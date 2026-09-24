import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Verify scripts MUST NOT touch live WhatsApp (repeated sends to fake numbers
# get the linked device flagged/unlinked). Evolution gateway is disconnected
# here, so every send degrades to simulated.
os.environ["WA_GATEWAY"] = "evolution"

import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import json
import time
from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, ensure_p4_schema

ensure_p4_schema()

client = TestClient(app)

failures = []
passed = 0
total = 10


def report(n, name, ok, detail=""):
    global passed
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {n}. {name} {detail}")
    if ok:
        passed += 1
    else:
        failures.append(f"{n}. {name}")


def _key(from_me=False):
    return {"remoteJid": "919999999999@s.whatsapp.net", "fromMe": from_me, "id": "MSGID123"}


# 1. extract_incoming
try:
    from app.services import whatsapp_flow as flow

    p_text = {"data": {"key": _key(), "message": {"conversation": "profit kyun gira?"}, "pushName": "Ramesh"}}
    p_ext = {"data": {"key": _key(), "message": {"extendedTextMessage": {"text": "hello"}}, "pushName": "R"}}
    p_audio = {"data": {"key": _key(), "message": {"audioMessage": {"mimetype": "audio/ogg"}}, "pushName": "R"}}
    p_image = {"data": {"key": _key(), "message": {"imageMessage": {"mimetype": "image/jpeg"}}, "pushName": "R"}}
    p_me = {"data": {"key": _key(from_me=True), "message": {"conversation": "hi"}, "pushName": "R"}}
    r1, r2, r3, r4, r5 = (flow.extract_incoming(p) for p in (p_text, p_ext, p_audio, p_image, p_me))
    ok = (
        isinstance(r1, dict) and r1.get("kind") == "text" and "profit" in (r1.get("text") or "")
        and isinstance(r2, dict) and r2.get("kind") == "text" and (r2.get("text") or "") == "hello"
        and isinstance(r3, dict) and r3.get("kind") == "audio"
        and isinstance(r4, dict) and r4.get("kind") == "image"
        and r5 is None
    )
    report(1, "extract_incoming", ok,
           f"-> {[ (r or {}).get('kind') if isinstance(r, dict) else None for r in (r1, r2, r3, r4, r5) ]}")
except Exception as e:
    report(1, "extract_incoming", False, f"EXC {e}")

# 2. evolution.status()
try:
    from app.services import evolution

    s = evolution.status()
    ok = (
        isinstance(s, dict)
        and s.get("configured") is True
        and s.get("connected") is False
        and isinstance(s.get("instructions"), str) and len(s["instructions"].strip()) > 0
    )
    report(2, "evolution.status", ok, f"-> configured={s.get('configured')} connected={s.get('connected')}")
except Exception as e:
    report(2, "evolution.status", False, f"EXC {e}")

# 3. notify.send_text simulated
try:
    from app.services import notify

    r = notify.send_text("919999999999", "test")
    ok = isinstance(r, dict) and r.get("simulated") is True
    report(3, "notify simulated", ok, f"-> {r}")
except Exception as e:
    report(3, "notify simulated", False, f"EXC {e}")

# 4. confirm approve flow
try:
    from app.models import Customer, DocumentLog, Product, Receivable, Sale
    from app.services import documents

    db = SessionLocal()
    try:
        # cleanup previous test rows
        try:
            prod = db.query(Product).filter(Product.name == "TestCola").first()
            if prod is not None:
                db.query(Sale).filter(Sale.product_id == prod.id).delete()
                db.query(Product).filter(Product.id == prod.id).delete()
            cust = db.query(Customer).filter(Customer.name == "TestParty").first()
            if cust is not None:
                db.query(Receivable).filter(Receivable.customer_id == cust.id).delete()
                db.query(Customer).filter(Customer.id == cust.id).delete()
            db.query(DocumentLog).filter(DocumentLog.filename.like("test-p4%")).delete()
            db.commit()
        except Exception:
            db.rollback()
        entries = [
            {"date": date.today().isoformat(), "party_name": "TestCash", "item": "TestCola",
             "qty": 5, "amount": 500, "entry_type": "SALE"},
            {"date": date.today().isoformat(), "party_name": "TestParty", "item": None,
             "qty": None, "amount": 1000, "entry_type": "CREDIT_GIVEN"},
        ]
        log = DocumentLog(
            source="test", filename="test-p4-approve.jpg",
            parsed_entries=json.dumps({"entries": entries, "totals": {}, "notes": "t"}),
            status="pending_confirm", phone="919999999999",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        doc_id = log.id
    finally:
        db.close()

    db = SessionLocal()
    try:
        res = documents.confirm_document(db, doc_id, True, phone="919999999999")
        sale_ok = (
            db.query(Sale).join(Product, Sale.product_id == Product.id)
            .filter(Product.name == "TestCola").first() is not None
        )
        recv_ok = (
            db.query(Receivable).join(Customer, Receivable.customer_id == Customer.id)
            .filter(Customer.name == "TestParty").first() is not None
        )
        st = db.query(DocumentLog).filter(DocumentLog.id == doc_id).first()
        ok_first = (
            isinstance(res, dict) and "error" not in res
            and sale_ok and recv_ok and st is not None and st.status == "confirmed"
        )
        res2 = documents.confirm_document(db, doc_id, True, phone="919999999999")
        ok_second = isinstance(res2, dict) and bool(res2.get("error"))
        ok = ok_first and ok_second
        report(4, "confirm approve", ok,
               f"-> sale={sale_ok} recv={recv_ok} status={st.status if st else '?'} reconfirm_err={ok_second}")
    finally:
        db.close()
except Exception as e:
    report(4, "confirm approve", False, f"EXC {e}")

# 5. confirm reject path
try:
    from app.models import DocumentLog
    from app.services import documents

    db = SessionLocal()
    try:
        log = DocumentLog(
            source="test", filename="test-p4-reject.jpg",
            parsed_entries=json.dumps({"entries": []}),
            status="pending_confirm", phone="919999999999",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        rid = log.id
        res = documents.confirm_document(db, rid, False, phone="919999999999")
        st = db.query(DocumentLog).filter(DocumentLog.id == rid).first()
        ok = isinstance(res, dict) and st is not None and st.status == "rejected"
        report(5, "confirm reject", ok, f"-> status={st.status if st else '?'}")
    finally:
        db.close()
except Exception as e:
    report(5, "confirm reject", False, f"EXC {e}")

# 6. POST /webhook/whatsapp fast 200
try:
    payload = {
        "event": "MESSAGES_UPSERT",
        "data": {"key": _key(), "message": {"conversation": "profit kyun gira?"},
                 "pushName": "Tester"},
    }
    t0 = time.time()
    r = client.post("/webhook/whatsapp", json=payload)
    dt = time.time() - t0
    # NOTE: production me webhook turant 200 deta hai (kaam BackgroundTasks me hota hai).
    # TestClient background tasks ko serially wait karta hai; live LLM (Groq tools chain,
    # 3 specialists) slow link par ~30-110s le sakta hai. 180s = hang detector, speed
    # guarantee BackgroundTasks ki architecture se milti hai, is number se nahi.
    ok = r.status_code == 200 and dt < 180.0
    try:
        j = r.json()
        ok = ok and j.get("received") is True
    except Exception:
        ok = False
    report(6, "webhook fast 200", ok, f"-> {r.status_code} {dt:.2f}s")
except Exception as e:
    report(6, "webhook fast 200", False, f"EXC {e}")

# 7. GET /whatsapp/status
try:
    r = client.get("/whatsapp/status")
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and isinstance(j.get("connected"), bool)
    report(7, "whatsapp status", ok, f"-> {r.status_code} connected={j.get('connected')}")
except Exception as e:
    report(7, "whatsapp status", False, f"EXC {e}")

# 8. POST /brief/send
try:
    r = client.post("/brief/send")
    j = r.json() if r.status_code == 200 else {}
    items = j.get("items")
    ok = r.status_code == 200 and isinstance(items, list) and len(items) == 3 and j.get("simulated") is True
    report(8, "brief send", ok,
           f"-> {r.status_code} items={len(items) if isinstance(items, list) else '?'} simulated={j.get('simulated')}")
except Exception as e:
    report(8, "brief send", False, f"EXC {e}")

# 9. voice map + graceful tts/stt
try:
    from app.services import voice

    ok_map = isinstance(getattr(voice, "VOICE_MAP", None), dict) and "hi" in voice.VOICE_MAP
    tts_ok = False
    try:
        out = voice.tts("नमस्ते", "hi")
        tts_ok = (out is None) or isinstance(out, (bytes, bytearray))
    except Exception:
        tts_ok = False
    try:
        s = voice.stt(b"junk")
        stt_ok = isinstance(s, dict) and s.get("text") == "" and "error" in s
    except Exception:
        stt_ok = False
    ok = ok_map and tts_ok and stt_ok
    report(9, "voice graceful", ok, f"-> map={ok_map} tts_ok={tts_ok} stt_ok={stt_ok}")
except Exception as e:
    report(9, "voice graceful", False, f"EXC {e}")

if failures:
    print(f"P4 VERIFY: {passed}/{total} checks passed")
    print("FAILURES:", failures)
    sys.exit(1)

# 10. OpenWA-shaped fake payloads (text + audio inline base64 of 10 bytes)
try:
    import base64 as _b64

    from app.services import whatsapp_flow as flow10

    ow_text = {
        "event": "message.received", "sessionId": "sess-1",
        "data": {"id": "m1", "from": "919999999999@c.us", "chatId": "919999999999@c.us",
                 "body": "profit kyun gira?", "type": "text", "fromMe": False, "isGroup": False},
    }
    ow_audio = {
        "event": "message.received", "sessionId": "sess-1",
        "data": {"id": "m2", "from": "919999999999@c.us", "chatId": "919999999999@c.us",
                 "body": "", "type": "audio", "fromMe": False, "isGroup": False,
                 "media": {"mimetype": "audio/ogg", "data": _b64.b64encode(b"0123456789").decode()}},
    }
    rt = flow10.extract_incoming(ow_text)
    ra = flow10.extract_incoming(ow_audio)
    ok = (
        isinstance(rt, dict) and rt.get("kind") == "text" and "profit" in (rt.get("text") or "")
        and rt.get("phone") == "919999999999"
        and isinstance(ra, dict) and ra.get("kind") == "audio"
        and isinstance(ra.get("bytes"), (bytes, bytearray)) and len(ra["bytes"]) == 10
        and ra.get("phone") == "919999999999"
    )
    report(10, "openwa extract", ok,
           f"-> text={isinstance(rt, dict) and rt.get('kind')} audio_bytes={len((ra or {}).get('bytes') or b'')}")
except Exception as e:
    report(10, "openwa extract", False, f"EXC {e}")

print(f"P4 VERIFY (openwa): {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)
