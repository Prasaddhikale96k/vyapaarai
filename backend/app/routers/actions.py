from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Action
from app.routers.auth import get_optional_owner, owner_id_of
from app.routers.intelligence import invalidate_intel
from app.services.actions import build_supplier_order_text, generate_recommendations, serialize_action
from app.services.notify import send_text

router = APIRouter(tags=["actions"])


class ApproveIn(BaseModel):
    supplier_contact_id: Optional[int] = None
    supplier_phone: Optional[str] = ""
    supplier_name: Optional[str] = ""


class SendToSupplierIn(BaseModel):
    contact_id: Optional[int] = None
    phone: Optional[str] = ""
    name: Optional[str] = ""


def _resolve_supplier(db, oid: int, contact_id=None, phone: str = "", name: str = ""):
    """Contacts me se supplier resolve karo. Returns (phone, name) ya ("","").

    contact_id > manual phone > "" . Never raises."""
    try:
        if contact_id is not None:
            try:
                from app.models import Contact

                c = (
                    db.query(Contact)
                    .filter(Contact.owner_id == int(oid or 1),
                            Contact.id == int(contact_id))
                    .first()
                )
                if c is not None:
                    return (str(getattr(c, "phone", "") or ""),
                            str(getattr(c, "name", "") or ""))
            except Exception:
                pass
        ph = ""
        try:
            from app.services.phone import normalize_phone as _digits

            ph = _digits(phone)
        except Exception:
            ph = "".join(ch for ch in str(phone or "") if ch.isdigit())
        if ph and (10 <= len(ph) <= 13):
            nm = str(name or "").strip()
            if not nm:
                try:
                    from app.models import Contact

                    hit = (
                        db.query(Contact)
                        .filter(Contact.owner_id == int(oid or 1),
                                Contact.phone == ph)
                        .first()
                    )
                    if hit is not None:
                        nm = str(getattr(hit, "name", "") or "")
                except Exception:
                    pass
            return (ph, nm)
    except Exception:
        pass
    return ("", "")


def _biz_of(owner) -> str:
    try:
        return str(getattr(owner, "business_name", "") or "").strip()
    except Exception:
        return ""


