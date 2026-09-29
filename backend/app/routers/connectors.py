"""Live connectors router: Sheets/Excel/Tally. JWT owner-scoped. Never raises."""

import json
import logging

from fastapi import APIRouter, Depends, Request
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
    source: str  # excel | tally
    rows: list = []


def _owner_filter(db, owner_id: int):
    from app.models import Connector

    return db.query(Connector).filter(Connector.owner_id == int(owner_id or 1))


@router.get("/connectors")
def list_connectors(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector
    from app.services.connectors import serialize_connector

    rows = _owner_filter(db, owner_id_of(owner)).order_by(Connector.id).all()
    return [serialize_connector(c) for c in rows]


@router.post("/connectors")
def create_connector(req: ConnectorIn, db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Connector
    from app.services.connectors import CONNECTOR_TYPES, serialize_connector

    ctype = str(req.type or "").strip().lower()
    if ctype not in CONNECTOR_TYPES:
        return {"ok": False, "error": f"type galat hai — chuno: {', '.join(sorted(CONNECTOR_TYPES))}"}
    try:
        cfg = json.dumps(req.config or {})
    except Exception:
        cfg = "{}"
    c = Connector(owner_id=owner_id_of(owner), type=ctype, config=cfg, status="offline")
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
    return {"ok": True, "connector": serialize_connector(c)}


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
    """Agent push: {source: excel|tally, rows:[...]} -> ingestion path -> ingestion_logs."""
    from app.services.connectors import ingest_agent_rows

    summary = ingest_agent_rows(owner_id_of(owner), req.source, req.rows, db)
    return summary
