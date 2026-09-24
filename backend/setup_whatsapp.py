"""VyapaarAI WhatsApp setup via OpenWA gateway — repeatable + idempotent.

Usage (laptop restart ke baad bhi same):
    backend\\openwa_start.cmd        (OpenWA start)
    uvicorn app.main:app --reload    (backend start, backend/ folder se)
    python setup_whatsapp.py         (backend/ folder se)

Sirf `requests` chahiye (requirements.txt me already hai).
Har HTTP call timeout=10, try/except ke saath — network error par crash nahi hoga.
10 baar chalao = same result (har step skip gracefully karta hai).

OpenWA routes iske apne source se liye gaye hain:
  GET  /api/health                              (public, key nahi chahiye)
  GET  /api/sessions?name=<name>                (session dhundo)
  POST /api/sessions {name}                     (session banao, 201 + {id,...})
  POST /api/sessions/<id>/start                 (engine start)
  GET  /api/sessions/<id>                       (status: ready = connected)
  GET  /api/sessions/<id>/qr                    ({qrCode: 'data:image/png;base64,...'})
  POST /api/sessions/<id>/webhooks {url, events, secret>=16 chars, retryCount}
Auth: X-API-Key header (= OpenWA .env me API_MASTER_KEY).
"""

import base64
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("`requests` nahi mila. Pehle chalao: pip install -r requirements.txt")
    sys.exit(1)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

TIMEOUT = 10
BASE_DIR = Path(__file__).resolve().parent  # backend/
QR_PATH = BASE_DIR / "qr.png"
ENV_PATH = BASE_DIR / ".env"


def load_dotenv_minimal(path: Path) -> None:
    """Chhota .env loader — koi nayi dependency nahi. Existing env ko override nahi karta."""
    try:
        if not path.exists():
            return
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception as exc:
        print(f"[warn] .env padhne me dikkat ({exc}) — defaults use kar rahe hain.")


load_dotenv_minimal(ENV_PATH)

OPENWA_URL = (os.getenv("OPENWA_URL", "http://localhost:2785") or "http://localhost:2785").strip().rstrip("/")
OPENWA_API_KEY = os.getenv("OPENWA_API_KEY", "").strip()
OPENWA_SESSION = (os.getenv("OPENWA_SESSION", "vyapaarai") or "vyapaarai").strip()
BACKEND_PORT = (os.getenv("BACKEND_PORT", "8000") or "8000").strip()
WEBHOOK_URL = (
    os.getenv("WEBHOOK_URL", "") or f"http://localhost:{BACKEND_PORT}/webhook/whatsapp"
).strip()
# OpenWA secret kam se kam 16 chars maangta hai (chhota secret = HTTP 400).
WEBHOOK_SECRET = (os.getenv("WEBHOOK_SECRET", "") or "vyapaar_hmac_secret_2026").strip()
if len(WEBHOOK_SECRET) < 16:
    WEBHOOK_SECRET = "vyapaar_hmac_secret_2026"

API = OPENWA_URL + "/api"


def H() -> dict:
    return {"X-API-Key": OPENWA_API_KEY, "Content-Type": "application/json"}


def step1_health() -> None:
    print("[1/5] OpenWA health check ho raha hai...")
    try:
        r = requests.get(f"{API}/health", timeout=TIMEOUT)
        print(f"[1/5] OpenWA mil gaya (HTTP {r.status_code}). Aage badhte hain.")
        return
    except Exception:
        pass
    try:
        # purana fallback: bina /api ke root
        r = requests.get(f"{OPENWA_URL}/api", timeout=TIMEOUT)
        print(f"[1/5] OpenWA mil gaya (HTTP {r.status_code}). Aage badhte hain.")
        return
    except Exception:
        pass
    print("OpenWA nahi chal raha. backend\\openwa_start.cmd chalao, phir dobara chalao: python setup_whatsapp.py")
    sys.exit(1)


def find_session() -> dict | None:
    try:
        r = requests.get(f"{API}/sessions", headers=H(), params={"name": OPENWA_SESSION}, timeout=TIMEOUT)
        if r.status_code == 401:
            print("[warn] API key galat hai — OPENWA_API_KEY backend/.env me OpenWA ke API_MASTER_KEY jaisa rakho.")
            return None
        if r.status_code != 200:
            print(f"[warn] session list HTTP {r.status_code}: {r.text[:200]}")
            return None
        try:
            data = r.json()
        except Exception:
            return None
        items = data if isinstance(data, list) else [data]
        for it in items:
            if isinstance(it, dict) and str(it.get("name") or "") == OPENWA_SESSION and it.get("id"):
                return it
        return None
    except Exception as exc:
        print(f"[warn] session list me network dikkat: {exc}")
        return None


