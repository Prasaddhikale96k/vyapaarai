"""One-shot FINAL verify: schema, prod guard, routes, reseed truth, enum, HMAC,
copy-proof, scheme radar. Offline-safe (temp-sqlite reseed, no live WA/LLM).

Run: python verify_p15.py -> P15 VERIFY: 9/9 + ALL GREEN
"""
import os

os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"  # keep live WA out
os.environ["ENVIRONMENT"] = "development"

import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import time as _time

from fastapi.testclient import TestClient

from app.main import app

failures = []
passed = 0
total = 9


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}", flush=True)
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


# 1. new tables/columns exist
try:
    from app.models import ChatMessage, Contact, Connector, OwnerProfile, VoiceLog

    prof_cols = {c.name for c in OwnerProfile.__table__.columns}
    chat_cols = {c.name for c in ChatMessage.__table__.columns}
    checks = {
        "business_type": "business_type" in prof_cols,
        "distributors": "distributors" in prof_cols,
        "contacts": Contact.__tablename__ == "contacts",
        "connectors": Connector.__tablename__ == "connectors",
        "chat.owner_id": "owner_id" in chat_cols,
        "chat.source": "source" in chat_cols,
        "voice_logs": VoiceLog.__tablename__ == "voice_logs",
    }
    ok = all(checks.values())
    report(1, "tables/columns", ok, f"-> {checks}")
except Exception as e:
    report(1, "tables/columns", False, f"EXC {e}")

# 2. production guard: no dev_otp when ENVIRONMENT=production (subprocess)
try:
    import json
    import subprocess

    script = (
        "import os; os.environ['ENVIRONMENT']='production'; os.environ['ENABLE_WATCHER']='false';"
        "os.environ['WA_GATEWAY']='evolution';"
        "from fastapi.testclient import TestClient; from app.main import app;"
        "from app.db import SessionLocal; from app.models import OwnerProfile;"
        "db=SessionLocal(); p=db.query(OwnerProfile).filter(OwnerProfile.id==1).first();"
        "p.allowed=True; db.commit(); db.close();"
        "c=TestClient(app, raise_server_exceptions=False);"
        "import json; r=c.post('/auth/otp/request', json={'phone':'919834854511'});"
        "j=r.json(); print(json.dumps({'status':r.status_code,'has_dev_otp':'dev_otp' in j,'sent':j.get('sent'),'reason':j.get('reason'),'has_detail':'detail' in j}))"
    )
    out = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True,
                         cwd=os.path.dirname(os.path.abspath(__file__)), timeout=180)
    line = [l for l in out.stdout.strip().splitlines() if l.startswith("{")]
    j = json.loads(line[-1]) if line else {}
    # P19 honesty contract: 502 + NO dev_otp + sent False + reason + Hindi detail
    ok = (j.get("status") == 502 and j.get("has_dev_otp") is False and j.get("sent") is False
          and j.get("reason") == "whatsapp-delivery-failed" and j.get("has_detail") is True)
    report(2, "production guard (502 honesty, no dev_otp)", ok, f"-> {j}")
except Exception as e:
    report(2, "production guard (no dev_otp)", False, f"EXC {e}")

# 3. routes registered
try:
    paths = set(app.openapi().get("paths", {}).keys())
    need = {"/connectors", "/connectors/{connector_id}", "/connectors/{connector_id}/sync-now",
            "/connectors/ingest", "/contacts", "/contacts/{contact_id}",
            "/contacts/{contact_id}/send", "/credit-score/report", "/ingest/grid"}
    missing = sorted(need - paths)
    ok = not missing
    report(3, "routes registered", ok, f"-> missing={missing}")
except Exception as e:
    report(3, "routes registered", False, f"EXC {e}")

# 4. temp-sqlite reseed counts true (REAL seed_demo_data on scratch DB)
try:
    import json
    import subprocess
    import tempfile

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    seed_script = (
        "import json;"
        "from app.db import SessionLocal;"
        "from app.models import Product, InventoryItem, Receivable, VoiceLog;"
        "from sqlalchemy import func;"
        "db=SessionLocal();"
        "n_prod=db.query(Product).count();"
        "n_low=db.query(Product, InventoryItem).join(InventoryItem, Product.id==InventoryItem.product_id)"
        ".filter(InventoryItem.stock_qty<InventoryItem.reorder_level).count();"
        "od=db.query(func.sum(Receivable.amount)).filter(Receivable.paid.is_(False)).scalar() or 0;"
        "n_voice=db.query(VoiceLog).filter(VoiceLog.owner_id==1).count();"
        "db.close();"
        "print(json.dumps({'prod':n_prod,'low':n_low,'overdue':round(float(od),2),'voice':n_voice}))"
    )
    env = dict(os.environ, DATABASE_URL=f"sqlite:///{tmp.name}")
    here = os.path.dirname(os.path.abspath(__file__))
    r1 = subprocess.run([sys.executable, "seed_demo_data.py"], capture_output=True, text=True,
                        cwd=here, env=env, timeout=300)
    r2 = subprocess.run([sys.executable, "-c", seed_script], capture_output=True, text=True,
                        cwd=here, env=env, timeout=120)
    line = [l for l in r2.stdout.strip().splitlines() if l.startswith("{")]
    j = json.loads(line[-1]) if line else {}
    try:
        os.unlink(tmp.name)
    except Exception:
        pass
    ok = (j.get("prod") == 40 and j.get("low") == 18
          and j.get("overdue") == 53400.0 and j.get("voice") == 2847)
    report(4, "reseed truth (18 low of 40, 2847 voice)", ok, f"-> {j} seed_rc={r1.returncode}")
