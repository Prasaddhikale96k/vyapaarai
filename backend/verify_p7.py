"""Phase A (P7) verify: ledger + preview/commit + web docs + hardening. 10 checks + legacy."""

import os
os.environ["ENABLE_WATCHER"] = "false"  # BEFORE app import
# Verify scripts MUST NOT touch live WhatsApp. Evolution gateway is disconnected
# here, so every send degrades to simulated.
os.environ["WA_GATEWAY"] = "evolution"

import csv
import io
import json
import subprocess
import sys
from datetime import date
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi.testclient import TestClient

from app.main import app
from app.config import WATCH_DIR
from app.db import SessionLocal, ensure_access_schema, ensure_p4_schema

ensure_p4_schema()
ensure_access_schema()
try:
    from app.db import Base, engine
    import app.models as _app_models  # noqa: F401 (aliased: must not shadow FastAPI `app`)
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

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


def _mint(owner_id, phone):
    import jwt as _jwt
    from datetime import datetime, timedelta
    return _jwt.encode(
        {"sub": str(int(owner_id)), "phone": phone, "exp": datetime.utcnow() + timedelta(days=7)},
        _jwt_secret(), algorithm="HS256")


def _auth(owner_id, phone):
    return {"Authorization": f"Bearer {_mint(owner_id, phone)}"}


def _clean_product(db, name, owner_id=1):
    try:
        from app.models import InventoryItem, Product, Sale
        prod = db.query(Product).filter(
            Product.owner_id == owner_id, Product.name == name).first()
        if prod is not None:
            db.query(Sale).filter(Sale.product_id == prod.id).delete()
            db.query(InventoryItem).filter(InventoryItem.product_id == prod.id).delete()
            db.query(Product).filter(Product.id == prod.id).delete()
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _clean_customer(db, name, owner_id=1):
    try:
        from app.models import Customer, Receivable
        cust = db.query(Customer).filter(
            Customer.owner_id == owner_id, Customer.name == name).first()
        if cust is not None:
            db.query(Receivable).filter(Receivable.customer_id == cust.id).delete()
            db.query(Customer).filter(Customer.id == cust.id).delete()
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _clean_ledger(db, filename):
    try:
        from app.models import ProcessedFile
        db.query(ProcessedFile).filter(ProcessedFile.filename == filename).delete()
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


TODAY = date.today().isoformat()


# 1. process_file twice -> 2nd skipped_same, sales unchanged
try:
    from app.models import ProcessedFile, Sale
    from app.services import sync as sync_mod

    fname = "sales_p7_ledger.csv"
    fpath = WATCH_DIR / fname
    body = f"date,product,qty,unit_price,amount,customer\n{TODAY},P7 Ledger Item,2,100,200,P7 Ledger Cust\n"
    db = _db()
    try:
        _clean_product(db, "P7 Ledger Item")
        _clean_customer(db, "P7 Ledger Cust")
        _clean_ledger(db, fname)
        c0 = db.query(Sale).filter(Sale.owner_id == 1).count()
    finally:
        db.close()
    try:
        fpath.write_text(body, encoding="utf-8")
        r1 = sync_mod.process_file(fpath, owner_id=1, source="watch")
        db = _db()
        try:
            c1 = db.query(Sale).filter(Sale.owner_id == 1).count()
        finally:
            db.close()
        r2 = sync_mod.process_file(fpath, owner_id=1, source="watch")
        db = _db()
        try:
            c2 = db.query(Sale).filter(Sale.owner_id == 1).count()
            led = db.query(ProcessedFile).filter(
                ProcessedFile.filename == fname).order_by(ProcessedFile.id).all()
            statuses = [l.status for l in led]
        finally:
            db.close()
        ok = (
            isinstance(r1, dict) and r1.get("status") == "ingested"
            and int(r1.get("rows_inserted", 0)) >= 1
            and c1 == c0 + int(r1.get("rows_inserted", 0))
            and isinstance(r2, dict) and r2.get("status") == "skipped_same"
            and c2 == c1
            and "ingested" in statuses and "skipped_same" in statuses
        )
        report(1, "ledger dedupe", ok,
               f"-> r1={r1.get('status')}/{r1.get('rows_inserted')} r2={r2.get('status')} "
               f"sales={c0}->{c1}->{c2} ledger={statuses}")
    finally:
        try:
            if fpath.exists():
                fpath.unlink()
        except Exception:
            pass
        db = _db()
        try:
            _clean_product(db, "P7 Ledger Item")
            _clean_customer(db, "P7 Ledger Cust")
            _clean_ledger(db, fname)
        finally:
            db.close()
