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

CONNECTOR_TYPES = {"google_sheets", "excel_agent", "tally_agent"}
CONNECTOR_STATUS = {"live", "polling", "offline", "error"}

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
        }
    except Exception:
        return {}


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


def ingest_agent_rows(owner_id: int, source: str, rows: list, db) -> dict:
    """POST /connectors/ingest handler: agent-pushed rows -> ingestion path.

    rows = list of lists (first row may be headers). source = excel | tally.
    Returns IngestSummary-shaped dict. Never raises.
    """
    try:
        if source not in ("excel", "tally"):
            return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                    "rows_skipped": 0, "warnings": [f"unknown source '{source}' — excel|tally"]}
        if not rows:
            return {"source_type": source, "filename": f"agent-{source}", "rows_inserted": 0,
                    "rows_skipped": 0, "warnings": ["koi rows nahi aayi"]}
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
        from app.services.ingestion import ingest_dataframe

        source_type = "tally" if source == "tally" else "sales"
        summary = ingest_dataframe(db, df, source_type, f"agent-{source}", owner_id=int(owner_id or 1))
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
        from app.models import Connector

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
