"""Document AI — Gemini Vision register/bill parser + confirm flow."""

import base64
import json
import logging
import os
import re
from datetime import date, timedelta

import requests

logger = logging.getLogger("vyapaarai.documents")

EXTRACTION_PROMPT = (
    "You are a meticulous Indian business data extractor. Read this register page / bill photo / "
    "PDF. Extract every entry you can read. Return ONLY JSON: "
    '{"entries":[{"date":"YYYY-MM-DD or null","party_name":str|null,"item":str|null,'
    '"qty":number|null,"amount":number|null,'
    '"entry_type":"SALE|CREDIT_GIVEN|CREDIT_RECEIVED|PAYMENT_MADE|PURCHASE"}],'
    '"totals":{"sales":number,"credit_given":number},"notes":str} '
    "Unreadable fields = null. Do not invent entries."
)

FAILURE_MSG = "Photo/PDF padh nahi paye — dobara bhejein ya saaf photo lein."


def _gemini_key() -> str:
    v = os.getenv("GEMINI_API_KEY")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GEMINI_API_KEY", "") or "").strip()
    except Exception:
        return ""


def _gemini_model() -> str:
    v = os.getenv("GEMINI_MODEL")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GEMINI_MODEL", "") or "").strip() or "gemini-2.5-flash"
    except Exception:
        return "gemini-2.5-flash"


