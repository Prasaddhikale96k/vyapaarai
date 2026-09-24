import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Live WhatsApp ko verify se door rakho (fake numbers pe send = link flag hota hai).
os.environ["WA_GATEWAY"] = "evolution"

import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

failures = []
passed = 0
total = 9


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}")
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


# 1. tool_run_sql
try:
    from app.services import agents as ag

    r1 = ag.tool_run_sql("SELECT COUNT(*) AS n FROM products")
    ok1 = False
    try:
        rows = json.loads(r1)
        ok1 = isinstance(rows, list) and len(rows) > 0 and "n" in rows[0]
    except Exception:
        ok1 = False
    r2 = ag.tool_run_sql("DELETE FROM products")
    ok2 = isinstance(r2, str) and r2.startswith("ERROR")
    r3 = ag.tool_run_sql("SELECT * FROM products; DROP TABLE products")
    ok3 = isinstance(r3, str) and r3.startswith("ERROR")
    ok = ok1 and ok2 and ok3
    report(1, "tool_run_sql safety", ok, f"-> select_ok={ok1} delete_err={ok2} multi_err={ok3}")
except Exception as e:
    report(1, "tool_run_sql safety", False, f"EXC {e}")

# 2. tool_get_metric
try:
    from app.services import agents as ag

    raw = ag.tool_get_metric("overdue_total")
    ok_num = False
    val = None
    try:
        val = json.loads(raw)
        ok_num = isinstance(val, (int, float)) and float(val) >= 50000
    except Exception:
        ok_num = False
    raw2 = ag.tool_get_metric("nonsense")
    ok_err = isinstance(raw2, str) and raw2.startswith("ERROR")
    ok = ok_num and ok_err
    report(2, "tool_get_metric overdue", ok, f"-> overdue={val} err={ok_err}")
except Exception as e:
    report(2, "tool_get_metric overdue", False, f"EXC {e}")

# 3. detect_language
try:
    from app.services import agents as ag

    ok = ag.detect_language("नमस्ते भाई") == "hi" and ag.detect_language("hello") == "en"
    report(3, "detect_language", ok,
           f"-> hi={ag.detect_language('नमस्ते भाई')} en={ag.detect_language('hello')}")
except Exception as e:
    report(3, "detect_language", False, f"EXC {e}")

# 4. POST /actions/generate + dedupe
try:
    # clean slate so re-runs are deterministic
    from app.db import SessionLocal
    from app.models import Action

    db = SessionLocal()
    try:
        db.query(Action).delete()
        db.commit()
    finally:
        db.close()
    r = client.post("/actions/generate")
    j = r.json() if r.status_code == 200 else {}
    c1 = j.get("created")
    ok1 = r.status_code == 200 and isinstance(c1, int) and c1 >= 3
    r2 = client.post("/actions/generate")
    j2 = r2.json() if r2.status_code == 200 else {}
    c2 = j2.get("created")
    ok2 = r2.status_code == 200 and c2 == 0
    ok = ok1 and ok2
    report(4, "/actions/generate dedupe", ok, f"-> created1={c1} created2={c2}")
except Exception as e:
    report(4, "/actions/generate dedupe", False, f"EXC {e}")

# 5. GET /actions?status=pending
try:
    r = client.get("/actions", params={"status": "pending"})
    j = r.json() if r.status_code == 200 else []
    ok = (
        r.status_code == 200
        and isinstance(j, list)
        and len(j) > 0
        and all(isinstance(it, dict) and str(it.get("draft_message") or "").strip() != "" for it in j)
    )
    report(5, "GET /actions pending", ok, f"-> {r.status_code} count={len(j) if isinstance(j, list) else '?'}")
except Exception as e:
    report(5, "GET /actions pending", False, f"EXC {e}")

# 6. approve / reject
try:
    r = client.get("/actions", params={"status": "pending"})
    items = r.json() if r.status_code == 200 else []
    if not isinstance(items, list) or len(items) < 2:
        report(6, "approve/reject", False, f"need >=2 pending, got {len(items) if isinstance(items, list) else '?'}")
    else:
        first = items[0]["id"]
        second = items[1]["id"]
        ra = client.post(f"/actions/{first}/approve")
        ja = ra.json() if ra.status_code == 200 else {}
        ok_a = (
            ra.status_code == 200
            and ja.get("status") == "approved"
            and isinstance(ja.get("delivery"), dict)
            and ja["delivery"].get("simulated") is True
        )
        ra2 = client.post(f"/actions/{first}/approve")
        ok_a2 = ra2.status_code == 409
        rr = client.post(f"/actions/{second}/reject")
        jr = rr.json() if rr.status_code == 200 else {}
        ok_r = rr.status_code == 200 and jr.get("status") == "rejected"
        ok = ok_a and ok_a2 and ok_r
        report(6, "approve/reject", ok,
               f"-> approve={ra.status_code}/{ja.get('status')} re-approve={ra2.status_code} reject={rr.status_code}/{jr.get('status')}")
except Exception as e:
    report(6, "approve/reject", False, f"EXC {e}")

# 7. llm demo fallback
try:
    from app.services import llm as llm_mod

    t = llm_mod._demo_fallback("profit kyun gira?")
    ok = isinstance(t, str) and len(t.strip()) > 0 and "Demo mode" in t
    report(7, "demo_fallback", ok, f"-> len={len(t) if isinstance(t, str) else '?'}")
except Exception as e:
    report(7, "demo_fallback", False, f"EXC {e}")

# 8. POST /chat
try:
    r = client.post("/chat", json={"message": "Why did my profit fall this month?"})
    j = r.json() if r.status_code == 200 else {}
    ans = j.get("answer", "")
    steps = j.get("steps", None)
    prov = j.get("provider", "")
    ok = (
        r.status_code == 200
        and isinstance(ans, str) and len(ans) > 50
        and isinstance(steps, list)
        and prov in ("groq", "gemini", "demo_fallback")
    )
    report(8, "POST /chat", ok,
           f"-> {r.status_code} ans_len={len(ans) if isinstance(ans, str) else '?'} provider={prov} steps={len(steps) if isinstance(steps, list) else '?'}")
except Exception as e:
    report(8, "POST /chat", False, f"EXC {e}")

# 9. POST /chat empty -> 422
try:
    r = client.post("/chat", json={"message": ""})
    ok = r.status_code == 422
    report(9, "POST /chat empty 422", ok, f"-> {r.status_code} {r.text[:200]}")
except Exception as e:
    report(9, "POST /chat empty 422", False, f"EXC {e}")

print(f"P3 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)
