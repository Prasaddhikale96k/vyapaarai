"""Web auth: WhatsApp-registered owners ke liye OTP + JWT login. Real, never crashes."""

import logging
import os
import random
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter

logger = logging.getLogger("vyapaarai.auth")

router = APIRouter(tags=["auth"])

_bearer = HTTPBearer(auto_error=False)

OTP_TTL_MIN = 5


class OtpRequest(BaseModel):
    phone: str


class OtpVerify(BaseModel):
    phone: str
    code: str


class RegisterRequest(BaseModel):
    phone: str
    name: Optional[str] = ""
    business_name: Optional[str] = ""
    business_type: str
    distributors: Optional[list] = None
    distributor_phone: Optional[str] = ""
    language: Optional[str] = "hi"


def _digits(text) -> str:
    try:
        return "".join(ch for ch in str(text or "") if ch.isdigit())
    except Exception:
        return ""


def _jwt_secret() -> str:
    try:
        from app import config as _cfg

        s = os.getenv("JWT_SECRET", "") or str(getattr(_cfg, "JWT_SECRET", "") or "")
    except Exception:
        s = os.getenv("JWT_SECRET", "")
    return s or ""


def _admin_phone() -> str:
    try:
        from app import config as _cfg

        raw = os.getenv("ADMIN_PHONE", "") or str(getattr(_cfg, "ADMIN_PHONE", "") or "")
    except Exception:
        raw = os.getenv("ADMIN_PHONE", "")
    return _digits(raw)


def _is_dev() -> bool:
    try:
        from app import config as _cfg

        env = os.getenv("ENVIRONMENT", "") or str(getattr(_cfg, "ENVIRONMENT", "") or "")
    except Exception:
        env = os.getenv("ENVIRONMENT", "")
    return (env or "development").strip().lower() == "development"


def _send_login_otp(phone: str, code: str) -> bool:
    try:
        from app.services import notify as _notify

        res = _notify.send_text(phone or "", f"🔐 VyapaarAI login OTP: {code}. 5 min me use karein.")
        return bool(isinstance(res, dict) and not res.get("simulated", True))
    except Exception:
        return False


def _owner_to_dict(prof, is_admin: bool = False) -> dict:
    try:
        from app.services.owners import serialize_owner

        d = serialize_owner(prof)
        d["is_admin"] = bool(is_admin)
        return d
    except Exception:
        return {"is_admin": bool(is_admin)}


def is_admin_owner(prof) -> bool:
    try:
        if int(getattr(prof, "id", 0) or 0) == 1:
            return True
        admin = _admin_phone()
        if admin and _digits(getattr(prof, "phone", "")) == admin:
            return True
        return False
    except Exception:
        return False


def _decode_token(token: str) -> dict:
    secret = _jwt_secret()
    if not secret:
        raise HTTPException(status_code=500, detail="Server JWT not configured")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expire ho gaya — dobara login karein")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_owner(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
):
    if creds is None or not (creds.credentials or "").strip():
        raise HTTPException(status_code=401, detail="Login chahiye — /login pe OTP lo")
    payload = _decode_token(creds.credentials.strip())
    try:
        oid = int(payload.get("sub") or 0)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
    except Exception:
        prof = None
    if prof is None or not bool(getattr(prof, "allowed", False)):
        raise HTTPException(status_code=401, detail="Account active nahi hai")
    return prof


def get_optional_owner(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """Token ho to uska owner, warna None (caller default owner 1 use karega)."""
    try:
        if creds is None or not (creds.credentials or "").strip():
            return None
        payload = jwt.decode(creds.credentials.strip(), _jwt_secret(), algorithms=["HS256"])
        oid = int(payload.get("sub") or 0)
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        if prof is None or not bool(getattr(prof, "allowed", False)):
            return None
        return prof
    except Exception:
        return None


def require_admin(prof=Depends(get_current_owner)):
    if not is_admin_owner(prof):
        raise HTTPException(status_code=403, detail="Sirf admin kar sakta hai")
    return prof


def owner_id_of(prof, default: int = 1) -> int:
    try:
        if prof is not None:
            return int(getattr(prof, "id", default) or default)
    except Exception:
        pass
    return default


@router.post("/auth/otp/request")
@limiter.limit("5/minute")
def otp_request(request: Request, req: OtpRequest, db: Session = Depends(get_db)):
    from app.models import OwnerProfile

    phone = _digits(req.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=422, detail="Sahi phone number bhejo")
    prof = _find_profile_by_phone(db, req.phone)
    if prof is not None:
        phone = str(getattr(prof, "phone", "") or "") or phone
    if prof is None:
        # one-shot P1: OTP = onboarding — unknown number gets honest 403, but
        # an existing (even inactive) profile may always request an OTP
        raise HTTPException(
            status_code=403,
            detail="Ye number registered nahi hai — pehle /register karo ya WhatsApp par 'hi' bhejo",
        )
    code = "%06d" % random.randint(0, 999999)
    try:
        prof.otp_code = code
        prof.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MIN)
        prof.otp_attempts = 0
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="OTP bana nahi paya")
    sent = _send_login_otp(phone, code)
    out = {"sent": bool(sent)}
    if not sent:
        if _is_dev():
            out["sent"] = True
            out["dev_otp"] = code
        else:
            # P15: production me dev_otp KABHI nahi — honest failure with message
            out["sent"] = False
            out["error"] = "OTP WhatsApp par nahi bheja ja saka — bridge (919511996418) check karo"
    return out


