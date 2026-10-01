"""VyapaarAI Intelligence Engines — pure Python + SQL analytics. No LLM calls."""

import logging
import math
import statistics
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Expense, InventoryItem, Product, Receivable, Sale

logger = logging.getLogger("vyapaarai.intelligence")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def clamp(x: float, lo: float, hi: float) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        v = lo
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def fmt_inr(x) -> str:
    try:
        v = float(x)
    except (TypeError, ValueError):
        v = 0.0
    return f"\u20b9{int(round(v)):,}"


def _fmt_short(x) -> str:
    """Compact money: \u20b94.1L / \u20b98.5k / \u20b9850 style for breakdowns."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        v = 0.0
    av = abs(v)
    sign = "-" if v < 0 else ""
    if av >= 100000:
        return f"{sign}\u20b9{av / 100000:.1f}L"
    if av >= 1000:
        return f"{sign}\u20b9{av / 1000:.1f}k"
    return f"{sign}\u20b9{int(round(av)):,}"


def windows(today: Optional[date] = None) -> Tuple[date, date, date, date]:
    """Return (cur_start, cur_end, prev_start, prev_end). Inclusive both ends."""
    t = today or date.today()
    cur_end = t
    cur_start = t - timedelta(days=29)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=29)
    return cur_start, cur_end, prev_start, prev_end


def _oid(owner_id) -> int:
    """Owner id normalize (default 1). Har scoped query isi se filter karti hai."""
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def owner_has_data(db: Session, owner_id: int = 1) -> bool:
    """P22 honesty: True if the owner has ANY business row. Never raises."""
    try:
        oid = _oid(owner_id)
        for model in (Sale, Product, Receivable, InventoryItem, Expense):
            try:
                if db.query(model.id).filter(model.owner_id == oid).first() is not None:
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def revenue_between(db: Session, start: date, end: date, owner_id: int = 1) -> float:
    try:
        oid = _oid(owner_id)
        v = db.query(func.sum(Sale.amount)).filter(
            Sale.owner_id == oid, Sale.date >= start, Sale.date <= end
        ).scalar()
    except Exception:
        return 0.0
    return float(v) if v is not None else 0.0


def cogs_between(db: Session, start: date, end: date, owner_id: int = 1) -> float:
    try:
        oid = _oid(owner_id)
        v = (
            db.query(func.sum(Sale.qty * Product.purchase_price))
            .join(Product, Sale.product_id == Product.id)
            .filter(Sale.owner_id == oid, Product.owner_id == oid,
                    Sale.date >= start, Sale.date <= end)
            .scalar()
        )
    except Exception:
        return 0.0
    return float(v) if v is not None else 0.0


def operating_expenses_between(db: Session, start: date, end: date, owner_id: int = 1) -> float:
    try:
        oid = _oid(owner_id)
        v = (
            db.query(func.sum(Expense.amount))
            .filter(
                Expense.owner_id == oid,
                Expense.date >= start,
                Expense.date <= end,
                Expense.category != "Purchases",
            )
            .scalar()
        )
    except Exception:
        return 0.0
    return float(v) if v is not None else 0.0


def purchases_between(db: Session, start: date, end: date, owner_id: int = 1) -> float:
    try:
        oid = _oid(owner_id)
        v = (
            db.query(func.sum(Expense.amount))
            .filter(
                Expense.owner_id == oid,
                Expense.date >= start,
                Expense.date <= end,
                Expense.category == "Purchases",
            )
            .scalar()
        )
    except Exception:
        return 0.0
    return float(v) if v is not None else 0.0


def gross_margin_between(db: Session, start: date, end: date, owner_id: int = 1) -> float:
    rev = revenue_between(db, start, end, owner_id)
    if rev <= 0:
        return 0.0
    cogs = cogs_between(db, start, end, owner_id)
    try:
        return (rev - cogs) / rev
    except ZeroDivisionError:
        return 0.0


def _overdue_stats(db: Session, today: Optional[date] = None, owner_id: int = 1):
    t = today or date.today()
    oid = _oid(owner_id)
    try:
        outstanding = (
            db.query(func.sum(Receivable.amount))
            .filter(Receivable.owner_id == oid, Receivable.paid.is_(False))
            .scalar()
        )
    except Exception:
        outstanding = None
    try:
        overdue_amount = (
            db.query(func.sum(Receivable.amount))
            .filter(Receivable.owner_id == oid, Receivable.paid.is_(False), Receivable.due_date < t)
            .scalar()
        )
    except Exception:
        overdue_amount = None
    try:
        overdue_count = (
            db.query(func.count(Receivable.id))
            .filter(Receivable.owner_id == oid, Receivable.paid.is_(False), Receivable.due_date < t)
            .scalar()
        )
    except Exception:
        overdue_count = 0
    outstanding_f = float(outstanding) if outstanding is not None else 0.0
    overdue_f = float(overdue_amount) if overdue_amount is not None else 0.0
    overdue_c = int(overdue_count) if overdue_count is not None else 0
    return outstanding_f, overdue_f, overdue_c


# ---------------------------------------------------------------------------
# ENGINE 1: Business health score
# ---------------------------------------------------------------------------

def health_score(db: Session, today: Optional[date] = None, owner_id: int = 1) -> dict:
    t = today or date.today()
    oid = _oid(owner_id)
    cur_start, cur_end, prev_start, prev_end = windows(t)

    rev_cur = revenue_between(db, cur_start, cur_end, oid)
    rev_prev = revenue_between(db, prev_start, prev_end, oid)

    growth = (rev_cur - rev_prev) / max(rev_prev, 1)
    sales_score = int(round(clamp(50 + growth * 150, 5, 100)))

    # inventory
    try:
        total_skus = db.query(func.count(Product.id)).filter(Product.owner_id == oid).scalar() or 0
    except Exception:
        total_skus = 0
    total_skus = int(total_skus)
    if total_skus <= 0:
        below_pct = 0.0
        dead_pct = 0.0
        below_count = 0
        dead_count = 0
    else:
        try:
            below_count = (
                db.query(func.count(InventoryItem.id))
                .filter(InventoryItem.owner_id == oid,
                        InventoryItem.stock_qty < InventoryItem.reorder_level)
                .scalar()
                or 0
            )
        except Exception:
            below_count = 0
        below_count = int(below_count)
        below_pct = below_count / total_skus if total_skus else 0.0
        # dead: stock>0 and zero sales in last 45 days
        cutoff = t - timedelta(days=44)
        try:
            sold_ids = {
                r[0]
                for r in db.query(Sale.product_id)
                .filter(Sale.owner_id == oid, Sale.date >= cutoff, Sale.date <= t)
                .distinct()
                .all()
            }
        except Exception:
            sold_ids = set()
        try:
            inv_rows = db.query(InventoryItem.product_id, InventoryItem.stock_qty).filter(
                InventoryItem.owner_id == oid).all()
        except Exception:
            inv_rows = []
        dead_count = sum(
            1 for pid, sq in inv_rows if (sq or 0) > 0 and pid not in sold_ids
        )
        dead_pct = dead_count / total_skus if total_skus else 0.0
    inventory_score = int(round(clamp(100 - below_pct * 60 - dead_pct * 40, 0, 100)))

    # receivables
    outstanding, overdue_amount, overdue_count = _overdue_stats(db, t, oid)
    overdue_value_pct = overdue_amount / max(outstanding, 1) if outstanding > 0 else 0.0
    receivables_score = int(
        round(clamp(100 - overdue_value_pct * 80 - min(overdue_count * 4, 20), 0, 100))
    )

    # profitability
    margin_cur = gross_margin_between(db, cur_start, cur_end, oid)
    margin_prev = gross_margin_between(db, prev_start, prev_end, oid)
    profitability_score = int(
        round(
            clamp(
                50 + (margin_cur - margin_prev) * 250 + (margin_cur - 0.15) * 100,
                5,
                100,
            )
        )
    )

    overall = int(round(0.25 * sales_score + 0.25 * inventory_score + 0.25 * receivables_score + 0.25 * profitability_score))
    overall = int(clamp(overall, 0, 100))

    if overall >= 80:
        grade = "Excellent"
    elif overall >= 65:
        grade = "Good"
    elif overall >= 50:
        grade = "Needs Attention"
    else:
        grade = "At Risk"

    growth_pct = growth * 100
    rev_cur_s = _fmt_short(rev_cur)
    rev_prev_s = _fmt_short(rev_prev)

    subscores = [
        {
            "name": "Sales",
            "score": sales_score,
            "weight": 0.25,
            "breakdown": (
                f"Revenue {rev_cur_s} vs {rev_prev_s} last month "
                f"({growth_pct:+.1f}%) over 30d windows"
            ),
        },
        {
            "name": "Inventory",
            "score": inventory_score,
            "weight": 0.25,
            "breakdown": (
                f"{below_count} SKUs below reorder ({below_pct:.0%}), "
                f"{dead_count} dead-stock of {total_skus} SKUs"
            ),
        },
        {
            "name": "Receivables",
            "score": receivables_score,
            "weight": 0.25,
            "breakdown": (
                f"{fmt_inr(overdue_amount)} overdue across {overdue_count} invoices "
                f"of {fmt_inr(outstanding)} outstanding"
            ),
        },
        {
            "name": "Profitability",
            "score": profitability_score,
            "weight": 0.25,
            "breakdown": (
                f"Gross margin {margin_cur:.1%} vs {margin_prev:.1%} last month "
                f"({(margin_cur - margin_prev) * 100:+.1f}pp shift)"
            ),
        },
    ]

    weakest = min(subscores, key=lambda s: s["score"])
    headline = (
        f"{weakest['name']} is the weakest link "
        f"(score {weakest['score']}/100) — {weakest['breakdown']}."
    )

    # P22 honesty: no rows -> scores are null (breakdown zeros stay).
    has_data = owner_has_data(db, oid)
    if not has_data:
        headline = "No entries yet — your score builds from your first sale, stock, or payment."
        for s in subscores:
            s["score"] = None
        return {
            "overall": None,
            "grade": None,
            "has_data": False,
            "subscores": subscores,
            "headline": headline,
        }

    return {
        "overall": overall,
        "grade": grade,
        "has_data": True,
        "subscores": subscores,
        "headline": headline,
    }


# ---------------------------------------------------------------------------
# Festival calendar (editable): forecast days inside a window get a demand spike.
# ---------------------------------------------------------------------------

FESTIVALS = [
    {"name": "Diwali", "start": date(2026, 11, 4), "end": date(2026, 11, 12), "multiplier": 1.6},
    {"name": "Holi", "start": date(2027, 3, 18), "end": date(2027, 3, 24), "multiplier": 1.4},
    {"name": "Eid", "start": date(2027, 2, 8), "end": date(2027, 2, 12), "multiplier": 1.3},
    {"name": "Rakhi", "start": date(2027, 8, 17), "end": date(2027, 8, 19), "multiplier": 1.3},
]


def festival_on(day: date) -> Optional[dict]:
    """Festival whose window contains `day`, else None. Never raises."""
    try:
        for f in FESTIVALS:
            if f["start"] <= day <= f["end"]:
                return f
    except Exception:
        pass
    return None


def festivals_in(start_day: date, end_day: date) -> List[dict]:
    """JSON-safe festivals overlapping [start_day, end_day]. Never raises."""
    out: List[dict] = []
    try:
        for f in FESTIVALS:
            try:
                if f["end"] >= start_day and f["start"] <= end_day:
                    out.append({
                        "name": str(f["name"]),
                        "start": f["start"].isoformat(),
                        "end": f["end"].isoformat(),
                        "multiplier": float(f["multiplier"]),
                    })
            except Exception:
                continue
    except Exception:
        pass
    return out


# ---------------------------------------------------------------------------
# ENGINE 2: Demand forecast
# ---------------------------------------------------------------------------

def forecast_product(db: Session, sku: str, days: int = 14, today: Optional[date] = None,
                     owner_id: int = 1) -> dict:
    t = today or date.today()
    oid = _oid(owner_id)
    if not sku or not str(sku).strip():
        raise ValueError("Unknown SKU")
    code = str(sku).strip()
    try:
        product = (
            db.query(Product)
            .filter(Product.owner_id == oid, func.lower(Product.sku) == code.lower())
            .first()
        )
    except Exception:
        product = None
    if product is None:
        raise ValueError(f"Unknown SKU: {sku}")

    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 14
    days = max(1, min(days, 60))

    start = t - timedelta(days=27)
    try:
        rows = (
            db.query(Sale.date, func.sum(Sale.qty))
            .filter(
                Sale.owner_id == oid,
                Sale.product_id == product.id,
                Sale.date >= start,
                Sale.date <= t,
            )
            .group_by(Sale.date)
            .all()
        )
        qty_by_date = {r[0]: float(r[1]) if r[1] is not None else 0.0 for r in rows}
    except Exception:
        qty_by_date = {}

    history: List[Dict] = []
    for i in range(27, -1, -1):
        d = t - timedelta(days=i)
        q = float(qty_by_date.get(d, 0.0) or 0.0)
        history.append({"date": d.isoformat(), "qty": q})

    total_qty = sum(h["qty"] for h in history)
    avg_daily = total_qty / 28 if history else 0.0

    # weekday index
    weekday_index: Dict[int, float] = {}
    for wd in range(7):
        vals = [
            h["qty"]
            for h in history
            if date.fromisoformat(h["date"]).weekday() == wd
        ]
        if not vals or avg_daily <= 0:
            weekday_index[wd] = 1.0
        else:
            mean_wd = sum(vals) / len(vals)
            try:
                weekday_index[wd] = mean_wd / avg_daily
            except ZeroDivisionError:
                weekday_index[wd] = 1.0

    forecast: List[Dict] = []
    for i in range(1, days + 1):
        fd = t + timedelta(days=i)
        idx = weekday_index.get(fd.weekday(), 1.0)
        try:
            q = float(avg_daily) * float(idx)
        except (TypeError, ValueError):
            q = 0.0
        fest = festival_on(fd)
        fest_name = None
        if fest is not None:
            try:
                q = float(q) * float(fest.get("multiplier", 1.0))
                fest_name = str(fest.get("name", ""))
            except (TypeError, ValueError):
                pass
        forecast.append({"date": fd.isoformat(), "qty": round(q, 1),
                         "festival": fest_name})

    try:
        inv = (
            db.query(InventoryItem)
            .filter(InventoryItem.owner_id == oid, InventoryItem.product_id == product.id)
            .first()
        )
    except Exception:
        inv = None
    stock_qty = float(inv.stock_qty) if inv and inv.stock_qty is not None else 0.0
    reorder_level = float(inv.reorder_level) if inv and inv.reorder_level is not None else 0.0

    if avg_daily and avg_daily > 0:
        try:
            stockout_days = round(stock_qty / avg_daily, 1)
        except ZeroDivisionError:
            stockout_days = None
    else:
        stockout_days = None

    if stockout_days is None:
        risk = "OK"
    elif stockout_days < 5:
        risk = "CRITICAL"
    elif stockout_days < 10:
        risk = "HIGH"
    elif stockout_days < 21:
        risk = "MEDIUM"
    else:
        risk = "OK"

    return {
        "sku": product.sku,
        "name": product.name,
        "stock_qty": stock_qty,
        "reorder_level": reorder_level,
        "avg_daily": round(float(avg_daily), 2),
        "stockout_days": stockout_days,
        "risk": risk,
        "history": history,
        "forecast": forecast,
        "festivals": festivals_in(t + timedelta(days=1), t + timedelta(days=days)),
    }


# ---------------------------------------------------------------------------
# ENGINE 3: Root cause
# ---------------------------------------------------------------------------

def _high_margin_shares(db: Session, cur_start, cur_end, prev_start, prev_end,
                        owner_id: int = 1) -> Tuple[float, float, float]:
    """Return (share_cur, share_prev, median_margin_pct)."""
    oid = _oid(owner_id)
    try:
        products = db.query(Product).filter(Product.owner_id == oid).all()
    except Exception:
        products = []
    margins: List[float] = []
    prod_margin: Dict[int, float] = {}
    for p in products:
        try:
            sp = float(p.sale_price or 0)
        except (TypeError, ValueError):
            sp = 0.0
        try:
            pp = float(p.purchase_price or 0)
        except (TypeError, ValueError):
            pp = 0.0
        if sp and sp != 0:
            m = (sp - pp) / sp * 100
        else:
            m = 0.0
        prod_margin[p.id] = m
        margins.append(m)
    if not margins:
        return 0.0, 0.0, 0.0
    try:
        med = float(statistics.median(margins))
    except Exception:
        med = 0.0
    high_ids = {pid for pid, m in prod_margin.items() if m >= med}
    rev_cur = revenue_between(db, cur_start, cur_end, oid)
    rev_prev = revenue_between(db, prev_start, prev_end, oid)
    if not high_ids:
        return 0.0, 0.0, med
    try:
        hi_cur = (
            db.query(func.sum(Sale.amount))
            .filter(
                Sale.owner_id == oid,
                Sale.date >= cur_start,
                Sale.date <= cur_end,
                Sale.product_id.in_(high_ids),
            )
            .scalar()
        )
    except Exception:
        hi_cur = None
    try:
        hi_prev = (
            db.query(func.sum(Sale.amount))
            .filter(
                Sale.owner_id == oid,
                Sale.date >= prev_start,
                Sale.date <= prev_end,
                Sale.product_id.in_(high_ids),
            )
            .scalar()
        )
    except Exception:
        hi_prev = None
    hi_cur_f = float(hi_cur) if hi_cur is not None else 0.0
    hi_prev_f = float(hi_prev) if hi_prev is not None else 0.0
    share_cur = hi_cur_f / rev_cur if rev_cur > 0 else 0.0
    share_prev = hi_prev_f / rev_prev if rev_prev > 0 else 0.0
    return share_cur, share_prev, med


def root_cause(db: Session, today: Optional[date] = None, owner_id: int = 1) -> dict:
    t = today or date.today()
    oid = _oid(owner_id)
    cur_start, cur_end, prev_start, prev_end = windows(t)

    rev_cur = revenue_between(db, cur_start, cur_end, oid)
    rev_prev = revenue_between(db, prev_start, prev_end, oid)
    cogs_cur = cogs_between(db, cur_start, cur_end, oid)
    cogs_prev = cogs_between(db, prev_start, prev_end, oid)
    opex_cur = operating_expenses_between(db, cur_start, cur_end, oid)
    opex_prev = operating_expenses_between(db, prev_start, prev_end, oid)
    purch_cur = purchases_between(db, cur_start, cur_end, oid)
    purch_prev = purchases_between(db, prev_start, prev_end, oid)

    profit_cur = rev_cur - cogs_cur - opex_cur
    profit_prev = rev_prev - cogs_prev - opex_prev

    denom = abs(profit_prev) if abs(profit_prev) > 0 else 1.0
    try:
        change_pct = (profit_cur - profit_prev) / denom * 100
    except ZeroDivisionError:
        change_pct = 0.0

    share_cur, share_prev, _med = _high_margin_shares(
        db, cur_start, cur_end, prev_start, prev_end, oid
    )

    rev_denom = max(rev_prev, 1)
    try:
        rev_pct = (rev_cur - rev_prev) / rev_denom * 100
    except ZeroDivisionError:
        rev_pct = 0.0
    purch_denom = max(abs(purch_prev), 1)
    try:
        purch_pct = (purch_cur - purch_prev) / purch_denom * 100
    except ZeroDivisionError:
        purch_pct = 0.0

    outstanding, overdue_amount, overdue_count = _overdue_stats(db, t, oid)

    rev_dir = "down" if rev_cur < rev_prev else ("up" if rev_cur > rev_prev else "flat")
    purch_dir = "up" if purch_cur > purch_prev else ("down" if purch_cur < purch_prev else "flat")
    mix_dir = "down" if share_cur < share_prev else ("up" if share_cur > share_prev else "flat")

    factors = [
        {
            "factor": "Revenue change",
            "direction": rev_dir,
            "impact": round(rev_cur - rev_prev, 2),
            "detail": (
                f"Revenue {_fmt_short(rev_cur)} vs {_fmt_short(rev_prev)} "
                f"({rev_pct:+.1f}%)"
            ),
        },
        {
            "factor": "Purchase cost pressure",
            "direction": purch_dir,
            "impact": round(purch_cur - purch_prev, 2),
            "detail": (
                f"Purchases {_fmt_short(purch_cur)} vs {_fmt_short(purch_prev)} "
                f"({purch_pct:+.1f}%)"
            ),
        },
        {
            "factor": "High-margin sales mix",
            "direction": mix_dir,
            "impact": round((share_cur - share_prev) * 100, 1),
            "detail": (
                f"{share_prev * 100:.0f}% \u2192 {share_cur * 100:.0f}% of revenue "
                f"from high-margin products"
            ),
        },
        {
            "factor": "Receivables blockage",
            "direction": "blocked" if overdue_count > 0 else "clear",
            "impact": round(overdue_amount, 2),
            "detail": (
                f"Receivables blockage: {fmt_inr(overdue_amount)} overdue "
                f"across {overdue_count} invoices "
                f"(outstanding {fmt_inr(outstanding)})"
            ),
        },
    ]

    narrative = (
        f"Operating profit {fmt_inr(profit_cur)} vs {fmt_inr(profit_prev)} "
        f"last month ({change_pct:+.1f}%). "
        f"Main drivers: (1) {factors[0]['detail']}; "
        f"(2) {factors[1]['detail']}; "
        f"(3) {factors[2]['detail']}."
    )

    return {
        "profit_cur": round(float(profit_cur), 2),
        "profit_prev": round(float(profit_prev), 2),
        "change_pct": round(float(change_pct), 1),
        "factors": factors,
        "narrative": narrative,
    }


# ---------------------------------------------------------------------------
# ENGINE 4: Anomaly detection
# ---------------------------------------------------------------------------

def anomalies(db: Session, today: Optional[date] = None, owner_id: int = 1) -> List[dict]:
    t = today or date.today()
    oid = _oid(owner_id)
    out: List[dict] = []
    cur_start, cur_end, prev_start, prev_end = windows(t)

    # daily revenue last 30d
    try:
        rows = (
            db.query(Sale.date, func.sum(Sale.amount))
            .filter(Sale.owner_id == oid, Sale.date >= cur_start, Sale.date <= cur_end)
            .group_by(Sale.date)
            .all()
        )
        rev_by_date = {r[0]: float(r[1]) if r[1] is not None else 0.0 for r in rows}
    except Exception:
        rev_by_date = {}
    daily: List[Tuple[date, float]] = []
    d = cur_start
    while d <= cur_end:
        daily.append((d, float(rev_by_date.get(d, 0.0) or 0.0)))
        d += timedelta(days=1)
    if daily:
        vals = [v for _, v in daily]
        n = len(vals)
        try:
            mean = sum(vals) / n if n else 0.0
        except ZeroDivisionError:
            mean = 0.0
        try:
            var = sum((v - mean) ** 2 for v in vals) / n if n else 0.0
            std = math.sqrt(var) if var > 0 else 0.0
        except (ValueError, ZeroDivisionError):
            std = 0.0
        if std and std > 0:
            for dd, v in daily:
                try:
                    z = (v - mean) / std
                except ZeroDivisionError:
                    continue
                if abs(z) > 2:
                    kind = "Revenue spike" if v > mean else "Revenue drop"
                    out.append(
                        {
                            "type": kind,
                            "severity": "high",
                            "message": (
                                f"{kind} on {dd.isoformat()}: {fmt_inr(v)} "
                                f"(z={z:+.1f}, avg {fmt_inr(mean)})"
                            ),
                            "date": dd.isoformat(),
                        }
                    )

    # margin erosion
    try:
        margin_cur = gross_margin_between(db, cur_start, cur_end, oid)
        margin_prev = gross_margin_between(db, prev_start, prev_end, oid)
        if (margin_prev - margin_cur) > 0.05:
            drop_pp = (margin_prev - margin_cur) * 100
            out.append(
                {
                    "type": "Margin erosion",
                    "severity": "high",
                    "message": (
                        f"Gross margin {margin_prev:.1%} \u2192 {margin_cur:.1%} "
                        f"(drop {drop_pp:.1f}pp MoM)"
                    ),
                }
            )
    except Exception:
        pass

    # receivables pressure
    try:
        _outstanding, overdue_amount, overdue_count = _overdue_stats(db, t, oid)
        if overdue_count >= 3:
            out.append(
                {
                    "type": "Receivables pressure",
                    "severity": "medium",
                    "message": (
                        f"Receivables pressure: {fmt_inr(overdue_amount)} "
                        f"across {overdue_count} invoices overdue"
                    ),
                }
            )
    except Exception:
        pass

    return out


# ---------------------------------------------------------------------------
# ENGINE 5: Buy/Sell matrix
# ---------------------------------------------------------------------------

def buy_sell_matrix(db: Session, today: Optional[date] = None, owner_id: int = 1) -> dict:
    t = today or date.today()
    oid = _oid(owner_id)
    cur_start, cur_end, _, _ = windows(t)
    try:
        products = db.query(Product).filter(Product.owner_id == oid).order_by(Product.name).all()
    except Exception:
        products = []

    qty_map: Dict[int, float] = {}
    rev_map: Dict[int, float] = {}
    if products:
        try:
            rows = (
                db.query(
                    Sale.product_id,
                    func.sum(Sale.qty),
                    func.sum(Sale.amount),
                )
                .filter(Sale.owner_id == oid, Sale.date >= cur_start, Sale.date <= cur_end)
                .group_by(Sale.product_id)
                .all()
            )
            for pid, q, r in rows:
                qty_map[pid] = float(q) if q is not None else 0.0
                rev_map[pid] = float(r) if r is not None else 0.0
        except Exception:
            pass

    items: List[dict] = []
    vels: List[float] = []
    margins: List[float] = []
    for p in products:
        q = float(qty_map.get(p.id, 0.0) or 0.0)
        r = float(rev_map.get(p.id, 0.0) or 0.0)
        velocity = q / 30 if q else 0.0
        try:
            sp = float(p.sale_price or 0)
        except (TypeError, ValueError):
            sp = 0.0
        try:
            pp = float(p.purchase_price or 0)
        except (TypeError, ValueError):
            pp = 0.0
        if sp and sp != 0:
            try:
                margin_pct = (sp - pp) / sp * 100
            except ZeroDivisionError:
                margin_pct = 0.0
        else:
            margin_pct = 0.0
        vels.append(velocity)
        margins.append(margin_pct)
        items.append(
            {
                "sku": p.sku,
                "name": p.name,
                "velocity_30": round(velocity, 2),
                "revenue_30": round(r, 2),
                "margin_pct": round(margin_pct, 1),
                "_v": velocity,
                "_m": margin_pct,
            }
        )

    if vels:
        try:
            median_velocity = float(statistics.median(vels))
        except Exception:
            median_velocity = 0.0
    else:
        median_velocity = 0.0
    if margins:
        try:
            median_margin = float(statistics.median(margins))
        except Exception:
            median_margin = 0.0
    else:
        median_margin = 0.0

    products_out: List[dict] = []
    counts = {"STAR": 0, "VOLUME": 0, "HIDDEN_GEM": 0, "EXIT": 0}
    for it in items:
        high_v = it["_v"] >= median_velocity
        high_m = it["_m"] >= median_margin
        if high_v and high_m:
            quad = "STAR"
            action = "Push: priority display & promotion"
        elif high_v and not high_m:
            quad = "VOLUME"
            action = "Negotiate cost or raise price 5-10%"
        elif not high_v and high_m:
            quad = "HIDDEN_GEM"
            action = "Promote/bundle to move volume"
        else:
            quad = "EXIT"
            action = "Clearance offer; stop reordering"
        counts[quad] = counts.get(quad, 0) + 1
        products_out.append(
            {
                "sku": it["sku"],
                "name": it["name"],
                "velocity_30": it["velocity_30"],
                "revenue_30": it["revenue_30"],
                "margin_pct": it["margin_pct"],
                "quadrant": quad,
                "action": action,
            }
        )

    # ensure all 4 keys present
    for k in ("STAR", "VOLUME", "HIDDEN_GEM", "EXIT"):
        counts.setdefault(k, 0)

    return {
        "median_velocity": round(median_velocity, 2),
        "median_margin": round(median_margin, 1),
        "products": products_out,
        "quadrant_counts": counts,
    }


# ---------------------------------------------------------------------------
# ENGINE 6: Morning brief builder
# ---------------------------------------------------------------------------

def _avg_daily_28(db: Session, product_id: int, t: date, owner_id: int = 1) -> float:
    start = t - timedelta(days=27)
    oid = _oid(owner_id)
    try:
        v = (
            db.query(func.sum(Sale.qty))
            .filter(
                Sale.owner_id == oid,
                Sale.product_id == product_id,
                Sale.date >= start,
                Sale.date <= t,
            )
            .scalar()
        )
    except Exception:
        return 0.0
    total = float(v) if v is not None else 0.0
    return total / 28 if total else 0.0


def build_brief(db: Session, today: Optional[date] = None, owner_id: int = 1) -> List[dict]:
    t = today or date.today()
    oid = _oid(owner_id)
    brief: List[dict] = []

    # 1. overdue
    outstanding, overdue_amount, overdue_count = _overdue_stats(db, t, oid)
    if overdue_count > 0:
        brief.append(
            {
                "icon": "\U0001f4b0",
                "title": f"{fmt_inr(overdue_amount)} payment atka hai",
                "detail": (
                    f"{fmt_inr(overdue_amount)} payment atka hai "
                    f"{overdue_count} invoices mein "
                    f"(outstanding {fmt_inr(outstanding)})"
                ),
                "severity": "high",
            }
        )
    else:
        brief.append(
            {
                "icon": "\U0001f4b0",
                "title": "No overdue payments",
                "detail": "All receivables clear — koi payment atka nahi hai",
                "severity": "low",
            }
        )

    # 2. nearest stockout
    try:
        products = db.query(Product).filter(Product.owner_id == oid).all()
    except Exception:
        products = []
    inv_map: Dict[int, InventoryItem] = {}
    try:
        for inv in db.query(InventoryItem).filter(InventoryItem.owner_id == oid).all():
            inv_map[inv.product_id] = inv
    except Exception:
        pass
    best = None
    best_days = None
    for p in products:
        inv = inv_map.get(p.id)
        stock = float(inv.stock_qty) if inv and inv.stock_qty is not None else 0.0
        avg = _avg_daily_28(db, p.id, t, oid)
        if avg and avg > 0:
            try:
                sd = stock / avg
            except ZeroDivisionError:
                continue
            if best_days is None or sd < best_days:
                best_days = sd
                best = (p, stock, avg, sd)
    if best is not None:
        p, stock, avg, sd = best
        sev = "high" if sd < 10 else "medium"
        brief.append(
            {
                "icon": "\U0001f4e6",
                "title": f"{p.name} — stock low",
                "detail": (
                    f"{p.name} sirf ~{sd:.0f} din ka stock bacha "
                    f"(stock {stock:.0f}, avg {avg:.1f}/day)"
                ),
                "severity": sev,
            }
        )
    else:
        brief.append(
            {
                "icon": "\U0001f4e6",
                "title": "Stock healthy",
                "detail": "Sabhi products mein paryaapt stock hai",
                "severity": "low",
            }
        )

    # 3. profit trend
    cur_start, cur_end, prev_start, prev_end = windows(t)
    rev_cur = revenue_between(db, cur_start, cur_end, oid)
    rev_prev = revenue_between(db, prev_start, prev_end, oid)
    cogs_cur = cogs_between(db, cur_start, cur_end, oid)
    cogs_prev = cogs_between(db, prev_start, prev_end, oid)
    opex_cur = operating_expenses_between(db, cur_start, cur_end, oid)
    opex_prev = operating_expenses_between(db, prev_start, prev_end, oid)
    profit_cur = rev_cur - cogs_cur - opex_cur
    profit_prev = rev_prev - cogs_prev - opex_prev
    denom = abs(profit_prev) if abs(profit_prev) > 0 else 1.0
    try:
        pct = (profit_cur - profit_prev) / denom * 100
    except ZeroDivisionError:
        pct = 0.0
    down = profit_cur < profit_prev
    verb = "gira" if down else ("badha" if profit_cur > profit_prev else "stable")
    icon = "\U0001f4c9" if down else "\U0001f4c8"
    sev3 = "high" if down and pct < -5 else ("medium" if down else "low")
    brief.append(
        {
            "icon": icon,
            "title": f"Profit {abs(pct):.1f}% {verb} vs last month",
            "detail": (
                f"Profit {pct:+.1f}% {verb} vs last month "
                f"({fmt_inr(profit_cur)} vs {fmt_inr(profit_prev)})"
            ),
            "severity": sev3,
        }
    )

    return brief[:3]
