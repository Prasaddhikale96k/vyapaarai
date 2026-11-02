"""Live connectors: Google Sheets poll + Excel/Tally agent push. Never raises.

- Google Sheets: config {sheet_id, range}; 60s APScheduler poll; values.get via
  GOOGLE_API_KEY (public sheets only — private sheets need OAuth, deferred);
  row diff via sha256 -> new rows through ingestion alias-maps (sales) ->
  rows_synced/last_sync_at -> intel cache invalidate -> realtime event (ingestion_logs).
- Agent push: POST /connectors/ingest {source: excel|tally, rows:[...]} -> same
  ingestion path -> ingestion_logs.
"""

import csv
import hashlib
import io
import json
import logging
import os
from datetime import datetime

import requests

logger = logging.getLogger("vyapaarai.connectors")

CONNECTOR_TYPES = {
    "google_sheets", "excel_agent", "tally_agent",
    "busy_agent", "marg_agent",
    "shopify", "woocommerce",
    "zapier", "custom_api",
}
CONNECTOR_STATUS = {"live", "polling", "offline", "error"}

# Types that authenticate via API key (Zapier/Make/custom pushes).
KEY_TYPES = {"zapier", "custom_api", "shopify", "woocommerce"}


def new_api_key() -> str:
    """Generate a connect-hub API key. Never raises."""
    try:
        import secrets

        return "vk_" + secrets.token_urlsafe(32)
    except Exception:
        import uuid

        return "vk_" + uuid.uuid4().hex


def mask_api_key(key: str | None) -> str | None:
    """Last-4 masked form for list responses. Full key is shown only once at create/regenerate."""
    try:
        k = str(key or "").strip()
        if not k:
            return None
        return "…" + k[-4:]
    except Exception:
        return None

SHEETS_POLL_SECONDS = 60


def _google_api_key() -> str:
    try:
        from app import config as _cfg

        raw = os.getenv("GOOGLE_API_KEY", "") or str(getattr(_cfg, "google_api_key", "") or "")
    except Exception:
        raw = os.getenv("GOOGLE_API_KEY", "")
    return raw.strip()


def serialize_connector(c) -> dict:
    try:
        cfg = {}
        raw = getattr(c, "config", None)
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    cfg = parsed
            except Exception:
                cfg = {}
        last = getattr(c, "last_sync_at", None)
        return {
            "id": getattr(c, "id", None),
            "owner_id": getattr(c, "owner_id", 1),
            "type": getattr(c, "type", ""),
            "config": cfg,
            "status": getattr(c, "status", "offline"),
            "last_sync_at": last.isoformat() if last else None,
            "rows_synced": getattr(c, "rows_synced", 0),
            "has_key": bool(getattr(c, "api_key", None)),
            "key_hint": mask_api_key(getattr(c, "api_key", None)),
        }
    except Exception:
        return {}


def _touch_agent_connector(db, owner_id: int, source: str, inserted: int) -> None:
    """Agent push aate hi connector row live karo taaki UI me dikhe.

    tally/excel/busy/marg agent ka koi row nahi hota (sirf rows push hote hain),
    isliye yahin upsert: pehli push pe row bane, har push pe live + count.
    Never raises.
    """
    try:
        from app.models import Connector
        from datetime import datetime

        ctype = f"{source}_agent"
        if ctype not in CONNECTOR_TYPES:
            ctype = source if source in CONNECTOR_TYPES else None
        if not ctype:
            return
        oid = int(owner_id or 1)
        c = db.query(Connector).filter(
            Connector.owner_id == oid, Connector.type == ctype).first()
        if c is None:
            c = Connector(owner_id=oid, type=ctype, config="{}",
                          status="live", rows_synced=0)
            db.add(c)
        c.status = "live"
        c.last_sync_at = datetime.utcnow()
        try:
            c.rows_synced = int(getattr(c, "rows_synced", 0) or 0) + max(int(inserted or 0), 0)
        except Exception:
            pass
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _invalidate_intel_caches() -> None:
    """Invalidate 60s intel caches after new data lands."""
    try:
        from app.services import intelligence

        for attr in ("_CACHE", "_cache", "CACHE"):
            obj = getattr(intelligence, attr, None)
            if isinstance(obj, dict):
                obj.clear()
    except Exception:
        pass


