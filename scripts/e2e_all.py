"""MASTER P18 E2E pipeline proof. Offline-safe, scratch sqlite, no live WA/LLM.

Covers: AUTH, CHAT, VOICE (edge-tts synth + junk 422), WHATSAPP FLOW
(registration machine, owner reply, scheme, HAAN/NAHI, HMAC), INGESTION
(template/preview/commit/grid/tally/agent/dedupe), ACTIONS, CONTACTS,
INTELLIGENCE, REPORTS, CONNECTORS, PRODUCTION GUARD.

Run from repo root:  python scripts/e2e_all.py   (cwd must be backend/)
Each check prints PASS/FAIL/SKIP with evidence. Exit 1 on any FAIL.
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(os.path.dirname(HERE), "backend")
if os.path.basename(os.getcwd()) != "backend":
    print("e2e_all.py must run with cwd=backend/ (repo root scripts/, backend runtime)")
    sys.exit(2)
sys.path.insert(0, BACKEND)

TMP = tempfile.mkdtemp(prefix="e2e_")
DBF = os.path.join(TMP, "e2e.db")
WATCH = os.path.join(TMP, "watch")
os.makedirs(WATCH, exist_ok=True)

os.environ["DATABASE_URL"] = f"sqlite:///{DBF}"
os.environ["ENVIRONMENT"] = "development"
os.environ["WA_GATEWAY"] = "evolution"
os.environ["ENABLE_WATCHER"] = "false"
os.environ["ALLOWED_INBOUND_PHONES"] = ""
os.environ["WEBHOOK_SECRET"] = "e2e_secret_123"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

passed, failed, skipped = 0, 0, 0
fails = []


def report(name, status, detail=""):
    global passed, failed, skipped
    tag = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP"}[status]
    print(f"[{tag}] {name} {detail}", flush=True)
    if status == "pass":
        passed += 1
    elif status == "fail":
        failed += 1
        fails.append(name)
    else:
        skipped += 1


# ---------- seed scratch DB ----------
try:
    import runpy

    runpy.run_path(os.path.join(BACKEND, "seed_demo_data.py"), run_name="__main__")
    report("setup scratch reseed", "pass", f"db={DBF}")
except Exception as e:
    report("setup scratch reseed", "fail", f"EXC {e}")
    print(f"\nE2E: {passed} pass, {failed} FAIL, {skipped} skip")
    sys.exit(1)

from fastapi.testclient import TestClient  # noqa: E402

from app import config as _cfg  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)
SECRET = _cfg.WEBHOOK_SECRET
OWNER_PHONE = "919834854511"  # seed/demo owner (allowed)
NEWBIE = "919810000001"  # unknown WA number for registration machine


def _db():
    return SessionLocal()


def wa_post(body_text, phone, mtype="text"):
    return client.post(
        "/webhook/whatsapp",
        json={"event": "message.received",
              "data": {"from": phone, "chatId": f"{phone}@c.us",
                       "type": mtype, "body": body_text}},
        headers={"x-webhook-secret": SECRET},
    )


def last_reply(phone):
    """Latest assistant whatsapp reply persisted for this phone (via _reply hook)."""
    from app.models import ChatMessage

    db = _db()
    try:
        row = (db.query(ChatMessage)
               .filter(ChatMessage.session_phone == phone, ChatMessage.role == "assistant",
                       ChatMessage.source == "whatsapp")
               .order_by(ChatMessage.id.desc()).first())
        return str(row.content) if row else ""
    finally:
        db.close()


# ================= AUTH =================
NEWPHONE = "91977" + "123456"[:6]
try:
    r = client.post("/auth/register", json={"phone": NEWPHONE, "business_type": "garbage"})
    report("auth register enum 422", "pass" if r.status_code == 422 else "fail",
           f"-> {r.status_code}")
except Exception as e:
    report("auth register enum 422", "fail", f"EXC {e}")

try:
    r = client.post("/auth/register", json={"phone": NEWPHONE, "name": "E2E",
                                             "business_name": "E2E Store",
                                             "business_type": "kirana", "language": "hi"})
    j = r.json() if r.status_code == 200 else {}
    report("auth register ok pending", "pass" if j.get("status") == "pending" else "fail",
           f"-> {r.status_code} {j}")
except Exception as e:
    report("auth register ok pending", "fail", f"EXC {e}")

try:
    r = client.post("/auth/otp/request", json={"phone": NEWPHONE})
    j = r.json()
    dev = j.get("dev_otp", "")
    report("auth otp request dev_otp", "pass" if dev else "fail",
           f"-> sent={j.get('sent')} has_dev={bool(dev)}")
except Exception as e:
    dev = ""
    report("auth otp request dev_otp", "fail", f"EXC {e}")

TOK_NEW, TOK_OWNER = "", ""
try:
    r = client.post("/auth/otp/verify", json={"phone": NEWPHONE, "code": dev})
    j = r.json() if r.status_code == 200 else {}
    TOK_NEW = j.get("token", "")
    report("auth otp verify JWT+allowed", "pass" if TOK_NEW and j.get("owner", {}).get("allowed") else "fail",
           f"-> {r.status_code} allowed={j.get('owner', {}).get('allowed')} activated={j.get('activated')}")
except Exception as e:
    report("auth otp verify JWT+allowed", "fail", f"EXC {e}")

try:
    from app.models import OwnerProfile

    db = _db()
    try:
        p = db.query(OwnerProfile).filter(OwnerProfile.phone.in_([NEWPHONE, NEWPHONE[2:]])).first()
        step = getattr(p, "reg_step", "?") if p else "?"
    finally:
        db.close()
    rw = client.post("/auth/otp/verify", json={"phone": NEWPHONE, "code": "000000"})
    report("auth wrong OTP 401", "pass" if rw.status_code == 401 else "fail",
           f"-> {rw.status_code} reg_step={step}")
except Exception as e:
    report("auth wrong OTP 401", "fail", f"EXC {e}")

try:
    r = client.post("/auth/otp/request", json={"phone": "919800000999"})
    try:
        hint = "register" in str(r.json().get("detail", "")).lower()
    except Exception:
        hint = False
    ok = r.status_code == 403 and hint
    report("auth unknown 403 + register hint", "pass" if ok else "fail",
           f"-> {r.status_code} hint={hint}")
except Exception as e:
    report("auth unknown 403 + register hint", "fail", f"EXC {e}")

try:
    from app.models import OwnerProfile

    BLK = "919820000007"
    db = _db()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == BLK).first()
        if old is not None:
            db.delete(old)
            db.commit()
        db.add(OwnerProfile(phone=BLK, name="E2E Blocked", allowed=True,
                            onboarded=False, blocked=True))
        db.commit()
    finally:
        db.close()
    r = client.post("/auth/otp/request", json={"phone": BLK})
    try:
        susp = "suspend" in str(r.json().get("detail", "")).lower()
    except Exception:
        susp = False
    ok = r.status_code == 403 and susp
    report("auth blocked 403 suspended", "pass" if ok else "fail",
           f"-> {r.status_code} susp={susp}")
    db = _db()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == BLK).first()
        if old is not None:
            db.delete(old)
            db.commit()
    finally:
        db.close()
except Exception as e:
    report("auth blocked 403 suspended", "fail", f"EXC {e}")

try:
    r = client.post("/auth/otp/request", json={"phone": OWNER_PHONE})
    ow_dev = r.json().get("dev_otp", "")
    r2 = client.post("/auth/otp/verify", json={"phone": OWNER_PHONE, "code": ow_dev})
    TOK_OWNER = r2.json().get("token", "") if r2.status_code == 200 else ""
    me = client.get("/me", headers={"Authorization": f"Bearer {TOK_OWNER}"})
    report("auth owner login + /me", "pass" if TOK_OWNER and me.status_code == 200 else "fail",
           f"-> tok={bool(TOK_OWNER)} me={me.status_code}")
except Exception as e:
    report("auth owner login + /me", "fail", f"EXC {e}")

OH = {"Authorization": f"Bearer {TOK_OWNER}"} if TOK_OWNER else {}

# ================= CHAT =================
try:
    r = client.post("/chat", json={"message": "aaj ki bikri kitni hui?", "phone": "web"})
    j = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and bool(j.get("answer")) and "provider" in j
          and isinstance(j.get("steps"), list))
    report("chat answer+steps+provider", "pass" if ok else "fail",
           f"-> {r.status_code} provider={j.get('provider')} ans_len={len(str(j.get('answer','')))}")
except Exception as e:
    report("chat answer+steps+provider", "fail", f"EXC {e}")

try:
    r = client.post("/chat", json={"message": "   ", "phone": "web"})
    report("chat empty 422", "pass" if r.status_code == 422 else "fail", f"-> {r.status_code}")
except Exception as e:
    report("chat empty 422", "fail", f"EXC {e}")

# ================= VOICE =================
VOICE_MP3 = os.path.join(TMP, "voice-hi.mp3")
try:
    import asyncio

    import edge_tts

    async def _synth():
        c = edge_tts.Communicate("aaj ki bikri kitni hui", "hi-IN-SwaraNeural")
        await c.save(VOICE_MP3)

    asyncio.run(_synth())
    with open(VOICE_MP3, "rb") as f:
        vb = f.read()
    from app.models import VoiceLog as _VL

    dbv = _db()
    try:
        v0 = dbv.query(_VL).filter(_VL.owner_id == 1).count()
    finally:
        dbv.close()
    r = client.post("/chat/voice", files={"file": ("voice.mp3", vb, "audio/mpeg")},
                    data={"phone": "web"})
    j = r.json() if r.status_code == 200 else {}
    dbv = _db()
    try:
        v1 = dbv.query(_VL).filter(_VL.owner_id == 1).count()
    finally:
        dbv.close()
    ok = (r.status_code == 200 and bool(str(j.get("transcript", "")).strip())
          and bool(j.get("answer")) and v1 == v0 + 1)
    report("voice full loop (synth->stt->answer)", "pass" if ok else "fail",
           f"-> {r.status_code} transcript={str(j.get('transcript',''))[:60]!r} voice_logs {v0}->{v1}")
except Exception as e:
    report("voice full loop (synth->stt->answer)", "skip", f"SKIP edge-tts/STT unavailable: {str(e)[:120]}")

try:
    import wave

    junk = os.path.join(TMP, "junk.wav")
    with wave.open(junk, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x01" * 1600)  # 0.2s noise
    with open(junk, "rb") as f:
        jb = f.read()
    r = client.post("/chat/voice", files={"file": ("junk.wav", jb, "audio/wav")},
                    data={"phone": "web"})
    j = r.json() if r.status_code == 422 else {}
    ok = r.status_code == 422 and bool(j.get("detail"))
    report("voice junk 422 Hindi reason", "pass" if ok else "fail",
           f"-> {r.status_code} detail={str(j.get('detail',''))[:60]!r}")
except Exception as e:
    report("voice junk 422 Hindi reason", "fail", f"EXC {e}")

# ================= WHATSAPP FLOW =================
try:
    r = client.post("/webhook/whatsapp", json={"event": "ping"})
    report("webhook HMAC missing 401", "pass" if r.status_code == 401 else "fail",
           f"-> {r.status_code}")
except Exception as e:
    report("webhook HMAC missing 401", "fail", f"EXC {e}")


def wa_step(text, phone=NEWBIE):
    r = wa_post(text, phone)
    return r.status_code, last_reply(phone)


try:
    from app.models import OwnerProfile

    s, rep = wa_step("hi")
    db = _db()
    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == NEWBIE).first()
        step1 = getattr(prof, "reg_step", "?") if prof else "?"
    finally:
        db.close()
    ok = s == 200 and step1 == "NAME" and bool(rep)
    report("wa registration starts (NAME)", "pass" if ok else "fail",
           f"-> http={s} step={step1} reply={rep[:60]!r}")
    wa_step("E2E WA")
    wa_step("E2E WA Store")
    s3, rep3 = wa_step("1")
    wa_step("9123456780, 9123456781")
    s5, rep5 = wa_step("Hindi")
    db = _db()
    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == NEWBIE).first()
        code = str(getattr(prof, "otp_code", "") or "") if prof else ""
        step5 = getattr(prof, "reg_step", "?") if prof else "?"
        dists = str(getattr(prof, "distributors", "") or "") if prof else ""
        btype = str(getattr(prof, "business_type", "") or "") if prof else ""
    finally:
        db.close()
    okm = ("DISTRIBUTOR" in rep3 or "distributor" in rep3.lower()) and step5 == "OTP" and bool(code)
    report("wa machine NAME..OTP (cat+multi-dist+lang)", "pass" if okm else "fail",
           f"-> step={step5} btype={btype} dists={dists} code={bool(code)}")
    # wrong OTP x3 -> restart at NAME
    wa_step("000000")
    wa_step("000001")
    s_w, _ = wa_step("000002")
    db = _db()
    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == NEWBIE).first()
        step_w = getattr(prof, "reg_step", "?") if prof else "?"
        code2 = str(getattr(prof, "otp_code", "") or "") if prof else ""
    finally:
        db.close()
    # re-run to OTP then verify correctly
    wa_step("E2E WA")
    wa_step("E2E WA Store")
    wa_step("1")
    wa_step("9123456780")
    wa_step("Hindi")
    db = _db()
    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == NEWBIE).first()
        code = str(getattr(prof, "otp_code", "") or "") if prof else ""
    finally:
        db.close()
    s_v, rep_v = wa_step(code)
    db = _db()
    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == NEWBIE).first()
        allowed = bool(getattr(prof, "allowed", False)) if prof else False
    finally:
        db.close()
    okv = step_w == "NAME" and allowed and ("ACTIVE" in rep_v or "active" in rep_v.lower())
    report("wa wrong-x3 restart + OTP verify allowed", "pass" if okv else "fail",
           f"-> after3x={step_w} allowed={allowed} http={s_v}")
except Exception as e:
    report("wa registration machine", "fail", f"EXC {e}")

try:
    s, _ = wa_step("aaj ki bikri kitni hui?", OWNER_PHONE)
    h = client.get("/chat/history", headers=OH)
    rows = h.json() if h.status_code == 200 else []
    wa_rows = [m for m in rows if m.get("source") == "whatsapp"]
    ok = s == 200 and len(wa_rows) >= 2
    report("wa owner reply + history source", "pass" if ok else "fail",
           f"-> http={s} wa_rows={len(wa_rows)}")
except Exception as e:
    report("wa owner reply + history source", "fail", f"EXC {e}")

try:
    from app.models import Action, Product

    db = _db()
    try:
        p = db.query(Product).filter(Product.owner_id == 1).first()
        pname = str(p.name)
        pprice = float(p.purchase_price or 10)
    finally:
        db.close()
    msg = f"{pname} Rs {int(pprice * 10)} mein 10+1 free"
    before = last_reply(OWNER_PHONE)
    wa_step(msg, OWNER_PHONE)
    after = last_reply(OWNER_PHONE)
    db = _db()
    try:
        acts = (db.query(Action).filter(Action.owner_id == 1, Action.type == "scheme_alert",
                                        Action.status == "pending")
                .order_by(Action.id.desc()).all())
    finally:
        db.close()
    ok = bool(acts) and after != before and "Scheme" in after
    report("wa scheme -> scheme_alert action", "pass" if ok else "fail",
           f"-> msg={msg[:50]!r} acts={len(acts)} replied={after[:60]!r}")
except Exception as e:
    report("wa scheme -> scheme_alert action", "fail", f"EXC {e}")

try:
    import json as _json

    from app.models import DocumentLog, Sale

    db = _db()
    try:
        n0 = db.query(Sale).filter(Sale.owner_id == 1).count()
        log = DocumentLog(owner_id=1, source="whatsapp", filename="e2e.jpg",
                          parsed_entries=_json.dumps({"entries": [
                              {"entry_type": "SALE", "item": "E2EItem",
                               "qty": 2, "amount": 100.0}]}),
                          status="pending_confirm", phone=OWNER_PHONE)
        db.add(log)
        db.commit()
        db.refresh(log)
        lid = log.id
    finally:
        db.close()
    wa_step("HAAN", OWNER_PHONE)
    db = _db()
    try:
        n1 = db.query(Sale).filter(Sale.owner_id == 1).count()
        st = db.query(DocumentLog).filter(DocumentLog.id == lid).first().status
    finally:
        db.close()
    ok = n1 == n0 + 1
    report("wa HAAN confirm applies sale", "pass" if ok else "fail",
           f"-> sales {n0}->{n1} log={st}")
    db = _db()
    try:
        log2 = DocumentLog(owner_id=1, source="whatsapp", filename="e2e2.jpg",
                           parsed_entries=_json.dumps({"entries": [
                               {"entry_type": "SALE", "item": "E2EItem2",
                                "qty": 1, "amount": 50.0}]}),
                           status="pending_confirm", phone=OWNER_PHONE)
        db.add(log2)
        db.commit()
        db.refresh(log2)
        lid2 = log2.id
    finally:
        db.close()
    wa_step("NAHI", OWNER_PHONE)
    db = _db()
    try:
        st2 = db.query(DocumentLog).filter(DocumentLog.id == lid2).first().status
    finally:
        db.close()
    report("wa NAHI rejects document", "pass" if st2 == "rejected" else "fail",
           f"-> log={st2}")
except Exception as e:
    report("wa HAAN/NAHI confirm flow", "fail", f"EXC {e}")

# ================= INGESTION =================
try:
    r = client.get("/ingest/template", params={"type": "sales"})
    report("ingest template csv", "pass" if r.status_code == 200 and "date" in r.text.lower() else "fail",
           f"-> {r.status_code} len={len(r.text)}")
except Exception as e:
    report("ingest template csv", "fail", f"EXC {e}")

try:
    tpl = client.get("/ingest/template", params={"type": "sales"}).text
    r = client.post("/ingest/preview", files={"file": ("t.csv", tpl.encode(), "text/csv")},
                    data={"type": "sales"})
    j = r.json() if r.status_code == 200 else {}
    report("ingest preview dry-run", "pass" if r.status_code == 200 else "fail",
           f"-> {r.status_code} keys={list(j.keys())[:5]}")
except Exception as e:
    report("ingest preview dry-run", "fail", f"EXC {e}")

try:
    from app.models import OwnerProfile, Product

    db = _db()
    try:
        n_prod0 = db.query(Product).filter(Product.owner_id == 1).count()
        prof1 = db.query(OwnerProfile).filter(OwnerProfile.id == 1).first()
        onb0 = bool(getattr(prof1, "onboarded", False))
        if prof1 is not None:
            prof1.onboarded = False
            db.commit()
    finally:
        db.close()
    csv_text = ("date,product,qty,unit_price,customer\n"
                "2026-09-20,E2E Commit Item,2,45,Ramesh\n")
    r = client.post("/ingest/commit", files={"file": ("c.csv", csv_text.encode(), "text/csv")},
                    data={"type": "sales"}, headers=OH)
    j = r.json() if r.status_code == 200 else {}
    db = _db()
    try:
        n_prod1 = db.query(Product).filter(Product.owner_id == 1).count()
        prof1 = db.query(OwnerProfile).filter(OwnerProfile.id == 1).first()
        onb1 = bool(getattr(prof1, "onboarded", False)) if prof1 else False
    finally:
        db.close()
    ok = (r.status_code == 200 and int(j.get("rows_inserted", 0) or 0) >= 1 and onb1)
    report("ingest commit inserts + onboarded", "pass" if ok else "fail",
           f"-> {r.status_code} ins={j.get('rows_inserted')} onb {onb0}->{onb1} prod {n_prod0}->{n_prod1}")
except Exception as e:
    report("ingest commit inserts + onboarded", "fail", f"EXC {e}")

try:
    body = {"rows": [
        {"date": "2026-09-21", "product": "E2E Grid A", "qty": "999",
         "unit_price": "11", "customer": "", "type": "sale"},
        {"date": "2026-09-21", "product": "E2E Grid B", "qty": "888",
         "unit_price": "12", "customer": "", "type": "sale"},
    ]}
    r = client.post("/ingest/grid", json=body, headers=OH)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and int(j.get("rows_inserted", 0) or 0) >= 2
    report("ingest grid 2 rows", "pass" if ok else "fail",
           f"-> {r.status_code} ins={j.get('rows_inserted')}")
except Exception as e:
    report("ingest grid 2 rows", "fail", f"EXC {e}")

try:
    tally = ("""<ENVELOPE><BODY><DATA><TALLYMESSAGE><VOUCHER VOUCHERTYPENAME="Sales" DATE="20260920">"""
             """<PARTYLEDGERNAME>E2E Tally Party</PARTYLEDGERNAME>"""
             """<LEDGERENTRIES.LIST><AMOUNT>777</AMOUNT></LEDGERENTRIES.LIST>"""
             """</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>""")
    r = client.post("/ingest/tally-xml", files={"file": ("t.xml", tally.encode(), "text/xml")},
                    headers=OH)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and int(j.get("rows_inserted", 0) or 0) >= 1
    report("ingest tally-xml voucher", "pass" if ok else "fail",
           f"-> {r.status_code} ins={j.get('rows_inserted')}")
except Exception as e:
    report("ingest tally-xml voucher", "fail", f"EXC {e}")

try:
    r = client.post("/connectors/ingest",
                    json={"source": "excel",
                          "rows": [["date", "product", "qty", "unit_price"],
                                   ["2026-09-22", "Parle Biscuits 300g", "3", "35"]]},
                    headers=OH)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and int(j.get("rows_inserted", 0) or 0) >= 1
    report("connectors ingest excel rows", "pass" if ok else "fail",
           f"-> {r.status_code} ins={j.get('rows_inserted')}")
except Exception as e:
    report("connectors ingest excel rows", "fail", f"EXC {e}")

try:
    from app.services import sync as _sync

    fp = os.path.join(WATCH, "dupe.csv")
    with open(fp, "w") as f:
        f.write("date,product,qty,unit_price\n2026-09-23,E2E Dupe,1,9\n")
    r1 = _sync.process_file(fp, owner_id=1, source="watch")
    r2 = _sync.process_file(fp, owner_id=1, source="watch")
    ok = (str(r2.get("status", "")).lower() == "skipped_same"
          or "skip" in str(r2).lower())
    report("watch dedupe sha256 skip", "pass" if ok else "fail",
           f"-> first={r1.get('status')} second={r2.get('status')}")
except Exception as e:
    report("watch dedupe sha256 skip", "fail", f"EXC {e}")

# ================= ACTIONS =================
ACT_ID = None
try:
    r = client.post("/actions/generate", headers=OH)
    j = r.json() if r.status_code == 200 else {}
    pend = client.get("/actions", params={"status": "pending"}, headers=OH).json()
    ok = r.status_code == 200 and len(pend) >= 1
    if pend:
        ACT_ID = pend[0]["id"]
    report("actions generate pending", "pass" if ok else "fail",
           f"-> created={j.get('created')} pending={len(pend) if isinstance(pend, list) else '?'}")
except Exception as e:
    report("actions generate pending", "fail", f"EXC {e}")

try:
    r = client.post(f"/actions/{ACT_ID}/approve", headers=OH)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and j.get("status") in ("approved", "sent")
    report("actions approve", "pass" if ok else "fail",
           f"-> {r.status_code} status={j.get('status')} delivery={str(j.get('delivery'))[:60]}")
    r2 = client.post(f"/actions/{ACT_ID}/approve", headers=OH)
    report("actions re-approve 409", "pass" if r2.status_code == 409 else "fail",
           f"-> {r2.status_code}")
except Exception as e:
    report("actions approve + 409", "fail", f"EXC {e}")

try:
    from app.models import Action

    db = _db()
    try:
        a = Action(owner_id=1, type="discount_offer", title="E2E reject me",
                   detail="e2e-reject-marker", status="pending")
        db.add(a)
        db.commit()
        db.refresh(a)
        rid = a.id
    finally:
        db.close()
    r = client.post(f"/actions/{rid}/reject", headers=OH)
    ok = r.status_code == 200 and r.json().get("status") == "rejected"
    report("actions reject path", "pass" if ok else "fail", f"-> {r.status_code}")
except Exception as e:
    report("actions reject path", "fail", f"EXC {e}")

try:
    from app.models import Action, Contact

    NEW_SUP = "919820000007"
    db = _db()
    try:
        a = Action(owner_id=1, type="reorder", title="E2E reorder",
                   detail="e2e-reorder-marker", target_name="E2E Supplier",
                   target_phone=NEW_SUP, status="pending")
        db.add(a)
        db.commit()
        db.refresh(a)
        roid = a.id
    finally:
        db.close()
    client.post(f"/actions/{roid}/approve", headers=OH)
    db = _db()
    try:
        c = (db.query(Contact).filter(Contact.owner_id == 1, Contact.phone == NEW_SUP).first())
        kind = getattr(c, "kind", "") if c else ""
    finally:
        db.close()
    report("reorder approve auto-contact", "pass" if kind == "supplier" else "fail",
           f"-> kind={kind!r}")
except Exception as e:
    report("reorder approve auto-contact", "fail", f"EXC {e}")

# ================= CONTACTS =================
try:
    r = client.post("/contacts", json={"name": "E2E Contact", "phone": "919830000009",
                                       "kind": "supplier"}, headers=OH)
    j = r.json() if r.status_code == 200 else {}
    cid = j.get("id")
    lst = client.get("/contacts", headers=OH).json()
    ok = bool(cid) and any(c.get("id") == cid for c in lst)
    report("contacts CRUD create+list", "pass" if ok else "fail", f"-> id={cid}")
    sent = {}
    import app.services.notify as _notify

    real_send = _notify.send_text

    def _cap(phone, text):
        sent["phone"] = phone
        sent["text"] = text
        return {"ok": True, "simulated": False}

    _notify.send_text = _cap
    try:
        r2 = client.post(f"/contacts/{cid}/send", json={"message": "E2E hello"}, headers=OH)
    finally:
        _notify.send_text = real_send
    j2 = r2.json() if r2.status_code == 200 else {}
    sig_ok = "(via VyapaarAI)" in str(sent.get("text", ""))
    ok2 = j2.get("status") == "sent" and sig_ok
    report("contacts send + signature", "pass" if ok2 else "fail",
           f"-> {j2} sig={sig_ok}")
    r3 = client.delete(f"/contacts/{cid}", headers=OH)
    report("contacts delete", "pass" if r3.status_code == 200 else "fail",
           f"-> {r3.status_code}")
except Exception as e:
    report("contacts CRUD/send/delete", "fail", f"EXC {e}")

# ================= INTELLIGENCE =================
try:
    prods = client.get("/products", headers=OH).json()
    sku = prods[0]["sku"] if prods else "SN-BISC-300"
    endpoints = ["/health-score", f"/forecast?sku={sku}&days=7", "/root-cause",
                 "/anomalies", "/buy-sell-matrix", "/brief", "/credit-score"]
    bad = []
    for ep in endpoints:
        r = client.get(ep, headers=OH)
        if r.status_code != 200:
            bad.append(f"{ep}={r.status_code}")
    r404 = client.get("/forecast?sku=NOPE-XXX&days=7", headers=OH)
    h1 = client.get("/health-score", headers=OH)
    h2 = client.get("/health-score", headers=OH)
    cache = h2.headers.get("x-cache", "")
    ok = not bad and r404.status_code == 404 and cache == "hit"
    report("intelligence 7 GETs + 404 + X-Cache", "pass" if ok else "fail",
           f"-> bad={bad} unk404={r404.status_code} xcache={cache!r}")
except Exception as e:
    report("intelligence 7 GETs + 404 + X-Cache", "fail", f"EXC {e}")

# ================= REPORTS =================
try:
    r = client.get("/reports/daily", headers=OH)
    ok = (r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
          and r.content[:5] == b"%PDF-")
    report("reports daily PDF", "pass" if ok else "fail",
           f"-> {r.status_code} bytes={len(r.content)}")
except Exception as e:
    report("reports daily PDF", "fail", f"EXC {e}")

try:
    r = client.get("/credit-score/report", headers=OH)
    ok = (r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
          and r.content[:5] == b"%PDF-")
    report("credit-score report PDF", "pass" if ok else "fail",
           f"-> {r.status_code} bytes={len(r.content)}")
except Exception as e:
    report("credit-score report PDF", "fail", f"EXC {e}")

# ================= CONNECTORS =================
try:
    r = client.post("/connectors", json={"type": "google_sheets",
                                         "config": {"sheet_id": "e2e", "range": "A1:A5"}},
                    headers=OH)
    j = r.json() if r.status_code == 200 else {}
    cc = (j.get("connector") or {}) if isinstance(j, dict) else {}
    cid = cc.get("id")
    r2 = client.post(f"/connectors/{cid}/sync-now", headers=OH) if cid else None
    j2 = r2.json() if r2 is not None and r2.status_code == 200 else {}
    res = j2.get("result", {}) if isinstance(j2, dict) else {}
    err = str(res.get("error", ""))
    ok = bool(cid) and "GOOGLE_API_KEY" in err
    report("connectors sheets no-key honest error", "pass" if ok else "fail",
           f"-> id={cid} err={err[:80]!r}")
    if cid:
        client.delete(f"/connectors/{cid}", headers=OH)
except Exception as e:
    report("connectors sheets no-key honest error", "fail", f"EXC {e}")

# ================= PROD GUARD =================
try:
    import json as _json
    import subprocess as _sp

    script = (
        "import os; os.environ['ENVIRONMENT']='production'; os.environ['ENABLE_WATCHER']='false';"
        "os.environ['WA_GATEWAY']='evolution';"
        "from fastapi.testclient import TestClient; from app.main import app;"
        "c=TestClient(app, raise_server_exceptions=False);"
        "import json; r=c.post('/auth/otp/request', json={'phone':'" + OWNER_PHONE + "'});"
        "print(json.dumps({'has_dev_otp':'dev_otp' in r.json()}))"
    )
    out = _sp.run([sys.executable, "-c", script], capture_output=True, text=True,
                  cwd=BACKEND, timeout=180)
    line = [x for x in out.stdout.strip().splitlines() if x.startswith("{")]
    j = _json.loads(line[-1]) if line else {}
    report("prod guard no dev_otp", "pass" if j.get("has_dev_otp") is False else "fail",
           f"-> {j}")
except Exception as e:
    report("prod guard no dev_otp", "fail", f"EXC {e}")

print(f"\nE2E ALL: {passed} pass, {failed} FAIL, {skipped} skip", flush=True)
if fails:
    print("FAILURES:", flush=True)
    for f in fails:
        print(f"  - {f}", flush=True)
    sys.exit(1)
print("E2E ALL: GREEN", flush=True)