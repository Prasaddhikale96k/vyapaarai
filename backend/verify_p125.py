"""One-shot P1 verify: OTP = onboarding (no admin gate). Prints P125 VERIFY: ALL GREEN."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"

import sys
import time
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
total = 4


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}", flush=True)
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


SUFFIX = str(int(time.time()))[-6:]
TMP = f"91981{SUFFIX}"


def _clean():
    try:
        from app.models import OwnerProfile
        db = SessionLocal()
        try:
            for ph in (TMP, TMP[2:] if TMP.startswith("91") else TMP):
                old = db.query(OwnerProfile).filter(OwnerProfile.phone == ph).first()
                if old is not None:
                    db.delete(old)
            db.commit()
        finally:
            db.close()
    except Exception:
        pass


_clean()

# 1. existing allowed owner -> 409
try:
    r = client.post("/auth/register", json={"phone": "919834854511", "name": "X", "business_type": "kirana"})
    ok = r.status_code == 409 and "Already registered" in str(r.json().get("detail", ""))
    report(1, "register existing 409", ok, f"-> {r.status_code} {r.text[:100]}")
except Exception as e:
    report(1, "register existing 409", False, f"EXC {e}")

# 2. new owner -> pending (OTP framing, no admin copy)
try:
    r = client.post("/auth/register", json={
        "phone": TMP, "name": "P125 Web", "business_name": "P125 Web Stores",
        "business_type": "kirana", "language": "hi"})
    j = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and j.get("status") == "pending"
          and "admin approve" not in str(j.get("message", "")).lower())
    report(2, "register new pending", ok, f"-> {r.status_code} {j}")
except Exception as e:
    report(2, "register new pending", False, f"EXC {e}")

# 3. otp request on INACTIVE profile -> 200 (no 403); unknown phone -> 403
try:
    r = client.post("/auth/otp/request", json={"phone": TMP})
    r_unk = client.post("/auth/otp/request", json={"phone": "919800000999"})
    ok = r.status_code == 200 and r_unk.status_code == 403
    report(3, "otp request inactive 200 / unknown 403", ok,
           f"-> inactive={r.status_code} unknown={r_unk.status_code}")
except Exception as e:
    report(3, "otp request inactive 200 / unknown 403", False, f"EXC {e}")

# 4. verify with DB code -> allowed==True + token + /me; wrong code -> 401
try:
    from app.models import OwnerProfile
    db = SessionLocal()
    try:
        prof = db.query(OwnerProfile).filter(
            OwnerProfile.phone.in_([TMP, TMP[2:] if TMP.startswith("91") else TMP])).first()
        code = str(getattr(prof, "otp_code", "") or "") if prof else ""
        stored = str(getattr(prof, "phone", TMP)) if prof else TMP
    finally:
        db.close()
    rv = client.post("/auth/otp/verify", json={"phone": stored, "code": code}) if code else None
    tok = rv.json().get("token", "") if rv is not None and rv.status_code == 200 else ""
    me = client.get("/me", headers={"Authorization": f"Bearer {tok}"}) if tok else None
    mj = me.json() if me is not None and me.status_code == 200 else {}
    rw = client.post("/auth/otp/verify", json={"phone": stored, "code": "000000"})
    ok = (bool(code) and bool(tok) and mj.get("allowed") is True
          and mj.get("business_name") == "P125 Web Stores" and rw.status_code == 401)
    report(4, "verify activates + token + wrong-code 401", ok,
           f"-> code={bool(code)} tok={bool(tok)} allowed={mj.get('allowed')} wrong={rw.status_code}")
except Exception as e:
    report(4, "verify activates + token + wrong-code 401", False, f"EXC {e}")

_clean()

print(f"P125 VERIFY: {passed}/{total} checks passed", flush=True)
if failures:
    print("FAILURES:", failures, flush=True)
    sys.exit(1)
print("P125 VERIFY: ALL GREEN", flush=True)
