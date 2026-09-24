"""Web Document AI — PDF/photo recognize + confirm. Owner-scoped, JWT required.

Backend parse/confirm already exist (services.documents); ONLY web routes here.
WhatsApp flow is untouched.
"""

import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.routers.auth import get_current_owner, owner_id_of

logger = logging.getLogger("vyapaarai.documents_web")

router = APIRouter(prefix="/documents", tags=["documents"])


def _phone_of(owner) -> str:
    try:
        return str(getattr(owner, "phone", "") or "")
    except Exception:
        return ""


def _serialize_log(log) -> dict:
    try:
        created = log.created_at.isoformat() if getattr(log, "created_at", None) else None
    except Exception:
        created = str(getattr(log, "created_at", None))
    try:
        raw = getattr(log, "parsed_entries", None)
        payload = json.loads(raw) if isinstance(raw, str) and raw else (raw or {})
        entries = payload.get("entries", []) if isinstance(payload, dict) else []
        if not isinstance(entries, list):
            entries = []
    except Exception:
        entries = []
    return {
        "id": getattr(log, "id", None),
        "filename": getattr(log, "filename", ""),
        "source": getattr(log, "source", ""),
        "status": getattr(log, "status", ""),
        "entries": entries,
        "entry_count": len(entries),
        "created_at": created,
    }


@router.post("/upload")
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    owner=Depends(get_current_owner),
):
    """Image/PDF -> Gemini vision extract -> pending_confirm log."""
    from app.services import documents as docs

    try:
        content = await file.read()
    except Exception:
        content = b""
    if not content:
        raise HTTPException(status_code=422, detail="Khaali file — PDF/photo bhejo")
    from app.routers.ingest import guard_upload

    fname = guard_upload(content, file.filename)
    res = docs.parse_document(
        db, bytes(content), fname or "document",
        source="web", phone=_phone_of(owner), owner_id=owner_id_of(owner),
    )
    if isinstance(res, dict) and res.get("error"):
        raise HTTPException(status_code=502, detail=str(res["error"]))
    return res


@router.get("/pending")
def list_pending(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    """Caller's pending_confirm logs (newest first)."""
    try:
        from app.models import DocumentLog

        rows = (
            db.query(DocumentLog)
            .filter(DocumentLog.owner_id == owner_id_of(owner),
                    DocumentLog.status == "pending_confirm")
            .order_by(DocumentLog.id.desc())
            .limit(20)
            .all()
        )
        return [_serialize_log(r) for r in rows]
    except Exception as exc:
        logger.info("pending list failed: %s", str(exc)[:200])
        return []


@router.post("/{doc_id}/confirm")
@limiter.limit("20/minute")
def confirm_web(request: Request, doc_id: int, db: Session = Depends(get_db),
                owner=Depends(get_current_owner)):
    from app.services import documents as docs

    res = docs.confirm_document(db, int(doc_id), True,
                                phone=_phone_of(owner), owner_id=owner_id_of(owner))
    if isinstance(res, dict) and res.get("error"):
        raise HTTPException(status_code=404, detail=str(res["error"]))
    try:
        from app.routers.intelligence import invalidate_intel

        invalidate_intel()
    except Exception:
        pass
    return res


@router.post("/{doc_id}/reject")
@limiter.limit("20/minute")
def reject_web(request: Request, doc_id: int, db: Session = Depends(get_db),
               owner=Depends(get_current_owner)):
    from app.services import documents as docs

    res = docs.confirm_document(db, int(doc_id), False,
                                phone=_phone_of(owner), owner_id=owner_id_of(owner))
    if isinstance(res, dict) and res.get("error"):
        raise HTTPException(status_code=404, detail=str(res["error"]))
    return res
