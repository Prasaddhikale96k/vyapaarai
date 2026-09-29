import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
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


class GridRow(BaseModel):
    date: str = ""
    product: str = ""
    qty: Optional[str] = ""
    unit_price: Optional[str] = ""
    customer: str = ""
    type: str = "sale"


class GridIn(BaseModel):
    rows: list[GridRow] = []


@router.post("/grid")
@limiter.limit("20/minute")
def ingest_grid(request: Request, body: GridIn, db: Session = Depends(get_db),
                owner=Depends(get_optional_owner)):
    """Direct Entry grid save: JSON rows -> EXISTING ingest_dataframe (no parse dup).

    Mapping: sale -> sales ingestor; purchase -> expenses (category=Purchases,
    note=product); expense -> expenses (category=product/Misc, note=customer).
    amount = (qty||1) x unit_price. filename='web-grid' marks the log.
    """
    import pandas as pd

    from app.services.ingestion import ingest_dataframe, parse_amount

    oid = owner_id_of(owner)
    sales_rows: list = []
    exp_rows: list = []
    for r in (body.rows or []):
        t = str(getattr(r, "type", "") or "sale").strip().lower()
        if t not in ("sale", "purchase", "expense"):
            t = "sale"
        d = str(getattr(r, "date", "") or "").strip()
        prod = str(getattr(r, "product", "") or "").strip()
        qty = parse_amount(getattr(r, "qty", "") or "")
        price = parse_amount(getattr(r, "unit_price", "") or "")
        cust = str(getattr(r, "customer", "") or "").strip()
        if not d or not prod or qty is None and t in ("sale", "purchase"):
            continue
        if price is None:
            continue
        if t == "sale":
            sales_rows.append({"date": d, "product": prod, "qty": qty,
                               "unit_price": price, "customer": cust})
        elif t == "purchase":
            exp_rows.append({"date": d, "category": "Purchases",
                             "amount": float(qty or 0) * float(price), "note": prod})
        else:
            exp_rows.append({"date": d, "category": prod or "Misc",
                             "amount": float(qty if qty is not None else 1) * float(price),
                             "note": cust or None})
    total_in = total_skip = 0
    warnings: list = []
    if sales_rows:
        s = ingest_dataframe(db, pd.DataFrame(sales_rows), "sales", "web-grid", owner_id=oid)
        total_in += int(s.get("rows_inserted", 0) or 0)
        total_skip += int(s.get("rows_skipped", 0) or 0)
        warnings += list(s.get("warnings", []) or [])
    if exp_rows:
        s = ingest_dataframe(db, pd.DataFrame(exp_rows), "expenses", "web-grid", owner_id=oid)
        total_in += int(s.get("rows_inserted", 0) or 0)
        total_skip += int(s.get("rows_skipped", 0) or 0)
        warnings += list(s.get("warnings", []) or [])
    if not sales_rows and not exp_rows:
        return {"source_type": "web-grid", "filename": "web-grid",
                "rows_inserted": 0, "rows_skipped": len(body.rows or []),
                "warnings": ["Koi valid row nahi — date/product/qty/price check karo"]}
    invalidate_intel()
    return {"source_type": "web-grid", "filename": "web-grid",
            "rows_inserted": total_in, "rows_skipped": total_skip,
            "warnings": warnings[:20]}


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
