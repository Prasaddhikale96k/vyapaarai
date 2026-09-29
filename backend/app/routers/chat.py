import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.models import Action
from app.routers.auth import get_optional_owner, owner_id_of
from app.services.actions import serialize_action

logger = logging.getLogger("vyapaarai.chat")

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    phone: Optional[str] = "web"


@router.get("/chat/history")
def chat_history(db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    """Unified thread: owner_id match OR session_phone match, oldest first. Max 100."""
    from app.models import ChatMessage

    oid = owner_id_of(owner)
    try:
        own_phone = str(getattr(owner, "phone", "") or "").strip() if owner is not None else ""
    except Exception:
        own_phone = ""
    try:
        filt = [ChatMessage.owner_id == oid]
        if own_phone:
            digits = "".join(ch for ch in own_phone if ch.isdigit())
            if digits:
                filt.append(ChatMessage.session_phone == digits)
                filt.append(ChatMessage.session_phone == own_phone)
        from sqlalchemy import or_ as _or

        rows = (
            db.query(ChatMessage)
            .filter(_or(*filt))
            .order_by(ChatMessage.id.asc())
            .limit(100)
            .all()
        )
    except Exception:
        rows = []
    out = []
    for m in rows:
        try:
            created = m.created_at.isoformat() if getattr(m, "created_at", None) else None
        except Exception:
            created = str(getattr(m, "created_at", None))
        out.append({
            "id": getattr(m, "id", None),
            "role": getattr(m, "role", "user"),
            "content": getattr(m, "content", "") or "",
            "language": getattr(m, "language", "") or "",
            "source": getattr(m, "source", "web") or "web",
            "created_at": created,
        })
    return out


@router.post("/chat")
@limiter.limit("30/minute")
def chat(request: Request, req: ChatRequest, db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    msg = (req.message or "")
    if not msg.strip():
        raise HTTPException(status_code=422, detail="message must be non-empty")
    phone = (req.phone or "web").strip() or "web"
    oid = owner_id_of(owner)
    try:
        from app.services import agents as ag

        result = ag.orchestrate(msg.strip(), phone=phone, owner_id=oid)
        answer = result.get("answer", "")
        steps = result.get("steps", [])
        provider = result.get("provider", "demo_fallback")
        specialists_used = result.get("specialists_used", [])
    except Exception as exc:
        logger.warning("orchestrate failed, emergency demo fallback: %s", exc)
        try:
            from app.services import llm as llm_mod

            answer = llm_mod._demo_fallback(msg.strip())
        except Exception:
            answer = f"Demo mode: unable to answer right now. Your question was: {msg.strip()[:300]}"
        steps = []
        provider = "demo_fallback"
        specialists_used = ["sales", "inventory", "finance"]
    if not answer or not str(answer).strip():
        try:
            from app.services import llm as llm_mod

            answer = llm_mod._demo_fallback(msg.strip())
        except Exception:
            answer = f"Demo mode: summary unavailable. Question: {msg.strip()[:300]}"
        provider = "demo_fallback"
    # suggested actions: top 3 pending, newest first (owner-scoped)
    try:
        rows = (
            db.query(Action)
            .filter(Action.owner_id == oid, Action.status == "pending")
            .order_by(Action.id.desc())
            .limit(3)
            .all()
        )
        suggested = [serialize_action(a) for a in rows]
    except Exception as exc:
        logger.warning("suggested_actions failed: %s", exc)
        suggested = []
    if provider not in ("groq", "gemini", "demo_fallback"):
        provider = "demo_fallback"
    return {
        "answer": answer,
        "steps": steps if isinstance(steps, list) else [],
        "suggested_actions": suggested,
        "provider": provider,
        "specialists_used": specialists_used,
    }


def _pending_actions(db, oid, limit: int = 3):
    try:
        rows = (
            db.query(Action)
            .filter(Action.owner_id == oid, Action.status == "pending")
            .order_by(Action.id.desc())
            .limit(limit)
            .all()
        )
        return [serialize_action(a) for a in rows]
    except Exception as exc:
        logger.warning("suggested_actions failed: %s", exc)
        return []


@router.post("/chat/voice")
@limiter.limit("30/minute")
async def chat_voice(
    request: Request,
    file: UploadFile = File(...),
    phone: Optional[str] = Form(default="web"),
    db: Session = Depends(get_db),
    owner=Depends(get_optional_owner),
):
    """Web voice notes: STT -> orchestrate -> same JSON + transcript. Never crashes."""
    try:
        content = await file.read()
    except Exception:
        content = b""
    try:
        raw_len = len(bytes(content or b""))
    except Exception:
        raw_len = 0
    if raw_len < 16:
        raise HTTPException(status_code=422,
                            detail="Khaali audio aaya — dobara record karo 🎤")
    oid = owner_id_of(owner)
    who = (phone or "web").strip() or "web"
    try:
        fname = str(getattr(file, "filename", "") or "").lower()
        ext = "." + fname.rsplit(".", 1)[-1] if "." in fname else ".webm"
        if ext not in (".webm", ".ogg", ".mp3", ".mp4", ".wav", ".m4a"):
            ext = ".webm"
    except Exception:
        ext = ".webm"
    try:
        from app.services import voice as voice_mod

        r = voice_mod.stt(bytes(content or b""), suffix=ext)
        transcript = str((r or {}).get("text", "") or "").strip()
        lang = str((r or {}).get("language", "") or "hi").strip() or "hi"
        stt_err = str((r or {}).get("error", "") or "")
    except Exception:
        transcript, lang, stt_err = "", "hi", ""
    if not transcript:
        raise HTTPException(
            status_code=422,
            detail=stt_err or "Kuch sunai nahi diya — mic paas rakho, dobara bolo 🎤",
        )
    try:
        from app.services import agents as ag

        result = ag.orchestrate(transcript, phone=who, owner_id=oid)
        answer = result.get("answer", "")
        steps = result.get("steps", [])
        provider = result.get("provider", "demo_fallback")
        specialists_used = result.get("specialists_used", [])
    except Exception as exc:
        logger.warning("voice orchestrate failed: %s", exc)
        answer, steps, provider, specialists_used = (
            "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏",
            [], "demo_fallback", [],
        )
    if provider not in ("groq", "gemini", "demo_fallback"):
        provider = "demo_fallback"
    return {
        "answer": answer,
        "steps": steps if isinstance(steps, list) else [],
        "suggested_actions": _pending_actions(db, oid),
        "provider": provider,
        "specialists_used": specialists_used,
        "transcript": transcript,
        "language": lang,
    }
