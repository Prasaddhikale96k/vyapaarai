"""Business Credit Score (bank-ready). Pure Python + SQL. Never raises."""

import logging
import math
from datetime import date, timedelta
from typing import Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Receivable, Sale
from app.services import intelligence as eng

logger = logging.getLogger("vyapaarai.credit")


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def _biz_name(db: Session, oid: int) -> str:
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        biz = str(getattr(prof, "business_name", "") or "").strip()
        if biz:
            return biz
    except Exception:
        pass
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip() or "Sharma Kirana Traders"
    except Exception:
        return "Sharma Kirana Traders"


def credit_score(db: Session, owner_id: int = 1) -> dict:
    t = date.today()
    oid = _oid(owner_id)
    biz = _biz_name(db, oid)

    # ---- receivables discipline (40%) ----
    try:
        outstanding = db.query(func.sum(Receivable.amount)).filter(
            Receivable.owner_id == oid, Receivable.paid.is_(False)).scalar()
        overdue_amount = db.query(func.sum(Receivable.amount)).filter(
            Receivable.owner_id == oid, Receivable.paid.is_(False),
            Receivable.due_date < t).scalar()
        overdue_rows = db.query(Receivable.due_date).filter(
            Receivable.owner_id == oid, Receivable.paid.is_(False),
            Receivable.due_date < t).all()
    except Exception:
        outstanding, overdue_amount, overdue_rows = None, None, []
    out_f = float(outstanding) if outstanding is not None else 0.0
    od_f = float(overdue_amount) if overdue_amount is not None else 0.0
    od_n = len(overdue_rows)
    pct = (od_f / out_f) if out_f > 0 else 0.0
    try:
        avg_late = (sum((t - r[0]).days for r in overdue_rows) / od_n) if od_n else 0.0
    except Exception:
        avg_late = 0.0
    discipline = eng.clamp(100 - pct * 70 - min(avg_late * 2, 30), 0, 100)

    # ---- sales stability (30%): cv of daily revenue, last 60d ----
    try:
        start60 = t - timedelta(days=59)
        rows = (
            db.query(Sale.date, func.sum(Sale.amount))
            .filter(Sale.owner_id == oid, Sale.date >= start60, Sale.date <= t)
            .group_by(Sale.date)
            .all()
        )
        by_date = {r[0]: float(r[1]) if r[1] is not None else 0.0 for r in rows}
        vals = [float(by_date.get(start60 + timedelta(days=i), 0.0) or 0.0) for i in range(60)]
        mean = sum(vals) / 60
        if mean > 0:
            var = sum((v - mean) ** 2 for v in vals) / 60
            cv = math.sqrt(var) / mean if var > 0 else 0.0
            stability = eng.clamp(100 - min(cv * 100, 100), 0, 100)
        else:
            cv, stability = 0.0, 0.0
    except Exception:
        cv, stability = 0.0, 0.0

    # ---- activity growth (20%): 30d revenue ratio ----
    try:
        cur_s, cur_e, prev_s, prev_e = eng.windows(t)
        rev_cur = eng.revenue_between(db, cur_s, cur_e, oid)
        rev_prev = eng.revenue_between(db, prev_s, prev_e, oid)
        g = (rev_cur - rev_prev) / max(rev_prev, 1)  # ratio, e.g. 0.12
        growth = eng.clamp(50 + g * 150, 0, 100)
        growth_pct = g * 100
    except Exception:
        growth, growth_pct, rev_cur, rev_prev = 50.0, 0.0, 0.0, 0.0

    # ---- margin health (10%) ----
    try:
        cur_s, cur_e, _, _ = eng.windows(t)
        margin = eng.gross_margin_between(db, cur_s, cur_e, oid)
        margin_score = eng.clamp(margin * 250, 0, 100)
    except Exception:
        margin, margin_score = 0.0, 0.0

    overall = int(round(eng.clamp(
        0.40 * discipline + 0.30 * stability + 0.20 * growth + 0.10 * margin_score,
        0, 100)))
    if overall >= 80:
        grade = "Loan-ready"
    elif overall >= 60:
        grade = "Improving"
    else:
        grade = "High-risk"

    parts = [
        ("Receivables discipline", discipline,
         f"{eng.fmt_inr(od_f)} overdue across {od_n} invoices of {eng.fmt_inr(out_f)} outstanding"),
        ("Sales stability", stability,
         f"daily revenue cv {cv:.2f} over last 60d"),
        ("Activity growth", growth,
         f"revenue {growth_pct:+.1f}% vs prev 30d"),
        ("Margin health", margin_score,
         f"gross margin {margin:.1%} last 30d"),
    ]
    parts_sorted = sorted(parts, key=lambda p: p[1])
    reasons = [f"{name} ({score:.0f}/100) — {detail}"
               for name, score, detail in parts_sorted[:2]]

    # ---- bank summary inputs ----
    try:
        span = db.query(func.min(Sale.date), func.max(Sale.date)).filter(
            Sale.owner_id == oid).first()
        months_set = {r[0].strftime("%Y-%m") for r in
                      db.query(Sale.date).filter(Sale.owner_id == oid).distinct().all()
                      if r[0] is not None}
        months = len(months_set)
        total_rev = db.query(func.sum(Sale.amount)).filter(
            Sale.owner_id == oid).scalar()
        total_rev_f = float(total_rev) if total_rev is not None else 0.0
        monthly_avg = total_rev_f / max(months, 1)
        _ = span
    except Exception:
        months, monthly_avg = 0, 0.0

    bank_summary = (
        f"{biz} — business credit summary.\n"
        f"{months} months of sales data; average monthly revenue {eng.fmt_inr(monthly_avg)}.\n"
        f"Overdue exposure {eng.fmt_inr(od_f)} across {od_n} invoices.\n"
        f"Credit score {overall}/100 ({grade}).\n"
        f"Generated by VyapaarAI on {t.isoformat()}."
    )

    subscores = [
        {"name": n, "score": round(float(s), 1), "weight": w, "breakdown": d}
        for (n, s, d), w in zip(parts, (0.40, 0.30, 0.20, 0.10))
    ]
    return {
        "overall": overall,
        "grade": grade,
        "subscores": subscores,
        "reasons": reasons,
        "bank_summary": bank_summary,
        "months_data": months,
        "monthly_revenue_avg": round(monthly_avg, 2),
        "overdue_total": round(od_f, 2),
        "overdue_count": od_n,
    }
