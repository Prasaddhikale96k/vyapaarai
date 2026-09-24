from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Action
from app.routers.auth import get_optional_owner, owner_id_of
from app.routers.intelligence import invalidate_intel
from app.services.actions import generate_recommendations, serialize_action
from app.services.notify import send_text

router = APIRouter(tags=["actions"])


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
def approve_action(action_id: int, db: Session = Depends(get_db), owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    a = db.query(Action).filter(Action.id == action_id, Action.owner_id == oid).first()
    if a is None:
        raise HTTPException(status_code=404, detail="Unknown action id")
    if a.status in ("approved", "sent", "rejected"):
        raise HTTPException(status_code=409, detail=f"Action already {a.status}")
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
    delivery = send_text(a.target_phone or "", a.draft_message or "")
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
    return {"status": a.status, "delivery": delivery}


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