except Exception as e:
    report(1, "ledger dedupe", False, f"EXC {e}")

# 2. startup_scan ingests fresh file; ledger row exists
try:
    from app.models import ProcessedFile, Sale
    from app.services import sync as sync_mod

    fname = "p7scan.csv"  # no prefix -> header inference must kick in
    fpath = WATCH_DIR / fname
    body = f"date,product,qty,unit_price,amount,customer\n{TODAY},P7 Scan Item,3,50,150,P7 Scan Cust\n"
    db = _db()
    try:
        _clean_product(db, "P7 Scan Item")
        _clean_customer(db, "P7 Scan Cust")
        _clean_ledger(db, fname)
    finally:
        db.close()
    try:
        fpath.write_text(body, encoding="utf-8")
        out = sync_mod.startup_scan(owner_id=1)
        hit = [r for r in out if isinstance(r, dict) and r.get("filename") == fname]
        db = _db()
        try:
            led = db.query(ProcessedFile).filter(ProcessedFile.filename == fname).first()
            from app.models import Product
            prod = db.query(Product).filter(
                Product.owner_id == 1, Product.name == "P7 Scan Item").first()
            sale_n = db.query(Sale).filter(
                Sale.owner_id == 1, Sale.product_id == prod.id).count() if prod else 0
        finally:
            db.close()
        ok = (
            len(hit) == 1 and hit[0].get("status") == "ingested"
            and led is not None and led.status == "ingested"
            and sale_n >= 1
        )
        report(2, "startup_scan", ok,
               f"-> scan_status={hit[0].get('status') if hit else '?'} "
               f"ledger={led.status if led else None} sales={sale_n}")
    finally:
        try:
            if fpath.exists():
                fpath.unlink()
        except Exception:
            pass
        db = _db()
        try:
            _clean_product(db, "P7 Scan Item")
            _clean_customer(db, "P7 Scan Cust")
            _clean_ledger(db, fname)
        finally:
            db.close()
except Exception as e:
    report(2, "startup_scan", False, f"EXC {e}")

# 3. binary junk -> quarantined + moved, no crash
try:
    from app.models import ProcessedFile
    from app.services import sync as sync_mod

    fname = "p7junk.csv"
    fpath = WATCH_DIR / fname
    qpath = WATCH_DIR / sync_mod.QUARANTINE_DIRNAME / fname
    db = _db()
    try:
        _clean_ledger(db, fname)
    finally:
        db.close()
    try:
        if qpath.exists():
            qpath.unlink()
        fpath.write_bytes(os.urandom(128))
        r = sync_mod.process_file(fpath, owner_id=1, source="watch")
        db = _db()
        try:
            led = db.query(ProcessedFile).filter(ProcessedFile.filename == fname).first()
        finally:
            db.close()
        ok = (
            isinstance(r, dict) and r.get("status") == "quarantined"
            and not fpath.exists() and qpath.exists()
            and led is not None and led.status == "quarantined"
        )
        report(3, "quarantine", ok,
               f"-> status={r.get('status')} moved={qpath.exists()} ledger={led.status if led else None}")
    finally:
        try:
            if fpath.exists():
                fpath.unlink()
        except Exception:
            pass
        try:
            if qpath.exists():
                qpath.unlink()
        except Exception:
            pass
        db = _db()
        try:
            _clean_ledger(db, fname)
        finally:
            db.close()
except Exception as e:
    report(3, "quarantine", False, f"EXC {e}")

