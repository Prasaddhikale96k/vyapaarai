"""Tally sync agent: poll http://localhost:9000 XML (Tally.Py patterns) -> POST /connectors/ingest.

Day Book vouchers + stock since last-sync marker. Env:
  TALLY_URL    (default http://localhost:9000)
  BACKEND_URL  (default http://localhost:8000)
  TOKEN_FILE   (default ./connectors/token.txt)
  POLL_SECONDS (default 60)
  FROM_DATE    (default 20240101) — Tally date format YYYYMMDD

Run:  python connectors/tally_sync.py   (from backend/)
"""

import json
import logging
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("tally_sync")

TALLY_URL = os.getenv("TALLY_URL", "http://localhost:9000").rstrip("/")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
TOKEN_FILE = Path(os.getenv("TOKEN_FILE", "./connectors/token.txt")).resolve()
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "60"))
FROM_DATE = os.getenv("FROM_DATE", "20240101")
STATE_FILE = Path(os.getenv("TALLY_STATE", "./connectors/tally_state.json")).resolve()


def _token() -> str:
    try:
        return TOKEN_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def _post_ingest(rows: list) -> dict:
    tok = _token()
    if not tok:
        return {"ok": False, "error": f"token nahi mila ({TOKEN_FILE})"}
    try:
        r = requests.post(
            f"{BACKEND_URL}/connectors/ingest",
            json={"source": "tally", "rows": rows},
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            timeout=30,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "resp": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def _day_book_xml(from_date: str, to_date: str) -> str:
    """Tally Day Book request (Tally.Py envelope pattern)."""
    return f"""<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Day Book</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVFROMDATE>{from_date}</SVFROMDATE>
        <SVTODATE>{to_date}</SVTODATE>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>"""


def _fetch_day_book() -> str:
    r = requests.post(TALLY_URL, data=_day_book_xml(FROM_DATE, datetime.now().strftime("%Y%m%d")), timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"tally HTTP {r.status_code}")
    return r.text


def _parse_vouchers(xml_text: str) -> list:
    """TALLYMESSAGE/VOUCHER -> list of dicts (date, party, voucher_type, amount)."""
    out = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return out
    for msg in root.iter("TALLYMESSAGE"):
        v = msg.find("VOUCHER")
        if v is None:
            continue
        try:
            date_el = v.find("DATE")
            date = date_el.text.strip() if date_el is not None and date_el.text else ""
            # Tally date is YYYYMMDD
            if len(date) == 8:
                date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
            party = ""
            p = v.find("PARTYNAME")
            if p is not None and p.text:
                party = p.text.strip()
            vtype = ""
            vt = v.find("VOUCHERTYPENAME")
            if vt is not None and vt.text:
                vtype = vt.text.strip()
            amount = 0.0
            for amt in v.iter("AMOUNT"):
                if amt.text:
                    try:
                        amount = float(amt.text.strip())
                        break
                    except Exception:
                        pass
            out.append({"date": date, "party_name": party, "voucher_type": vtype, "amount": amount})
        except Exception:
            continue
    return out


def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"last_count": 0}


def _save_state(state: dict) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state), encoding="utf-8")
    except Exception:
        pass


def main():
    logger.info("tally_sync polling %s (backend=%s)", TALLY_URL, BACKEND_URL)
    while True:
        try:
            xml_text = _fetch_day_book()
            vouchers = _parse_vouchers(xml_text)
            state = _load_state()
            last_count = int(state.get("last_count", 0) or 0)
            new_vouchers = vouchers[last_count:] if len(vouchers) > last_count else []
            if new_vouchers:
                header = ["date", "party_name", "voucher_type", "amount"]
                rows = [header] + [[v.get("date", ""), v.get("party_name", ""),
                                    v.get("voucher_type", ""), v.get("amount", "")] for v in new_vouchers]
                res = _post_ingest(rows)
                if res.get("ok"):
                    state["last_count"] = len(vouchers)
                    _save_state(state)
                    logger.info("tally_sync: %d new vouchers ingested", len(new_vouchers))
                else:
                    logger.warning("tally_sync: ingest fail: %s", res.get("error", "unknown"))
            else:
                logger.info("tally_sync: koi naya voucher nahi (total %d)", len(vouchers))
        except Exception as exc:
            logger.warning("tally_sync poll failed: %s", str(exc)[:200])
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
