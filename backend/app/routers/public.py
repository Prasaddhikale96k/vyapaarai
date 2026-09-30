"""P20 landing truth engine: live DB stats, no auth. Never raises.

GET /public/stats -> {overdue_total, low_stock_count, voice_entries,
health_now, business_name} computed from the live DB for the truth owner:
first onboarded owner, else OWNER_PHONE profile, else owner 1.
60s in-memory cache. Zeros are honest (landing renders zero-state lines).
"""
import logging
import time

from fastapi import APIRouter
from sqlalchemy import func

logger = logging.getLogger("vyapaarai.public")

router = APIRouter(tags=["public"])

_CACHE: dict = {}
_TTL = 60.0


def _truth_owner_id(db) -> int:
    """First onboarded owner -> OWNER_PHONE profile -> owner 1. Never raises."""
    try:
        from app.models import OwnerProfile

        prof = (db.query(OwnerProfile)
                .filter(OwnerProfile.onboarded.is_(True))
                .order_by(OwnerProfile.id.asc()).first())
        if prof is not None:
            return int(getattr(prof, "id", 1) or 1)
    except Exception:
        pass
    try:
        import os

        from app import config as _cfg
        from app.services.phone import normalize_phone as _digits

        raw = os.getenv("OWNER_PHONE", "") or str(getattr(_cfg, "OWNER_PHONE", "") or "")
        want = _digits(raw)
        if want:
            from app.models import OwnerProfile

            for p in db.query(OwnerProfile).all():
                try:
                    if _digits(getattr(p, "phone", "")) == want:
                        return int(getattr(p, "id", 1) or 1)
                except Exception:
                    continue
    except Exception:
        pass
    return 1


@router.get("/public/stats")
def public_stats():
    now = time.time()
    try:
        hit = _CACHE.get("stats")
        if hit is not None and hit[1] > now:
            return hit[0]
    except Exception:
        pass
    out = {"overdue_total": 0.0, "low_stock_count": 0, "voice_entries": 0,
           "health_now": 0, "business_name": ""}
    try:
        from datetime import date as _date

        from app.db import SessionLocal
        from app.models import InventoryItem, OwnerProfile, Receivable, VoiceLog

        db = SessionLocal()
        try:
            oid = _truth_owner_id(db)
            today = _date.today()
            try:
                od = db.query(func.sum(Receivable.amount)).filter(
                    Receivable.owner_id == oid, Receivable.paid.is_(False),
                    Receivable.due_date < today).scalar()
                out["overdue_total"] = round(float(od or 0), 2)
            except Exception:
                pass
            try:
                out["low_stock_count"] = int(db.query(InventoryItem).filter(
                    InventoryItem.owner_id == oid,
                    InventoryItem.stock_qty <= InventoryItem.reorder_level).count() or 0)
            except Exception:
                pass
            try:
                out["voice_entries"] = int(db.query(VoiceLog).filter(
                    VoiceLog.owner_id == oid).count() or 0)
            except Exception:
                pass
            try:
                from app.services import intelligence as eng

                out["health_now"] = int(eng.health_score(db, owner_id=oid).get("overall", 0) or 0)
            except Exception:
                pass
            try:
                prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
                out["business_name"] = str(getattr(prof, "business_name", "") or "").strip()
            except Exception:
                pass
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.info("public stats failed: %s", str(exc)[:150])
    try:
        _CACHE["stats"] = (out, now + _TTL)
    except Exception:
        pass
    return out