# 4. /ingest/preview -> rows_ok>0 AND DB counts unchanged
try:
    from app.models import Product, Sale

    body = f"date,product,qty,unit_price,amount,customer\n{TODAY},P7 Preview Item,4,25,100,P7 Preview Cust\n"
    db = _db()
    try:
        s0 = db.query(Sale).count()
        p0 = db.query(Product).count()
    finally:
        db.close()
    r = client.post("/ingest/preview", files={"file": ("preview_p7.csv", body, "text/csv")},
                    data={"type": "sales"})
    j = r.json() if r.status_code == 200 else {}
    db = _db()
    try:
        s1 = db.query(Sale).count()
        p1 = db.query(Product).count()
    finally:
        db.close()
    ok = (
        r.status_code == 200 and int(j.get("rows_ok", 0)) > 0
        and s1 == s0 and p1 == p0
        and isinstance(j.get("preview"), list) and len(j["preview"]) > 0
        and "product" in (j.get("mapped_fields") or [])
    )
    report(4, "preview no-commit", ok,
           f"-> {r.status_code} rows_ok={j.get('rows_ok')} sales={s0}->{s1} products={p0}->{p1}")
except Exception as e:
    report(4, "preview no-commit", False, f"EXC {e}")

# 5. /ingest/commit -> counts +N once; onboarded flips
try:
    from app.models import OwnerProfile, Product, Sale

    TMP_PHONE = "919000000095"
    db = _db()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == TMP_PHONE).first()
        if old is not None:
            db.delete(old)
            db.commit()
        tmp = OwnerProfile(phone=TMP_PHONE, name="P7Tmp", allowed=True, onboarded=False)
        db.add(tmp)
        db.commit()
        db.refresh(tmp)
        tmp_id = int(tmp.id)
    finally:
        db.close()
    tok = None
    try:
        rr = client.post("/auth/otp/request", json={"phone": TMP_PHONE})
        code = rr.json().get("dev_otp", "") if rr.status_code == 200 else ""
        rr2 = client.post("/auth/otp/verify", json={"phone": TMP_PHONE, "code": code}) if code else None
        tok = rr2.json().get("token", "") if rr2 is not None and rr2.status_code == 200 else ""
    except Exception:
        tok = ""
    body = f"date,product,qty,unit_price,amount,customer\n{TODAY},P7 Commit Item,5,20,100,P7 Commit Cust\n"
    db = _db()
    try:
        s0 = db.query(Sale).filter(Sale.owner_id == tmp_id).count()
    finally:
        db.close()
    rc = client.post("/ingest/commit", files={"file": ("commit_p7.csv", body, "text/csv")},
                     data={"type": "sales"},
                     headers={"Authorization": f"Bearer {tok}"}) if tok else None
    jc = rc.json() if rc is not None and rc.status_code == 200 else {}
    db = _db()
    try:
        s1 = db.query(Sale).filter(Sale.owner_id == tmp_id).count()
        prof = db.query(OwnerProfile).filter(OwnerProfile.id == tmp_id).first()
        onboarded = bool(prof.onboarded) if prof is not None else False
    finally:
        db.close()
    added = int(jc.get("rows_inserted", -1)) if isinstance(jc, dict) else -1
    ok = (
        rc is not None and rc.status_code == 200 and added >= 1
        and s1 == s0 + added and onboarded is True
    )
    report(5, "commit + onboarded", ok,
           f"-> {rc.status_code if rc else '?'} inserted={added} sales={s0}->{s1} onboarded={onboarded}")
    db = _db()
    try:
        _clean_product(db, "P7 Commit Item", tmp_id)
        _clean_customer(db, "P7 Commit Cust", tmp_id)
        t = db.query(OwnerProfile).filter(OwnerProfile.id == tmp_id).first()
        if t is not None:
            db.delete(t)
            db.commit()
        from app.models import IngestionLog, ProcessedFile
        db.query(IngestionLog).filter(IngestionLog.owner_id == tmp_id).delete()
        db.query(ProcessedFile).filter(ProcessedFile.owner_id == tmp_id).delete()
        db.commit()
    except Exception:
        pass
    finally:
        db.close()
except Exception as e:
    report(5, "commit + onboarded", False, f"EXC {e}")

# 6. /ingest/template?type=inventory -> parseable CSV, canonical headers
try:
    r = client.get("/ingest/template", params={"type": "inventory"})
    ok = False
    detail = f"-> {r.status_code}"
    if r.status_code == 200:
        try:
            rows = list(csv.reader(io.StringIO(r.text)))
            hdr = [h.strip() for h in rows[0]] if rows else []
            ok = ("product" in hdr and "stock_qty" in hdr and "reorder_level" in hdr
                  and len(rows) >= 3)
            detail = f"-> {r.status_code} header={hdr} rows={len(rows)}"
        except Exception as exc:
            detail = f"parse EXC {exc}"
    r2 = client.get("/ingest/template", params={"type": "bogus"})
    ok = ok and r2.status_code == 422
    report(6, "template csv", ok, detail + f" bogus={r2.status_code}")
