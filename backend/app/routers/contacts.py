"""Contacts + supplier messaging. JWT owner-scoped. Never raises."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.routers.auth import get_current_owner, owner_id_of

logger = logging.getLogger("vyapaarai.contacts")

router = APIRouter(tags=["contacts"])

CONTACT_KINDS = {"supplier", "customer", "distributor", "other"}


class ContactIn(BaseModel):
    name: str = ""
    phone: str = ""
    kind: str = "other"
    note: str = ""


class SendIn(BaseModel):
    message: str = ""


from app.services.phone import normalize_phone as _digits  # single util (S8#25)


def serialize_contact(c) -> dict:
    try:
        created = c.created_at.isoformat() if getattr(c, "created_at", None) else None
    except Exception:
        created = str(getattr(c, "created_at", None))
    return {
        "id": getattr(c, "id", None),
        "kind": getattr(c, "kind", "other") or "other",
        "name": getattr(c, "name", "") or "",
        "phone": getattr(c, "phone", "") or "",
        "note": getattr(c, "note", "") or "",
        "created_at": created,
    }


def sign_message(text: str, business_name: str) -> str:
    """Append the standard outbound signature line."""
    base = str(text or "").rstrip()
    biz = str(business_name or "").strip()
    sig = f" — {biz} (via VyapaarAI)" if biz else " (via VyapaarAI)"
    if base.endswith(sig):
        return base
    return base + sig


@router.get("/contacts")
def list_contacts(db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    from app.models import Contact

    rows = (
        db.query(Contact)
        .filter(Contact.owner_id == owner_id_of(owner))
        .order_by(Contact.kind, Contact.name)
        .all()
    )
    return [serialize_contact(c) for c in rows]


@router.post("/contacts")
def create_contact(body: ContactIn, db: Session = Depends(get_db),
                   owner=Depends(get_current_owner)):
    from app.models import Contact

    name = str(body.name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Naam kam se kam 2 akshar likho")
    phone = _digits(body.phone)
    if not (10 <= len(phone) <= 13):
        raise HTTPException(status_code=422, detail="Sahi 10–13 digit phone daalo")
    kind = str(body.kind or "other").strip().lower()
    if kind not in CONTACT_KINDS:
        raise HTTPException(status_code=422, detail="kind supplier|customer|distributor|other me se ho")
    c = Contact(owner_id=owner_id_of(owner), kind=kind, name=name[:128],
                phone=phone, note=str(body.note or "").strip() or None)
    try:
        db.add(c)
        db.commit()
        db.refresh(c)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Contact save nahi hua: {str(exc)[:120]}")
    return serialize_contact(c)


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db),
                   owner=Depends(get_current_owner)):
    from app.models import Contact

    c = (
        db.query(Contact)
        .filter(Contact.owner_id == owner_id_of(owner), Contact.id == int(contact_id))
        .first()
    )
    if c is None:
        raise HTTPException(status_code=404, detail="Contact nahi mila")
    try:
        db.delete(c)
        db.commit()
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Delete nahi hua: {str(exc)[:120]}")
    return {"ok": True}


@router.post("/contacts/{contact_id}/send")
@limiter.limit("20/minute")
def send_to_contact(request: Request, contact_id: int, body: SendIn,
                    db: Session = Depends(get_db), owner=Depends(get_current_owner)):
    """Send a WhatsApp message to a contact via the bridge + signature line."""
    from app.models import Contact
    from app.services import notify

    c = (
        db.query(Contact)
        .filter(Contact.owner_id == owner_id_of(owner), Contact.id == int(contact_id))
        .first()
    )
    if c is None:
        raise HTTPException(status_code=404, detail="Contact nahi mila")
    text = str(body.message or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message khaali hai — kuch likho")
    if len(text) > 1000:
        raise HTTPException(status_code=422, detail="Message 1000 akshar se chhota rakho")
    try:
        biz = str(getattr(owner, "business_name", "") or "").strip()
    except Exception:
        biz = ""
    try:
        res = notify.send_text(str(getattr(c, "phone", "") or ""), sign_message(text, biz))
    except Exception as exc:
        return {"status": "simulated", "error": str(exc)[:200]}
    if isinstance(res, dict) and not res.get("simulated", True):
        return {"status": "sent"}
    err = ""
    try:
        err = str((res or {}).get("error", "") or "")
    except Exception:
        pass
    return {"status": "simulated", "error": err[:200] or "gateway down — message nahi gaya"}


def ensure_supplier_contact(db, owner_id: int, name: str, phone: str) -> None:
    """Reorder approve: target_phone not in contacts -> auto-create kind=supplier. Never raises."""
    try:
        from app.models import Contact

        oid = int(owner_id or 1)
        ph = _digits(phone)
        if not ph:
            return
        hit = (
            db.query(Contact)
            .filter(Contact.owner_id == oid, Contact.phone == ph)
            .first()
        )
        if hit is not None:
            return
        db.add(Contact(owner_id=oid, kind="supplier",
                       name=str(name or "")[:128] or "Supplier",
                       phone=ph, note="auto: reorder action se"))
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
