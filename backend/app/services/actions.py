"""Action Engine — recommendation generator (P3)."""

import json
import logging
import math
import os
from datetime import date
from typing import List

logger = logging.getLogger("vyapaarai.actions")


def _business_name() -> str:
    v = os.getenv("BUSINESS_NAME")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip() or "Sharma Kirana Traders"
    except Exception:
        return "Sharma Kirana Traders"


def serialize_action(a) -> dict:
    try:
        created = a.created_at.isoformat() if getattr(a, "created_at", None) else None
    except Exception:
        created = str(getattr(a, "created_at", None))
    return {
        "id": a.id,
        "type": a.type,
        "title": a.title,
        "detail": a.detail,
        "target_name": a.target_name,
        "target_phone": a.target_phone,
        "amount": a.amount,
        "draft_message": a.draft_message,
        "status": a.status,
        "created_at": created,
    }


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def _existing_markers(db, action_type: str, owner_id: int = 1) -> list:
    from app.models import Action

    try:
        rows = (
            db.query(Action)
            .filter(Action.owner_id == _oid(owner_id), Action.type == action_type,
                    Action.status.in_(["pending", "approved", "sent"]))
            .all()
        )
    except Exception:
        rows = []
    markers = []
    for r in rows:
        try:
            markers.append(str(r.detail or ""))
        except Exception:
            pass
    return markers


def _has_marker(existing_details: list, marker: str) -> bool:
    for d in existing_details:
        if marker in (d or ""):
            return True
    return False


