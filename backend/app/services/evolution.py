"""Evolution API client — every call degrades gracefully, never raises."""

import base64
import logging
import os
import time

import requests

logger = logging.getLogger("vyapaarai.evolution")

_TIMEOUT = 15
_conn_cache: dict = {"at": 0.0, "value": False}


def _base_url() -> str:
    try:
        from app import config as _cfg

        url = os.getenv("EVOLUTION_API_URL", "") or str(getattr(_cfg, "EVOLUTION_API_URL", "") or "")
    except Exception:
        url = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
    return (url or "http://localhost:8080").rstrip("/")


def _api_key() -> str:
    try:
        from app import config as _cfg

        key = os.getenv("EVOLUTION_API_KEY", "") or str(getattr(_cfg, "EVOLUTION_API_KEY", "") or "")
    except Exception:
        key = os.getenv("EVOLUTION_API_KEY", "")
    return key or ""


def _instance() -> str:
    try:
        from app import config as _cfg

        inst = os.getenv("EVOLUTION_INSTANCE", "") or str(getattr(_cfg, "EVOLUTION_INSTANCE", "") or "")
    except Exception:
        inst = os.getenv("EVOLUTION_INSTANCE", "")
    return inst or "vyapaarai"


def _headers() -> dict:
    return {"apikey": _api_key(), "Content-Type": "application/json"}


def is_connected() -> bool:
    """Cached (60s) connection check. False on any error. Never raises."""
    try:
        now = time.time()
        if now - float(_conn_cache.get("at", 0.0)) < 60:
            return bool(_conn_cache.get("value", False))
        ok = False
        try:
            r = requests.get(
                f"{_base_url()}/instance/connectionState/{_instance()}",
                headers={"apikey": _api_key()},
                timeout=_TIMEOUT,
            )
            if r.status_code == 200:
                try:
                    data = r.json()
                except Exception:
                    data = {}
                # state may be nested: {"instance": {"state": "open"}} or {"state": "open"}
                state = ""
                if isinstance(data, dict):
                    if isinstance(data.get("instance"), dict):
                        state = str(data["instance"].get("state", "") or "")
                    state = state or str(data.get("state", "") or "")
                ok = state.strip().lower() == "open"
        except Exception as exc:
            logger.info("evolution is_connected check failed: %s", str(exc)[:200])
            ok = False
        _conn_cache["at"] = now
        _conn_cache["value"] = ok
        return ok
    except Exception:
        return False


def send_text(number: str, text: str) -> dict:
    try:
        r = requests.post(
            f"{_base_url()}/message/sendText/{_instance()}",
            headers=_headers(),
            json={"number": number, "text": text},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "response": r.json() if r.content else {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("evolution send_text failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def send_voice(number: str, mp3_bytes: bytes) -> dict:
    try:
        audio_b64 = base64.b64encode(bytes(mp3_bytes)).decode("ascii")
        r = requests.post(
            f"{_base_url()}/message/sendWhatsAppAudio/{_instance()}",
            headers=_headers(),
            json={"number": number, "audio": audio_b64},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "response": r.json() if r.content else {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("evolution send_voice failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def send_document(number: str, pdf_bytes: bytes, filename: str = "report.pdf",
                  caption: str = "") -> dict:
    """PDF as document via sendMedia (mediatype document). Never raises."""
    try:
        audio_b64 = base64.b64encode(bytes(pdf_bytes or b"")).decode("ascii")
        if not audio_b64:
            return {"ok": False, "error": "pdf khaali hai"}
        r = requests.post(
            f"{_base_url()}/message/sendMedia/{_instance()}",
            headers=_headers(),
            json={"number": number, "mediatype": "document", "media": audio_b64,
                  "fileName": filename or "report.pdf", "caption": caption or ""},
            timeout=_TIMEOUT,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "response": r.json() if r.content else {}}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:300]}"}
    except Exception as exc:
        logger.info("evolution send_document failed: %s", str(exc)[:200])
        return {"ok": False, "error": str(exc)[:300]}


def download_media(message_obj: dict) -> bytes | None:
    """Download media bytes for an inbound message. None on any failure."""
    try:
        data = message_obj or {}
        key = (data.get("key") or {}) if isinstance(data, dict) else {}
        msg_id = key.get("id")
        if not msg_id:
            # also accept the inner message dict shape
            return None
        r = requests.post(
            f"{_base_url()}/chat/getBase64FromMediaMessage",
            headers=_headers(),
            json={"message": {"key": {"id": msg_id}}},
            timeout=_TIMEOUT,
        )
        if r.status_code != 200:
            return None
        try:
            payload = r.json()
        except Exception:
            return None
        b64 = payload.get("base64", "") or ""
        if not b64:
            return None
        # strip data-url prefix if present
        if "," in b64 and b64.strip().startswith("data:"):
            b64 = b64.split(",", 1)[1]
        import tempfile

        raw = base64.b64decode(b64)
        # stream to temp file to avoid holding huge blobs twice in memory
        with tempfile.NamedTemporaryFile(suffix=".media", delete=True) as tmp:
            tmp.write(raw)
            tmp.flush()
            tmp.seek(0)
            return tmp.read()
    except Exception as exc:
        logger.info("evolution download_media failed: %s", str(exc)[:200])
        return None


def status() -> dict:
    configured = bool(_base_url() and _api_key() and _instance())
    try:
        connected = is_connected()
    except Exception:
        connected = False
    instructions = (
        "1. Create instance: curl -X POST {url}/instance/create -H \"apikey: KEY\" "
        "-H \"Content-Type: application/json\" -d '{{\"instanceName\":\"{inst}\",\"qrcode\":true}}'. "
        "2. Connect: GET {url}/instance/connect/{inst} with apikey header, then scan the QR. "
        "3. Set webhook: POST {url}/webhook/set/{inst} with body "
        "{{\"webhook\":{{\"enabled\":true,\"url\":\"http://host.docker.internal:8000/webhook/whatsapp\","
        "\"events\":[\"MESSAGES_UPSERT\"]}}}}."
    ).format(url=_base_url(), inst=_instance())
    return {
        "configured": configured,
        "connected": bool(connected),
        "instance": _instance(),
        "instructions": instructions,
    }
