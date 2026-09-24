"""Daily PDF report endpoints. Owner-scoped, JWT required."""

import io
import logging
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.auth import get_current_owner, owner_id_of

logger = logging.getLogger("vyapaarai.reports_web")

router = APIRouter(prefix="/reports", tags=["reports"])


def _fname() -> str:
    return f"report-{date.today().isoformat()}.pdf"


@router.get("/daily")
def daily_pdf(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.services import reports as rep

    pdf = rep.build_daily_pdf(db, owner_id_of(owner))
    return StreamingResponse(
        io.BytesIO(bytes(pdf)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_fname()}"'},
    )


@router.post("/send-now")
def send_now(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.services import notify
    from app.services import reports as rep

    oid = owner_id_of(owner)
    try:
        phone = str(getattr(owner, "phone", "") or "")
    except Exception:
        phone = ""
    try:
        pdf = rep.build_daily_pdf(db, oid)
    except Exception as exc:
        logger.warning("send-now build failed: %s", str(exc)[:200])
        return {"simulated": True, "to": phone, "error": "pdf build failed"}
    try:
        res = notify.send_document(phone, bytes(pdf), _fname(), "📄 VyapaarAI Daily Report")
    except Exception as exc:
        res = {"simulated": True, "error": str(exc)[:200]}
    out = {"simulated": bool((res or {}).get("simulated", True)), "to": phone}
    try:
        if (res or {}).get("gateway"):
            out["gateway"] = res["gateway"]
        if (res or {}).get("error"):
            out["error"] = str(res["error"])[:200]
    except Exception:
        pass
    return out