except Exception as e:
    report(4, "reseed truth (18 low of 40, 2847 voice)", False, f"EXC {e}")

client = TestClient(app, raise_server_exceptions=False)

# 5. register enum validation rejects garbage (unique phone per run)
_uniq = str(int(_time.time()))[-6:]
try:
    r = client.post("/auth/register", json={"phone": f"91666{_uniq}", "business_type": "garbage"})
    ok = r.status_code == 422
    report(5, "register enum rejects garbage", ok, f"-> status={r.status_code}")
except Exception as e:
    report(5, "register enum rejects garbage", False, f"EXC {e}")

# 6. webhook HMAC: missing secret -> 401, correct -> 200
try:
    from app import config as _cfg

    secret = _cfg.WEBHOOK_SECRET
    r_bad = client.post("/webhook/whatsapp", json={"event": "message.received", "data": {}})
    r_good = client.post("/webhook/whatsapp", json={"event": "message.received", "data": {}},
                         headers={"x-webhook-secret": secret})
    ok = r_bad.status_code == 401 and r_good.status_code == 200
    report(6, "webhook HMAC verify", ok, f"-> no_secret={r_bad.status_code} with_secret={r_good.status_code}")
except Exception as e:
    report(6, "webhook HMAC verify", False, f"EXC {e}")

# 7. copy proof: GATE-2 no longer contains "Admin approve karega"
try:
    import re

    hits = []
    for rel in ["app/services/whatsapp_flow.py", "app/routers/auth.py", "app/services/owners.py"]:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), *rel.split("/"))
        with open(p, encoding="utf-8", errors="replace") as f:
            src = f.read()
        for i, ln in enumerate(src.splitlines(), start=1):
            if re.search(r"admin approve karega|approval pending", ln, re.IGNORECASE):
                hits.append(f"{rel}:{i}")
    import pathlib

    fe = pathlib.Path(os.path.dirname(os.path.abspath(__file__))).parent / "frontend"
    for pat in ["app/login/page.tsx", "app/register/page.tsx", "app/app/chat/page.tsx",
                "app/app/contacts/page.tsx", "app/app/data/page.tsx", "app/app/actions/page.tsx",
                "components/sidebar.tsx"]:
        p = fe / pat
        if p.exists():
            src = p.read_text(encoding="utf-8", errors="replace")
            for i, ln in enumerate(src.splitlines(), start=1):
                if re.search(r"admin approve karega|approval pending", ln, re.IGNORECASE):
                    hits.append(f"frontend/{pat}:{i}")
    ok = not hits
    report(7, "no admin-approval copy", ok, f"-> hits={hits}")
except Exception as e:
    report(7, "no admin-approval copy", False, f"EXC {e}")

# 8. HSTS + CSP headers present
try:
    r = client.get("/health")
    hsts = r.headers.get("strict-transport-security", "")
    csp = r.headers.get("content-security-policy", "")
    ok = "max-age" in hsts and "default-src" in csp
    report(8, "HSTS + CSP headers", ok, f"-> hsts={bool(hsts)} csp={bool(csp)}")
except Exception as e:
    report(8, "HSTS + CSP headers", False, f"EXC {e}")

# 9. scheme radar offline-safe: regex parse + honest fallback, no action on fail
try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db import Base
    import app.models as _m  # noqa: F401
    from app.models import Action, Product
    from app.services import schemes as _sch

    eng = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    tdb = sessionmaker(bind=eng)()
    tdb.add(Product(owner_id=1, sku="PARLE-G", name="Parle-G Gold", category="Snacks",
                    unit="pcs", sale_price=25.0, purchase_price=20.0))
    tdb.commit()

    class _Prof:
        language = "hi"

    parsed = _sch.extract_scheme("Parle-G 10+1 free till Diwali, Rs 200")
    ok_parse = (parsed is not None and parsed.get("buy_qty") == 10
                and parsed.get("free_qty") == 1)
    r_ok = _sch.handle_scheme(tdb, _Prof(), "Parle-G 10+1 free till Diwali, Rs 200", owner_id=1)
    n_act = tdb.query(Action).filter(Action.type == "scheme_alert").count()
    r_fb = _sch.handle_scheme(tdb, _Prof(), "dhamaka offer hai bhai le lo", owner_id=1)
    n_act2 = tdb.query(Action).filter(Action.type == "scheme_alert").count()
    r_plain = _sch.handle_scheme(tdb, _Prof(), "aaj ka sale kitna hua", owner_id=1)
    tdb.close()
    eng.dispose()
    ok = (ok_parse and r_ok.get("handled") is True and n_act == 1
          and r_fb.get("handled") is True and "samajh nahi aayi" in r_fb.get("reply", "")
          and n_act2 == 1 and r_plain.get("handled") is False)
    report(9, "scheme radar (parse+action+fallback)", ok,
           f"-> parsed={parsed} acts={n_act}->{n_act2} plain={r_plain.get('handled')}")
except Exception as e:
    report(9, "scheme radar (parse+action+fallback)", False, f"EXC {e}")

print(f"\nP15 VERIFY: {passed}/{total} checks passed", flush=True)
if failures:
    print("FAILURES:", flush=True)
    for f in failures:
        print(f"  - {f}", flush=True)
    sys.exit(1)
print("P15 VERIFY: ALL GREEN", flush=True)
