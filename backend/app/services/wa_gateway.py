"""OpenWA gateway client — har call graceful, kabhi raise nahi karta.

Env:
  WA_GATEWAY=openwa (default) | evolution
  OPENWA_URL=http://localhost:2785 (host par chalta hai, isliye localhost)
  OPENWA_API_KEY=<OpenWA .env me API_MASTER_KEY wali value>
  OPENWA_SESSION=vyapaarai (session NAME; UUID khud resolve hota hai)

Auth: X-API-Key header. Routes OpenWA source se padhkar likhe gaye hain
(sessions/message/webhook controllers + IncomingMessage interface).
"""

import base64
import logging
import os
import time

import requests

logger = logging.getLogger("vyapaarai.wa_gateway")

_TIMEOUT = 15
_conn_cache: dict = {"at": 0.0, "value": False}
_sid_cache: dict = {"at": 0.0, "value": ""}


def gateway_name() -> str:
    try:
        from app import config as _cfg

        return (os.getenv("WA_GATEWAY", "") or str(getattr(_cfg, "WA_GATEWAY", "") or "") or "openwa").strip().lower() or "openwa"
    except Exception:
        try:
            return (os.getenv("WA_GATEWAY", "") or "openwa").strip().lower() or "openwa"
        except Exception:
            return "openwa"


def _base_url() -> str:
    try:
        from app import config as _cfg

        url = os.getenv("OPENWA_URL", "") or str(getattr(_cfg, "OPENWA_URL", "") or "")
    except Exception:
        url = os.getenv("OPENWA_URL", "http://localhost:2785")
    return (url or "http://localhost:2785").rstrip("/") + "/api"


def _api_key() -> str:
    try:
        from app import config as _cfg

        key = os.getenv("OPENWA_API_KEY", "") or str(getattr(_cfg, "OPENWA_API_KEY", "") or "")
    except Exception:
        key = os.getenv("OPENWA_API_KEY", "")
    return key or ""


def _session_name() -> str:
    try:
        from app import config as _cfg

        name = os.getenv("OPENWA_SESSION", "") or str(getattr(_cfg, "OPENWA_SESSION", "") or "")
    except Exception:
        name = os.getenv("OPENWA_SESSION", "")
    return (name or "vyapaarai").strip() or "vyapaarai"


def _headers() -> dict:
    return {"X-API-Key": _api_key(), "Content-Type": "application/json"}


def _digits(phone: str) -> str:
    try:
        if "@" in str(phone or ""):
            phone = str(phone).split("@")[0]
        return "".join(ch for ch in str(phone or "") if ch.isdigit())
    except Exception:
        return ""


def _chat_id(phone: str) -> str:
    d = _digits(phone)
    return f"{d}@c.us" if d else ""


def session_id() -> str:
    """Session NAME se UUID nikalo (60s cache). Na mile to ''."""
    try:
        now = time.time()
        if now - float(_sid_cache.get("at", 0.0)) < 60 and _sid_cache.get("value"):
            return str(_sid_cache.get("value") or "")
        sid = ""
        try:
            r = requests.get(
                f"{_base_url()}/sessions",
                headers=_headers(),
                params={"name": _session_name()},
                timeout=_TIMEOUT,
            )
            if r.status_code == 200:
                try:
                    data = r.json()
                except Exception:
                    data = []
                items = data if isinstance(data, list) else [data]
                for it in items:
                    if isinstance(it, dict) and it.get("id") and str(it.get("name") or "") == _session_name():
                        sid = str(it["id"])
                        break
                    if isinstance(it, dict) and it.get("id") and not sid:
                        sid = str(it["id"])
        except Exception as exc:
            logger.info("openwa session_id lookup failed: %s", str(exc)[:200])
        _sid_cache["at"] = now
        _sid_cache["value"] = sid
        return sid
    except Exception:
        return ""


