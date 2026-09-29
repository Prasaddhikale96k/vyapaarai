from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.limits import limiter
from app.routers.auth import get_current_owner, get_optional_owner, owner_id_of
from app.services import intelligence as eng

router = APIRouter(tags=["intelligence"])

# 60s in-memory cache for intelligence GETs: key (route, owner_id, params...).
# Invalidated on any data write (ingest commit/upload, doc confirm, actions generate).
_INTEL_CACHE: dict = {}
_INTEL_TTL = 60.0


def invalidate_intel() -> None:
    try:
        _INTEL_CACHE.clear()
    except Exception:
        pass


def _cached(key: str, compute, response: Response):
    import time as _time

    try:
        now = _time.time()
        hit = _INTEL_CACHE.get(key)
        if hit is not None and hit[1] > now:
            response.headers["X-Cache"] = "hit"
            return hit[0]
    except Exception:
        pass
    val = compute()
    try:
        _INTEL_CACHE[key] = (val, _time.time() + _INTEL_TTL)
        response.headers["X-Cache"] = "miss"
    except Exception:
        pass
    return val


@router.get("/health-score")
def get_health_score(response: Response, db: Session = Depends(get_db),
                     owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    return _cached(f"health-score|{oid}", lambda: eng.health_score(db, owner_id=oid), response)


@router.get("/forecast")
def get_forecast(
    response: Response,
    sku: str = Query(..., description="Product SKU"),
    days: int = Query(default=14, ge=1, le=60),
    db: Session = Depends(get_db),
    owner=Depends(get_optional_owner),
):
    oid = owner_id_of(owner)
    code = str(sku or "").strip().lower()

    def _compute():
        try:
            return eng.forecast_product(db, sku, days, owner_id=oid)
        except ValueError:
            raise HTTPException(status_code=404, detail=f"Unknown SKU: {sku}")

    return _cached(f"forecast|{oid}|{code}|{days}", _compute, response)


@router.get("/root-cause")
def get_root_cause(response: Response, db: Session = Depends(get_db),
                   owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    return _cached(f"root-cause|{oid}", lambda: eng.root_cause(db, owner_id=oid), response)


@router.get("/anomalies")
def get_anomalies(response: Response, db: Session = Depends(get_db),
                  owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    return _cached(f"anomalies|{oid}", lambda: eng.anomalies(db, owner_id=oid), response)


@router.get("/buy-sell-matrix")
def get_buy_sell_matrix(response: Response, db: Session = Depends(get_db),
                        owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    return _cached(f"buy-sell-matrix|{oid}",
                   lambda: eng.buy_sell_matrix(db, owner_id=oid), response)


@router.get("/brief")
def get_brief(response: Response, db: Session = Depends(get_db),
              owner=Depends(get_optional_owner)):
    oid = owner_id_of(owner)
    return _cached(f"brief|{oid}", lambda: eng.build_brief(db, owner_id=oid), response)


@router.get("/credit-score")
def get_credit_score(response: Response, db: Session = Depends(get_db),
                     owner=Depends(get_optional_owner)):
    from app.services import credit as cred

    oid = owner_id_of(owner)
    return _cached(f"credit-score|{oid}",
                   lambda: cred.credit_score(db, owner_id=oid), response)


@router.get("/credit-score/report")
@limiter.limit("20/minute")
def get_credit_report(request: Request, db: Session = Depends(get_db),
                      owner=Depends(get_current_owner)):
    """P8-F1: bank-ready loan file (PDF). JWT owner-scoped. Never crashes."""
    from datetime import date as _date

    from app.services import reports as _reports

    try:
        pdf = _reports.build_credit_pdf(db, owner_id=owner_id_of(owner))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report nahi bani: {str(exc)[:150]}")
    fname = f"credit-report-{_date.today().isoformat()}.pdf"
    return FastAPIResponse(content=pdf, media_type="application/pdf",
                           headers={"Content-Disposition": f'attachment; filename="{fname}"'})