except Exception as e:
    report(6, "template csv", False, f"EXC {e}")

# 7. web documents: pending + confirm + reject
try:
    from app.models import Customer, DocumentLog, Product, Receivable, Sale
    from app.services import sync as _s  # noqa: keep ledger import warm

    db = _db()
    try:
        _clean_product(db, "P7DocItem")
        _clean_customer(db, "P7DocParty")
        db.query(DocumentLog).filter(DocumentLog.filename.like("test-p7-doc%")).delete()
        db.commit()
        entries = [
            {"date": TODAY, "party_name": "P7DocCash", "item": "P7DocItem",
             "qty": 2, "amount": 200, "entry_type": "SALE"},
            {"date": TODAY, "party_name": "P7DocParty", "item": None,
             "qty": None, "amount": 500, "entry_type": "CREDIT_GIVEN"},
        ]
        log = DocumentLog(
            source="test", filename="test-p7-doc-a.jpg",
            parsed_entries=json.dumps({"entries": entries, "totals": {}, "notes": "t"}),
            status="pending_confirm", phone="919834854511", owner_id=1,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        doc_id = int(log.id)
    finally:
        db.close()
    h1 = _auth(1, "919834854511")
    rp = client.get("/documents/pending", headers=h1)
    jp = rp.json() if rp.status_code == 200 else []
    seen = any(isinstance(x, dict) and x.get("id") == doc_id for x in (jp if isinstance(jp, list) else []))
    rc = client.post(f"/documents/{doc_id}/confirm", headers=h1)
    jc = rc.json() if rc.status_code == 200 else {}
    db = _db()
    try:
        sale_ok = (
            db.query(Sale).join(Product, Sale.product_id == Product.id)
            .filter(Product.owner_id == 1, Product.name == "P7DocItem").first() is not None
        )
        recv_ok = (
            db.query(Receivable).join(Customer, Receivable.customer_id == Customer.id)
            .filter(Customer.owner_id == 1, Customer.name == "P7DocParty").first() is not None
        )
    finally:
        db.close()
    rp2 = client.get("/documents/pending", headers=h1)
    jp2 = rp2.json() if rp2.status_code == 200 else []
    excluded = not any(isinstance(x, dict) and x.get("id") == doc_id for x in (jp2 if isinstance(jp2, list) else []))
    # reject path on a second log
    db = _db()
    try:
        log2 = DocumentLog(
            source="test", filename="test-p7-doc-b.jpg",
            parsed_entries=json.dumps({"entries": []}),
            status="pending_confirm", phone="919834854511", owner_id=1,
        )
        db.add(log2)
        db.commit()
        db.refresh(log2)
        rid = int(log2.id)
    finally:
        db.close()
    rr = client.post(f"/documents/{rid}/reject", headers=h1)
    db = _db()
    try:
        st = db.query(DocumentLog).filter(DocumentLog.id == rid).first()
        rej_ok = rr.status_code == 200 and st is not None and st.status == "rejected"
    finally:
        db.close()
    ok = (
        rp.status_code == 200 and seen
        and rc.status_code == 200 and int(jc.get("confirmed", 0)) >= 2
        and sale_ok and recv_ok and excluded and rej_ok
    )
    report(7, "web documents", ok,
           f"-> pending_seen={seen} confirmed={jc.get('confirmed')} sale={sale_ok} "
           f"recv={recv_ok} excluded={excluded} reject={rej_ok}")
    db = _db()
    try:
        _clean_product(db, "P7DocItem")
        _clean_customer(db, "P7DocCash")
        _clean_customer(db, "P7DocParty")
        db.query(DocumentLog).filter(DocumentLog.filename.like("test-p7-doc%")).delete()
        db.commit()
    except Exception:
        pass
    finally:
        db.close()
except Exception as e:
    report(7, "web documents", False, f"EXC {e}")

# 8. group drop + allowlist gate
try:
    from app.models import OwnerProfile
    from app.services import whatsapp_flow as flow

    g1 = {
        "event": "message.received", "sessionId": "s",
        "data": {"id": "g1", "from": "120363012345@g.us", "chatId": "120363012345@g.us",
                 "body": "hello group", "type": "text", "fromMe": False},
    }
    g2 = {
        "event": "message.received", "sessionId": "s",
        "data": {"id": "m9", "from": "919000000091@c.us", "chatId": "919000000091@c.us",
                 "body": "hi", "type": "text", "fromMe": False, "isGroup": True},
    }
    ok_groups = flow.extract_incoming(g1) is None and flow.extract_incoming(g2) is None

    GATE_PHONE = "919000000091"
    db = _db()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == GATE_PHONE).first()
        if old is not None:
            db.delete(old)
            db.commit()
    finally:
        db.close()
    try:
        flow._allow_reply_at.clear()
    except Exception:
        pass
    prev = os.environ.get("ALLOWED_INBOUND_PHONES")
    os.environ["ALLOWED_INBOUND_PHONES"] = "919999999999"
    try:
        r = client.post("/webhook/whatsapp", json={
            "event": "message.received", "sessionId": "s",
            "data": {"id": "m-gate", "from": f"{GATE_PHONE}@c.us",
                     "chatId": f"{GATE_PHONE}@c.us", "body": "profit kyun gira?",
                     "type": "text", "fromMe": False, "isGroup": False},
        })
        try:
            ok_recv = r.status_code == 200 and r.json().get("received") is True
        except Exception:
            ok_recv = False
        db = _db()
        try:
            no_profile = db.query(OwnerProfile).filter(
                OwnerProfile.phone == GATE_PHONE).first() is None
        finally:
            db.close()
        ok = ok_groups and ok_recv and no_profile
        report(8, "group+allowlist", ok,
               f"-> group_drop={ok_groups} recv={ok_recv} no_side_effect={no_profile}")
    finally:
        try:
            if prev is None:
                del os.environ["ALLOWED_INBOUND_PHONES"]
            else:
                os.environ["ALLOWED_INBOUND_PHONES"] = prev
            flow._allow_reply_at.clear()
        except Exception:
            pass
        db = _db()
        try:
            old = db.query(OwnerProfile).filter(OwnerProfile.phone == GATE_PHONE).first()
            if old is not None:
                db.delete(old)
                db.commit()
        except Exception:
            pass
        finally:
            db.close()
