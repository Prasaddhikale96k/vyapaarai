import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Live WhatsApp ko verify se door rakho (fake numbers pe send = link flag hota hai).
os.environ["WA_GATEWAY"] = "evolution"

import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

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


# 1. /health
try:
    r = client.get("/health")
    ok = r.status_code == 200 and r.json().get("status") == "ok"
    report(1, "/health", ok, f"-> {r.status_code} {r.text[:200]}")
except Exception as e:
    report(1, "/health", False, f"EXC {e}")

# 2. /health-score
try:
    r = client.get("/health-score")
    j = r.json() if r.status_code == 200 else {}
    overall = j.get("overall")
    subs = j.get("subscores", [])
    grade = j.get("grade")
    recv = next((s for s in subs if "eceiv" in str(s.get("name", "")).lower()), None)
    recv_score = recv.get("score") if recv else None
    cond = (
        r.status_code == 200
        and isinstance(overall, (int, float)) and 30 <= overall <= 85
        and isinstance(subs, list) and len(subs) == 4
        and isinstance(recv_score, (int, float)) and recv_score < 80
        and grade in ("Excellent", "Good", "Needs Attention", "At Risk")
        and all(isinstance(s.get("breakdown"), str) and s.get("breakdown").strip() for s in subs)
    )
    report(2, "/health-score", cond,
           f"-> {r.status_code} overall={overall} grade={grade} recv={recv_score} subs={len(subs) if isinstance(subs, list) else '?'}")
except Exception as e:
    report(2, "/health-score", False, f"EXC {e}")

# 3. /root-cause
try:
    r = client.get("/root-cause")
    j = r.json() if r.status_code == 200 else {}
    narrative = j.get("narrative", "")
    factors = j.get("factors", [])
    change_pct = j.get("change_pct")
    blob = " ".join(
        str(f.get("factor", "")) + " " + str(f.get("detail", "")) for f in factors
    ).lower() if isinstance(factors, list) else ""
    mentions = ("receivable" in blob or "overdue" in blob)
    cond = (
        r.status_code == 200
        and isinstance(narrative, str) and narrative.strip() != ""
        and isinstance(factors, list) and len(factors) >= 3
        and isinstance(change_pct, (int, float))
        and mentions
    )
    report(3, "/root-cause", cond,
           f"-> {r.status_code} narrative_len={len(narrative) if isinstance(narrative, str) else '?'} "
           f"factors={len(factors) if isinstance(factors, list) else '?'} change_pct={change_pct} mentions_recv={mentions}")
except Exception as e:
    report(3, "/root-cause", False, f"EXC {e}")

# 4. /anomalies
try:
    r = client.get("/anomalies")
    j = r.json() if r.status_code == 200 else None
    cond = (
        r.status_code == 200
        and isinstance(j, list)
        and all(
            isinstance(it, dict) and it.get("type") and it.get("severity") and it.get("message")
            for it in j
        )
    )
    report(4, "/anomalies", cond, f"-> {r.status_code} count={len(j) if isinstance(j, list) else '?'}")
except Exception as e:
    report(4, "/anomalies", False, f"EXC {e}")

# 5. /products
first_sku = None
products_count = None
try:
    r = client.get("/products")
    j = r.json() if r.status_code == 200 else []
    products_count = len(j) if isinstance(j, list) else -1
    ok = r.status_code == 200 and isinstance(j, list) and len(j) >= 15
    if ok and len(j) > 0:
        first_sku = j[0].get("sku")
    report(5, "/products", ok, f"-> {r.status_code} count={products_count} first_sku={first_sku}")
except Exception as e:
    report(5, "/products", False, f"EXC {e}")

# 6. /forecast valid sku
try:
    if not first_sku:
        report(6, "/forecast valid", False, "no sku from check 5")
    else:
        r = client.get(f"/forecast?sku={first_sku}&days=14")
        j = r.json() if r.status_code == 200 else {}
        hist = j.get("history", [])
        fc = j.get("forecast", [])
        avg = j.get("avg_daily")
        risk = j.get("risk")
        cond = (
            r.status_code == 200
            and isinstance(hist, list) and len(hist) == 28
            and isinstance(fc, list) and len(fc) == 14
            and isinstance(avg, (int, float)) and avg >= 0
            and risk in ("CRITICAL", "HIGH", "MEDIUM", "OK")
        )
        report(6, "/forecast valid", cond,
               f"-> {r.status_code} sku={first_sku} hist={len(hist) if isinstance(hist, list) else '?'} "
               f"fc={len(fc) if isinstance(fc, list) else '?'} avg={avg} risk={risk}")
except Exception as e:
    report(6, "/forecast valid", False, f"EXC {e}")

# 7. /forecast unknown -> 404
try:
    r = client.get("/forecast?sku=DOES_NOT_EXIST&days=14")
    ok = r.status_code == 404
    report(7, "/forecast 404", ok, f"-> {r.status_code} {r.text[:200]}")
except Exception as e:
    report(7, "/forecast 404", False, f"EXC {e}")

# 8. /buy-sell-matrix
try:
    r = client.get("/buy-sell-matrix")
    j = r.json() if r.status_code == 200 else {}
    prods = j.get("products", [])
    qcounts = j.get("quadrant_counts", {})
    valid_q = {"STAR", "VOLUME", "HIDDEN_GEM", "EXIT"}
    cond = (
        r.status_code == 200
        and isinstance(prods, list)
        and products_count is not None and len(prods) == products_count
        and all(
            isinstance(p, dict) and p.get("quadrant") in valid_q and p.get("action") and str(p.get("action")).strip()
            for p in prods
        )
        and isinstance(qcounts, dict) and set(qcounts.keys()) == valid_q
    )
    report(8, "/buy-sell-matrix", cond,
           f"-> {r.status_code} products={len(prods) if isinstance(prods, list) else '?'} "
           f"expected={products_count} qcounts={qcounts}")
except Exception as e:
    report(8, "/buy-sell-matrix", False, f"EXC {e}")

# 9. /brief
try:
    r = client.get("/brief")
    j = r.json() if r.status_code == 200 else None
    cond = (
        r.status_code == 200
        and isinstance(j, list) and len(j) == 3
        and all(
            isinstance(it, dict) and it.get("icon") and it.get("title") and it.get("detail")
            for it in j
        )
    )
    titles = [it.get("title") for it in j] if isinstance(j, list) else j
    report(9, "/brief", cond, f"-> {r.status_code} titles={titles}")
except Exception as e:
    report(9, "/brief", False, f"EXC {e}")

print(f"P2 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)
