import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse

from app.routers.auth import get_current_owner

logger = logging.getLogger("vyapaarai.whatsapp")

router = APIRouter(tags=["whatsapp"])


def _webhook_secret() -> str:
    try:
        from app import config as _cfg

        import os

        raw = os.getenv("WEBHOOK_SECRET", "") or str(getattr(_cfg, "WEBHOOK_SECRET", "") or "")
    except Exception:
        raw = ""
    return raw.strip()


def _verify_webhook(request: Request) -> bool:
    """S8#16: WEBHOOK_SECRET set ho to 'x-webhook-secret' header se verify karo.

    OpenWA webhook config me secret bheja jaata hai (wa_gateway.set_webhook);
    OpenWA har POST me 'x-webhook-secret: <secret>' header bhejta hai.
    Secret set nahi hai to verification skip (dev). Mismatch/missing -> False.
    """
    secret = _webhook_secret()
    if not secret:
        return True
    try:
        got = request.headers.get("x-webhook-secret", "") or ""
    except Exception:
        got = ""
    if not got:
        return False
    return hmac.compare_digest(str(got), str(secret))


@router.get("/webhook/whatsapp")
def whatsapp_ping():
    return {"status": "ok"}


@router.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    if not _verify_webhook(request):
        logger.warning("webhook rejected: missing/invalid x-webhook-secret")
        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized", "request_id": getattr(request.state, "request_id", "")},
        )
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    try:
        event = str((payload or {}).get("event", "") or "")
    except Exception:
        event = ""
    if event in ("MESSAGES_UPSERT", "message.received"):
        try:
            from app.services.whatsapp_flow import handle_incoming

            background_tasks.add_task(handle_incoming, payload)
        except Exception as exc:
            logger.warning("failed to schedule handle_incoming: %s", exc)
        return {"received": True}
    return {"ignored": event or True}


@router.get("/whatsapp/status")
def whatsapp_status():
    try:
        from app.services import wa_gateway

        return wa_gateway.status()
    except Exception as exc:
        return {"gateway": "openwa", "configured": True, "connected": False,
                "session": "vyapaarai",
                "instructions": f"status check failed: {exc}"}


@router.post("/brief/send")
def brief_send(owner=Depends(get_current_owner)):
    """S8#10: JWT required, scoped to auth owner. Koi OWNER_PHONE/first-profile fallback nahi."""
    try:
        from app.services.whatsapp_flow import build_and_send_brief

        return build_and_send_brief(owner=owner)
    except Exception as exc:
        logger.warning("brief send failed: %s", exc)
        return {"delivered": False, "simulated": True, "items": [], "error": str(exc)[:200]}