def step2_ensure_session() -> dict:
    print("[2/5] Session check ho rahi hai...")
    sess = find_session()
    if sess:
        print(f"[2/5] Session '{OPENWA_SESSION}' pehle se hai (id={sess.get('id')}) — create skip.")
        return sess
    print(f"[2/5] Session '{OPENWA_SESSION}' bana rahe hain...")
    try:
        r = requests.post(f"{API}/sessions", headers=H(), json={"name": OPENWA_SESSION}, timeout=TIMEOUT)
        if r.status_code in (200, 201):
            try:
                sess = r.json()
            except Exception:
                sess = {}
            print(f"[2/5] Session ban gayi (id={(sess or {}).get('id')}).")
            return sess if isinstance(sess, dict) else {}
        if r.status_code == 409 or "exist" in r.text.lower():
            print("[2/5] Session lagta hai pehle se hai (409) — dobara dhundhte hain.")
            return find_session() or {}
        print(f"[warn] Session create HTTP {r.status_code}: {r.text[:300]}")
        sys.exit(1)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[warn] Session create me network dikkat: {exc}")
        sys.exit(1)
    return {}


def get_status(sid: str) -> str:
    try:
        r = requests.get(f"{API}/sessions/{sid}", headers=H(), timeout=TIMEOUT)
        if r.status_code == 200:
            try:
                return str((r.json() or {}).get("status", "") or "").strip().lower()
            except Exception:
                return ""
        return ""
    except Exception as exc:
        print(f"[warn] status check fail: {exc}")
        return ""


def ensure_started(sid: str) -> None:
    try:
        r = requests.post(f"{API}/sessions/{sid}/start", headers=H(), timeout=TIMEOUT)
        if r.status_code in (200, 201):
            print("[3/5] Session engine start ho gaya.")
        elif r.status_code == 400 and "already" in r.text.lower():
            print("[3/5] Session pehle se started hai — skip.")
        else:
            print(f"[warn] start HTTP {r.status_code}: {r.text[:200]} — QR se try karte hain.")
    except Exception as exc:
        print(f"[warn] start me network dikkat: {exc}")


def fetch_qr(sid: str) -> str | None:
    try:
        r = requests.get(f"{API}/sessions/{sid}/qr", headers=H(), timeout=TIMEOUT)
        if r.status_code == 400:
            return None  # QR ready nahi / pehle se authenticated
        if r.status_code != 200:
            print(f"[warn] QR fetch HTTP {r.status_code}: {r.text[:200]}")
            return None
        try:
            data = r.json()
        except Exception:
            return None
        qr = (data or {}).get("qrCode", "") or ""
        if isinstance(qr, str) and "," in qr and qr.startswith("data:"):
            qr = qr.split(",", 1)[1]
        return qr.strip() or None
    except Exception as exc:
        print(f"[warn] QR fetch me network dikkat: {exc}")
        return None


def write_qr_png(b64: str) -> bool:
    try:
        raw = base64.b64decode(b64)
        QR_PATH.write_bytes(raw)
        print(f"[3/5] QR image likhi: {QR_PATH} ({len(raw)} bytes)")
        return True
    except Exception as exc:
        print(f"[warn] qr.png likhne me dikkat: {exc}")
        return False


def open_image_auto(path: Path) -> None:
    try:
        if os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
            print("[3/5] QR image Windows me khol di hai.")
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
            print("[3/5] QR image macOS me khol di hai.")
        else:
            subprocess.Popen(["xdg-open", str(path)])
            print("[3/5] QR image kholne ki koshish ki (xdg-open).")
    except Exception as exc:
        print(f"[warn] Image auto-open nahi hui ({exc}) — manually kholo: {path}")