def _mime_for(filename: str) -> str:
    name = str(filename or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def _strip_fences(text: str) -> str:
    t = str(text or "").strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", t, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return t


def _gemini_vision(content: bytes, mime: str) -> dict:
    api_key = _gemini_key()
    if not api_key:
        raise RuntimeError("missing GEMINI_API_KEY")
    model = _gemini_model()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    b64 = base64.b64encode(bytes(content)).decode("ascii")
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": b64}},
                    {"text": EXTRACTION_PROMPT},
                ],
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }
    r = requests.post(url, json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        raise RuntimeError(f"unexpected Gemini response: {str(data)[:400]}")
    return json.loads(_strip_fences(raw_text))


def _load_entries(parsed_raw) -> list:
    try:
        if isinstance(parsed_raw, str):
            payload = json.loads(parsed_raw)
        else:
            payload = parsed_raw or {}
        if isinstance(payload, list):
            return [e for e in payload if isinstance(e, dict)]
        entries = payload.get("entries", [])
        return [e for e in entries if isinstance(e, dict)]
    except Exception:
        return []


def build_summary(entries: list) -> str:
    try:
        entries = entries or []
        n = len(entries)
        if n == 0:
            return "📗 Koi entry saaf nahi dikhi — dobara saaf photo bhejein."
        sales = 0.0
        credit = 0.0
        parties = []
        for e in entries:
            try:
                amt = float(e.get("amount") or 0)
            except Exception:
                amt = 0.0
            et = str(e.get("entry_type") or "").upper()
            if et == "SALE":
                sales += amt
            if et == "CREDIT_GIVEN":
                credit += amt
            p = str(e.get("party_name") or "").strip()
            if p and p not in parties:
                parties.append(p)
        party_txt = ", ".join(parties[:3]) if parties else "—"
        return (
            f"📗 {n} entries mili — Sales ₹{sales:,.0f} • Udhaar diya ₹{credit:,.0f} "
            f"({party_txt}). Sahi hai? Reply: HAAN ya NAHI"
        )
    except Exception:
        return "📗 Entries mili. Sahi hai? Reply: HAAN ya NAHI"


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def parse_document(db, content: bytes, filename: str, source: str = "whatsapp", phone=None,
                   owner_id: int = 1) -> dict:
    try:
        from app.db import ensure_p4_schema

        try:
            ensure_p4_schema()
        except Exception:
            pass
        from app.models import DocumentLog

        if not content:
            return {"error": FAILURE_MSG}
        mime = _mime_for(filename or "")
        payload = _gemini_vision(bytes(content), mime)
        entries = _load_entries(payload.get("entries", [])) if isinstance(payload, dict) else []
        totals = {}
        notes = ""
        if isinstance(payload, dict):
            totals = payload.get("totals", {}) or {}
            notes = str(payload.get("notes", "") or "")
        log = DocumentLog(
            source=source or "whatsapp",
            owner_id=_oid(owner_id),
            filename=filename or "document",
            parsed_entries=json.dumps({"entries": entries, "totals": totals, "notes": notes}),
            status="pending_confirm",
            phone=phone,
        )
        db.add(log)
        db.commit()
        try:
            db.refresh(log)
        except Exception:
            pass
        return {"doc_id": log.id, "entries": entries, "summary_text": build_summary(entries)}
    except Exception as exc:
        logger.info("parse_document failed: %s", str(exc)[:300])
        try:
            db.rollback()
        except Exception:
            pass
        return {"error": FAILURE_MSG}


def _get_or_create_customer(db, name: str, owner_id: int = 1):
    from app.models import Customer

    oid = _oid(owner_id)
    cname = str(name or "").strip() or "Unknown Party"
    try:
        existing = db.query(Customer).filter(
            Customer.owner_id == oid, Customer.name.ilike(cname)).first()
    except Exception:
        existing = None
    if existing is not None:
        return existing
    c = Customer(name=cname, owner_id=oid)
    db.add(c)
    db.flush()
    return c


def _get_or_create_product(db, item: str, amount: float, qty: float, doc_id: int, idx: int,
                           owner_id: int = 1):
    from app.models import Product

    oid = _oid(owner_id)
    iname = str(item or "").strip() or f"Register Item {idx + 1}"
    try:
        existing = db.query(Product).filter(
            Product.owner_id == oid, Product.name.ilike(iname)).first()
    except Exception:
        existing = None
    if existing is not None:
        return existing
    try:
        q = float(qty or 0)
    except Exception:
        q = 0.0
    try:
        a = float(amount or 0)
    except Exception:
        a = 0.0
    unit_price = (a / q) if q > 0 else a
    sku = f"REG-{doc_id}-{idx}"
    p = Product(
        sku=sku,
        owner_id=oid,
        name=iname,
        category="General",
        unit="pcs",
        sale_price=round(unit_price, 2),
        purchase_price=round(unit_price * 0.85, 2),
    )
    db.add(p)
    db.flush()
    return p


def _parse_entry_date(value) -> date:
    try:
        if value:
            return date.fromisoformat(str(value).strip()[:10])
    except Exception:
        pass
    return date.today()


def confirm_document(db, doc_id: int, approve: bool, phone=None, owner_id: int = 1) -> dict:
    from app.db import ensure_p4_schema

    try:
        ensure_p4_schema()
    except Exception:
        pass
    from app.models import Customer, Expense, Product, Receivable, Sale

    oid = _oid(owner_id)
    try:
        from app.models import DocumentLog

        log = db.query(DocumentLog).filter(DocumentLog.id == doc_id).first()
    except Exception as exc:
        return {"error": f"Document lookup failed: {exc}"}
    if log is None or str(getattr(log, "status", "")) != "pending_confirm":
        return {"error": "Koi pending document nahi mila."}
    try:
        if int(getattr(log, "owner_id", oid) or oid) != oid:
            return {"error": "Ye document aapke account ka nahi hai."}
    except Exception:
        pass
    if not approve:
        try:
            log.status = "rejected"
            db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
        return {"status": "rejected", "message": "❌ Entries discard kar di gayi."}
    entries = _load_entries(getattr(log, "parsed_entries", None))
    committed = 0
    warnings: list = []
    for i, e in enumerate(entries):
        try:
            et = str(e.get("entry_type") or "").upper().strip()
            try:
                amount = float(e.get("amount") or 0)
            except Exception:
                amount = 0.0
            try:
                qty = float(e.get("qty") or 0)
            except Exception:
                qty = 0.0
            party = str(e.get("party_name") or "").strip() or None
            item = str(e.get("item") or "").strip() or None
            edate = _parse_entry_date(e.get("date"))
            if et == "SALE":
                prod = _get_or_create_product(db, item or "Item", amount, qty, log.id, i, oid)
                cust = _get_or_create_customer(db, party, oid) if party else None
                q = qty if qty > 0 else 1.0
                try:
                    unit_price = float(prod.sale_price or 0) or ((amount / q) if q else amount)
                except Exception:
                    unit_price = (amount / q) if q else amount
                total = amount if amount > 0 else round(q * unit_price, 2)
                db.add(
                    Sale(
                        date=edate, product_id=prod.id, owner_id=oid,
                        customer_id=cust.id if cust else None,
                        qty=q, unit_price=round(unit_price, 2),
                        amount=round(total, 2), source="register",
                    )
                )
                db.flush()
                committed += 1
            elif et == "CREDIT_GIVEN":
                cust = _get_or_create_customer(db, party, oid)
                inv = f"REG-{log.id}-{i}"
                db.add(
                    Receivable(
                        customer_id=cust.id, owner_id=oid, invoice_no=inv, amount=round(amount, 2),
                        issue_date=edate, due_date=edate + timedelta(days=30),
                        paid=False, paid_date=None, source="register",
                    )
                )
                db.flush()
                committed += 1
            elif et in ("CREDIT_RECEIVED", "PAYMENT_MADE"):
                if not party:
                    warnings.append(f"Entry {i + 1}: party naam nahi mila — skip.")
                    continue
                try:
                    rec = (
                        db.query(Receivable)
                        .join(Customer, Receivable.customer_id == Customer.id)
                        .filter(Receivable.owner_id == oid,
                                Receivable.paid.is_(False), Customer.name.ilike(f"%{party}%"))
                        .order_by(Receivable.due_date)
                        .first()
                    )
                except Exception:
                    rec = None
                if rec is None:
                    warnings.append(f"Entry {i + 1}: {party} ki koi udhaar entry nahi mili.")
                    continue
                rec.paid = True
                rec.paid_date = edate
                db.flush()
                committed += 1
            elif et == "PURCHASE":
                note = f"{party or ''} {item or ''}".strip() or "Register purchase"
                db.add(Expense(date=edate, owner_id=oid, category="Purchases", amount=round(amount, 2), note=note, source="register"))
                db.flush()
                committed += 1
            else:
                warnings.append(f"Entry {i + 1}: unknown type '{et}' — skip.")
        except Exception as exc:
            warnings.append(f"Entry {i + 1} save nahi hui: {str(exc)[:150]}")
            try:
                db.rollback()
                # re-attach log after rollback
                log = db.query(DocumentLog).filter(DocumentLog.id == doc_id).first()
                if log is None:
                    return {"error": "Document lookup failed after rollback."}
            except Exception:
                pass
            continue
    try:
        log.status = "confirmed"
        db.commit()
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        return {"error": f"Confirm save failed: {exc}"}
    return {"confirmed": committed, "warnings": warnings, "message": "✅ Entries save ho gayi"}
