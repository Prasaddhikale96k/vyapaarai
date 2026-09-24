import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.models import IngestionLog
from app.routers.auth import get_current_owner, get_optional_owner, owner_id_of
from app.routers.intelligence import invalidate_intel
from app.schemas import IngestSummary, IngestionLogResponse
from app.services.ingestion import commit_ingest, ingest_tally_xml, preview_ingest, template_csv

router = APIRouter(prefix="/ingest", tags=["ingest"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def guard_upload(content: bytes, filename: Optional[str]) -> str:
    """413 when >20MB; strip path traversal. Returns safe basename, never ''."""
    try:
        size = len(bytes(content or b""))
    except Exception:
        size = 0
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file too large (max 20MB)")
    try:
        name = Path(str(filename or "upload")).name
    except Exception:
        name = "upload"
    name = (name or "").strip() or "upload"
    if name in (".", ".."):
        name = "upload"
    return name


@router.post("/upload", response_model=IngestSummary)
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    type: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    owner=Depends(get_optional_owner),
):
    content = await file.read()
    fname = guard_upload(content, file.filename)
    result = commit_ingest(db, content, fname or "upload.csv", type_hint=type,
                           owner_id=owner_id_of(owner))
    invalidate_intel()
    return result


@router.post("/tally-xml", response_model=IngestSummary)
@limiter.limit("20/minute")
async def upload_tally_xml(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    owner=Depends(get_optional_owner),
):
    content = await file.read()
    fname = guard_upload(content, file.filename)
    result = ingest_tally_xml(db, content, fname or "tally.xml",
                              owner_id=owner_id_of(owner))
    invalidate_intel()
    return result


@router.get("/logs", response_model=list[IngestionLogResponse])
def list_logs(db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    rows = db.query(IngestionLog).filter(
        IngestionLog.owner_id == owner_id_of(owner)).order_by(
        IngestionLog.id.desc()).limit(50).all()
    out: list[IngestionLogResponse] = []
    for r in rows:
        try:
            warnings = json.loads(r.warnings) if r.warnings else []
        except Exception:
            warnings = [r.warnings] if r.warnings else []
        out.append(
            IngestionLogResponse(
                id=r.id,
                source_type=r.source_type,
                filename=r.filename,
                rows_inserted=r.rows_inserted,
                rows_skipped=r.rows_skipped,
                warnings=warnings,
                created_at=r.created_at,
            )
        )
    return out


@router.post("/preview")
@limiter.limit("20/minute")
async def preview_file(
    request: Request,
    file: UploadFile = File(...),
    type: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    owner=Depends(get_optional_owner),
):
    """Validate + preview WITHOUT committing (wizard step 2). Never writes."""
    try:
        content = await file.read()
    except Exception:
        content = b""
    fname = guard_upload(content, file.filename)
    return preview_ingest(content, fname or "upload.csv", type_hint=type,
                          owner_id=owner_id_of(owner))


@router.post("/commit", response_model=IngestSummary)
@limiter.limit("20/minute")
async def commit_file(
    request: Request,
    file: UploadFile = File(...),
    type: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    owner=Depends(get_current_owner),
):
    """Committed ingest; flips onboarded=True on first successful commit."""
    content = await file.read()
    fname = guard_upload(content, file.filename)
    result = commit_ingest(db, content, fname or "upload.csv", type_hint=type,
                           owner_id=owner_id_of(owner))
    try:
        if not bool(getattr(owner, "onboarded", False)):
            owner.onboarded = True
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    invalidate_intel()
    return result


@router.get("/files")
def list_files(db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    """Last 100 processed-file ledger rows (restart-safe auto-sync audit)."""
    try:
        from app.models import ProcessedFile
        from app.services.sync import serialize_processed

        rows = (
            db.query(ProcessedFile)
            .filter(ProcessedFile.owner_id == owner_id_of(owner))
            .order_by(ProcessedFile.id.desc())
            .limit(100)
            .all()
        )
        return [serialize_processed(r) for r in rows]
    except Exception:
        return []


@router.get("/template")
def download_template(type: str = Query(default="sales")):
    """Canonical CSV template + 2 example rows for the wizard."""
    text = template_csv(type)
    if text is None:
        raise HTTPException(
            status_code=422,
            detail="type sales|inventory|receivables|expenses|products me se ho",
        )
    key = str(type or "sales").strip().lower()
    return PlainTextResponse(
        text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=template-{key}.csv"},
    )