def step3_connect(sess: dict) -> None:
    sid = str((sess or {}).get("id") or "")
    if not sid:
        sess = find_session() or {}
        sid = str(sess.get("id") or "")
    if not sid:
        print("Session id nahi mila. Dobara chalao: python setup_whatsapp.py")
        sys.exit(1)
    print("[3/5] Session status check ho raha hai...")
    if get_status(sid) == "ready":
        print("[3/5] Status 'ready' hai — WhatsApp pehle se connected. QR skip.")
        return
    ensure_started(sid)
    time.sleep(4)
    if get_status(sid) == "ready":
        print("✅ WhatsApp connected! (start ke baad turant ready)")
        return
    print("[3/5] QR la rahe hain...")
    b64 = fetch_qr(sid)
    if not b64:
        time.sleep(5)
        b64 = fetch_qr(sid)
    if not b64:
        print("QR nahi mil paya (session shayad turant ready ho gayi ya engine busy hai).")
        print("Dobara chalao: python setup_whatsapp.py")
        sys.exit(1)
    if not write_qr_png(b64):
        print("QR decode nahi hua. Dobara chalao: python setup_whatsapp.py")
        sys.exit(1)
    print("📱 SPARE phone: WhatsApp → Linked Devices → Link a Device → ye QR scan karo")
    open_image_auto(QR_PATH)
    print("[3/5] Connect ka wait ho raha hai (har 3s check, max 120s)...")
    deadline = time.time() + 120
    last_refetch = time.time()
    while time.time() < deadline:
        time.sleep(3)
        if get_status(sid) == "ready":
            print("✅ WhatsApp connected!")
            return
        if time.time() - last_refetch > 25:
            print("[3/5] Fresh QR la rahe hain (purana expire ho sakta hai)...")
            fresh = fetch_qr(sid)
            if fresh and write_qr_png(fresh):
                print("📱 Nayi QR image aa gayi — spare phone se dobara SCAN karo")
                open_image_auto(QR_PATH)
            else:
                print("[warn] Fresh QR nahi mila (scan ho gaya ho to status check jaari).")
            last_refetch = time.time()
    print("⏰ 120s me connect nahi hua. QR expire ho gayi hogi — dobara chalao: python setup_whatsapp.py")
    sys.exit(1)


def step4_webhook(sess: dict) -> None:
    print("[4/5] Webhook set ho raha hai...")
    sid = str((sess or {}).get("id") or "") or ((find_session() or {}).get("id") or "")
    if not sid:
        print("[warn] Session id nahi mila — webhook skip. Dobara chalao.")
        return
    events = ["message.received", "session.status"]
    body = {"url": WEBHOOK_URL, "events": events, "secret": WEBHOOK_SECRET, "retryCount": 3}
    try:
        existing_id = ""
        r = requests.get(f"{API}/sessions/{sid}/webhooks", headers=H(), timeout=TIMEOUT)
        if r.status_code == 200:
            try:
                items = r.json()
            except Exception:
                items = []
            for it in items if isinstance(items, list) else []:
                if isinstance(it, dict) and str(it.get("url") or "") == WEBHOOK_URL:
                    existing_id = str(it.get("id") or "")
                    break
        if existing_id:
            u = requests.put(f"{API}/sessions/{sid}/webhooks/{existing_id}", headers=H(), json=body, timeout=TIMEOUT)
            if u.status_code in (200, 201):
                print(f"[4/5] Webhook OK (updated) → {WEBHOOK_URL} events={events}")
                return
        r = requests.post(f"{API}/sessions/{sid}/webhooks", headers=H(), json=body, timeout=TIMEOUT)
        if r.status_code in (200, 201):
            print(f"[4/5] Webhook OK (created) → {WEBHOOK_URL} events={events}")
        else:
            print(f"[warn] Webhook HTTP {r.status_code}: {r.text[:300]}")
    except Exception as exc:
        print(f"[warn] Webhook set me network dikkat: {exc}")


def step5_verify() -> None:
    print("[5/5] Final verify: FastAPI /whatsapp/status...")
    try:
        r = requests.get(f"http://localhost:{BACKEND_PORT}/whatsapp/status", timeout=TIMEOUT)
        if r.status_code == 200:
            try:
                data = r.json()
            except Exception:
                data = {}
            connected = bool(data.get("connected", False)) if isinstance(data, dict) else False
            print(f"[5/5] Backend status: connected={connected} ({data})")
            if not connected:
                print("[warn] Backend ke hisaab se abhi connected nahi — QR scan hua? dobara chalao.")
        else:
            print(f"[warn] Backend HTTP {r.status_code}: {r.text[:200]}")
    except Exception:
        print("Backend nahi chal raha? backend/ me chalao: uvicorn app.main:app --reload (webhook phir bhi set hai).")


def main() -> None:
    print("=== VyapaarAI WhatsApp setup shuru (OpenWA) ===")
    print(f"OpenWA: {OPENWA_URL} | session: {OPENWA_SESSION} | backend port: {BACKEND_PORT}")
    step1_health()
    sess = step2_ensure_session()
    step3_connect(sess)
    # step 4 (khaali nahi) — neeche webhook
    step4_webhook(sess)
    step5_verify()
    print("🎉 Setup complete — SPARE phone se backend ko message bhejo: 'profit kyun gira?'")


if __name__ == "__main__":
    main()
