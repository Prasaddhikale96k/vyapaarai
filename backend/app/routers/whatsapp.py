import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.routers.auth import get_optional_owner

logger = logging.getLogger("vyapaarai.whatsapp")

router = APIRouter(tags=["whatsapp"])


@router.get("/webhook/whatsapp")
def whatsapp_ping():
    return {"status": "ok"}


@router.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
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
def brief_send(owner=Depends(get_optional_owner)):
    try:
        from app.services.whatsapp_flow import build_and_send_brief

        return build_and_send_brief(owner=owner)
    except Exception as exc:
        logger.warning("brief send failed: %s", exc)
        return {"delivered": False, "simulated": True, "items": []}