def generate_recommendations(db, owner_id: int = 1) -> List[dict]:
    from app.models import Action, Customer, InventoryItem, Product, Receivable, Sale
    from app.services import intelligence as eng
    from datetime import timedelta

    oid = _oid(owner_id)
    biz = _business_name()
    today = date.today()
    created: list = []

    # Phase B: owner UPI VPA for deep-link collection (never crashes generation)
    try:
        from app.models import OwnerProfile

        _prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        _vpa = str(getattr(_prof, "upi_vpa", "") or "").strip()
        _bizname = str(getattr(_prof, "business_name", "") or "").strip() or biz
    except Exception:
        _vpa, _bizname = "", biz

    # ---- a) payment_reminder ----
    try:
        overdue = (
            db.query(Receivable, Customer)
            .join(Customer, Receivable.customer_id == Customer.id)
            .filter(Receivable.owner_id == oid, Customer.owner_id == oid,
                    Receivable.paid.is_(False), Receivable.due_date < today)
            .order_by(Receivable.due_date)
            .all()
        )
    except Exception as exc:
        logger.warning("payment_reminder query failed: %s", exc)
        overdue = []
    existing_pay = _existing_markers(db, "payment_reminder", oid)
    for rec, cust in overdue:
        try:
            marker = f"invoice:{rec.invoice_no or rec.id}"
            if _has_marker(existing_pay, marker):
                continue
            try:
                days = (today - rec.due_date).days if rec.due_date else 0
            except Exception:
                days = 0
            try:
                amt = float(rec.amount or 0)
            except Exception:
                amt = 0.0
            cname = cust.name if cust and cust.name else "Customer"
            draft = (
                f"Hi {cname} — gentle reminder: invoice {rec.invoice_no} for "
                f"₹{amt:,.0f} was due {days} days ago. Thank you! — {biz}"
            )
            if _vpa:
                # NPCI upi://pay deep link: pa+pn mandatory, am two decimals,
                # values percent-encoded (quote keeps @ readable in pa).
                try:
                    from urllib.parse import quote as _quote

                    inv = str(rec.invoice_no or "")
                    link = (
                        "upi://pay?pa=" + _quote(_vpa, safe="@-._~")
                        + "&pn=" + _quote(_bizname, safe="@-._~")
                        + "&am=" + f"{amt:.2f}"
                        + "&cu=INR"
                        + "&tn=" + _quote(inv, safe="@-._~")
                        + "&tr=" + _quote(inv, safe="@-._~")
                    )
                    draft += f"\n\n💳 Turant pay karne ke liye: {link}"
                except Exception:
                    pass
            title = f"Payment reminder: {cname} {rec.invoice_no}"
            detail = f"{marker} overdue {days}d amount {amt:,.0f} customer {cname}"
            sev = "high" if amt >= 10000 or days >= 7 else "medium"
            a = Action(
                type="payment_reminder",
                owner_id=oid,
                title=title[:128],
                detail=detail,
                target_name=cname,
                target_phone=cust.phone if cust else None,
                amount=amt,
                draft_message=draft,
                status="pending",
                meta=json.dumps({"severity": sev, "marker": marker, "days_overdue": days}),
            )
            db.add(a)
            existing_pay.append(detail)  # prevent dupes within same run
            created.append(a)
        except Exception as exc:
            logger.warning("payment_reminder row failed: %s", exc)
            continue

    # ---- b) reorder ----
    try:
        inv_rows = (
            db.query(InventoryItem, Product)
            .join(Product, InventoryItem.product_id == Product.id)
            .filter(InventoryItem.owner_id == oid, Product.owner_id == oid,
                    InventoryItem.stock_qty <= InventoryItem.reorder_level)
            .all()
        )
    except Exception as exc:
        logger.warning("reorder query failed: %s", exc)
        inv_rows = []
    existing_reorder = _existing_markers(db, "reorder", oid)
    for inv, prod in inv_rows:
        try:
            sku = prod.sku or str(prod.id)
            marker = f"sku:{sku}"
            if _has_marker(existing_reorder, marker):
                continue
            try:
                stock = float(inv.stock_qty or 0)
            except Exception:
                stock = 0.0
            try:
                rol = float(inv.reorder_level or 0)
            except Exception:
                rol = 0.0
            try:
                fc = eng.forecast_product(db, sku, 14, owner_id=oid)
                avg_daily = float(fc.get("avg_daily", 0) or 0)
                if avg_daily <= 0:
                    avg_daily = 1.0
            except Exception:
                avg_daily = 1.0
            try:
                suggested_qty = max(int(rol * 2 - stock), math.ceil(avg_daily * 7))
            except Exception:
                suggested_qty = max(int(rol * 2 - stock), 7)
            if suggested_qty < 1:
                suggested_qty = 1
            draft = (
                f"Internal: reorder {prod.name} ({sku}) — stock {stock:.0f} at/below "
                f"reorder {rol:.0f} (~{avg_daily:.1f}/day). Suggested qty {suggested_qty}."
            )
            title = f"Reorder {prod.name} ({sku})"[:128]
            detail = f"{marker} stock {stock:.0f} reorder {rol:.0f} suggested {suggested_qty}"
            a = Action(
                type="reorder",
                owner_id=oid,
                title=title,
                detail=detail,
                target_name=prod.name,
                target_phone=prod.supplier_phone,
                amount=None,
                draft_message=draft,
                status="pending",
                meta=json.dumps(
                    {"severity": "high", "marker": marker, "suggested_qty": suggested_qty,
                     "avg_daily": avg_daily}
                ),
            )
            db.add(a)
            existing_reorder.append(detail)
            created.append(a)
        except Exception as exc:
            logger.warning("reorder row failed: %s", exc)
            continue

    # ---- c) discount_offer ----
    try:
        cutoff = today - timedelta(days=44)
        try:
            sold_ids = {
                r[0] for r in db.query(Sale.product_id).filter(
                    Sale.owner_id == oid, Sale.date >= cutoff, Sale.date <= today).distinct().all()
            }
        except Exception:
            sold_ids = set()
        try:
            prods = db.query(Product).filter(Product.owner_id == oid).all()
        except Exception:
            prods = []
        try:
            inv_map = {r.product_id: r for r in db.query(InventoryItem).filter(
                InventoryItem.owner_id == oid).all()}
        except Exception:
            inv_map = {}
    except Exception as exc:
        logger.warning("discount query failed: %s", exc)
        prods, inv_map, sold_ids = [], {}, set()
    existing_disc = _existing_markers(db, "discount_offer", oid)
    for p in prods:
        try:
            inv = inv_map.get(p.id)
            stock = float(inv.stock_qty) if inv and inv.stock_qty is not None else 0.0
            if stock <= 0:
                continue
            if p.id in sold_ids:
                continue
            marker = f"sku:{p.sku}"
            if _has_marker(existing_disc, marker):
                continue
            draft = f"Clearance idea: {p.name} \u2014 10% off or bundle with fast mover."
            title = f"Clearance: {p.name}"[:128]
            detail = f"{marker} dead stock {stock:.0f} units, no sales 45d"
            a = Action(
                type="discount_offer",
                owner_id=oid,
                title=title,
                detail=detail,
                target_name=p.name,
                target_phone=None,
                amount=None,
                draft_message=draft,
                status="pending",
                meta=json.dumps({"severity": "medium", "marker": marker, "stock_qty": stock}),
            )
            db.add(a)
            existing_disc.append(detail)
            created.append(a)
        except Exception as exc:
            logger.warning("discount row failed: %s", exc)
            continue

    try:
        db.commit()
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning("generate commit failed: %s", exc)
        return []
    out = []
    for a in created:
        try:
            db.refresh(a)
        except Exception:
            pass
        out.append(serialize_action(a))
    return out
