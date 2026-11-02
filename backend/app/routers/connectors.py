"""Live connectors router: Sheets/Excel/Tally/Shopify/Zapier. JWT owner-scoped. Never raises."""

import json
import logging

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.routers.auth import get_current_owner, owner_id_of

logger = logging.getLogger("vyapaarai.connectors")

router = APIRouter(tags=["connectors"])


class ConnectorIn(BaseModel):
    type: str
    config: dict = {}


class IngestIn(BaseModel):
    source: str  # excel | tally | busy | marg
    rows: list = []


class V1SaleIn(BaseModel):
    date: str = ""
    product: str = ""
    qty: float | str | None = None
    unit_price: float | str | None = None
    customer: str = ""
    type: str = "sale"


class V1SalesIn(BaseModel):
    sales: list = []


def _owner_filter(db, owner_id: int):
    from app.models import Connector

    return db.query(Connector).filter(Connector.owner_id == int(owner_id or 1))


def _connector_by_key(db, raw_key: str):
    """Find connector by API key. Returns (connector | None). Never raises."""
    try:
        from app.models import Connector

        key = str(raw_key or "").strip()
        if not key:
            return None
        return db.query(Connector).filter(Connector.api_key == key).first()
    except Exception:
        return None


@router.get("/connectors")
def list_connectors(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector
    from app.services.connectors import serialize_connector

    rows = _owner_filter(db, owner_id_of(owner)).order_by(Connector.id).all()
    return [serialize_connector(c) for c in rows]


@router.post("/connectors")
def create_connector(req: ConnectorIn, db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector
    from app.services.connectors import CONNECTOR_TYPES, KEY_TYPES, new_api_key, serialize_connector

    ctype = str(req.type or "").strip().lower()
    if ctype not in CONNECTOR_TYPES:
        return {"ok": False, "error": f"type galat hai — chuno: {', '.join(sorted(CONNECTOR_TYPES))}"}
    try:
        cfg = json.dumps(req.config or {})
    except Exception:
        cfg = "{}"
    c = Connector(owner_id=owner_id_of(owner), type=ctype, config=cfg, status="offline")
    full_key = None
    if ctype in KEY_TYPES:
        try:
            full_key = new_api_key()
            c.api_key = full_key
        except Exception:
            pass
    try:
        db.add(c)
        db.commit()
        db.refresh(c)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        return {"ok": False, "error": f"connect nahi hua: {str(exc)[:150]}"}
    out = {"ok": True, "connector": serialize_connector(c)}
    if full_key:
        out["api_key"] = full_key
        out["note"] = "Ye key EK BAAR dikhegi — abhi copy karo (Zapier/Make me X-API-Key header me lagao)"
    return out


@router.post("/connectors/{connector_id}/regenerate-key")
def regenerate_key(connector_id: int, db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.services.connectors import KEY_TYPES, new_api_key, serialize_connector

    c = _owner_filter(db, owner_id_of(owner)).filter(Connector.id == int(connector_id)).first()
    if c is None:
        return {"ok": False, "error": "Connector nahi mila"}
    if str(getattr(c, "type", "") or "") not in KEY_TYPES:
        return {"ok": False, "error": "Is type me API key nahi hoti (zapier/custom_api/shopify/woocommerce me hoti hai)"}
    try:
        full_key = new_api_key()
        c.api_key = full_key
        db.commit()
        db.refresh(c)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        return {"ok": False, "error": f"key nahi bani: {str(exc)[:150]}"}
    return {"ok": True, "api_key": full_key, "connector": serialize_connector(c),
            "note": "Purani key ab kaam nahi karegi — Zapier/Make me nayi key dalo"}


@router.delete("/connectors/{connector_id}")
def delete_connector(connector_id: int, db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector

    c = _owner_filter(db, owner_id_of(owner)).filter(Connector.id == int(connector_id)).first()
    if c is None:
        return {"ok": False, "error": "Connector nahi mila"}
    try:
        db.delete(c)
        db.commit()
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        return {"ok": False, "error": f"delete nahi hua: {str(exc)[:150]}"}
    return {"ok": True}


@router.post("/connectors/{connector_id}/sync-now")
def sync_now(connector_id: int, db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector
    from app.services.connectors import poll_google_sheets, serialize_connector

    c = _owner_filter(db, owner_id_of(owner)).filter(Connector.id == int(connector_id)).first()
    if c is None:
        return {"ok": False, "error": "Connector nahi mila"}
    if c.type != "google_sheets":
        return {"ok": False, "error": f"sync-now sirf google_sheets ke liye hai (ye {c.type} hai)"}
    res = poll_google_sheets(c, db)
    return {"ok": bool(res.get("ok")), "result": res, "connector": serialize_connector(c)}


@router.post("/connectors/ingest")
@limiter.limit("20/minute")
def connector_ingest(request: Request, req: IngestIn, db: Session = Depends(get_db),
                     owner=Depends(get_current_owner)):
    """Agent push: {source: excel|tally|busy|marg, rows:[...]} -> ingestion path -> ingestion_logs."""
    from app.services.connectors import ingest_agent_rows

    summary = ingest_agent_rows(owner_id_of(owner), req.source, req.rows, db)
    return summary


# ---------- Pairing codes: computer agent ko bina token-copy jodo ----------
# Flow: web (JWT) POST /connectors/pair-code -> 6-char code dikhao ->
# agent me code dalo -> POST /connectors/agent-token {code} -> long JWT.
# Code 10 min, single-use, owner-bound. Never raises.

_PAIR_CODES: dict = {}  # code -> {owner_id, exp}
PAIR_TTL_S = 600


def _prune_pair_codes(now: float) -> None:
    try:
        for k in [k for k, v in _PAIR_CODES.items()
                  if not isinstance(v, dict) or float(v.get("exp", 0) or 0) <= now]:
            try:
                del _PAIR_CODES[k]
            except Exception:
                pass
    except Exception:
        pass


class PairIn(BaseModel):
    code: str = ""


@router.post("/connectors/pair-code")
def pair_code(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    import secrets
    import time

    try:
        _prune_pair_codes(time.time())
        oid = owner_id_of(owner)
        # purana unused code ho to wahi dobara do (ek owner = ek active code)
        for k, v in _PAIR_CODES.items():
            try:
                if isinstance(v, dict) and int(v.get("owner_id", 0) or 0) == int(oid or 0):
                    return {"ok": True, "code": k, "expires_in": max(0, int(float(v.get("exp", 0)) - time.time()))}
            except Exception:
                continue
        alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # confuse wale chars nahi (0/O/1/I)
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        _PAIR_CODES[code] = {"owner_id": int(oid or 1), "exp": time.time() + PAIR_TTL_S}
        return {"ok": True, "code": code, "expires_in": PAIR_TTL_S}
    except Exception as exc:
        return {"ok": False, "error": f"code nahi bana: {str(exc)[:120]}"}


@router.post("/connectors/agent-token")
@limiter.limit("10/minute")
def agent_token(request: Request, req: PairIn, db: Session = Depends(get_db)):
    import time
    from datetime import datetime, timedelta

    try:
        code = str(req.code or "").strip().upper()
        _prune_pair_codes(time.time())
        entry = _PAIR_CODES.pop(code, None)
        if not isinstance(entry, dict):
            return {"ok": False, "error": "Code galat hai ya expire ho gaya — web se naya code lo"}
        try:
            from app.models import OwnerProfile
            from app.routers.auth import _jwt_secret

            prof = db.query(OwnerProfile).filter(
                OwnerProfile.id == int(entry.get("owner_id", 1) or 1)).first()
            if prof is None or not bool(getattr(prof, "allowed", False)):
                return {"ok": False, "error": "Account active nahi hai"}
            secret = _jwt_secret()
            if not secret:
                return {"ok": False, "error": "Server JWT not configured"}
            import jwt as _jwt

            token = _jwt.encode(
                {"sub": str(int(prof.id)), "phone": prof.phone,
                 "exp": datetime.utcnow() + timedelta(days=90)},
                secret, algorithm="HS256")
            return {"ok": True, "token": token, "expires_in_days": 90}
        except Exception as exc:
            return {"ok": False, "error": f"token nahi bana: {str(exc)[:120]}"}
    except Exception as exc:
        return {"ok": False, "error": f"token nahi bana: {str(exc)[:120]}"}


# ---------- Connect-hub public API (X-API-Key, Zapier/Make/custom) ----------

def _require_key_connector(db, x_api_key: str | None):
    c = _connector_by_key(db, x_api_key or "")
    if c is None:
        return None, {"ok": False, "error": "Valid X-API-Key header chahiye — Connect hub se key copy karo"}
    return c, None


@router.post("/v1/ingest")
@limiter.limit("20/minute")
def v1_ingest(request: Request, req: IngestIn, db: Session = Depends(get_db),
              x_api_key: str | None = Header(default=None)):
    """Zapier/Make/custom push: header X-API-Key + {source, rows:[[...],...]}.

    rows = list of lists, first row headers (same shape as agent push).
    Owner = key wale connector ka owner. Never raises.
    """
    from app.services.connectors import ingest_agent_rows

    c, err = _require_key_connector(db, x_api_key)
    if err is not None:
        return err
    try:
        summary = ingest_agent_rows(int(getattr(c, "owner_id", 1) or 1), req.source, req.rows, db)
        try:
            c.status = "live"
            c.last_sync_at = __import__("datetime").datetime.utcnow()
            try:
                c.rows_synced = int(getattr(c, "rows_synced", 0) or 0) + int(summary.get("rows_inserted", 0) or 0)
            except Exception:
                pass
            db.commit()
        except Exception:
            pass
        return {"ok": True, **summary}
    except Exception as exc:
        return {"ok": False, "error": f"ingest fail: {str(exc)[:150]}"}


@router.post("/v1/sales")
@limiter.limit("20/minute")
def v1_sales(request: Request, req: V1SalesIn, db: Session = Depends(get_db),
             x_api_key: str | None = Header(default=None)):
    """Zapier-friendly named-fields push: {sales: [{date, product, qty, unit_price, customer?, type?}]}.

    type = sale (default) | purchase | expense. Owner = key wale connector ka owner.
    """
    from app.services.connectors import ingest_agent_rows

    c, err = _require_key_connector(db, x_api_key)
    if err is not None:
        return err
    try:
        items = req.sales if isinstance(req.sales, list) else []
        if not items:
            return {"ok": False, "error": "sales[] khaali hai — [{date, product, qty, unit_price}] bhejo"}
        rows = [["date", "product", "qty", "unit_price", "customer", "type"]]
        for it in items[:500]:
            try:
                d = it if isinstance(it, dict) else {}
                rows.append([
                    str(d.get("date", "") or ""),
                    str(d.get("product", "") or ""),
                    str(d.get("qty", "") or ""),
                    str(d.get("unit_price", d.get("price", "")) or ""),
                    str(d.get("customer", "") or ""),
                    str(d.get("type", "sale") or "sale"),
                ])
            except Exception:
                continue
        # named rows -> grid path: sale/purchase via product+qty+price, expense via type
        from app.services.ingestion import ingest_dataframe

        try:
            import pandas as pd

            df = pd.DataFrame(rows[1:], columns=rows[0])
        except Exception:
            df = None
        if df is None or df.empty:
            return {"ok": False, "error": "rows parse nahi hue"}
        summary = ingest_dataframe(db, df, "sales", f"api-{getattr(c, 'id', '?')}",
                                   owner_id=int(getattr(c, "owner_id", 1) or 1))
        try:
            from app.services.connectors import _invalidate_intel_caches

            _invalidate_intel_caches()
        except Exception:
            pass
        try:
            c.status = "live"
            c.last_sync_at = __import__("datetime").datetime.utcnow()
            try:
                c.rows_synced = int(getattr(c, "rows_synced", 0) or 0) + int(summary.get("rows_inserted", 0) or 0)
            except Exception:
                pass
            db.commit()
        except Exception:
            pass
        return {"ok": True, **summary}
    except Exception as exc:
        return {"ok": False, "error": f"ingest fail: {str(exc)[:150]}"}
