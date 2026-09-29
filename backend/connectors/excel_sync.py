"""Excel sync agent: watch folder -> batch .csv/.xlsx -> POST /connectors/ingest.

Env:
  BACKEND_URL  (default http://localhost:8000)
  TOKEN_FILE   (default ./connectors/token.txt) — JWT token for /connectors/ingest
  WATCH_DIR    (default ./watch)
  POLL_SECONDS (default 30)

Run:  python connectors/excel_sync.py   (from backend/)
"""

import json
import logging
import os
import time
from pathlib import Path

import requests
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("excel_sync")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
TOKEN_FILE = Path(os.getenv("TOKEN_FILE", "./connectors/token.txt")).resolve()
WATCH_DIR = Path(os.getenv("WATCH_DIR", "./watch")).resolve()
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "30"))


def _token() -> str:
    try:
        return TOKEN_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def _post_ingest(rows: list) -> dict:
    tok = _token()
    if not tok:
        return {"ok": False, "error": f"token nahi mila ({TOKEN_FILE}) — pehle /login karke token save karo"}
    try:
        r = requests.post(
            f"{BACKEND_URL}/connectors/ingest",
            json={"source": "excel", "rows": rows},
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            timeout=30,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "resp": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def _read_rows(path: Path) -> list:
    """CSV/Xlsx -> list of lists (header + data rows)."""
    import pandas as pd

    lower = path.name.lower()
    if lower.endswith((".xlsx", ".xls")):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)
    rows = [[str(c) for c in df.columns]]
    for _, row in df.iterrows():
        rows.append(["" if pd.isna(v) else str(v) for v in row.tolist()])
    return rows


class ExcelHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            self._handle(Path(str(event.src_path)))

    def on_moved(self, event):
        dest = getattr(event, "dest_path", None)
        if dest:
            self._handle(Path(str(dest)))

    def _handle(self, path: Path):
        time.sleep(2.0)  # debounce: file may still be copying
        if not path.is_file():
            return
        if path.suffix.lower() not in (".csv", ".xlsx", ".xls"):
            return
        try:
            rows = _read_rows(path)
        except Exception as exc:
            logger.warning("excel_sync: parse fail %s: %s", path.name, str(exc)[:150])
            return
        res = _post_ingest(rows)
        if res.get("ok"):
            logger.info("excel_sync: %s -> %d rows ingested", path.name, len(rows) - 1)
        else:
            logger.warning("excel_sync: %s -> %s", path.name, res.get("error", "unknown"))


def main():
    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    observer = Observer()
    observer.schedule(ExcelHandler(), str(WATCH_DIR), recursive=False)
    observer.start()
    logger.info("excel_sync watching %s (backend=%s)", WATCH_DIR, BACKEND_URL)
    try:
        while True:
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