@router.post("/auth/otp/verify")
def otp_verify(req: OtpVerify, db: Session = Depends(get_db)):
    from app.models import OwnerProfile

    phone = _digits(req.phone)
    prof = _find_profile_by_phone(db, req.phone)
    if prof is not None:
        phone = str(getattr(prof, "phone", "") or "") or phone
    if prof is None:
        raise HTTPException(status_code=401, detail="Galat number ya OTP")
    try:
        exp = getattr(prof, "otp_expires_at", None)
        expired = exp is None or datetime.utcnow() > exp
    except Exception:
        expired = True
    entered = _digits(req.code)
    ok = (
        not expired
        and bool(getattr(prof, "otp_code", None))
        and entered
        and entered == str(getattr(prof, "otp_code", "") or "")
    )
    if not ok:
        raise HTTPException(status_code=401, detail="Galat ya expire OTP")
    # one-shot P1: OTP verify = onboarding — inactive profile activates HERE
    activated = False
    try:
        prof.otp_code = None
        prof.otp_expires_at = None
        prof.otp_attempts = 0
        if not bool(getattr(prof, "allowed", False)):
            prof.allowed = True
            try:
                prof.reg_step = None
            except Exception:
                pass
            activated = True
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    if activated:
        try:
            from app.services import notify as _notify

            _notify.send_text(
                phone,
                "🎉 Account ACTIVE! Ab photo/voice/CSV bhejiye — main likh lunga. Pehli entry bhejo aur shuru karo!",
            )
        except Exception:
            pass
        try:
            from app.services import owners as _owners

            _owners._notify_admin_new_registration(prof, note="OTP-active (ops info)")
        except Exception:
            pass
    secret = _jwt_secret()
    if not secret:
        raise HTTPException(status_code=500, detail="Server JWT not configured")
    token = jwt.encode(
        {"sub": str(int(prof.id)), "phone": prof.phone,
         "exp": datetime.utcnow() + timedelta(days=7)},
        secret,
        algorithm="HS256",
    )
    admin = is_admin_owner(prof)
    return {"token": token, "owner": _owner_to_dict(prof, admin), "activated": activated}


def _norm_phone(raw) -> str:
    """Web normalization: digits only, strip leading 91 country code."""
    d = _digits(raw)
    if len(d) > 10 and d.startswith("91"):
        d = d[2:]
    return d


def _phone_candidates(raw) -> list:
    """All stored-form variants of a typed phone (register stores stripped form)."""
    d = _digits(raw)
    stripped = d[2:] if len(d) > 10 and d.startswith("91") else d
    cands = [d]
    if stripped not in cands:
        cands.append(stripped)
    if len(stripped) == 10 and ("91" + stripped) not in cands:
        cands.append("91" + stripped)
    return cands


def _find_profile_by_phone(db, raw):
    """Find OwnerProfile by any phone variant. None if no match."""
    from app.models import OwnerProfile

    try:
        return db.query(OwnerProfile).filter(
            OwnerProfile.phone.in_(_phone_candidates(raw))).first()
    except Exception:
        return None


