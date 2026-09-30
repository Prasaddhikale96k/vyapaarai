"""Multi-owner registration state machine + admin approval. 100% real, never raises."""

import json
import logging
import os
import random
import re
from datetime import datetime, timedelta

logger = logging.getLogger("vyapaarai.owners")

OTP_TTL_MIN = 5
OTP_MAX_ATTEMPTS = 3

# P15: 11 MSME business categories (I3). Codes are canonical; labels human.
BUSINESS_TYPES = [
    ("kirana", "Kirana / General Store"),
    ("pharmacy", "Pharmacy / Medical"),
    ("hardware", "Hardware"),
    ("garments", "Garments / Fashion"),
    ("electronics", "Electronics / Mobile"),
    ("bakery", "Bakery / Food"),
    ("dairy", "Dairy"),
    ("stationery", "Stationery"),
    ("auto_parts", "Auto Parts"),
    ("services", "Services"),
    ("other", "Other"),
]
BUSINESS_TYPE_CODES = {c for c, _ in BUSINESS_TYPES}
MAX_DISTRIBUTORS = 5


def _category_list_text() -> str:
    lines = [f"{i}. {label}" for i, (_c, label) in enumerate(BUSINESS_TYPES, start=1)]
    return "Apni business category chuno (number ya naam):\n" + "\n".join(lines)


def _parse_category(text: str):
    """Number (1-11) ya naam se business_type code nikalo. None = nahi mila."""
    t = str(text or "").strip()
    if not t:
        return None
    m = re.match(r"^(\d{1,2})$", t)
    if m:
        idx = int(m.group(1))
        if 1 <= idx <= len(BUSINESS_TYPES):
            return BUSINESS_TYPES[idx - 1][0]
        return None
    tl = t.lower()
    for code, label in BUSINESS_TYPES:
        if tl == code or tl == label.lower():
            return code
    for code, label in BUSINESS_TYPES:
        if code in tl or label.lower() in tl:
            return code
    return None


def _parse_distributors(text: str):
    """Comma/space-separated phones -> deduped list (10-13 digits each, max 5)."""
    raw = str(text or "").replace(",", " ")
    parts = raw.split()
    out = []
    for part in parts:
        d = _digits(part)
        if not d:
            continue
        if not (10 <= len(d) <= 13):
            continue
        if d not in out:
            out.append(d)
        if len(out) >= MAX_DISTRIBUTORS:
            break
    return out


def _get_distributors(prof) -> list:
    try:
        raw = getattr(prof, "distributors", None)
        if raw:
            arr = json.loads(raw)
            if isinstance(arr, list):
                return [str(x) for x in arr]
    except Exception:
        pass
    d = str(getattr(prof, "distributor_phone", "") or "").strip()
    return [d] if d else []


def _set_distributors(prof, phones: list) -> None:
    phones = [str(p) for p in (phones or []) if str(p).strip()][:MAX_DISTRIBUTORS]
    prof.distributors = json.dumps(phones) if phones else None
    prof.distributor_phone = phones[0] if phones else None


_STEP_ASK = {
    "NAME": "🙏 Namaste! VyapaarAI mein swagat. Pehle apna NAAM bhejiye.",
    "BUSINESS": "Dukaan ka naam? (free text)",
    "CATEGORY": _category_list_text(),
    "DISTRIBUTOR": "Aapke DISTRIBUTOR ke mobile numbers? (comma-separated, max 5)",
    "LANGUAGE": "Bhasha? (Hindi/Marathi/English...)",
}


from app.services.phone import normalize_phone as _digits  # single util (S8#25)


def _norm_lang(text) -> str:
    try:
        t = str(text or "").strip().lower()
    except Exception:
        return "hi"
    if any(k in t for k in ("hindi", "हिंदी", "हिन्दी", "hin")):
        return "hi"
    if any(k in t for k in ("marathi", "मराठी", "mar")):
        return "mr"
    if any(k in t for k in ("english", "angrezi", "eng", "en")):
        return "en"
    if any(k in t for k in ("gujarati", "guj")):
        return "gu"
    if any(k in t for k in ("tamil", "tam")):
        return "ta"
    if any(k in t for k in ("telugu", "tel")):
        return "te"
    if any(k in t for k in ("kannada", "kan")):
        return "kn"
    if len(t) <= 3 and t.isalpha():
        return t
    return "hi"


