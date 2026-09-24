"""P12.5 verify: web registration (no WhatsApp). Prints P12.5 VERIFY: ALL GREEN."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"

import subprocess
import sys
from datetime import datetime, timedelta
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app as _fastapi_app
from app.db import SessionLocal

client = TestClient(_fastapi_app, raise_server_exceptions=False)

failures = []
passed = 0
total = 5


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}", flush=True)
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


def _jwt_secret():
    try:
        for line in open(".env", encoding="utf-8").read().splitlines():
            if line.strip().startswith("JWT_SECRET="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


def _mint(owner_id, phone):
    import jwt as _jwt
    return _jwt.encode(
        {"sub": str(int(owner_id)), "phone": phone,
         "exp": datetime.utcnow() + timedelta(days=7)},
        _jwt_secret(), algorithm="HS256")


TMP = "919811112222"
ADMIN_H = {"Authorization": f"Bearer {_mint(1, '919834854511')}"}

# pre-clean temp phone (both +91 and stripped forms)
try:
    from app.models import OwnerProfile
    db = SessionLocal()
    try:
        for ph in (TMP, "9811112222"):
            old = db.query(OwnerProfile).filter(OwnerProfile.phone == ph).first()
            if old is not None:
                db.delete(old)
        db.commit()
    finally:
        db.close()
except Exception:
    pass

# 1. existing allowed owner -> 409
try:
    r = client.post("/auth/register", json={"phone": "919834854511", "name": "X"})
    ok = r.status_code == 409 and "Already registered" in str(r.json().get("detail", ""))
    report(1, "register existing 409", ok, f"-> {r.status_code} {r.text[:100]}")
except Exception as e:
    report(1, "register existing 409", False, f"EXC {e}")

# 2. new owner -> pending
try:
    r = client.post("/auth/register", json={
        "phone": "+91 98111 12222", "name": "P125 Web",
        "business_name": "P125 Web Stores", "distributor_phone": "919000000001",
        "language": "hi"})
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and j.get("status") == "pending"
    report(2, "register new pending", ok, f"-> {r.status_code} {j}")
except Exception as e:
    report(2, "register new pending", False, f"EXC {e}")

# 3. login request while pending -> 403 (+ duplicate register -> pending, not dup)
try:
    r = client.post("/auth/otp/request", json={"phone": TMP})
    r2 = client.post("/auth/register", json={"phone": TMP, "name": "Again"})
    j2 = r2.json() if r2.status_code == 200 else {}
    ok = (r.status_code == 403 and r2.status_code == 200
          and j2.get("status") == "pending")
    report(3, "pending login 403", ok, f"-> otp={r.status_code} re-reg={r2.status_code}")
except Exception as e:
    report(3, "pending login 403", False, f"EXC {e}")

# 4. admin approve -> otp/dev_otp -> token -> /me business
try:
    from app.models import OwnerProfile
    rl = client.get("/owners?status=pending", headers=ADMIN_H)
    rows = rl.json() if rl.status_code == 200 else []
    hit = [x for x in rows if isinstance(x, dict)
           and str(x.get("phone", "")).endswith("9811112222")]
    tid = hit[0]["id"] if hit else None
    stored = str(hit[0].get("phone", TMP)) if hit else TMP
    ra = client.post(f"/owners/{tid}/approve", headers=ADMIN_H) if tid else None
    ro = client.post("/auth/otp/request", json={"phone": stored})
    code = ro.json().get("dev_otp", "") if ro.status_code == 200 else ""
    rv = client.post("/auth/otp/verify", json={"phone": stored, "code": code}) if code else None
    tok = rv.json().get("token", "") if rv is not None and rv.status_code == 200 else ""
    me = client.get("/me", headers={"Authorization": f"Bearer {tok}"}) if tok else None
    mj = me.json() if me is not None and me.status_code == 200 else {}
    ok = (ra is not None and ra.status_code == 200 and bool(code) and bool(tok)
          and mj.get("business_name") == "P125 Web Stores")
    report(4, "approve+login+me", ok,
           f"-> approve={ra.status_code if ra else '?'} dev_otp={bool(code)} "
           f"me_biz={mj.get('business_name')}")
except Exception as e:
    report(4, "approve+login+me", False, f"EXC {e}")

# cleanup temp profile (both forms)
try:
    from app.models import OwnerProfile
    db = SessionLocal()
    try:
        for ph in (TMP, "9811112222"):
            old = db.query(OwnerProfile).filter(OwnerProfile.phone == ph).first()
            if old is not None:
                db.delete(old)
        db.commit()
    finally:
        db.close()
except Exception:
    pass

print(f"P12.5 progress: {passed}/{total} backend checks", flush=True)
if failures:
    print("FAILURES:", failures, flush=True)
    sys.exit(1)

# 5. verify_p3 once + build + tsc
try:
    p = subprocess.run([sys.executable, "-u", "verify_p3.py"], capture_output=True,
                       text=True, timeout=900)
    tail = (p.stdout or "").strip().splitlines()
    ok_p3 = p.returncode == 0 and any("P3 VERIFY: 9/9" in l for l in tail)
    import pathlib
    fe = pathlib.Path(__file__).resolve().parent.parent / "frontend"
    b = subprocess.run(["npm", "run", "build"], cwd=str(fe), capture_output=True,
                       text=True, timeout=600, shell=True)
    t = subprocess.run(["npx", "tsc", "--noEmit"], cwd=str(fe), capture_output=True,
                       text=True, timeout=300, shell=True)
    ok = ok_p3 and b.returncode == 0 and t.returncode == 0
    report(5, "p3+build+tsc", ok,
           f"-> p3={ok_p3} build={b.returncode} tsc={t.returncode}")
except Exception as e:
    report(5, "p3+build+tsc", False, f"EXC {e}")

if failures:
    print("FAILURES:", failures, flush=True)
    sys.exit(1)
print("P12.5 VERIFY: ALL GREEN", flush=True)