def _session_status(sid: str) -> str:
    try:
        r = requests.get(f"{_base_url()}/sessions/{sid}", headers=_headers(), timeout=_TIMEOUT)
        if r.status_code == 200:
            try:
                data = r.json()
            except Exception:
                return ""
            if isinstance(data, dict):
                return str(data.get("status", "") or "").strip().lower()
        return ""
    except Exception as exc:
        logger.info("openwa session status failed: %s", str(exc)[:200])
        return ""


def is_connected() -> bool:
    """60s cache. True sirf jab status == 'ready'. Kabhi raise nahi."""
    try:
        now = time.time()
        if now - float(_conn_cache.get("at", 0.0)) < 60:
            return bool(_conn_cache.get("value", False))
        ok = False
        try:
            sid = session_id()
            if sid:
                ok = _session_status(sid) == "ready"
        except Exception as exc:
            logger.info("openwa is_connected check failed: %s", str(exc)[:200])
            ok = False
        _conn_cache["at"] = now
        _conn_cache["value"] = ok
        return ok
    except Exception:
        return False


def send_text(phone: str, text: str) -> dict:
    try:
        sid = session_id()
        if not sid:
            return {"ok": False, "error": "openwa session nahi mili (setup_whatsapp.py chalao)"}
        chat = _chat_id(phone)
        if not chat:
            return {"ok": False, "error": "phone number khaali hai"}
        r = requests.post(
            f"{_base_url()}/sessions/{sid}/messages/send-text",
            headers=_headers(),
            json={"chatId": chat, "text": text or ""},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            try:
                return {"ok": True, "response": r.json() if r.content else {}}
            except Exception:
                return {"ok": True, "response": {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("openwa send_text failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def send_voice(phone: str, mp3_bytes: bytes) -> dict:
    """TTS mp3 ko plain audio file bhejta hai (ptt=false, mimetype audio/mpeg)."""
    try:
        sid = session_id()
        if not sid:
            return {"ok": False, "error": "openwa session nahi mili (setup_whatsapp.py chalao)"}
        chat = _chat_id(phone)
        if not chat:
            return {"ok": False, "error": "phone number khaali hai"}
        try:
            audio_b64 = base64.b64encode(bytes(mp3_bytes or b"")).decode("ascii")
        except Exception:
            return {"ok": False, "error": "audio encode nahi hua"}
        r = requests.post(
            f"{_base_url()}/sessions/{sid}/messages/send-audio",
            headers=_headers(),
            json={"chatId": chat, "base64": audio_b64, "mimetype": "audio/mpeg", "ptt": False},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            try:
                return {"ok": True, "response": r.json() if r.content else {}}
            except Exception:
                return {"ok": True, "response": {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("openwa send_voice failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def send_document(phone: str, pdf_bytes: bytes, filename: str = "report.pdf",
                    caption: str = "") -> dict:
    """PDF document bhejo: POST /api/sessions/<sid>/messages/send-document
    {chatId, base64, mimetype, filename, caption}. Kabhi raise nahi."""
    try:
        sid = session_id()
        if not sid:
            return {"ok": False, "error": "openwa session nahi mili (setup_whatsapp.py chalao)"}
        chat = _chat_id(phone)
        if not chat:
            return {"ok": False, "error": "phone number khaali hai"}
        try:
            doc_b64 = base64.b64encode(bytes(pdf_bytes or b"")).decode("ascii")
        except Exception:
            return {"ok": False, "error": "pdf encode nahi hua"}
        if not doc_b64:
            return {"ok": False, "error": "pdf khaali hai"}
        r = requests.post(
            f"{_base_url()}/sessions/{sid}/messages/send-document",
            headers=_headers(),
            json={"chatId": chat, "base64": doc_b64, "mimetype": "application/pdf",
                  "filename": filename or "report.pdf", "caption": caption or ""},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            try:
                return {"ok": True, "response": r.json() if r.content else {}}
            except Exception:
                return {"ok": True, "response": {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("openwa send_document failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def fetch_media(chat_id: str, message_id: str) -> bytes | None:
    """Stored media download (fallback jab webhook me inline bytes na ho). None on failure."""
    try:
        sid = session_id()
        if not sid or not chat_id or not message_id:
            return None
        r = requests.get(
            f"{_base_url()}/sessions/{sid}/messages/{chat_id}/{message_id}/media",
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        if r.status_code != 200:
            return None
        try:
            payload = r.json()
        except Exception:
            return None
        b64 = _find_b64(payload)
        if not b64:
            return None
        return base64.b64decode(b64)
    except Exception as exc:
        logger.info("openwa fetch_media failed: %s", str(exc)[:200])
        return None


def _find_b64(obj, depth: int = 0) -> str | None:
    """Kisi bhi nested shape se base64 media nikalo (media.data / data / base64 keys)."""
    try:
        if depth > 4 or obj is None:
            return None
        if isinstance(obj, dict):
            for key in ("data", "base64", "media"):
                if key in obj:
                    v = obj[key]
                    if isinstance(v, str) and len(v.strip()) > 20:
                        s = v.strip()
                        if s.startswith("data:") and "," in s:
                            s = s.split(",", 1)[1]
                        try:
                            base64.b64decode(s)
                            return s
                        except Exception:
                            continue
                    found = _find_b64(v, depth + 1)
                    if found:
                        return found
            return None
        return None
    except Exception:
        return None


def set_webhook(url: str, secret: str) -> dict:
    """Session webhook banayo ya update karo (message.received + session.status)."""
    try:
        sid = session_id()
        if not sid:
            return {"ok": False, "error": "openwa session nahi mili (setup_whatsapp.py chalao)"}
        events = ["message.received", "session.status"]
        existing_id = ""
        try:
            r = requests.get(f"{_base_url()}/sessions/{sid}/webhooks", headers=_headers(), timeout=_TIMEOUT)
            if r.status_code == 200:
                try:
                    items = r.json()
                except Exception:
                    items = []
                for it in items if isinstance(items, list) else []:
                    if isinstance(it, dict) and str(it.get("url") or "") == url:
                        existing_id = str(it.get("id") or "")
                        break
        except Exception as exc:
            logger.info("openwa webhook list failed: %s", str(exc)[:200])
        body = {"url": url, "events": events, "secret": secret, "retryCount": 3}
        if existing_id:
            try:
                r = requests.put(
                    f"{_base_url()}/sessions/{sid}/webhooks/{existing_id}",
                    headers=_headers(), json=body, timeout=_TIMEOUT,
                )
                if r.status_code in (200, 201):
                    return {"ok": True, "updated": True}
            except Exception as exc:
                logger.info("openwa webhook update failed: %s", str(exc)[:200])
        try:
            r = requests.post(
                f"{_base_url()}/sessions/{sid}/webhooks",
                headers=_headers(), json=body, timeout=_TIMEOUT,
            )
            if r.status_code in (200, 201):
                return {"ok": True, "created": True}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:300]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:300]}


def status() -> dict:
    configured = bool(_base_url() and _api_key() and _session_name())
    try:
        connected = is_connected() if gateway_name() == "openwa" else False
    except Exception:
        connected = False
    if gateway_name() != "openwa":
        try:
            from app.services import evolution as _evo

            return _evo.status()
        except Exception:
            pass
    instructions = (
        "1. OpenWA start karo: backend\\openwa_start.cmd (http://localhost:2785/api). "
        "2. Setup: cd backend && python setup_whatsapp.py — session banegi, QR aayega, scan karo. "
        "3. Webhook script khud set karta hai: POST /api/sessions/<id>/webhooks "
        "{url: http://localhost:8000/webhook/whatsapp, events: [message.received, session.status]}."
    )
    return {
        "gateway": "openwa",
        "configured": configured,
        "connected": bool(connected),
        "session": _session_name(),
        "instructions": instructions,
    }
