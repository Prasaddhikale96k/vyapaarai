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
import re
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
        direct = os.getenv("AGENT_TOKEN", "").strip()
        if direct:
            return direct
        return TOKEN_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def _save_token(tok: str) -> None:
    try:
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(tok.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("token save nahi hua: %s", str(exc)[:120])


def _pair_with_code() -> str:
    """Pehli baar: web se 6-char code lo, yahan dalo — token khud save hoga."""
    try:
        print("")
        print("VyapaarAI pairing — token copy karne ki zaroorat nahi.")
        print("  1. Tally kholo (company loaded, port 9000) + Web: /app/data -> 'Computer se jodo'")
        print("  2. Wo 6-char code yahan dalo:")
        code = input("  Code: ").strip().upper()
        if not code:
            return ""
        r = requests.post(f"{BACKEND_URL}/connectors/agent-token",
                          json={"code": code}, timeout=20)
        try:
            data = r.json()
        except Exception:
            data = {}
        if isinstance(data, dict) and data.get("ok") and data.get("token"):
            _save_token(str(data["token"]))
            print("  Paired! Ab se auto-sync chalega.")
            return str(data["token"])
        print(f"  Pair fail: {(data or {}).get('error', r.text[:120])}")
        return ""
    except Exception as exc:
        logger.warning("pair fail: %s", str(exc)[:150])
        return ""


def _ensure_token() -> str:
    tok = _token()
    if tok:
        return tok
    return _pair_with_code()


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


# Tally Day Book me sirf vouchers hote hain — naya item/stock master kabhi
# nahi aata. Isliye Stock Summary (item master + current qty) bhi utha ke
# products/inventory me daal dete hain, warna user Tally me naya item add
# karne ke baad site par dikhta hi nahi.
_STOCK_XML = """<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>"""


def _fetch_stock_summary() -> str:
    r = requests.post(TALLY_URL, data=_STOCK_XML, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"tally stock HTTP {r.status_code}")
    return r.text


def _slug(name: str) -> str:
    """Item name -> stable SKU (Tally me id nahi hoti)."""
    try:
        s = re.sub(r"[^A-Za-z0-9]+", "-", str(name or "")).strip("-").upper()
        return s or "ITEM"
    except Exception:
        return "ITEM"


def _tally_text(elem) -> str:
    """<el>text</el> -> stripped text, '' if missing. (ingestion.py has its own; local copy)."""
    try:
        if elem is None or elem.text is None:
            return ""
        return str(elem.text).strip()
    except Exception:
        return ""


def _parse_stock_items(xml_text: str) -> list:
    """Stock Summary -> [{sku, name, qty, rate, unit}]. qty like '18 kg' -> 18.0.

    Shape: <ENVELOPE><DSPACCNAME><DSPDISPNAME>Sugar</DSPDISPNAME></DSPACCNAME>
    <DSPSTKINFO><DSPSTKCL><DSPCLQTY>18 kg</DSPCLQTY><DSPCLRATE>45.00</DSPCLRATE>
    </DSPSTKCL></DSPSTKINFO></ENVELOPE>. name is a SIBLING of DSPSTKINFO, so
    a descendant search inside DSPSTKINFO never finds it.
    """
    out = []
    try:
        root = ET.fromstring(_clean_xml(xml_text))
    except Exception:
        return out
    names = [_tally_text(e) for e in root.iter("DSPDISPNAME")]
    for stk in root.iter("DSPSTKINFO"):
        try:
            name = names.pop(0) if names else ""
            if not name:
                continue
            qty = 0.0
            unit = "pcs"
            rate = 0.0
            for cl in stk.iter("DSPSTKCL"):
                q = _tally_text(cl.find("DSPCLQTY"))
                if q:
                    m = re.match(r"\s*([0-9][0-9.,]*)\s*([A-Za-z]*)", q)
                    if m:
                        try:
                            qty = float(m.group(1).replace(",", ""))
                            unit = (m.group(2) or "pcs").strip() or "pcs"
                        except ValueError:
                            qty = 0.0
                r = _tally_text(cl.find("DSPCLRATE"))
                if r:
                    try:
                        rate = float(r.replace(",", ""))
                    except ValueError:
                        rate = 0.0
            out.append({"sku": _slug(name), "name": name, "qty": qty,
                        "rate": rate, "unit": unit})
        except Exception:
            continue
    return out


def _clean_xml(xml_text: str) -> str:
    try:
        import re

        t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(xml_text or ""))

        def _scrub_numref(m):
            try:
                raw = m.group(1) or ""
                v = int(raw[1:], 16) if raw.lower().startswith("x") else int(raw)
                if v < 32 and v not in (9, 10, 13):
                    return ""
            except Exception:
                return ""
            return m.group(0)

        return re.sub(r"&#([xX]?[0-9a-fA-F]+);", _scrub_numref, t)
    except Exception:
        return str(xml_text or "")