@router.get("/actions")
def list_actions(status: Optional[str] = Query(default=None), db: Session = Depends(get_db),
                 owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    q = db.query(Action).filter(Action.owner_id == oid)
    if status:
        q = q.filter(Action.status == status)
    rows = q.order_by(Action.id.desc()).all()
    return [serialize_action(a) for a in rows]


@router.post("/actions/generate")
def generate(db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    actions = generate_recommendations(db, owner_id=owner_id_of(owner))
    invalidate_intel()
    return {"created": len(actions), "actions": actions}


@router.post("/actions/{action_id}/approve")
def approve_action(action_id: int, body: Optional[ApproveIn] = None,
                   db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    a = db.query(Action).filter(Action.id == action_id, Action.owner_id == oid).first()
    if a is None:
        raise HTTPException(status_code=404, detail="Unknown action id")
    if a.status in ("approved", "sent", "rejected"):
        raise HTTPException(status_code=409, detail=f"Action already {a.status}")
    # supplier override (Actions UI picker se): contact ya manual phone
    try:
        b = body or ApproveIn()
        sph, snm = _resolve_supplier(
            db, oid, getattr(b, "supplier_contact_id", None),
            str(getattr(b, "supplier_phone", "") or ""),
            str(getattr(b, "supplier_name", "") or ""))
        if sph:
            a.target_phone = sph
            if snm:
                if str(getattr(a, "type", "") or "") == "reorder":
                    # PRODUCT naam bachao: supplier naam meta me, taaki order
                    # me "X pcs BHEJ DIJIYE" sahi item ke saath jaye.
                    try:
                        m = a.get_meta() if hasattr(a, "get_meta") else {}
                        if not isinstance(m, dict):
                            m = {}
                        m["supplier_name"] = snm
                        a.set_meta(m)
                    except Exception:
                        pass
                else:
                    a.target_name = snm or a.target_name
    except Exception:
        pass
    a.status = "approved"
    try:
        db.commit()
        db.refresh(a)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(exc))
    # one-shot P2: reorder approve -> supplier contact auto-create + signature line
    try:
        from app.routers.contacts import ensure_supplier_contact, sign_message

        if str(getattr(a, "type", "") or "") == "reorder":
            try:
                _m = a.get_meta() if hasattr(a, "get_meta") else {}
                _snm = str((_m or {}).get("supplier_name", "") or "").strip()
            except Exception:
                _snm = ""
            ensure_supplier_contact(db, oid, _snm or str(getattr(a, "target_name", "") or ""),
                                    str(getattr(a, "target_phone", "") or ""))
        biz = _biz_of(owner)
        if str(getattr(a, "type", "") or "") == "reorder":
            text = build_supplier_order_text(a, biz)
        else:
            text = sign_message(str(getattr(a, "draft_message", "") or ""), biz)
    except Exception:
        try:
            text = str(getattr(a, "draft_message", "") or "")
        except Exception:
            text = ""
    # reorder + supplier phone nahi hai -> approve rakho, picker se bhejna hoga
    try:
        is_reorder = str(getattr(a, "type", "") or "") == "reorder"
    except Exception:
        is_reorder = False
    try:
        no_phone = not str(getattr(a, "target_phone", "") or "").strip()
    except Exception:
        no_phone = True
    if is_reorder and no_phone:
        try:
            order_message = build_supplier_order_text(a, _biz_of(owner))
        except Exception:
            order_message = text
        return {"status": a.status, "needs_supplier": True,
                "order_message": order_message,
                "target_phone": a.target_phone, "target_name": a.target_name,
                "delivery": {"simulated": True, "to": "",
                             "error": "supplier select karo — phone nahi hai"}}
    delivery = send_text(a.target_phone or "", text)
    try:
        simulated = bool(delivery.get("simulated", True))
    except Exception:
        simulated = True
    if not simulated:
        try:
            a.status = "sent"
            db.commit()
            db.refresh(a)
        except Exception:
            pass
    out = {"status": a.status, "delivery": delivery,
           "target_phone": a.target_phone, "target_name": a.target_name}
    if is_reorder:
        try:
            out["order_message"] = build_supplier_order_text(a, _biz_of(owner))
        except Exception:
            pass
        # phone tha par gateway down -> approved raha, UI picker se dobara bhej sakta hai
        if simulated:
            out["needs_supplier"] = False
    return out


@router.post("/actions/{action_id}/send-to-supplier")
def send_to_supplier(action_id: int, body: SendToSupplierIn,
                     db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    """Approved reorder ko chosen supplier ko WhatsApp pe bhejo.

    Body: {contact_id} ya {phone + name}. Target update + order text build +
    gateway send. Real delivery -> status sent, else approved rehta hai
    (dobara try ho sake)."""
    oid = owner_id_of(owner)
    a = db.query(Action).filter(Action.id == action_id, Action.owner_id == oid).first()
    if a is None:
        raise HTTPException(status_code=404, detail="Unknown action id")
    if a.status == "rejected":
        raise HTTPException(status_code=409, detail="Action already rejected")
    sph, snm = _resolve_supplier(db, oid, body.contact_id,
                                 str(body.phone or ""), str(body.name or ""))
    if not sph:
        raise HTTPException(status_code=422,
                            detail="Supplier select karo — sahi 10–13 digit phone chahiye")
    a.target_phone = sph
    if snm:
        if str(getattr(a, "type", "") or "") == "reorder":
            try:
                _m2 = a.get_meta() if hasattr(a, "get_meta") else {}
                if not isinstance(_m2, dict):
                    _m2 = {}
                _m2["supplier_name"] = snm
                a.set_meta(_m2)
            except Exception:
                pass
        else:
            a.target_name = snm
    try:
        from app.routers.contacts import ensure_supplier_contact

        try:
            _m3 = a.get_meta() if hasattr(a, "get_meta") else {}
            _snm3 = str((_m3 or {}).get("supplier_name", "") or "").strip()
        except Exception:
            _snm3 = ""
        ensure_supplier_contact(db, oid, _snm3 or str(getattr(a, "target_name", "") or ""),
                                sph)
    except Exception:
        pass
    if a.status == "pending":
        a.status = "approved"
    try:
        text = build_supplier_order_text(a, _biz_of(owner))
    except Exception:
        try:
            text = str(getattr(a, "draft_message", "") or "")
        except Exception:
            text = ""
    try:
        db.commit()
        db.refresh(a)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(exc))
    delivery = send_text(sph, text)
    try:
        simulated = bool(delivery.get("simulated", True))
    except Exception:
        simulated = True
    if not simulated:
        try:
            a.status = "sent"
            db.commit()
            db.refresh(a)
        except Exception:
            pass
    return {"status": a.status, "delivery": delivery, "order_message": text,
            "target_phone": a.target_phone, "target_name": a.target_name}


@router.post("/actions/{action_id}/reject")
def reject_action(action_id: int, db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    a = db.query(Action).filter(Action.id == action_id, Action.owner_id == owner_id_of(owner)).first()
    if a is None:
        raise HTTPException(status_code=404, detail="Unknown action id")
    if a.status in ("approved", "sent", "rejected"):
        raise HTTPException(status_code=409, detail=f"Action already {a.status}")
    a.status = "rejected"
    try:
        db.commit()
        db.refresh(a)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": a.status}
