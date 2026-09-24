"""Phase PROD v2 verify: hardening, offline-safe. 6 checks."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"

import subprocess
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app as _fastapi_app
from app.db import ensure_access_schema, ensure_p4_schema, ensure_prod_schema

ensure_p4_schema()
ensure_access_schema()
ensure_prod_schema()

client = TestClient(_fastapi_app, raise_server_exceptions=False)

failures = []
passed = 0
total = 6
skipped_notes = []


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}", flush=True)
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


# 1. OTP rate limit: 7th rapid -> 429 JSON with request_id
try:
    codes = []
    last_body = {}
    for _ in range(7):
        r = client.post("/auth/otp/request", json={"phone": "919000000099"})
        codes.append(r.status_code)
        try:
            last_body = r.json()
        except Exception:
            last_body = {}
    ok = (codes[6] == 429 and isinstance(last_body, dict)
          and "error" in last_body and str(last_body.get("request_id", "")) != "")
    report(1, "otp rate limit", ok, f"-> {codes} body={last_body}")
except Exception as e:
    report(1, "otp rate limit", False, f"EXC {e}")

# 2. upload guard: 21MB -> 413; traversal sanitized
try:
    big = b"x" * (21 * 1024 * 1024)
    r = client.post("/ingest/upload", files={"file": ("big.csv", big, "text/csv")},
                    data={"type": "sales"})
    ok_big = r.status_code == 413
    from datetime import date as _d
    body = (f"date,product,qty,unit_price,amount,customer\n"
            f"{_d.today().isoformat()},P11 Evil Item,1,10,10,P11 Evil\n")
    r2 = client.post("/ingest/upload", files={"file": ("../../evil.csv", body, "text/csv")},
                     data={"type": "sales"})
    fn = ""
    try:
        fn = str(r2.json().get("filename", ""))
    except Exception:
        pass
    ok_evil = (r2.status_code == 200 and fn == "evil.csv"
               and "/" not in fn and ".." not in fn)
    report(2, "upload guard", ok_big and ok_evil,
           f"-> 21MB={r.status_code} evil={r2.status_code}/{fn!r}")
    try:
        from app.db import SessionLocal
        from app.models import Customer, Product, Sale
        db = SessionLocal()
        try:
            p = db.query(Product).filter(Product.name == "P11 Evil Item").first()
            if p is not None:
                db.query(Sale).filter(Sale.product_id == p.id).delete()
                db.query(Product).filter(Product.id == p.id).delete()
            c = db.query(Customer).filter(Customer.name == "P11 Evil").first()
            if c is not None:
                db.query(Customer).filter(Customer.id == c.id).delete()
            db.commit()
        finally:
            db.close()
    except Exception:
        pass
except Exception as e:
    report(2, "upload guard", False, f"EXC {e}")

# 3. ready + 404 + security headers
try:
    r = client.get("/health/ready")
    j = r.json() if r.status_code == 200 else {}
    r2 = client.get("/nope-xyz-123")
    try:
        j2 = r2.json()
    except Exception:
        j2 = {}
    cto = r.headers.get("x-content-type-options", "")
    ok = (r.status_code == 200 and j.get("db") == "ok" and j.get("watch_dir") is True
          and r2.status_code == 404 and isinstance(j2, dict)
          and str(j2.get("request_id", "")) != ""
          and cto.lower() == "nosniff")
    report(3, "ready+404+headers", ok, f"-> ready={j} 404={j2} xcto={cto!r}")
except Exception as e:
    report(3, "ready+404+headers", False, f"EXC {e}")

# 4. cache hit/miss + invalidate on generate
try:
    r1 = client.get("/health-score")
    r2 = client.get("/health-score")
    h1 = r1.headers.get("x-cache", "")
    h2 = r2.headers.get("x-cache", "")
    rg = client.post("/actions/generate")
    r3 = client.get("/health-score")
    h3 = r3.headers.get("x-cache", "")
    ok = (r1.status_code == 200 and h1 == "miss" and h2 == "hit"
          and rg.status_code == 200 and h3 == "miss")
    report(4, "intel cache", ok, f"-> {h1}/{h2} gen={rg.status_code} after={h3}")
except Exception as e:
    report(4, "intel cache", False, f"EXC {e}")

# 5. PG indexes if postgresql else SKIPPED
try:
    from urllib.parse import urlparse

    from app.db import engine
    if urlparse(str(engine.url)).scheme == "sqlite":
        skipped_notes.append("check5: sqlite -> SKIPPED")
        report(5, "pg indexes", True, "SKIPPED (sqlite)")
    else:
        from sqlalchemy import text as _text
        idx_names = ["ix_sales_owner_date", "ix_receivables_owner_paid",
                     "ix_actions_owner_status", "ix_inventory_owner",
                     "ix_expenses_owner", "ix_document_logs_owner_status",
                     "ix_processed_files_sha256"]
        with engine.connect() as conn:
            have = {r[0] for r in conn.execute(
                _text("select indexname from pg_indexes where schemaname='public'")).fetchall()}
        missing = [n for n in idx_names if n not in have]
        report(5, "pg indexes", not missing, f"-> missing={missing}")
except Exception as e:
    report(5, "pg indexes", False, f"EXC {e}")

print(f"P11v2 VERIFY: {passed}/{total} checks passed", flush=True)
if failures:
    print("FAILURES:", failures, flush=True)
    sys.exit(1)

# 6. legacy p2..p10 on SQLITE, each ONCE
print("--- legacy reruns (sqlite, once each) ---", flush=True)
os.environ["DATABASE_URL"] = "sqlite:///./vyapaar.db"
legacy_ok = True
for name, cap in (("verify_p2.py", 900), ("verify_p3.py", 900),
                  ("verify_p4.py", 900), ("verify_p6.py", 900),
                  ("verify_p7.py", 1200), ("verify_p9.py", 1500),
                  ("verify_p10.py", 2400)):
    try:
        p = subprocess.run([sys.executable, "-u", name], capture_output=True,
                           text=True, timeout=cap)
        tail = (p.stdout or "").strip().splitlines()
        last = tail[-1] if tail else ""
        good = p.returncode == 0
        print(f"[{'PASS' if good else 'FAIL'}] {name} -> {last[:120]}", flush=True)
        if not good:
            legacy_ok = False
            print((p.stdout or "")[-1500:])
            print((p.stderr or "")[-800:])
    except Exception as e:
        print(f"[FAIL] {name} EXC {e}", flush=True)
        legacy_ok = False
    if not legacy_ok:
        break

if not legacy_ok:
    print("FAILURES: legacy scripts", flush=True)
    sys.exit(1)
report(6, "legacy p2..p10 sqlite", True, "-> all green, each once")
print(f"P11v2 VERIFY: {passed}/{total} (+SKIPPED: {'; '.join(skipped_notes) or 'none'})",
      flush=True)
