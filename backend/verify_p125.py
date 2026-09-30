"""One-shot P1 verify: OTP = onboarding (no admin gate). Prints P125 VERIFY: ALL GREEN."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"
os.environ["ENVIRONMENT"] = "development"  # P19: dev_otp path for OTP-content assertions
# (production no-dev_otp guard is pinned separately by verify_p15 check 2)

import sys
import time
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app as _fastapi_app
from app.db import SessionLocal, ensure_access_schema, ensure_p15_schema

# P19: migrate the (dev/prod) DB under test — additive, idempotent (blocked col)
ensure_access_schema()
ensure_p15_schema()

client = TestClient(_fastapi_app, raise_server_exceptions=False)

failures = []
passed = 0
total = 6


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

# 3. otp request on INACTIVE profile -> 200 (no 403); unknown phone -> 403 + register hint
try:
    r = client.post("/auth/otp/request", json={"phone": TMP})
    r_unk = client.post("/auth/otp/request", json={"phone": "919800000999"})
    try:
        hint = "register" in str(r_unk.json().get("detail", "")).lower()
    except Exception:
        hint = False
    ok = r.status_code == 200 and r_unk.status_code == 403 and hint
    report(3, "otp request inactive 200 / unknown 403+hint", ok,
           f"-> inactive={r.status_code} unknown={r_unk.status_code} hint={hint}")
except Exception as e:
    report(3, "otp request inactive 200 / unknown 403+hint", False, f"EXC {e}")

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

# 5. blocked profile (ops suspend) -> otp/request 403 suspended + verify 401
try:
    from app.models import OwnerProfile
    from app.services import owners as _owners

    BTMP = f"91982{SUFFIX}"
    db = SessionLocal()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == BTMP).first()
        if old is not None:
            db.delete(old)
            db.commit()
        bp = OwnerProfile(phone=BTMP, name="P125 Blocked", allowed=True, onboarded=False)
        db.add(bp)
        db.commit()
        db.refresh(bp)
        bid = bp.id
    finally:
        db.close()
    rb = client.post("/auth/otp/request", json={"phone": BTMP})
    before = (rb.status_code, str(rb.json().get("detail", "")))
    # ops suspend via reject_owner (blocked=True, allowed untouched)
    db = SessionLocal()
    try:
        res = _owners.reject_owner(db, bid)
    finally:
        db.close()
    ra = client.post("/auth/otp/request", json={"phone": BTMP})
    try:
        suspended = "suspend" in str(ra.json().get("detail", "")).lower()
    except Exception:
        suspended = False
    # restore via approve_owner (blocked=False) for cleanliness
    db = SessionLocal()
    try:
        _owners.approve_owner(db, bid)
        db.query(OwnerProfile).filter(OwnerProfile.id == bid).delete()
        db.commit()
    finally:
        db.close()
    ok = (rb.status_code == 200 and res.get("ok") is True
          and ra.status_code == 403 and suspended)
    report(5, "blocked -> 403 suspended (ops suspend/restore)", ok,
           f"-> before={before[0]} after={ra.status_code} susp={suspended}")
except Exception as e:
    report(5, "blocked -> 403 suspended (ops suspend/restore)", False, f"EXC {e}")

# 6. full seamless path: register -> otp/request (sent, no admin, no re-login) -> verify
try:
    CTMP = f"91983{SUFFIX}"
    db = SessionLocal()
    try:
        old = db.query(OwnerProfile).filter(
            OwnerProfile.phone.in_([CTMP, CTMP[2:] if CTMP.startswith("91") else CTMP])).first()
        if old is not None:
            db.delete(old)
            db.commit()
    finally:
        db.close()
    rr = client.post("/auth/register", json={"phone": CTMP, "name": "P125 Seam",
                                              "business_type": "kirana", "language": "hi"})
    rq = client.post("/auth/otp/request", json={"phone": CTMP})
    jq = rq.json() if rq.status_code == 200 else {}
    code = str(jq.get("dev_otp", "") or "")
    rv = client.post("/auth/otp/verify", json={"phone": CTMP, "code": code}) if code else None
    tok = rv.json().get("token", "") if rv is not None and rv.status_code == 200 else ""
    me = client.get("/me", headers={"Authorization": f"Bearer {tok}"}) if tok else None
    mj = me.json() if me is not None and me.status_code == 200 else {}
    db = SessionLocal()
    try:
        for ph in (CTMP, CTMP[2:] if CTMP.startswith("91") else CTMP):
            old = db.query(OwnerProfile).filter(OwnerProfile.phone == ph).first()
            if old is not None:
                db.delete(old)
        db.commit()
    finally:
        db.close()
    ok = (rr.status_code == 200 and rq.status_code == 200 and jq.get("sent") is True
          and bool(tok) and mj.get("allowed") is True)
    report(6, "seamless register->otp->verify (no admin)", ok,
           f"-> reg={rr.status_code} otp={rq.status_code} sent={jq.get('sent')} allowed={mj.get('allowed')}")
except Exception as e:
    report(6, "seamless register->otp->verify (no admin)", False, f"EXC {e}")

print(f"P125 VERIFY: {passed}/{total} checks passed", flush=True)
if failures:
    print("FAILURES:", failures, flush=True)
    sys.exit(1)
print("P125 VERIFY: ALL GREEN", flush=True)