def _bridge_label() -> str:
    """Bridge/assistant number for user-facing messages — config read, never hardcoded."""
    try:
        from app import config as _cfg

        raw = os.getenv("ASSISTANT_PHONE", "") or str(getattr(_cfg, "ASSISTANT_PHONE", "") or "")
    except Exception:
        raw = os.getenv("ASSISTANT_PHONE", "")
    return _digits(raw) or "bridge"


def _is_dev() -> bool:
    try:
        from app import config as _cfg

        env = os.getenv("ENVIRONMENT", "") or str(getattr(_cfg, "ENVIRONMENT", "") or "")
    except Exception:
        env = os.getenv("ENVIRONMENT", "")
    return (env or "development").strip().lower() == "development"


def get_profile(db, phone: str):
    try:
        from app.models import OwnerProfile

        return db.query(OwnerProfile).filter(OwnerProfile.phone == str(phone or "")).first()
    except Exception:
        return None


def _save(db) -> None:
    try:
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _send_otp_text(phone: str, code: str) -> bool:
    """OTP wa_gateway se bhejo. True = gateway ne accept kiya."""
    try:
        from app.services import wa_gateway as _gw

        use_openwa = True
        try:
            use_openwa = _gw.gateway_name() == "openwa"
        except Exception:
            use_openwa = True
        if use_openwa:
            try:
                res = _gw.send_text(phone or "", f"🔐 VyapaarAI OTP: {code}. Ise reply karke verify karein.")
            except Exception:
                return False
            return bool(isinstance(res, dict) and res.get("ok"))
        from app.services import evolution as _evo

        try:
            res = _evo.send_text(phone or "", f"🔐 VyapaarAI OTP: {code}. Ise reply karke verify karein.")
        except Exception:
            return False
        return bool(isinstance(res, dict) and res.get("ok"))
    except Exception:
        return False


def _admin_phone() -> str:
    try:
        from app import config as _cfg

        raw = os.getenv("ADMIN_PHONE", "") or str(getattr(_cfg, "ADMIN_PHONE", "") or "")
    except Exception:
        raw = os.getenv("ADMIN_PHONE", "")
    return _digits(raw)


WELCOME_TEXT = "🎉 Account ACTIVE! Ab photo/voice/CSV bhejiye — main likh lunga. Pehli entry bhejo aur shuru karo!"


def _notify_admin_new_registration(profile, note: str = "") -> None:
    """One-shot P1: informational OPS ping only — no approval gate exists."""
    try:
        admin = _admin_phone()
        if not admin:
            logger.info("ADMIN_PHONE khaali — registration alert skip (phone=%s)", getattr(profile, "phone", "?"))
            return
        try:
            from app.models import OwnerProfile as _OP

            _ = _OP
        except Exception:
            pass
        suffix = f" • {note}" if note else " (OTP pending)"
        text = (
            f"🆕 Nayi registration: {getattr(profile, 'name', '') or ''} "
            f"({getattr(profile, 'business_name', '') or ''}) • "
            f"{getattr(profile, 'phone', '') or ''}{suffix}"
        )
        try:
            from app.services import notify as _notify

            _notify.send_text(admin, text)
        except Exception as exc:
            logger.info("admin notify failed: %s", str(exc)[:200])
    except Exception:
        pass


def start_registration(db, phone: str, push_name=None) -> dict:
    """Naya number → NAME step. Existing → already/resume. Hamesha {'reply': ...}."""
    try:
        from app.models import OwnerProfile

        phone = _digits(phone)
        prof = get_profile(db, phone)
        if prof is not None and bool(getattr(prof, "allowed", False)):
            return {"reply": "Aap already registered hain ✅", "profile": prof}
        if prof is not None and getattr(prof, "reg_step", None):
            step = str(prof.reg_step or "")
            return {"reply": _STEP_ASK.get(step, _STEP_ASK["NAME"]), "profile": prof, "resumed": True}
        if prof is None:
            prof = OwnerProfile(
                phone=phone, name=str(push_name) if push_name else None,
                language="hi", allowed=False, onboarded=False, reg_step="NAME",
            )
            try:
                db.add(prof)
                _save(db)
                try:
                    db.refresh(prof)
                except Exception:
                    pass
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                prof = get_profile(db, phone)
                if prof is None:
                    return {"reply": "Kuch gadbad ho gayi, dobara try karein 🙏"}
        else:
            try:
                prof.reg_step = "NAME"
                _save(db)
            except Exception:
                pass
        return {"reply": _STEP_ASK["NAME"], "profile": prof}
    except Exception as exc:
        logger.info("start_registration failed: %s", str(exc)[:200])
        return {"reply": "Kuch gadbad ho gayi, dobara try karein 🙏"}


