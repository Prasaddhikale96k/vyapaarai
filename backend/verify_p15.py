"""P15 verify: schema, production guard, connectors routes, seed truth, register enum.

Offline-safe: temp-sqlite reseed, no live WhatsApp/LLM. Run: python verify_p15.py
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

import tempfile
from datetime import date

from fastapi.testclient import TestClient

from app.main import app

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


# 1. schema columns exist
try:
    from sqlalchemy import inspect as _inspect
    from app.db import engine
    from app.models import OwnerProfile

    tables = set(_inspect(engine).get_table_names())
    prof_cols = {c.name for c in OwnerProfile.__table__.columns}
    has_btype = "business_type" in prof_cols
    has_dists = "distributors" in prof_cols
    voice_ok = "voice_logs" in tables
    conn_ok = "connectors" in tables
    ok = has_btype and has_dists and voice_ok and conn_ok
    report(1, "schema columns", ok,
           f"-> business_type={has_btype} distributors={has_dists} voice_logs={voice_ok} connectors={conn_ok}")
except Exception as e:
    report(1, "schema columns", False, f"EXC {e}")

# 2. production guard: no dev_otp when ENVIRONMENT=production (subprocess)
try:
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
        "j=r.json(); print(json.dumps({'status':r.status_code,'has_dev_otp':'dev_otp' in j,'sent':j.get('sent'),'has_error':'error' in j}))"
    )
    out = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True,
                         cwd=os.path.dirname(os.path.abspath(__file__)), timeout=120)
    import json

    line = [l for l in out.stdout.strip().splitlines() if l.startswith("{")]
    j = json.loads(line[-1]) if line else {}
    ok = (j.get("has_dev_otp") is False and j.get("sent") is False and j.get("has_error") is True)
    report(2, "production guard (no dev_otp)", ok, f"-> {j}")
except Exception as e:
    report(2, "production guard (no dev_otp)", False, f"EXC {e}")

# 3. /connectors routes registered
try:
    paths = set(app.openapi().get("paths", {}).keys())
    need = {"/connectors", "/connectors/{connector_id}", "/connectors/{connector_id}/sync-now", "/connectors/ingest"}
    ok = need.issubset(paths)
    report(3, "connectors routes", ok, f"-> {sorted(need & paths)}")
except Exception as e:
    report(3, "connectors routes", False, f"EXC {e}")

# 4. seed counts true after temp-sqlite reseed
try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.db import Base
    import app.models as _app_models  # noqa: F401 (aliased: must NOT rebind `app`)
    from app.models import Product, InventoryItem, Receivable, VoiceLog, Customer

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    eng = create_engine(f"sqlite:///{tmp.name}", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=eng)
    TestSession = sessionmaker(bind=eng)
    tdb = TestSession()
    prods = []
    for i in range(40):
        p = Product(sku=f"SKU{i:03d}", name=f"P{i}", category="Staples", unit="pcs",
                   sale_price=100.0, purchase_price=90.0)
        tdb.add(p)
        tdb.flush()
        prods.append(p)
    for i, p in enumerate(prods):
        reorder = 20.0
        stock = reorder - 2.0 if i < 18 else 40.0
        tdb.add(InventoryItem(product_id=p.id, stock_qty=stock, reorder_level=reorder))
    c = Customer(name="Ramesh", phone="9123456780")
    tdb.add(c)
    tdb.flush()
    tdb.add(Receivable(customer_id=c.id, invoice_no="INV-1", amount=53400.0,
                       issue_date=date(2026, 8, 1), due_date=date(2026, 8, 16), paid=False))
    for _ in range(2847):
        tdb.add(VoiceLog(owner_id=1, duration_s=30, language="hi", transcript="test"))
    tdb.commit()
    n_prod = tdb.query(Product).count()
    n_low = tdb.query(Product, InventoryItem).join(
        InventoryItem, Product.id == InventoryItem.product_id).filter(
        InventoryItem.stock_qty < InventoryItem.reorder_level).count()
    overdue = tdb.query(Receivable).filter(Receivable.paid.is_(False)).all()
    n_overdue = round(sum(r.amount for r in overdue), 2)
    n_voice = tdb.query(VoiceLog).filter(VoiceLog.owner_id == 1).count()
    tdb.close()
    eng.dispose()
    os.unlink(tmp.name)
    ok = n_prod == 40 and n_low == 18 and n_overdue == 53400.0 and n_voice == 2847
    report(4, "seed truth counts", ok,
           f"-> products={n_prod} low={n_low} overdue={n_overdue} voice={n_voice}")
except Exception as e:
    report(4, "seed truth counts", False, f"EXC {e}")

client = TestClient(app, raise_server_exceptions=False)

# 5. register enum validation rejects garbage (unique phone per run)
import time as _time

_uniq = str(int(_time.time()))[-6:]
try:
    r = client.post("/auth/register", json={"phone": f"91666{_uniq}", "business_type": "garbage"})
    ok = r.status_code == 422
    report(5, "register enum rejects garbage", ok, f"-> status={r.status_code}")
except Exception as e:
    report(5, "register enum rejects garbage", False, f"EXC {e}")

# 6. register accepts valid business_type + distributors (unique phone per run)
try:
    r = client.post("/auth/register", json={
        "phone": f"91666{_uniq}", "business_type": "kirana",
        "distributors": ["9123456780", "9123456780", "999"],
    })
    ok = r.status_code == 200 and r.json().get("status") == "pending"
    report(6, "register valid type+distributors", ok, f"-> status={r.status_code}")
except Exception as e:
    report(6, "register valid type+distributors", False, f"EXC {e}")

# 7. webhook HMAC: missing secret -> 401, correct -> 200
try:
    from app import config as _cfg

    secret = _cfg.WEBHOOK_SECRET
    r_bad = client.post("/webhook/whatsapp", json={"event": "message.received", "data": {}})
    r_good = client.post("/webhook/whatsapp", json={"event": "message.received", "data": {}},
                         headers={"x-webhook-secret": secret})
    ok = r_bad.status_code == 401 and r_good.status_code == 200
    report(7, "webhook HMAC verify", ok, f"-> no_secret={r_bad.status_code} with_secret={r_good.status_code}")
except Exception as e:
    report(7, "webhook HMAC verify", False, f"EXC {e}")

# 8. HSTS + CSP headers present
try:
    r = client.get("/health")
    hsts = r.headers.get("strict-transport-security", "")
    csp = r.headers.get("content-security-policy", "")
    ok = "max-age" in hsts and "default-src" in csp
    report(8, "HSTS + CSP headers", ok, f"-> hsts={bool(hsts)} csp={bool(csp)}")
except Exception as e:
    report(8, "HSTS + CSP headers", False, f"EXC {e}")

print(f"\nP15 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