@router.post("/auth/register")
@limiter.limit("10/minute")
def web_register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    """Web registration: creates inactive profile — OTP verify activates it (no admin gate)."""
    from app.models import OwnerProfile

    d = _digits(req.phone)
    if len(d) < 10:
        raise HTTPException(status_code=422, detail="Sahi phone number bhejo (10+ digits)")
    stripped = d[2:] if len(d) > 10 and d.startswith("91") else d
    candidates = [d]
    if stripped not in candidates:
        candidates.append(stripped)
    if len(stripped) == 10 and ("91" + stripped) not in candidates:
        candidates.append("91" + stripped)
    prof = db.query(OwnerProfile).filter(OwnerProfile.phone.in_(candidates)).first()
    if prof is not None and bool(getattr(prof, "allowed", False)):
        raise HTTPException(status_code=409, detail="Already registered — login karo")
    if prof is not None:
        return {"status": "pending",
                "message": "⏳ Number mil gaya — ab OTP verify karo aur shuru karo ✅"}
    # P15: business_type enum validation (11 categories)
    from app.services.owners import BUSINESS_TYPE_CODES, MAX_DISTRIBUTORS

    btype = str(req.business_type or "").strip().lower()
    if btype not in BUSINESS_TYPE_CODES:
        raise HTTPException(
            status_code=422,
            detail=f"business_type galat hai — chuno: {', '.join(sorted(BUSINESS_TYPE_CODES))}",
        )
    # P15: distributors list (10-13 digits each, dedupe, max 5)
    dist_list = []
    for raw in (req.distributors or []):
        try:
            dd = _digits(raw)
        except Exception:
            dd = ""
        if dd and (10 <= len(dd) <= 13) and dd not in dist_list:
            dist_list.append(dd)
        if len(dist_list) >= MAX_DISTRIBUTORS:
            break
    # legacy single distributor_phone field -> merge into list
    try:
        legacy = _digits(req.distributor_phone)
    except Exception:
        legacy = ""
    if legacy and (10 <= len(legacy) <= 13) and legacy not in dist_list:
        dist_list.insert(0, legacy)
    dist_list = dist_list[:MAX_DISTRIBUTORS]
    import json as _json

    lang = str(req.language or "hi").strip().lower()[:8] or "hi"
    prof = OwnerProfile(
        phone=stripped,
        name=str(req.name or "").strip()[:128] or None,
        business_name=str(req.business_name or "").strip()[:128] or None,
        business_type=btype,
        distributors=_json.dumps(dist_list) if dist_list else None,
        distributor_phone=dist_list[0] if dist_list else None,
        language=lang,
        allowed=False,
        onboarded=False,
        reg_step=None,
    )
    try:
        db.add(prof)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Register nahi ho paya")
    try:
        from app.services import owners as _owners

        _owners._notify_admin_new_registration(prof)
    except Exception:
        pass
    return {"status": "pending",
            "message": "✅ Number note ho gaya — ab Login par OTP verify karo aur shuru karo"}


@router.get("/distributors/lookup")
def distributors_lookup(q: str = Query(default=""), db: Session = Depends(get_db),
                        _owner=Depends(get_optional_owner)):
    """Smart picker (I1): approved owner_profiles me phone prefix ya name substring se match. Limit 8."""
    from app.models import OwnerProfile

    query = str(q or "").strip()
    if not query:
        return []
    try:
        digits = _digits(query)
    except Exception:
        digits = ""
    try:
        like = f"%{query[:64]}%"
        q_obj = db.query(OwnerProfile).filter(OwnerProfile.allowed.is_(True))
        if digits:
            q_obj = q_obj.filter(
                (OwnerProfile.phone.like(f"{digits[:12]}%")) |
                (OwnerProfile.name.ilike(like)) |
                (OwnerProfile.business_name.ilike(like))
            )
        else:
            q_obj = q_obj.filter(
                (OwnerProfile.name.ilike(like)) |
                (OwnerProfile.business_name.ilike(like))
            )
        rows = q_obj.order_by(OwnerProfile.id).limit(8).all()
        out = []
        for p in rows:
            d = _owner_to_dict(p, False)
            out.append({
                "phone": d.get("phone", ""),
                "name": d.get("name", ""),
                "business_name": d.get("business_name", ""),
                "business_type": d.get("business_type", ""),
            })
        return out
    except Exception:
        return []


@router.get("/me")
def me(prof=Depends(get_current_owner)):
    return _owner_to_dict(prof, is_admin_owner(prof))


@router.get("/owners")
def list_owners(status: Optional[str] = Query(default=None), db: Session = Depends(get_db),
               _admin=Depends(require_admin)):
    from app.models import OwnerProfile

    q = db.query(OwnerProfile).order_by(OwnerProfile.id)
    if (status or "").strip().lower() == "pending":
        q = q.filter(OwnerProfile.allowed.is_(False))
    return [_owner_to_dict(p, is_admin_owner(p)) for p in q.all()]


@router.post("/owners/{owner_id}/approve")
def approve(owner_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    from app.services import owners as _owners

    res = _owners.approve_owner(db, owner_id)
    if not res.get("ok"):
        raise HTTPException(status_code=404, detail=res.get("error") or "Approve nahi hua")
    return res


@router.post("/owners/{owner_id}/reject")
def reject(owner_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    from app.services import owners as _owners

    res = _owners.reject_owner(db, owner_id)
    if not res.get("ok"):
        raise HTTPException(status_code=404, detail=res.get("error") or "Reject nahi hua")
    return res
