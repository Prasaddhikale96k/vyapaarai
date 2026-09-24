"""Delivery via WA gateway (OpenWA default, Evolution optional), simulated otherwise. Never raises."""

import logging
import os

logger = logging.getLogger("vyapaarai.notify")


def _gateway_name() -> str:
    try:
        from app.services import wa_gateway as _gw

        return _gw.gateway_name()
    except Exception:
        try:
            return (os.getenv("WA_GATEWAY", "") or "openwa").strip().lower() or "openwa"
        except Exception:
            return "openwa"


def send_text(to: str, body: str) -> dict:
    try:
        logger.info("notify send_text to=%s body=%.120s", to, body)
    except Exception:
        pass
    try:
        gw = _gateway_name()
        if gw == "openwa":
            from app.services import wa_gateway

            try:
                connected = wa_gateway.is_connected()
            except Exception:
                connected = False
            if not connected:
                return {"simulated": True, "to": to, "gateway": "openwa"}
            try:
                res = wa_gateway.send_text(to or "", body or "")
            except Exception as exc:
                return {"simulated": True, "to": to, "gateway": "openwa", "error": str(exc)[:200]}
            if isinstance(res, dict) and res.get("ok"):
                out = {"simulated": False, "to": to, "gateway": "openwa"}
                try:
                    if res.get("response") is not None:
                        out["response"] = res["response"]
                except Exception:
                    pass
                return out
            err = ""
            try:
                err = str((res or {}).get("error", "") or "")
            except Exception:
                pass
            return {"simulated": True, "to": to, "gateway": "openwa", "error": err[:200]}
        from app.services import evolution

        try:
            connected = evolution.is_connected()
        except Exception:
            connected = False
        if connected:
            try:
                res = evolution.send_text(to or "", body or "")
            except Exception as exc:
                return {"simulated": True, "to": to, "error": str(exc)[:200]}
            if isinstance(res, dict) and res.get("ok"):
                out = {"simulated": False, "to": to}
                try:
                    if res.get("response") is not None:
                        out["response"] = res["response"]
                except Exception:
                    pass
                return out
            err = ""
            try:
                err = str((res or {}).get("error", "") or "")
            except Exception:
                pass
            return {"simulated": True, "to": to, "error": err[:200]}
        return {"simulated": True, "to": to}
    except Exception as exc:
        return {"simulated": True, "to": to, "error": str(exc)[:200]}


def send_document(to: str, pdf_bytes: bytes, filename: str = "report.pdf",
                  caption: str = "") -> dict:
    """PDF as WhatsApp DOCUMENT via gateway (OpenWA default, Evolution optional).

    Gateway down/unlinked -> {"simulated": True}. Never raises.
    """
    try:
        logger.info("notify send_document to=%s file=%s bytes=%d",
                    to, filename, len(bytes(pdf_bytes or b"")))
    except Exception:
        pass
    try:
        gw = _gateway_name()
        if gw == "openwa":
            from app.services import wa_gateway

            try:
                connected = wa_gateway.is_connected()
            except Exception:
                connected = False
            if not connected:
                return {"simulated": True, "to": to, "gateway": "openwa"}
            try:
                res = wa_gateway.send_document(to or "", bytes(pdf_bytes or b""),
                                               filename or "report.pdf", caption or "")
            except Exception as exc:
                return {"simulated": True, "to": to, "gateway": "openwa",
                        "error": str(exc)[:200]}
            if isinstance(res, dict) and res.get("ok"):
                return {"simulated": False, "to": to, "gateway": "openwa"}
            err = ""
            try:
                err = str((res or {}).get("error", "") or "")
            except Exception:
                pass
            return {"simulated": True, "to": to, "gateway": "openwa", "error": err[:200]}
        from app.services import evolution

        try:
            connected = evolution.is_connected()
        except Exception:
            connected = False
        if not connected:
            return {"simulated": True, "to": to, "gateway": "evolution"}
        try:
            res = evolution.send_document(to or "", bytes(pdf_bytes or b""),
                                          filename or "report.pdf", caption or "")
        except Exception as exc:
            return {"simulated": True, "to": to, "gateway": "evolution",
                    "error": str(exc)[:200]}
        if isinstance(res, dict) and res.get("ok"):
            return {"simulated": False, "to": to, "gateway": "evolution"}
        err = ""
        try:
            err = str((res or {}).get("error", "") or "")
        except Exception:
            pass
        return {"simulated": True, "to": to, "gateway": "evolution", "error": err[:200]}
    except Exception as exc:
        return {"simulated": True, "to": to, "error": str(exc)[:200]}