except Exception as e:
    report(8, "group+allowlist", False, f"EXC {e}")

# 9. /data/reset guards (admin 200 RESEEDS — run last before legacy)
try:
    from app.models import OwnerProfile

    db = _db()
    try:
        old = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000094").first()
        if old is not None:
            db.delete(old)
            db.commit()
        tmp = OwnerProfile(phone="919000000094", name="P7NonAdmin", allowed=True, onboarded=True)
        db.add(tmp)
        db.commit()
        db.refresh(tmp)
        tmp_id = int(tmp.id)
    finally:
        db.close()
    r0 = client.post("/data/reset")
    r1 = client.post("/data/reset", headers=_auth(tmp_id, "919000000094"))
    r2 = client.post("/data/reset", headers=_auth(1, "919834854511"))
    ok200 = False
    try:
        ok200 = r2.status_code == 200 and "reseeded" in str(r2.json().get("message", ""))
    except Exception:
        ok200 = False
    ok = r0.status_code == 401 and r1.status_code == 403 and ok200
    report(9, "reset guards", ok,
           f"-> no_tok={r0.status_code} non_admin={r1.status_code} admin={r2.status_code}")
    db = _db()
    try:
        t = db.query(OwnerProfile).filter(OwnerProfile.phone == "919000000094").first()
        if t is not None:
            db.delete(t)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
except Exception as e:
    report(9, "reset guards", False, f"EXC {e}")

print(f"P7 VERIFY: {passed}/{total} checks passed")
if failures:
    print("FAILURES:", failures)
    sys.exit(1)

# 10. legacy reruns
print("--- legacy reruns ---")
legacy_ok = True
for name in ("verify_p2.py", "verify_p3.py", "verify_p4.py", "verify_p6.py"):
    try:
        p = subprocess.run([sys.executable, name], capture_output=True, text=True, timeout=900)
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
report(10, "legacy p2/p3/p4/p6", True, "-> all green")
print(f"P7 VERIFY: {passed}/{total} + legacy green")