def advance_registration(db, phone: str, text: str) -> dict:
    """Active reg_step ko aage badhao. Hamesha {'reply': ...}."""
    try:
        phone = _digits(phone)
        prof = get_profile(db, phone)
        if prof is None:
            return start_registration(db, phone, None)
        if bool(getattr(prof, "allowed", False)):
            return {"reply": "Aap already registered hain ✅", "profile": prof}
        step = str(getattr(prof, "reg_step", "") or "")
        if not step:
            return start_registration(db, phone, None)
        t = str(text or "").strip()

        if step == "NAME":
            if len(t) < 2:
                return {"reply": "Naam thoda lamba likhiye 🙏", "profile": prof}
            prof.name = t[:128]
            prof.reg_step = "BUSINESS"
            _save(db)
            return {"reply": _STEP_ASK["BUSINESS"], "profile": prof}

        if step == "BUSINESS":
            if len(t) < 2:
                return {"reply": "Dukaan ka naam thoda lamba likhiye 🙏", "profile": prof}
            prof.business_name = t[:128]
            prof.reg_step = "CATEGORY"
            _save(db)
            return {"reply": _STEP_ASK["CATEGORY"], "profile": prof}

        if step == "CATEGORY":
            code = _parse_category(t)
            if not code:
                return {"reply": _STEP_ASK["CATEGORY"], "profile": prof}
            prof.business_type = code
            prof.reg_step = "DISTRIBUTOR"
            _save(db)
            return {"reply": _STEP_ASK["DISTRIBUTOR"], "profile": prof}

        if step == "DISTRIBUTOR":
            phones = _parse_distributors(t)
            if not phones:
                return {"reply": "Distributor ka 10-digit mobile number bhejiye (comma-separated, max 5) 🙏", "profile": prof}
            _set_distributors(prof, phones)
            prof.reg_step = "LANGUAGE"
            _save(db)
            return {"reply": _STEP_ASK["LANGUAGE"], "profile": prof}

        if step == "LANGUAGE":
            prof.language = _norm_lang(t)
            code = "%06d" % random.randint(0, 999999)
            try:
                prof.otp_code = code
                prof.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MIN)
                prof.otp_attempts = 0
                prof.reg_step = "OTP"
                _save(db)
            except Exception:
                return {"reply": "Kuch gadbad ho gayi, dobara try karein 🙏", "profile": prof}
            sent = _send_otp_text(phone, code)
            if sent:
                reply = "🔐 VyapaarAI OTP: bheja gaya hai. Ise reply karke verify karein."
            elif _is_dev():
                reply = f"🔐 VyapaarAI OTP: {code}. Ise reply karke verify karein. (dev OTP: {code})"
            else:
                # P15: production me OTP code WA reply me KABHI echo nahi hota
                reply = f"❌ OTP bheja nahi ja saka — WhatsApp bridge ({_bridge_label()}) check karo, phir dobara try karein."
            return {"reply": reply, "profile": prof, "otp_sent": sent}

        if step == "OTP":
            return verify_otp(db, phone, t)

        # unknown step → restart
        try:
            prof.reg_step = "NAME"
            _save(db)
        except Exception:
            pass
        return {"reply": _STEP_ASK["NAME"], "profile": prof}
    except Exception as exc:
        logger.info("advance_registration failed: %s", str(exc)[:200])
        return {"reply": "Kuch gadbad ho gayi, dobara try karein 🙏"}


