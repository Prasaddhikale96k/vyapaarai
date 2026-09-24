"""Phase A verify: multi-owner + access control. 8 checks + legacy reruns."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Verify scripts MUST NOT touch live WhatsApp (repeated sends to fake numbers
# get the linked device flagged/unlinked). Evolution gateway is disconnected
# here, so every send degrades to simulated.
os.environ["WA_GATEWAY"] = "evolution"

import subprocess
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, ensure_access_schema, ensure_p4_schema

ensure_p4_schema()
ensure_access_schema()

client = TestClient(app)

failures = []
passed = 0
total = 8


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


def _digits(s):
    return "".join(ch for ch in str(s or "") if ch.isdigit())


TEST_PHONE = "919000000099"
TEST_PHONE2 = "919000000098"


def _clean_test_phones():
    db = _db()
    try:
        from app.models import OwnerProfile
        for ph in (TEST_PHONE, TEST_PHONE2):
            p = db.query(OwnerProfile).filter(OwnerProfile.phone == ph).first()
            if p is not None:
                db.delete(p)
        # owner2 wapas pending
        o2 = db.query(OwnerProfile).filter(OwnerProfile.id == 2).first()
        if o2 is not None:
            o2.allowed = False
            o2.reg_step = None
            o2.otp_code = None
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


_clean_test_phones()


def _wa_text_payload(phone, body):
    return {
        "event": "message.received",
        "sessionId": "sess-test",
        "data": {
            "id": "m-%s" % phone, "from": "%s@c.us" % phone, "chatId": "%s@c.us" % phone,
            "body": body, "type": "text", "fromMe": False, "isGroup": False,
        },
    }


def _jwt_secret():
    try:
        for line in open(".env", encoding="utf-8").read().splitlines():
            if line.strip().startswith("JWT_SECRET="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


def _mint(owner_id, phone):
    """White-box JWT (OTP delivery test 2 me cover hoti hai; ye guards ke liye)."""
    import jwt as _jwt
    from datetime import datetime, timedelta
    return _jwt.encode(
        {"sub": str(int(owner_id)), "phone": phone, "exp": datetime.utcnow() + timedelta(days=7)},
        _jwt_secret(), algorithm="HS256")


def _get_token(phone):
    """dev OTP flow se JWT nikalo (gateway fail → dev_otp)."""
    r = client.post("/auth/otp/request", json={"phone": phone})
    if r.status_code != 200:
        return None
    try:
        code = r.json().get("dev_otp", "")
    except Exception:
        code = ""
    if not code:
        return None
    r2 = client.post("/auth/otp/verify", json={"phone": phone, "code": code})
    if r2.status_code != 200:
        return None
    try:
        return r2.json().get("token", "")
    except Exception:
        return None


# 1. registration machine
try:
    from app.services import owners as own

    db = _db()
    try:
        r0 = own.start_registration(db, TEST_PHONE, "TestUser")
        s1 = own.advance_registration(db, TEST_PHONE, "Rahul")
        s2 = own.advance_registration(db, TEST_PHONE, "Rahul Stores")
        s3 = own.advance_registration(db, TEST_PHONE, "919000000001")
        s4 = own.advance_registration(db, TEST_PHONE, "Hindi")
        from app.models import OwnerProfile
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == TEST_PHONE).first()
        otp_set = bool(prof is not None and prof.otp_code)
        w = own.verify_otp(db, TEST_PHONE, "000000")
        ok_wrong = isinstance(w, dict) and ("Galat" in str(w.get("reply", "")) or "chance" in str(w.get("reply", "")))
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == TEST_PHONE).first()
        real_code = str(prof.otp_code or "") if prof else ""
        c = own.verify_otp(db, TEST_PHONE, real_code)
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == TEST_PHONE).first()
        ok = (
            isinstance(r0, dict) and "NAAM" in str(r0.get("reply", "")).upper()
            and isinstance(s4, dict) and "OTP" in str(s4.get("reply", "")).upper()
            and otp_set and ok_wrong
            and isinstance(c, dict) and "approval" in str(c.get("reply", "")).lower()
            and prof is not None and not bool(prof.allowed) and not prof.reg_step
        )
        report(1, "registration machine", ok,
               f"-> ask_name={'NAAM' in str(r0.get('reply','')).upper()} otp_set={otp_set} wrong_ok={ok_wrong}")
    finally:
        db.close()
except Exception as e:
    report(1, "registration machine", False, f"EXC {e}")

# 2. web OTP login + /me (fake allowed owner → dev_otp; pending → 403 sahi hai)
try:
    db = _db()
    try:
        from app.models import OwnerProfile
        tmp = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000096").first()
        if tmp is None:
            tmp = OwnerProfile(phone="919000000096", name="LoginTest", allowed=True, onboarded=True)
            db.add(tmp)
            db.commit()
        else:
            tmp.allowed = True
            db.commit()
    finally:
        db.close()
    r = client.post("/auth/otp/request", json={"phone": "919000000096"})
    dev_code = ""
    try:
        dev_code = r.json().get("dev_otp", "") if r.status_code == 200 else ""
    except Exception:
        dev_code = ""
    rw = client.post("/auth/otp/verify", json={"phone": "919000000096", "code": "000000"})
    rc = client.post("/auth/otp/verify", json={"phone": "919000000096", "code": dev_code}) if dev_code else None
    tok2 = ""
    try:
        tok2 = rc.json().get("token", "") if rc is not None and rc.status_code == 200 else ""
    except Exception:
        tok2 = ""
    m_ok = client.get("/me", headers={"Authorization": f"Bearer {tok2}"}) if tok2 else None
    m_no = client.get("/me")
    rpend = client.post("/auth/otp/request", json={"phone": "919812345678"})
    db = _db()
    try:
        from app.models import OwnerProfile
        t = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000096").first()
        if t is not None:
            db.delete(t)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
    ok = (
        r.status_code == 200 and bool(dev_code)
        and rw.status_code == 401
        and rc is not None and rc.status_code == 200 and bool(tok2)
        and m_ok is not None and m_ok.status_code == 200
        and m_no.status_code == 401
        and rpend.status_code == 403
    )
    report(2, "otp login + /me", ok,
           f"-> req={r.status_code} wrong={rw.status_code} token_ok={bool(tok2)} me={m_ok.status_code if m_ok else '?'}/{m_no.status_code} pending_req={rpend.status_code}")
except Exception as e:
    report(2, "otp login + /me", False, f"EXC {e}")

# 3. WhatsApp from unallowed phone → registration/pending (no agents)
try:
    r = client.post("/webhook/whatsapp", json=_wa_text_payload(TEST_PHONE, "profit kyun gira?"))
    ok_recv = False
    try:
        ok_recv = r.status_code == 200 and r.json().get("received") is True
    except Exception:
        ok_recv = False
    r2 = client.post("/webhook/whatsapp", json=_wa_text_payload(TEST_PHONE2, "Hi"))
    try:
        ok_recv2 = r2.status_code == 200 and r2.json().get("received") is True
    except Exception:
        ok_recv2 = False
    db = _db()
    try:
        from app.models import OwnerProfile
        p2 = db.query(OwnerProfile).filter(OwnerProfile.phone == TEST_PHONE2).first()
        routed_to_reg = p2 is not None and str(p2.reg_step or "") == "NAME"
    finally:
        db.close()
    ok = ok_recv and ok_recv2 and routed_to_reg
    report(3, "wa gating (pending/reg)", ok, f"-> recv={ok_recv}/{ok_recv2} reg_step_NAME={routed_to_reg}")
except Exception as e:
    report(3, "wa gating (pending/reg)", False, f"EXC {e}")

# 4. approve owner2: 401/403 guards + post-approve agents path
try:
    admin_tok = _mint(1, "919834854511")  # owner 1 = admin (OTP delivery test 2 me covered)
    no_tok = client.post("/owners/2/approve")
    # non-admin allowed owner banao (temp)
    db = _db()
    tmp_id = 0
    try:
        from app.models import OwnerProfile
        tmp = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000097").first()
        if tmp is None:
            tmp = OwnerProfile(phone="919000000097", name="Tmp", allowed=True, onboarded=True)
            db.add(tmp)
            db.commit()
        else:
            tmp.allowed = True
            db.commit()
        tmp_id = int(tmp.id)
    finally:
        db.close()
    user_tok = _mint(tmp_id, "919000000097")
    forb = client.post("/owners/2/approve", headers={"Authorization": f"Bearer {user_tok}"}) if user_tok else None
    appr = client.post("/owners/2/approve", headers={"Authorization": f"Bearer {admin_tok}"}) if admin_tok else None
    ok_appr = appr is not None and appr.status_code == 200
    # approve ke baad chat agents tak pahuche
    agents_ok = False
    if ok_appr:
        try:
            from app.services import agents as ag
            res = ag.orchestrate("profit kyun gira?", phone="919812345678", owner_id=2)
            agents_ok = isinstance(res, dict) and isinstance(res.get("steps"), list)
        except Exception:
            agents_ok = False
    # temp owner safai
    db = _db()
    try:
        from app.models import OwnerProfile
        t = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000097").first()
        if t is not None:
            db.delete(t)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
    ok = (
        no_tok.status_code == 401
        and forb is not None and forb.status_code == 403
        and ok_appr and agents_ok
    )
    report(4, "approve guards + agents", ok,
           f"-> no_tok={no_tok.status_code} non_admin={forb.status_code if forb else '?'} approve={appr.status_code if appr else '?'} agents={agents_ok}")
except Exception as e:
    report(4, "approve guards + agents", False, f"EXC {e}")

# 5. scope_sql isolation
try:
    import json as _json
    from app.services import agents as ag

    c1 = _json.loads(ag.tool_run_sql("SELECT COUNT(*) n FROM sales", 1))[0].get("n")
    c2 = _json.loads(ag.tool_run_sql("SELECT COUNT(*) n FROM sales", 2))[0].get("n")
    scoped = ag.scope_sql("SELECT COUNT(*) n FROM sales", 2)
    ok = isinstance(c1, int) and isinstance(c2, int) and c1 != c2 and "owner_id=2" in scoped
    report(5, "scope_sql isolation", ok, f"-> owner1={c1} owner2={c2}")
except Exception as e:
    report(5, "scope_sql isolation", False, f"EXC {e}")

# 6. health-score differs per owner
try:
    t1 = _mint(1, "919834854511")
    t2 = _mint(2, "919812345678")
    h1 = client.get("/health-score", headers={"Authorization": f"Bearer {t1}"}) if t1 else None
    h2 = client.get("/health-score", headers={"Authorization": f"Bearer {t2}"}) if t2 else None
    o1 = h1.json().get("overall") if h1 is not None and h1.status_code == 200 else None
    o2 = h2.json().get("overall") if h2 is not None and h2.status_code == 200 else None
    ok = isinstance(o1, (int, float)) and isinstance(o2, (int, float)) and o1 != o2
    report(6, "per-owner health", ok, f"-> owner1={o1} owner2={o2}")
except Exception as e:
    report(6, "per-owner health", False, f"EXC {e}")

# 7. pending list me sirf allowed=False
try:
    t1 = _mint(1, "919834854511")
    r = client.get("/owners?status=pending", headers={"Authorization": f"Bearer {t1}"}) if t1 else None
    rows = r.json() if r is not None and r.status_code == 200 else None
    ok = (
        isinstance(rows, list) and len(rows) > 0
        and all(isinstance(x, dict) and x.get("allowed") is False for x in rows)
    )
    report(7, "pending list", ok, f"-> count={len(rows) if isinstance(rows, list) else '?'}")
except Exception as e:
    report(7, "pending list", False, f"EXC {e}")

print(f"P6 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)

# 8. legacy reruns
print("--- legacy reruns ---")
legacy_ok = True
for name in ("verify_p2.py", "verify_p3.py", "verify_p4.py"):
    try:
        p = subprocess.run([sys.executable, name], capture_output=True, text=True, timeout=900)
        tail = (p.stdout or "").strip().splitlines()
        last = tail[-1] if tail else ""
        good = p.returncode == 0
        print(f"[{'PASS' if good else 'FAIL'}] {name} -> {last[:120]}")
        if not good:
            legacy_ok = False
            print((p.stdout or "")[-1500:])
    except Exception as e:
        print(f"[FAIL] {name} EXC {e}")
        legacy_ok = False

if not legacy_ok:
    print("FAILURES: legacy scripts")
    sys.exit(1)
report(8, "legacy p2/p3/p4", True, "-> all green")
print(f"P6 VERIFY: {passed}/{total} + legacy green")
