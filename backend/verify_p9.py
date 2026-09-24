"""Phase B-1 verify: UPI deep-links + daily PDF report. 7 checks + legacy on sqlite."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Verify scripts MUST NOT touch live WhatsApp. Evolution gateway is disconnected
# here, so every send degrades to simulated.
os.environ["WA_GATEWAY"] = "evolution"

import re
import subprocess
import sys
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlsplit
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app as _fastapi_app
from app.db import SessionLocal, ensure_access_schema, ensure_p4_schema

ensure_p4_schema()
ensure_access_schema()
try:
    from app.db import Base, engine
    import app.models as _app_models  # noqa: F401 (aliased: must not shadow FastAPI `app`)
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

client = TestClient(_fastapi_app)

failures = []
passed = 0
total = 7


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}")
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


def _db():
    return SessionLocal()


def _jwt_secret():
    try:
        for line in open(".env", encoding="utf-8").read().splitlines():
            if line.strip().startswith("JWT_SECRET="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


def _auth(owner_id, phone):
    import jwt as _jwt
    tok = _jwt.encode(
        {"sub": str(int(owner_id)), "phone": phone,
         "exp": datetime.utcnow() + timedelta(days=7)},
        _jwt_secret(), algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


OWNER1 = (1, "919834854511")

# 1. UPI deep-link in payment reminders
try:
    from app.models import Action
    from app.services.actions import generate_recommendations

    db = _db()
    try:
        db.query(Action).filter(Action.owner_id == 1,
                                Action.type == "payment_reminder").delete()
        db.commit()
        created = generate_recommendations(db, owner_id=1)
    finally:
        db.close()
    pay = [a for a in created if a.get("type") == "payment_reminder"
           and "upi://" in str(a.get("draft_message") or "")]
    ok_link = False
    detail = f"-> generated={len(created)} pay_with_upi={len(pay)}"
    if pay:
        m = re.search(r"upi://[^\s\"']+", str(pay[0].get("draft_message") or ""))
        if m:
            q = parse_qs(urlsplit(m.group(0)).query)
            g = lambda k: (q.get(k, [""])[0])
            ok_link = (
                m.group(0).startswith("upi://pay?pa=sharmatraders@okicici")
                and g("pa") == "sharmatraders@okicici"
                and all(g(k) for k in ("pn", "am", "cu", "tn", "tr"))
                and re.fullmatch(r"\d+\.\d{2}", g("am") or "") is not None
                and g("cu") == "INR" and g("tr").startswith("INV")
            )
            detail += f" pa={g('pa')} am={g('am')} tr={g('tr')}"
        any8500 = any("am=8500.00" in str(a.get("draft_message") or "") for a in pay)
        ok_link = ok_link and any8500
        detail += f" has8500={any8500}"
    ok = len(pay) >= 1 and ok_link
    report(1, "upi deep-link", ok, detail)
    db = _db()
    try:
        ids = [a.get("id") for a in created if isinstance(a.get("id"), int)]
        if ids:
            db.query(Action).filter(Action.id.in_(ids)).delete()
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
except Exception as e:
    report(1, "upi deep-link", False, f"EXC {e}")

# 2. PDF bytes
try:
    from app.services.reports import build_daily_pdf

    db = _db()
    try:
        pdf = build_daily_pdf(db, 1)
    finally:
        db.close()
    ok = isinstance(pdf, (bytes, bytearray)) and bytes(pdf)[:4] == b"%PDF" and len(pdf) > 3000
    report(2, "pdf bytes", ok, f"-> {len(pdf) if isinstance(pdf, (bytes, bytearray)) else '?'} bytes")
except Exception as e:
    report(2, "pdf bytes", False, f"EXC {e}")

# 3. GET /reports/daily
try:
    r = client.get("/reports/daily", headers=_auth(*OWNER1))
    ct = r.headers.get("content-type", "")
    ok = (r.status_code == 200 and "application/pdf" in ct
          and r.content[:4] == b"%PDF" and len(r.content) > 3000)
    report(3, "GET /reports/daily", ok, f"-> {r.status_code} {ct} {len(r.content)}b")
except Exception as e:
    report(3, "GET /reports/daily", False, f"EXC {e}")

# 4. POST /reports/send-now (gateway down -> simulated)
try:
    r = client.post("/reports/send-now", headers=_auth(*OWNER1))
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and j.get("simulated") is True
    report(4, "send-now simulated", ok, f"-> {r.status_code} {j}")
except Exception as e:
    report(4, "send-now simulated", False, f"EXC {e}")

# 5. nightly_report 21:00 job present
try:
    from app.services import sync as sync_mod

    sync_mod.ENABLE_WATCHER = True
    try:
        sync_mod.start_watchers()
        jobs = sync_mod._scheduler.get_jobs() if sync_mod._scheduler else []
        by_id = {j.id: j for j in jobs}
        night = by_id.get("nightly_report")
        ok = (night is not None and "21" in str(night.trigger)
              and "morning_brief" in by_id)
        report(5, "nightly job", ok,
               f"-> jobs={sorted(by_id)} trigger={night.trigger if night else None}")
    finally:
        try:
            sync_mod.stop_watchers()
        except Exception:
            pass
        sync_mod.ENABLE_WATCHER = False
except Exception as e:
    report(5, "nightly job", False, f"EXC {e}")

# 6. frontend build + chip conditional
try:
    import pathlib
    fe = pathlib.Path(__file__).resolve().parent.parent / "frontend"
    src = (fe / "app" / "actions" / "page.tsx").read_text(encoding="utf-8")
    chip_ok = ("upiLink" in src and "Open UPI link" in src
               and ("upiLink &&" in src or "upiLink ?" in src)
               and "upi:" in src)
    p = subprocess.run(["npm", "run", "build"], cwd=str(fe),
                       capture_output=True, text=True, timeout=600,
                       shell=True)
    ok = chip_ok and p.returncode == 0
    tail = ((p.stdout or "") + (p.stderr or "")).strip().splitlines()
    report(6, "frontend build+chip", ok,
           f"-> chip={chip_ok} build_rc={p.returncode} "
           f"{(tail[-1] if tail else '')[:100]}")
except Exception as e:
    report(6, "frontend build+chip", False, f"EXC {e}")

print(f"P9 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)

# 7. legacy p2..p7 on SQLITE (logic already proven; PG runs above)
print("--- legacy reruns (sqlite) ---")
os.environ["DATABASE_URL"] = "sqlite:///./vyapaar.db"
legacy_ok = True
for name in ("verify_p2.py", "verify_p3.py", "verify_p4.py",
             "verify_p6.py", "verify_p7.py"):
    try:
        p = subprocess.run([sys.executable, "-u", name], capture_output=True,
                           text=True, timeout=900)
        tail = (p.stdout or "").strip().splitlines()
        last = tail[-1] if tail else ""
        good = p.returncode == 0
        print(f"[{'PASS' if good else 'FAIL'}] {name} -> {last[:120]}")
        if not good:
            legacy_ok = False
            print((p.stdout or "")[-1500:])
            print((p.stderr or "")[-800:])
    except Exception as e:
        print(f"[FAIL] {name} EXC {e}")
        legacy_ok = False

if not legacy_ok:
    print("FAILURES: legacy scripts")
    sys.exit(1)
report(7, "legacy p2..p7 sqlite", True, "-> all green")
print(f"P9 VERIFY: {passed}/{total} + legacy green")