def verify_otp(db, phone: str, code: str) -> dict:
    """OTP check: sahi → ACTIVE immediately (OTP = onboarding); galat/expire → error (3 attempts → restart)."""
    try:
        phone = _digits(phone)
        prof = get_profile(db, phone)
        if prof is None or str(getattr(prof, "reg_step", "") or "") != "OTP":
            return {"reply": "Pehle registration shuru karein — apna NAAM bhejiye 🙏"}
        if bool(getattr(prof, "blocked", False)):
            return {"reply": "⛔ Account suspended hai — ops se sampark karein."}
        if bool(getattr(prof, "allowed", False)):
            return {"reply": "Aap already registered hain ✅", "profile": prof}
        try:
            attempts = int(getattr(prof, "otp_attempts", 0) or 0)
        except Exception:
            attempts = 0
        exp = getattr(prof, "otp_expires_at", None)
        try:
            expired = exp is None or datetime.utcnow() > exp
        except Exception:
            expired = True
        entered = _digits(code)
        ok = (
            not expired
            and bool(getattr(prof, "otp_code", None))
            and entered
            and entered == str(getattr(prof, "otp_code", "") or "")
        )
        if not ok:
            attempts += 1
            try:
                prof.otp_attempts = attempts
                _save(db)
            except Exception:
                pass
            if attempts >= OTP_MAX_ATTEMPTS or expired:
                try:
                    prof.reg_step = "NAME"
                    prof.otp_code = None
                    prof.otp_expires_at = None
                    prof.otp_attempts = 0
                    _save(db)
                except Exception:
                    pass
                why = "OTP expire ho gaya" if expired else "3 galat attempts"
                return {"reply": f"{why} — dobara shuru karte hain. Apna NAAM bhejiye 🙏", "profile": prof}
            left = OTP_MAX_ATTEMPTS - attempts
            return {"reply": f"❌ Galat OTP. {left} chance bache hain — sahi code bhejiye.", "profile": prof}
        # correct — activate immediately
        try:
            prof.reg_step = None
            prof.otp_code = None
            prof.otp_expires_at = None
            prof.otp_attempts = 0
            prof.allowed = True
            if not getattr(prof, "language", None):
                prof.language = "hi"
            _save(db)
        except Exception:
            pass
        _notify_admin_new_registration(prof, note="OTP-active (ops info)")
        return {
            "reply": WELCOME_TEXT,
            "profile": prof,
        }
    except Exception as exc:
        logger.info("verify_otp failed: %s", str(exc)[:200])
        return {"reply": "Kuch gadbad ho gayi, dobara try karein 🙏"}


def approve_owner(db, owner_id: int) -> dict:
    """Ops override restore: blocked=False (+allowed=True) + WhatsApp ACTIVE message."""
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == int(owner_id)).first()
        if prof is None:
            return {"ok": False, "error": "Owner nahi mila."}
        prof.allowed = True
        try:
            prof.blocked = False
        except Exception:
            pass
        prof.reg_step = None
        _save(db)
        msg = "🎉 Account ACTIVE! Ab data bhejiye: current stock list (CSV/PDF/photo) ya likh ke batayiye."
        try:
            from app.services import notify as _notify

            _notify.send_text(str(getattr(prof, "phone", "") or ""), msg)
        except Exception as exc:
            logger.info("approve notify failed: %s", str(exc)[:200])
        return {"ok": True, "owner_id": prof.id}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def reject_owner(db, owner_id: int) -> dict:
    """Ops override suspend: blocked=True (allowed untouched — onboarding flag)."""
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == int(owner_id)).first()
        if prof is None:
            return {"ok": False, "error": "Owner nahi mila."}
        try:
            prof.blocked = True
        except Exception:
            pass
        _save(db)
        try:
            from app.services import notify as _notify

            _notify.send_text(
                str(getattr(prof, "phone", "") or ""),
                "⛔ Aapka VyapaarAI account ops ne suspend kiya hai. Bahali ke liye ops se sampark karein.",
            )
        except Exception as exc:
            logger.info("reject notify failed: %s", str(exc)[:200])
        return {"ok": True, "owner_id": prof.id}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def serialize_owner(prof) -> dict:
    try:
        return {
            "id": getattr(prof, "id", None),
            "phone": getattr(prof, "phone", ""),
            "name": getattr(prof, "name", ""),
            "business_name": getattr(prof, "business_name", ""),
            "business_type": getattr(prof, "business_type", "") or "",
            "language": getattr(prof, "language", "hi") or "hi",
            "allowed": bool(getattr(prof, "allowed", False)),
            "blocked": bool(getattr(prof, "blocked", False)),
            "onboarded": bool(getattr(prof, "onboarded", False)),
            "distributor_phone": getattr(prof, "distributor_phone", ""),
            "distributors": _get_distributors(prof),
            "upi_vpa": getattr(prof, "upi_vpa", "") or "",
            "reg_step": getattr(prof, "reg_step", None),
        }
    except Exception:
        return {}