def _parse_vouchers(xml_text: str) -> list:
    """TALLYMESSAGE/VOUCHER -> list of dicts (date, party, voucher_type, amount)."""
    out = []
    try:
        root = ET.fromstring(_clean_xml(xml_text))
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
            # Day Book export me tag PARTYLEDGERNAME hota hai, kabhi PARTYNAME
            for _tag in ("PARTYNAME", "PARTYLEDGERNAME"):
                p = v.find(_tag)
                if p is not None and p.text and p.text.strip():
                    party = p.text.strip()
                    break
            vtype = ""
            vt = v.find("VOUCHERTYPENAME")
            if vt is not None and vt.text:
                vtype = vt.text.strip()
            amount = 0.0
            for amt in v.iter("AMOUNT"):
                if amt.text:
                    try:
                        # Tally debit line negative hoti hai — quantum lo, sign voucher-type se tay hoga
                        amount = abs(float(amt.text.strip()))
                        break
                    except Exception:
                        pass
            mid = ""
            try:
                me = v.find("MASTERID")
                if me is not None and me.text:
                    mid = me.text.strip()
            except Exception:
                mid = ""
            out.append({"date": date, "party_name": party, "voucher_type": vtype,
                        "amount": amount, "master_id": mid})
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


def _post_products(items: list) -> dict:
    tok = _token()
    if not tok:
        return {"ok": False, "error": "token nahi mila"}
    try:
        r = requests.post(
            f"{BACKEND_URL}/connectors/ingest",
            json={"source": "excel", "rows": items},
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            timeout=30,
        )
        if r.status_code in (200, 201):
            return {"ok": True, "resp": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def main():
    logger.info("tally_sync polling %s (backend=%s)", TALLY_URL, BACKEND_URL)
    if not _ensure_token():
        logger.warning("tally_sync: bina pairing ke band — dobara chalao aur code dalo")
        return
    while True:
        try:
            # 1) Day Book vouchers (sales/purchases)
            xml_text = _fetch_day_book()
            vouchers = _parse_vouchers(xml_text)
            state = _load_state()
            last_count = int(state.get("last_count", 0) or 0)
            new_vouchers = vouchers[last_count:] if len(vouchers) > last_count else []
            if new_vouchers:
                header = ["date", "party_name", "voucher_type", "amount", "master_id"]
                rows = [header] + [[v.get("date", ""), v.get("party_name", ""),
                                    v.get("voucher_type", ""), v.get("amount", ""),
                                    v.get("master_id", "")] for v in new_vouchers]
                res = _post_ingest(rows)
                if res.get("ok"):
                    state["last_count"] = len(vouchers)
                    _save_state(state)
                    logger.info("tally_sync: %d new vouchers ingested", len(new_vouchers))
                else:
                    logger.warning("tally_sync: ingest fail: %s", res.get("error", "unknown"))
            else:
                logger.info("tally_sync: koi naya voucher nahi (total %d)", len(vouchers))

            # 2) Stock Summary (item master + qty) — naye item add hone par
            #    yahi se dikhega, Day Book kabhi nahi dikhata.
            try:
                stock_xml = _fetch_stock_summary()
                items = _parse_stock_items(stock_xml)
                if items:
                    rows = [["sku", "name", "category", "unit", "sale_price", "purchase_price"]] + [
                        [it["sku"], it["name"], "Staples", it["unit"], it["rate"], it["rate"]]
                        for it in items
                    ]
                    res = _post_products(rows)
                    if res.get("ok"):
                        logger.info("tally_sync: %d stock items synced", len(items))
                    else:
                        logger.warning("tally_sync: stock sync fail: %s",
                                       res.get("error", "unknown"))
                    # qty bhi products me nahi jaati — inventory level alag bhejo
                    inv_rows = [["product", "stock_qty", "reorder_level"]] + [
                        [it["name"], it["qty"], 10.0] for it in items
                    ]
                    try:
                        r2 = requests.post(
                            f"{BACKEND_URL}/connectors/ingest",
                            json={"source": "inventory", "rows": inv_rows},
                            headers={"Authorization": f"Bearer {_token()}",
                                     "Content-Type": "application/json"},
                            timeout=30,
                        )
                        if r2.status_code in (200, 201):
                            logger.info("tally_sync: %d inventory levels synced",
                                        len(items))
                    except Exception as exc:
                        logger.info("tally_sync: inventory post skip: %s",
                                    str(exc)[:120])
            except Exception as exc:
                logger.info("tally_sync: stock fetch skip: %s", str(exc)[:150])
        except Exception as exc:
            logger.warning("tally_sync poll failed: %s", str(exc)[:200])
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
