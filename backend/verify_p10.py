"""Phase B-2 verify: credit score + festival forecast. 5 checks + legacy on sqlite."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
os.environ["WA_GATEWAY"] = "evolution"

import subprocess
import sys
from datetime import date, datetime, timedelta
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app as _fastapi_app
from app.db import SessionLocal, ensure_access_schema, ensure_p4_schema

ensure_p4_schema()
ensure_access_schema()

client = TestClient(_fastapi_app)

failures = []
passed = 0
total = 5


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


# 1. /credit-score owner1 + owner2 differs
try:
    from app.models import OwnerProfile

    db = _db()
    try:
        o2 = db.query(OwnerProfile).filter(OwnerProfile.id == 2).first()
        if o2 is not None and not bool(getattr(o2, "allowed", False)):
            o2.allowed = True
            db.commit()
    finally:
        db.close()
    r1 = client.get("/credit-score", headers=_auth(1, "919834854511"))
    j1 = r1.json() if r1.status_code == 200 else {}
    r2 = client.get("/credit-score", headers=_auth(2, "919812345678"))
    j2 = r2.json() if r2.status_code == 200 else {}
    o1, o2s = j1.get("overall"), j2.get("overall")
    ok = (
        r1.status_code == 200 and r2.status_code == 200
        and isinstance(o1, (int, float)) and 0 <= o1 <= 100
        and j1.get("grade") in ("Loan-ready", "Improving", "High-risk")
        and "₹" in str(j1.get("bank_summary", ""))
        and "Sharma Kirana Traders" in str(j1.get("bank_summary", ""))
        and isinstance(j1.get("reasons"), list) and len(j1["reasons"]) >= 1
        and isinstance(o2s, (int, float)) and o2s != o1
    )
    report(1, "credit-score", ok,
           f"-> owner1={o1}/{j1.get('grade')} owner2={o2s} "
           f"reasons={len(j1.get('reasons') or [])}")
except Exception as e:
    report(1, "credit-score", False, f"EXC {e}")

# 2+3. festival forecast (Diwali 2026-11-08) + festivals list
try:
    target = date(2026, 11, 8)
    need = (target - date.today()).days + 1
    days = max(need, 14)
    if days > 60:
        report(2, "diwali spike", False, f"target out of 60d horizon (need {need})")
        report(3, "festivals list", False, "skipped")
    else:
        r = client.get("/forecast", params={"sku": "ST-ATTA-5KG", "days": days})
        j = r.json() if r.status_code == 200 else {}
        fc = j.get("forecast", []) if isinstance(j.get("forecast"), list) else []
        hit = [e for e in fc if isinstance(e, dict) and e.get("date") == "2026-11-08"]
        wkday = []
        for e in fc:
            try:
                d = date.fromisoformat(str(e.get("date", ""))[:10])
                if (e.get("festival") in (None, "")
                        and d.weekday() < 5 and float(e.get("qty", 0)) > 0):
                    wkday.append(float(e["qty"]))
            except Exception:
                continue
        wkday.sort()
        med = wkday[len(wkday) // 2] if wkday else 0
        tq = float(hit[0].get("qty", 0)) if hit else 0
        ok2 = (r.status_code == 200 and len(hit) == 1
               and hit[0].get("festival") == "Diwali"
               and med > 0 and tq > 1.3 * med)
        report(2, "diwali spike", ok2,
               f"-> 11-08 qty={tq} fest={hit[0].get('festival') if hit else '?'} "
               f"vs weekday_med={med}")
        fests = j.get("festivals", []) if isinstance(j.get("festivals"), list) else []
        ok3 = any(isinstance(f, dict) and f.get("name") == "Diwali"
                  and abs(float(f.get("multiplier", 0)) - 1.6) < 1e-9 for f in fests)
        report(3, "festivals list", ok3, f"-> {[f.get('name') for f in fests]}")
except Exception as e:
    report(2, "diwali spike", False, f"EXC {e}")
    report(3, "festivals list", False, f"EXC {e}")

# 4. frontend build + tsc + credit card markers
try:
    import pathlib
    fe = pathlib.Path(__file__).resolve().parent.parent / "frontend"
    page = (fe / "app" / "page.tsx").read_text(encoding="utf-8")
    chart = (fe / "components" / "forecast-chart.tsx").read_text(encoding="utf-8")
    markers = ("Business Credit Score" in page and "Copy bank summary" in page
               and "clipboard" in page and "ReferenceArea" in chart
               and "spike expected" in chart)
    t = subprocess.run(["npx", "tsc", "--noEmit"], cwd=str(fe),
                       capture_output=True, text=True, timeout=300, shell=True)
    b = subprocess.run(["npm", "run", "build"], cwd=str(fe),
                       capture_output=True, text=True, timeout=600, shell=True)
    ok = markers and t.returncode == 0 and b.returncode == 0
    report(4, "frontend build", ok,
           f"-> markers={markers} tsc={t.returncode} build={b.returncode}")
except Exception as e:
    report(4, "frontend build", False, f"EXC {e}")

print(f"P10 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)

# 5. legacy p2..p9 on SQLITE
print("--- legacy reruns (sqlite) ---")
os.environ["DATABASE_URL"] = "sqlite:///./vyapaar.db"
legacy_ok = True
for name, cap in (("verify_p2.py", 900), ("verify_p3.py", 900),
                  ("verify_p4.py", 900), ("verify_p6.py", 900),
                  ("verify_p7.py", 900), ("verify_p9.py", 1500)):
    try:
        p = subprocess.run([sys.executable, "-u", name], capture_output=True,
                           text=True, timeout=cap)
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
report(5, "legacy p2..p9 sqlite", True, "-> all green")
print(f"P10 VERIFY: {passed}/{total} + legacy green")