def _rows_to_csv_bytes(rows: list) -> bytes:
    """Sheet/agent rows (list of lists) -> CSV bytes for the ingestion path."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in rows:
        writer.writerow(["" if v is None else v for v in row])
    return buf.getvalue().encode("utf-8")


def _tally_vouchers_to_frames(rows: list) -> tuple:
    """tally_sync rows [date,party_name,voucher_type,amount] -> (sales_rows, exp_rows, skipped, notes).

    Voucher me item/qty nahi hota, isliye: Sales -> sale (qty=1, price=amount),
    Purchase -> khareed (expenses). Receipt/Payment/Journal paise ka len-den hai,
    bikri nahi — skip + saaf warning (galat revenue se behtar).
    """
    sales_rows = [["date", "product", "qty", "unit_price", "customer"]]
    exp_rows = [["date", "category", "amount", "note"]]
    skipped = 0
    dupes = 0
    seen_mid: set = set()  # same voucher Day Book me dobara → skip
    agg: dict = {}  # (kind,date,vtype,amount,party) -> count (alag vouchers, same rakam = jodo)
    skipped_types: dict = {}
    body = rows[1:] if len(rows) > 1 else []

    def _cell(r, i):
        try:
            v = r[i] if i < len(r) else ""
            return "" if v is None else str(v).strip()
        except Exception:
            return ""

    def _iso_date(s: str) -> str:
        # tally_sync hamesha YYYY-MM-DD bhejta hai. Ingestor ka dayfirst parse
        # ISO ko palat deta hai (04-02 -> Feb 4) — yahin lock karo.
        try:
            from datetime import datetime as _dt

            return _dt.strptime(s.strip(), "%Y-%m-%d").strftime("%Y-%m-%d")
        except Exception:
            return s

    for r in body:
        if not isinstance(r, (list, tuple)):
            skipped += 1
            continue
        vdate, party, vtype, amount = _cell(r, 0), _cell(r, 1), _cell(r, 2), _cell(r, 3)
        vdate = _iso_date(vdate)
        try:
            _amt = float(str(amount).replace(",", ""))
        except Exception:
            _amt = 0.0
        if not vdate or not amount or _amt <= 0:
            # Aadha-adhura voucher (bina rakam) — ledger ganda mat karo
            skipped += 1
            skipped_types["bina-rakam"] = skipped_types.get("bina-rakam", 0) + 1
            continue
            skipped += 1
            continue
        vt = vtype.lower()
        mid = _cell(r, 4)
        if mid:
            if mid in seen_mid:
                dupes += 1
                skipped += 1
                continue
            seen_mid.add(mid)
        if "sale" in vt:
            key = ("sale", vdate, vtype, amount, party)
            agg[key] = agg.get(key, 0) + 1
        elif "purchase" in vt:
            key = ("purchase", vdate, vtype, amount, party)
            agg[key] = agg.get(key, 0) + 1
        else:
            skipped += 1
            skipped_types[vtype or "unknown"] = skipped_types.get(vtype or "unknown", 0) + 1
    for (kind, vdate, vtype, amount, party), n in agg.items():
        if kind == "sale":
            # qty=n (alag vouchers, same rakam) — revenue exact, unique-row safe
            sales_rows.append([vdate, f"Tally {vtype or 'Sale'}", str(n), amount, party])
        else:
            try:
                total = float(str(amount).replace(",", "")) * n
            except Exception:
                total = amount
            exp_rows.append([vdate, "Purchases", str(total),
                             f"Tally {vtype} {party} x{n}".strip()])
    notes = []
    if dupes:
        notes.append(f"duplicate voucher skip: {dupes} (Day Book me dobara dikhe)")
    _norakam = skipped_types.pop("bina-rakam", 0)
    if _norakam:
        notes.append(f"aadhe-adhure voucher skip: {_norakam} (rakam nahi thi)")
    if skipped_types:
        parts = ", ".join(f"{t} x{n}" for t, n in sorted(skipped_types.items()))
        notes.append(f"len-den wale vouchers skip (bikri nahi): {parts}")
    return sales_rows, exp_rows, skipped, notes


def ingest_agent_rows(owner_id: int, source: str, rows: list, db) -> dict:
    """POST /connectors/ingest handler: agent-pushed rows -> ingestion path.

    rows = list of lists (first row may be headers). source = excel | tally | ...
    tally vouchers ko pehle sales/khareed shape me badlo (INGESTORS me "tally"
    nahi hai — seedha bhejne se sab skip hota tha).
    Returns IngestSummary-shaped dict. Never raises.
    """
    try:
        if source not in ("excel", "tally", "busy", "marg", "shopify", "woocommerce",
                          "zapier", "custom", "products", "inventory"):
            return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                    "rows_skipped": 0, "warnings": [f"unknown source '{source}' — excel|tally|busy|marg|shopify|woocommerce|zapier|custom"]}
        if not rows:
            return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                    "rows_skipped": 0, "warnings": ["koi rows nahi aayi"]}
        from app.services.ingestion import ingest_dataframe

        oid = int(owner_id or 1)
        if source == "tally":
            import pandas as pd

            s_rows, e_rows, skipped, notes = _tally_vouchers_to_frames(rows)
            inserted = 0
            warnings: list = list(notes)
            if len(s_rows) > 1:
                s = ingest_dataframe(db, pd.DataFrame(s_rows[1:], columns=s_rows[0]),
                                     "sales", "agent-tally", owner_id=oid)
                inserted += int(s.get("rows_inserted", 0) or 0)
                skipped += int(s.get("rows_skipped", 0) or 0)
                warnings += list(s.get("warnings", []) or [])
            if len(e_rows) > 1:
                e = ingest_dataframe(db, pd.DataFrame(e_rows[1:], columns=e_rows[0]),
                                     "expenses", "agent-tally", owner_id=oid)
                inserted += int(e.get("rows_inserted", 0) or 0)
                skipped += int(e.get("rows_skipped", 0) or 0)
                warnings += list(e.get("warnings", []) or [])
            if len(s_rows) <= 1 and len(e_rows) <= 1:
                warnings.append("koi Sale/Purchase voucher nahi mila — sirf wahi sync hote hain")
            _touch_agent_connector(db, oid, "tally", inserted)
            _invalidate_intel_caches()
            return {"source_type": "tally", "filename": "agent-tally",
                    "rows_inserted": inserted, "rows_skipped": skipped,
                    "warnings": warnings[:50]}
        if source in ("products", "inventory"):
            import pandas as pd

            try:
                df = pd.DataFrame(rows[1:], columns=[str(h) for h in rows[0]]) if rows and len(rows) > 1 else None
            except Exception:
                df = None
            if df is None or df.empty:
                return {"source_type": source, "filename": f"agent-{source}",
                        "rows_inserted": 0, "rows_skipped": 0,
                        "warnings": ["rows parse nahi hue"]}
            st = "products" if source == "products" else "inventory"
            s = ingest_dataframe(db, df, st, f"agent-{source}", owner_id=oid)
            _touch_agent_connector(db, oid, source, int(s.get("rows_inserted", 0) or 0))
            _invalidate_intel_caches()
            return {"source_type": source, "filename": f"agent-{source}",
                    "rows_inserted": int(s.get("rows_inserted", 0) or 0),
                    "rows_skipped": int(s.get("rows_skipped", 0) or 0),
                    "warnings": list(s.get("warnings", []) or [])}
        try:
            import pandas as pd

            body = rows[1:] if len(rows) > 1 else []
            header = rows[0] if rows else []
            df = pd.DataFrame(body, columns=[str(h) for h in header]) if header else pd.DataFrame(body)
        except Exception:
            df = None
        if df is None or df.empty:
            return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                    "rows_skipped": len(rows), "warnings": ["rows parse nahi hue"]}
        summary = ingest_dataframe(db, df, "sales", f"agent-{source}", owner_id=oid)
        try:
            _touch_agent_connector(db, oid, source, int(summary.get("rows_inserted", 0) or 0))
        except Exception:
            pass
        _invalidate_intel_caches()
        return summary
    except Exception as exc:
        logger.info("agent ingest failed: %s", str(exc)[:200])
        return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                "rows_skipped": len(rows or []), "warnings": [f"ingest failed: {str(exc)[:150]}"]}


def _fetch_sheet_values(sheet_id: str, range_name: str) -> list:
    """GET values via Sheets API (public sheets). Raises on failure."""
    key = _google_api_key()
    if not key:
        raise RuntimeError("GOOGLE_API_KEY nahi hai — public sheets ke liye API key chahiye (private sheets ke liye OAuth deferred)")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{range_name}"
    r = requests.get(url, params={"key": key}, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"sheets API HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    return data.get("values", []) or []


def poll_google_sheets(connector, db) -> dict:
    """Poll one Google Sheets connector. Row diff via sha256 -> new rows -> sales ingestion."""
    try:

        cfg = {}
        raw = getattr(connector, "config", None)
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    cfg = parsed
            except Exception:
                cfg = {}
        sheet_id = str(cfg.get("sheet_id", "") or "").strip()
        range_name = str(cfg.get("range", "") or "A1:Z1000").strip() or "A1:Z1000"
        if not sheet_id:
            connector.status = "error"
            db.commit()
            return {"ok": False, "error": "sheet_id nahi hai connector config me"}
        try:
            values = _fetch_sheet_values(sheet_id, range_name)
        except Exception as exc:
            connector.status = "error"
            db.commit()
            return {"ok": False, "error": str(exc)[:200]}
        digest = hashlib.sha256(json.dumps(values, default=str).encode("utf-8")).hexdigest()
        prev_digest = str(cfg.get("row_digest", "") or "")
        if digest == prev_digest:
            connector.status = "polling"
            connector.last_sync_at = datetime.utcnow()
            db.commit()
            return {"ok": True, "changed": False, "rows": len(values)}
        # changed -> new rows through ingestion alias-maps (sales)
        new_rows = values
        summary = ingest_agent_rows(int(getattr(connector, "owner_id", 1) or 1), "excel", new_rows, db)
        cfg["row_digest"] = digest
        connector.config = json.dumps(cfg)
        connector.status = "polling"
        connector.last_sync_at = datetime.utcnow()
        try:
            connector.rows_synced = int(getattr(connector, "rows_synced", 0) or 0) + int(summary.get("rows_inserted", 0) or 0)
        except Exception:
            pass
        db.commit()
        _invalidate_intel_caches()
        return {"ok": True, "changed": True, "rows": len(values),
                "rows_inserted": summary.get("rows_inserted", 0),
                "warnings": summary.get("warnings", [])}
    except Exception as exc:
        logger.info("poll_google_sheets failed: %s", str(exc)[:200])
        try:
            connector.status = "error"
            db.commit()
        except Exception:
            pass
        return {"ok": False, "error": str(exc)[:200]}


def start_connector_scheduler() -> None:
    """APScheduler 60s poll for google_sheets connectors. Idempotent, never raises."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        from app.db import SessionLocal
        from app.models import Connector

        scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

        def _job():
            db = SessionLocal()
            try:
                rows = db.query(Connector).filter(Connector.type == "google_sheets").all()
                for c in rows:
                    try:
                        poll_google_sheets(c, db)
                    except Exception as exc:
                        logger.info("connector %s poll failed: %s", getattr(c, "id", "?"), str(exc)[:150])
            except Exception as exc:
                logger.info("connector scheduler job failed: %s", str(exc)[:200])
            finally:
                try:
                    db.close()
                except Exception:
                    pass

        scheduler.add_job(_job, "interval", seconds=SHEETS_POLL_SECONDS,
                          id="connector_sheets_poll", replace_existing=True)
        scheduler.start()
        logger.info("connector scheduler started (google_sheets 60s poll)")
    except Exception as exc:
        logger.info("connector scheduler failed to start: %s", str(exc)[:200])
