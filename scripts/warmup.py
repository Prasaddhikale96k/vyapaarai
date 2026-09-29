"""P18 demo warmup: preload whisper, warm orchestrate/health/credit/forecast.

Run from repo root with cwd=backend/:  python ../scripts/warmup.py
Uses the live app engine (dev sqlite or DATABASE_URL). Prints timings.
Never writes demo data. Exit 1 if any step fails.
"""
import os
import sys
import time

if os.path.basename(os.getcwd()) != "backend":
    print("warmup.py must run with cwd=backend/")
    sys.exit(2)
sys.path.insert(0, os.getcwd())

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

os.environ.setdefault("ENABLE_WATCHER", "false")

fails = []


def step(name, fn):
    t0 = time.time()
    try:
        out = fn()
        print(f"[WARM] {name} ok in {time.time()-t0:.1f}s {out}", flush=True)
    except Exception as e:
        print(f"[WARM-FAIL] {name}: {str(e)[:200]}", flush=True)
        fails.append(name)


def _whisper():
    from app.services import voice as V

    m = V._get_model()
    return f"(model={type(m).__name__})"


def _orchestrate():
    from app.services import agents as A

    r = A.orchestrate("aaj ki bikri kitni hui?", phone="web", owner_id=1)
    return f"(provider={r.get('provider')} ans={len(str(r.get('answer','')))}ch)"


def _health():
    from app.db import SessionLocal
    from app.services import intelligence as E

    db = SessionLocal()
    try:
        h = E.health_score(db, owner_id=1)
        return f"(overall={h.get('overall')})"
    finally:
        db.close()


def _credit_pdf():
    from app.db import SessionLocal
    from app.services import reports as R

    db = SessionLocal()
    try:
        pdf = R.build_credit_pdf(db, 1)
        assert pdf[:5] == b"%PDF-", "not a pdf"
        return f"({len(pdf)} bytes)"
    finally:
        db.close()


def _forecast():
    from app.db import SessionLocal
    from app.models import Product
    from app.services import intelligence as E

    db = SessionLocal()
    try:
        p = db.query(Product).filter(Product.owner_id == 1).first()
        f = E.forecast_product(db, p.sku, 7, owner_id=1)
        return f"(sku={p.sku} days={len(f.get('forecast', []))})"
    finally:
        db.close()


step("whisper load", _whisper)
step("orchestrate", _orchestrate)
step("health-score", _health)
step("credit PDF", _credit_pdf)
step("forecast", _forecast)

if fails:
    print(f"WARMUP: FAIL {fails}", flush=True)
    sys.exit(1)
print("WARMUP: ALL HOT", flush=True)
