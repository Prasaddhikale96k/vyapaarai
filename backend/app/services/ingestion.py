"""CSV/Excel/Tally XML ingestion into canonical DB rows.

Any messy CSV/Excel from Tally/Vyapar/Excel becomes clean canonical rows.
Never crashes on bad rows - collects warning strings and keeps going.
"""

import io
import json
import re
import threading
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.models import Customer, Expense, IngestionLog, InventoryItem, Product, Receivable, Sale


# ---------------------------------------------------------------------------
# Owner context: entry points set it (default 1 = watch folder / legacy).
# ---------------------------------------------------------------------------

_ingest_ctx = threading.local()


def _ingest_oid(owner_id=None) -> int:
    try:
        if owner_id is not None:
            v = int(owner_id)
            return v if v > 0 else 1
    except Exception:
        pass
    try:
        v = int(getattr(_ingest_ctx, "owner_id", 1) or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def set_ingest_owner(owner_id) -> None:
    try:
        _ingest_ctx.owner_id = _ingest_oid(owner_id)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Column alias maps (normalized lowercase header -> canonical field)
# ---------------------------------------------------------------------------

SALES_ALIASES = {
    "date": "date",
    "invoice date": "date",
    "bill date": "date",
    "product": "product",
    "item": "product",
    "item name": "product",
    "sku": "product",
    "product name": "product",
    "qty": "qty",
    "quantity": "qty",
    "price": "unit_price",
    "rate": "unit_price",
    "unit price": "unit_price",
    "amount": "amount",
    "total": "amount",
    "value": "amount",
    "customer": "customer",
    "party": "customer",
    "party name": "customer",
}

PRODUCTS_ALIASES = {
    "sku": "sku",
    "code": "sku",
    "name": "name",
    "product": "name",
    "item name": "name",
    "category": "category",
    "unit": "unit",
    "sale_price": "sale_price",
    "selling price": "sale_price",
    "sale rate": "sale_price",
    "purchase_price": "purchase_price",
    "cost": "purchase_price",
    "purchase rate": "purchase_price",
    "cost price": "purchase_price",
}

INVENTORY_ALIASES = {
    "product": "product",
    "item": "product",
    "sku": "product",
    "stock": "stock_qty",
    "stock qty": "stock_qty",
    "quantity": "stock_qty",
    "closing stock": "stock_qty",
    "reorder_level": "reorder_level",
    "reorder": "reorder_level",
    "min stock": "reorder_level",
    "rol": "reorder_level",
}

RECEIVABLES_ALIASES = {
    "customer": "customer",
    "party": "customer",
    "invoice": "invoice_no",
    "invoice no": "invoice_no",
    "bill no": "invoice_no",
    "amount": "amount",
    "total": "amount",
    "issue_date": "issue_date",
    "date": "issue_date",
    "due_date": "due_date",
    "due": "due_date",
    "status": "paid",
    "paid": "paid",
}

EXPENSE_ALIASES = {
    "date": "date",
    "category": "category",
    "head": "category",
    "expense head": "category",
    "amount": "amount",
    "note": "note",
    "description": "note",
}

ALIAS_MAPS = {
    "sales": SALES_ALIASES,
    "products": PRODUCTS_ALIASES,
    "inventory": INVENTORY_ALIASES,
    "receivables": RECEIVABLES_ALIASES,
    "expenses": EXPENSE_ALIASES,
}


# ---------------------------------------------------------------------------
# Value cleaning
# ---------------------------------------------------------------------------

def parse_amount(raw: Any) -> Optional[float]:
    """Handle 'Rs 1,200.50', '1200', ' 1,200 ', '(500)' -> -500.

    Invalid -> None (caller adds a warning).
    """
    if raw is None:
        return None
    if isinstance(raw, float) and pd.isna(raw):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", "-", "--", "nil", "null"):
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1].strip()
    # Strip rupee symbols / currency codes / spaces
    s = s.replace("\u20b9", "").replace("Rs.", "").replace("Rs", "")
    s = s.replace(",", "").replace(" ", "")
    if not s:
        return None
    try:
        val = float(s)
    except ValueError:
        return None
    if negative:
        val = -abs(val)
    return val


def parse_date(raw: Any) -> Optional[date]:
    """pandas to_datetime(dayfirst=True). Handles '01-04-2026', '2026-04-01', '1-Apr-26'."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, float) and pd.isna(raw):
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        ts = pd.to_datetime(s, dayfirst=True, errors="coerce")
    except Exception:
        return None
    if pd.isna(ts):
        return None
    return ts.date()


def parse_paid(raw: Any) -> bool:
    """paid/yes/1/true/y -> True, everything else -> False."""
    if raw is None:
        return False
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)) and not (isinstance(raw, float) and pd.isna(raw)):
        return str(int(raw)) == "1"
    s = str(raw).strip().lower()
    return s in ("paid", "yes", "1", "true", "y", "done", "received", "settled")


# ---------------------------------------------------------------------------
# Header normalisation + type inference
# ---------------------------------------------------------------------------

def normalize_frame(df: pd.DataFrame, source_type: str) -> pd.DataFrame:
    """Rename columns case-insensitively via alias map. Unknown columns kept as-is."""
    alias = ALIAS_MAPS.get(source_type, {})
    renamed: Dict[str, str] = {}
    for col in df.columns:
        key = str(col).strip().lower()
        renamed[col] = alias.get(key, str(col).strip())
    out = df.rename(columns=renamed)
    return out


def infer_type_from_headers(columns: List[str]) -> Optional[str]:
    """No filename prefix -> infer type from headers using alias maps."""
    lowered = {c.strip().lower() for c in columns}
    scores: Dict[str, int] = {}
    for stype, amap in ALIAS_MAPS.items():
        scores[stype] = len(lowered.intersection(set(amap.keys())))
    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        return None
    return best


def route_type(filename: str, columns: Optional[List[str]] = None) -> Optional[str]:
    """Filename prefix decides type; fall back to header inference."""
    lower = filename.lower()
    if lower.startswith("sales"):
        return "sales"
    if lower.startswith("inventory"):
        return "inventory"
    if lower.startswith("receivables") or lower.startswith("parties"):
        return "receivables"
    if lower.startswith("expenses"):
        return "expenses"
    if lower.startswith("products"):
        return "products"
    if lower.endswith(".xml"):
        return "tally"
    if columns:
        return infer_type_from_headers(columns)
    return None


# ---------------------------------------------------------------------------
# Small get-or-create helpers
# ---------------------------------------------------------------------------

def _slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug.upper()[:48] if slug else "ITEM"


def get_or_create_product(
    db: Session,
    name: str,
    unit_price: float,
    category: str = "Staples",
    sku: Optional[str] = None,
) -> Product:
    """Unknown product name -> auto-create Product (purchase = 0.85 * sale)."""
    oid = _ingest_oid()
    if sku:
        existing = db.query(Product).filter(Product.owner_id == oid, Product.sku == sku).first()
        if existing:
            return existing
    if name:
        existing = db.query(Product).filter(Product.owner_id == oid, Product.name == name).first()
        if existing:
            return existing
        existing = db.query(Product).filter(Product.owner_id == oid, Product.sku == name).first()
        if existing:
            return existing
    sku_val = sku or _slug(name or "ITEM")
    # ensure unique sku
    base = sku_val
    i = 1
    while db.query(Product).filter(Product.sku == sku_val).first() is not None:
        i += 1
        sku_val = f"{base}-{i}"
    prod = Product(
        owner_id=oid,
        sku=sku_val,
        name=name or sku_val,
        category=category or "Staples",
        unit="pcs",
        sale_price=float(unit_price or 0.0),
        purchase_price=float((unit_price or 0.0) * 0.85),
    )
    db.add(prod)
    db.flush()
    return prod


def get_or_create_customer(db: Session, name: str, phone: Optional[str] = None) -> Optional[Customer]:
    if not name or not str(name).strip():
        return None
    oid = _ingest_oid()
    clean = str(name).strip()
    existing = db.query(Customer).filter(Customer.owner_id == oid, Customer.name == clean).first()
    if existing:
        return existing
    cust = Customer(name=clean, phone=phone, owner_id=oid)
    db.add(cust)
    db.flush()
    return cust


# ---------------------------------------------------------------------------
# Row ingestors (each never raises on a bad row)
# ---------------------------------------------------------------------------

def _coerce_date_cell(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return parse_date(value)


def ingest_sales_df(db: Session, df: pd.DataFrame, warnings: List[str]) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    oid = _ingest_oid()
    frame = normalize_frame(df, "sales")
    for idx, row in frame.iterrows():
        try:
            lineno = idx + 2  # 1-based + header
            d = _coerce_date_cell(row.get("date"))
            prod_raw = row.get("product")
            prod_name = None if (prod_raw is None or (isinstance(prod_raw, float) and pd.isna(prod_raw))) else str(prod_raw).strip()
            qty = parse_amount(row.get("qty"))
            unit_price = parse_amount(row.get("unit_price"))
            amount = parse_amount(row.get("amount"))
            cust_raw = row.get("customer")
            cust_name = None if (cust_raw is None or (isinstance(cust_raw, float) and pd.isna(cust_raw))) else str(cust_raw).strip()

            if d is None or not prod_name or qty is None:
                skipped += 1
                warnings.append(f"sales row {lineno}: skipped (missing date/product/qty)")
                continue
            if unit_price is None and amount is None:
                skipped += 1
                warnings.append(f"sales row {lineno}: skipped (missing price and amount)")
                continue
            if unit_price is None:
                unit_price = amount / qty if qty else 0.0
            if amount is None:
                amount = qty * unit_price

            product = get_or_create_product(db, prod_name, float(unit_price))
            customer = get_or_create_customer(db, cust_name) if cust_name else None
            customer_id = customer.id if customer else None

            dup = (
                db.query(Sale)
                .filter(
                    Sale.owner_id == oid,
                    Sale.date == d,
                    Sale.product_id == product.id,
                    Sale.qty == float(qty),
                    Sale.amount == float(amount),
                )
            )
            if customer_id is None:
                dup = dup.filter(Sale.customer_id.is_(None))
            else:
                dup = dup.filter(Sale.customer_id == customer_id)
            if dup.first() is not None:
                skipped += 1
                warnings.append(f"sales row {lineno}: skipped (duplicate)")
                continue

            db.add(
                Sale(
                    date=d,
                    owner_id=oid,
                    product_id=product.id,
                    customer_id=customer_id,
                    qty=float(qty),
                    unit_price=float(unit_price),
                    amount=float(amount),
                    source="csv",
                )
            )
            inserted += 1
        except Exception as exc:  # never crash on bad rows
            skipped += 1
            warnings.append(f"sales row {idx}: skipped ({exc})")
            continue
    return inserted, skipped


def ingest_products_df(db: Session, df: pd.DataFrame, warnings: List[str]) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    oid = _ingest_oid()
    frame = normalize_frame(df, "products")
    for idx, row in frame.iterrows():
        try:
            lineno = idx + 2
            sku_raw = row.get("sku")
            name_raw = row.get("name")
            sku = None if (sku_raw is None or (isinstance(sku_raw, float) and pd.isna(sku_raw))) else str(sku_raw).strip()
            name = None if (name_raw is None or (isinstance(name_raw, float) and pd.isna(name_raw))) else str(name_raw).strip()
            if not sku and not name:
                skipped += 1
                warnings.append(f"products row {lineno}: skipped (missing sku and name)")
                continue
            sku = sku or _slug(name)
            name = name or sku
            category = str(row.get("category")).strip() if row.get("category") not in (None, "") and not (isinstance(row.get("category"), float) and pd.isna(row.get("category"))) else "Staples"
            unit = str(row.get("unit")).strip() if row.get("unit") not in (None, "") and not (isinstance(row.get("unit"), float) and pd.isna(row.get("unit"))) else "pcs"
            sale_price = parse_amount(row.get("sale_price"))
            purchase_price = parse_amount(row.get("purchase_price"))
            if sale_price is None:
                sale_price = 0.0
                warnings.append(f"products row {lineno}: sale_price missing, default 0")
            if purchase_price is None:
                purchase_price = sale_price * 0.85

            existing = db.query(Product).filter(Product.owner_id == oid, Product.sku == sku).first()
            if existing:
                existing.name = name
                existing.category = category
                existing.unit = unit
                existing.sale_price = float(sale_price)
                existing.purchase_price = float(purchase_price)
            else:
                db.add(
                    Product(
                        owner_id=oid,
                        sku=sku,
                        name=name,
                        category=category,
                        unit=unit,
                        sale_price=float(sale_price),
                        purchase_price=float(purchase_price),
                    )
                )
            inserted += 1
        except Exception as exc:
            skipped += 1
            warnings.append(f"products row {idx}: skipped ({exc})")
            continue
    return inserted, skipped


def ingest_inventory_df(db: Session, df: pd.DataFrame, warnings: List[str]) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    oid = _ingest_oid()
    frame = normalize_frame(df, "inventory")
    today = date.today()
    for idx, row in frame.iterrows():
        try:
            lineno = idx + 2
            prod_raw = row.get("product")
            prod_name = None if (prod_raw is None or (isinstance(prod_raw, float) and pd.isna(prod_raw))) else str(prod_raw).strip()
            if not prod_name:
                skipped += 1
                warnings.append(f"inventory row {lineno}: skipped (missing product)")
                continue
            stock_qty = parse_amount(row.get("stock_qty"))
            reorder_level = parse_amount(row.get("reorder_level"))
            if stock_qty is None:
                stock_qty = 0.0
                warnings.append(f"inventory row {lineno}: stock missing, default 0")
            if reorder_level is None:
                reorder_level = 0.0

            product = db.query(Product).filter(Product.owner_id == oid, Product.sku == prod_name).first()
            if product is None:
                product = db.query(Product).filter(Product.owner_id == oid, Product.name == prod_name).first()
            if product is None:
                product = get_or_create_product(db, prod_name, 0.0)

            existing = db.query(InventoryItem).filter(
                InventoryItem.owner_id == oid, InventoryItem.product_id == product.id).first()
            if existing:
                existing.stock_qty = float(stock_qty)
                existing.reorder_level = float(reorder_level)
                existing.as_of = today
            else:
                db.add(
                    InventoryItem(
                        owner_id=oid,
                        product_id=product.id,
                        stock_qty=float(stock_qty),
                        reorder_level=float(reorder_level),
                        as_of=today,
                    )
                )
            inserted += 1
        except Exception as exc:
            skipped += 1
            warnings.append(f"inventory row {idx}: skipped ({exc})")
            continue
    return inserted, skipped


def ingest_receivables_df(db: Session, df: pd.DataFrame, warnings: List[str]) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    oid = _ingest_oid()
    frame = normalize_frame(df, "receivables")
    for idx, row in frame.iterrows():
        try:
            lineno = idx + 2
            cust_raw = row.get("customer")
            inv_raw = row.get("invoice_no")
            cust_name = None if (cust_raw is None or (isinstance(cust_raw, float) and pd.isna(cust_raw))) else str(cust_raw).strip()
            invoice_no = None if (inv_raw is None or (isinstance(inv_raw, float) and pd.isna(inv_raw))) else str(inv_raw).strip()
            amount = parse_amount(row.get("amount"))
            issue_date = _coerce_date_cell(row.get("issue_date"))
            due_date = _coerce_date_cell(row.get("due_date"))
            paid = parse_paid(row.get("paid"))
            if not invoice_no or amount is None:
                skipped += 1
                warnings.append(f"receivables row {lineno}: skipped (missing invoice_no/amount)")
                continue
            if db.query(Receivable).filter(
                    Receivable.owner_id == oid, Receivable.invoice_no == invoice_no).first() is not None:
                skipped += 1
                warnings.append(f"receivables row {lineno}: skipped (duplicate {invoice_no})")
                continue
            customer = get_or_create_customer(db, cust_name or "Unknown")
            if issue_date is None:
                issue_date = date.today()
            if due_date is None:
                due_date = issue_date
            db.add(
                Receivable(
                    owner_id=oid,
                    customer_id=customer.id,
                    invoice_no=invoice_no,
                    amount=float(amount),
                    issue_date=issue_date,
                    due_date=due_date,
                    paid=bool(paid),
                    paid_date=date.today() if paid else None,
                    source="csv",
                )
            )
            inserted += 1
        except Exception as exc:
            skipped += 1
            warnings.append(f"receivables row {idx}: skipped ({exc})")
            continue
    return inserted, skipped


def ingest_expenses_df(db: Session, df: pd.DataFrame, warnings: List[str]) -> tuple[int, int]:
    inserted = 0
    skipped = 0
    oid = _ingest_oid()
    frame = normalize_frame(df, "expenses")
    for idx, row in frame.iterrows():
        try:
            lineno = idx + 2
            d = _coerce_date_cell(row.get("date"))
            cat_raw = row.get("category")
            category = "Misc" if (cat_raw is None or (isinstance(cat_raw, float) and pd.isna(cat_raw)) or not str(cat_raw).strip()) else str(cat_raw).strip()
            amount = parse_amount(row.get("amount"))
            note_raw = row.get("note")
            note = None if (note_raw is None or (isinstance(note_raw, float) and pd.isna(note_raw))) else str(note_raw).strip()
            if d is None or amount is None:
                skipped += 1
                warnings.append(f"expenses row {lineno}: skipped (missing date/amount)")
                continue
            db.add(Expense(date=d, owner_id=oid, category=category, amount=float(amount), note=note, source="csv"))
            inserted += 1
        except Exception as exc:
            skipped += 1
            warnings.append(f"expenses row {idx}: skipped ({exc})")
            continue
    return inserted, skipped


INGESTORS = {
    "sales": ingest_sales_df,
    "products": ingest_products_df,
    "inventory": ingest_inventory_df,
    "receivables": ingest_receivables_df,
    "expenses": ingest_expenses_df,
}


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def _write_log(db: Session, source_type: str, filename: str, inserted: int, skipped: int, warnings: List[str]) -> None:
    db.add(
        IngestionLog(
            owner_id=_ingest_oid(),
            source_type=source_type,
            filename=filename,
            rows_inserted=inserted,
            rows_skipped=skipped,
            warnings=json.dumps(warnings[:50]),
        )
    )


def ingest_dataframe(db: Session, df: pd.DataFrame, source_type: str, filename: str,
                     owner_id: int = 1) -> Dict[str, Any]:
    set_ingest_owner(owner_id)
    warnings: List[str] = []
    if source_type not in INGESTORS:
        warnings.append(f"unknown source_type '{source_type}'")
        _write_log(db, source_type, filename, 0, len(df), warnings)
        db.commit()
        return {"source_type": source_type, "filename": filename, "rows_inserted": 0, "rows_skipped": len(df), "warnings": warnings}
    func = INGESTORS[source_type]
    inserted, skipped = func(db, df, warnings)
    _write_log(db, source_type, filename, inserted, skipped, warnings)
    db.commit()
    return {
        "source_type": source_type,
        "filename": filename,
        "rows_inserted": inserted,
        "rows_skipped": skipped,
        "warnings": warnings,
    }


def read_upload_to_df(content: bytes, filename: str) -> pd.DataFrame:
    lower = filename.lower()
    bio = io.BytesIO(content)
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        return pd.read_excel(bio)
    # csv: try utf-8 then latin-1
    for enc in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            bio.seek(0)
            return pd.read_csv(io.BytesIO(content), encoding=enc)
        except Exception:
            continue
    bio.seek(0)
    return pd.read_csv(bio, encoding="utf-8", engine="python", on_bad_lines="skip")


def ingest_file_bytes(db: Session, content: bytes, filename: str, type_hint: Optional[str] = None,
                      owner_id: int = 1) -> Dict[str, Any]:
    """Ingest uploaded CSV/Excel bytes. type_hint overrides routing."""
    set_ingest_owner(owner_id)
    try:
        df = read_upload_to_df(content, filename)
    except Exception as exc:
        warnings = [f"could not parse file: {exc}"]
        _write_log(db, type_hint or "unknown", filename, 0, 0, warnings)
        db.commit()
        return {"source_type": type_hint or "unknown", "filename": filename, "rows_inserted": 0, "rows_skipped": 0, "warnings": warnings}
    columns = [str(c) for c in df.columns]
    source_type = (type_hint or "").strip().lower() or route_type(filename, columns) or "sales"
    if source_type == "tally":
        source_type = route_type(filename, columns) or infer_type_from_headers(columns) or "sales"
        if source_type == "tally":
            source_type = "sales"
    return ingest_dataframe(db, df, source_type, filename, owner_id=owner_id)


def ingest_file_path(db: Session, path: Path, type_hint: Optional[str] = None,
                     owner_id: int = 1) -> Dict[str, Any]:
    content = path.read_bytes()
    return ingest_file_bytes(db, content, path.name, type_hint, owner_id=owner_id)


# ---------------------------------------------------------------------------
# Tally XML parser
# ---------------------------------------------------------------------------

def _tally_text(elem: Optional[ET.Element]) -> str:
    if elem is None or elem.text is None:
        return ""
    return elem.text.strip()


def _parse_tally_date(raw: str) -> Optional[date]:
    s = raw.strip()
    if not s:
        return None
    # format YYYYMMDD
    if re.fullmatch(r"\d{8}", s):
        try:
            return date(int(s[0:4]), int(s[4:6]), int(s[6:8]))
        except ValueError:
            return None
    return parse_date(s)


def _parse_tally_qty(raw: str) -> float:
    s = raw.strip()
    if not s:
        return 0.0
    # strip trailing unit words: "10 pcs", "5.0 Kgs", "2 Nos"
    m = re.match(r"^\(?([0-9,]*\.?[0-9]+)", s)
    if not m:
        # parenthesised negative?
        if s.startswith("(") and s.endswith(")"):
            inner = _parse_tally_qty(s[1:-1])
            return -abs(inner)
        return 0.0
    try:
        val = float(m.group(1).replace(",", ""))
    except ValueError:
        return 0.0
    if s.startswith("(") and s.endswith(")"):
        val = -abs(val)
    return val


def ingest_tally_xml(db: Session, xml_bytes: bytes, filename: str, owner_id: int = 1) -> Dict[str, Any]:
    warnings: List[str] = []
    inserted = 0
    skipped = 0
    oid = _ingest_oid(owner_id)
    set_ingest_owner(oid)
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        warnings.append(f"xml parse error: {exc}")
        _write_log(db, "tally", filename, 0, 0, warnings)
        db.commit()
        return {"source_type": "tally", "filename": filename, "rows_inserted": 0, "rows_skipped": 0, "warnings": warnings}

    messages = root.findall(".//TALLYMESSAGE")
    if not messages:
        # maybe root itself is a voucher/message
        messages = [root]

    for msg in messages:
        try:
            voucher = msg.find("VOUCHER")
            if voucher is None:
                if msg.tag == "VOUCHER":
                    voucher = msg
                else:
                    continue
            vtype = (voucher.get("VOUCHERTYPENAME") or voucher.get("VCHTYPE") or "").strip()
            vtype_low = vtype.lower()
            date_raw = voucher.get("DATE") or _tally_text(voucher.find("DATE"))
            vdate = _parse_tally_date(date_raw) if date_raw else None
            if vdate is None:
                vdate = date.today()
                warnings.append(f"tally voucher '{vtype}': DATE missing/invalid, used today")
            party = _tally_text(voucher.find("PARTYLEDGERNAME")) or _tally_text(voucher.find("PARTYNAME")) or "Unknown"

            # sum of AMOUNT ledger entries (abs)
            total = 0.0
            for le in voucher.findall(".//LEDGERENTRIES.LIST/AMOUNT") + voucher.findall(".//AMOUNT"):
                try:
                    total += abs(float(_tally_text(le).replace(",", "") or 0))
                except ValueError:
                    continue

            # stock items
            items = []
            for inv in voucher.findall(".//INVENTORYENTRIES.LIST") + voucher.findall(".//STOCKITEMS"):
                nm = _tally_text(inv.find("STOCKITEMNAME"))
                qty_raw = _tally_text(inv.find("BILLEDQTY")) or _tally_text(inv.find("ACTUALQTY")) or "1"
                rate_raw = _tally_text(inv.find("RATE")).replace(",", "") or "0"
                try:
                    rate = float(rate_raw.split("/")[0].strip() or 0)
                except ValueError:
                    rate = 0.0
                qty = _parse_tally_qty(qty_raw)
                if nm:
                    items.append((nm, qty, rate))

            if "sales" in vtype_low:
                customer = get_or_create_customer(db, party)
                cid = customer.id if customer else None
                if not items:
                    # voucher-level sale row
                    prod = get_or_create_product(db, party or "Tally Sale", total or 0.0)
                    amt = total
                    dup = db.query(Sale).filter(
                        Sale.owner_id == oid,
                        Sale.date == vdate, Sale.product_id == prod.id,
                        Sale.qty == 1.0, Sale.amount == amt,
                    )
                    dup = dup.filter(Sale.customer_id.is_(None) if cid is None else Sale.customer_id == cid)
                    if dup.first() is None:
                        db.add(Sale(date=vdate, owner_id=oid, product_id=prod.id, customer_id=cid, qty=1.0, unit_price=amt, amount=amt, source="tally"))
                        inserted += 1
                    else:
                        skipped += 1
                else:
                    for nm, qty, rate in items:
                        if not qty:
                            skipped += 1
                            continue
                        prod = get_or_create_product(db, nm, rate)
                        amt = qty * rate if rate else total / max(len(items), 1)
                        dup = db.query(Sale).filter(
                            Sale.owner_id == oid,
                            Sale.date == vdate, Sale.product_id == prod.id,
                            Sale.qty == float(qty), Sale.amount == float(amt),
                        )
                        dup = dup.filter(Sale.customer_id.is_(None) if cid is None else Sale.customer_id == cid)
                        if dup.first() is not None:
                            skipped += 1
                            continue
                        db.add(Sale(date=vdate, owner_id=oid, product_id=prod.id, customer_id=cid, qty=float(qty), unit_price=float(rate), amount=float(amt), source="tally"))
                        inserted += 1
            elif "purchase" in vtype_low:
                amt = abs(total)
                db.add(Expense(date=vdate, owner_id=oid, category="Purchases", amount=float(amt), note=f"Tally purchase {party}", source="tally"))
                inserted += 1
            else:
                skipped += 1
                warnings.append(f"tally voucher type '{vtype or 'unknown'}' skipped")
        except Exception as exc:
            skipped += 1
            warnings.append(f"tally message skipped ({exc})")
            continue

    _write_log(db, "tally", filename, inserted, skipped, warnings)
    db.commit()
    return {"source_type": "tally", "filename": filename, "rows_inserted": inserted, "rows_skipped": skipped, "warnings": warnings}


# ---------------------------------------------------------------------------
# Preview (NO commit) + commit split — powers the onboarding wizard.
# Existing callers keep working: commit_ingest == legacy ingest_file_bytes path.
# ---------------------------------------------------------------------------

def _preview_cell(value: Any) -> Optional[str]:
    try:
        if value is None:
            return None
        if isinstance(value, float) and pd.isna(value):
            return None
        s = str(value).strip()
        return s or None
    except Exception:
        return None


def _json_safe(value: Any) -> Any:
    try:
        if value is None:
            return None
        if isinstance(value, float) and pd.isna(value):
            return None
        if hasattr(value, "isoformat"):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        if isinstance(value, (int, float, str, bool)):
            return value
        return str(value)
    except Exception:
        return None


def _preview_validate(source_type: str, row) -> Optional[str]:
    """One normalized row -> None if committable, else short reason. Never raises."""
    try:
        get = row.get
        if source_type == "sales":
            if _coerce_date_cell(get("date")) is None:
                return "missing/invalid date"
            if not _preview_cell(get("product")):
                return "missing product"
            if parse_amount(get("qty")) is None:
                return "missing/invalid qty"
            if parse_amount(get("unit_price")) is None and parse_amount(get("amount")) is None:
                return "missing price and amount"
            return None
        if source_type == "products":
            if not _preview_cell(get("sku")) and not _preview_cell(get("name")):
                return "missing sku and name"
            return None
        if source_type == "inventory":
            if not _preview_cell(get("product")):
                return "missing product"
            return None
        if source_type == "receivables":
            if not _preview_cell(get("invoice_no")):
                return "missing invoice_no"
            if parse_amount(get("amount")) is None:
                return "missing/invalid amount"
            return None
        if source_type == "expenses":
            if _coerce_date_cell(get("date")) is None:
                return "missing/invalid date"
            if parse_amount(get("amount")) is None:
                return "missing/invalid amount"
            return None
        return f"unknown type '{source_type}'"
    except Exception as exc:
        return f"row error: {exc}"[:150]


def preview_ingest(content: bytes, filename: str, type_hint: Optional[str] = None,
                   owner_id: int = 1) -> Dict[str, Any]:
    """Validate + preview WITHOUT touching the DB (no commit, no logs).

    Returns {type, columns_detected, mapped_fields, rows_total, rows_ok,
             errors:[{row_no, reason}] (max 50), preview:[first 10 rows]}.
    Never raises.
    """
    try:
        set_ingest_owner(owner_id)
        fname = filename or "upload.csv"
        try:
            df = read_upload_to_df(bytes(content or b""), fname)
        except Exception as exc:
            return {
                "type": (type_hint or "").strip().lower() or "unknown",
                "columns_detected": [], "mapped_fields": [],
                "rows_total": 0, "rows_ok": 0,
                "errors": [{"row_no": 0, "reason": f"could not parse file: {exc}"[:200]}],
                "preview": [],
            }
        columns = [str(c) for c in df.columns]
        stype = (
            (type_hint or "").strip().lower()
            or route_type(fname, columns)
            or infer_type_from_headers(columns)
            or "unknown"
        )
        frame = normalize_frame(df, stype) if stype in ALIAS_MAPS else df
        mapped = [str(c) for c in frame.columns]
        errors: List[Dict[str, Any]] = []
        preview: List[Dict[str, Any]] = []
        ok = 0
        try:
            total = int(len(frame))
        except Exception:
            total = 0
        for idx, row in frame.iterrows():
            try:
                lineno = int(idx) + 2 if isinstance(idx, int) else len(preview) + len(errors) + 2
            except Exception:
                lineno = 0
            reason = _preview_validate(stype, row)
            if reason is None:
                ok += 1
                if len(preview) < 10:
                    try:
                        preview.append({str(k): _json_safe(v) for k, v in dict(row).items()})
                    except Exception:
                        pass
            else:
                if len(errors) < 50:
                    errors.append({"row_no": lineno, "reason": reason})
        return {
            "type": stype,
            "columns_detected": columns,
            "mapped_fields": mapped,
            "rows_total": total,
            "rows_ok": ok,
            "errors": errors,
            "preview": preview,
        }
    except Exception as exc:
        return {
            "type": (type_hint or "").strip().lower() or "unknown",
            "columns_detected": [], "mapped_fields": [],
            "rows_total": 0, "rows_ok": 0,
            "errors": [{"row_no": 0, "reason": str(exc)[:200]}],
            "preview": [],
        }


def commit_ingest(db: Session, content: bytes, filename: str, type_hint: Optional[str] = None,
                  owner_id: int = 1) -> Dict[str, Any]:
    """Committed ingest (IngestionLog + rows). Same behavior as legacy uploads."""
    return ingest_file_bytes(db, content, filename, type_hint, owner_id)


# ---------------------------------------------------------------------------
# Canonical CSV templates (wizard downloads)
# ---------------------------------------------------------------------------

TEMPLATES: Dict[str, tuple] = {
    "sales": (
        ["date", "product", "qty", "unit_price", "amount", "customer"],
        [
            ["2026-09-20", "Sugar 1kg", "10", "48", "480", "Ramesh Verma"],
            ["2026-09-21", "Tata Salt 1kg", "5", "30", "150", "Sunita Devi"],
        ],
    ),
    "inventory": (
        ["product", "stock_qty", "reorder_level"],
        [
            ["Sugar 1kg", "40", "20"],
            ["Tata Salt 1kg", "25", "15"],
        ],
    ),
    "receivables": (
        ["customer", "invoice_no", "amount", "issue_date", "due_date", "paid"],
        [
            ["Ramesh Verma", "INV-2001", "2500", "2026-09-01", "2026-09-16", "no"],
            ["Sunita Devi", "INV-2002", "1200", "2026-09-05", "2026-09-20", "no"],
        ],
    ),
    "expenses": (
        ["date", "category", "amount", "note"],
        [
            ["2026-09-20", "Rent", "15000", "Shop rent"],
            ["2026-09-21", "Misc", "350", "Daily misc"],
        ],
    ),
    "products": (
        ["sku", "name", "category", "unit", "sale_price", "purchase_price"],
        [
            ["ST-SUGAR-1KG", "Sugar 1kg", "Staples", "pcs", "48", "44"],
            ["ST-SALT-1KG", "Tata Salt 1kg", "Staples", "pcs", "30", "27"],
        ],
    ),
}


def template_csv(source_type: str) -> Optional[str]:
    """Canonical headers + 2 example rows. None on unknown type. Never raises."""
    try:
        key = str(source_type or "").strip().lower()
        spec = TEMPLATES.get(key)
        if not spec:
            return None
        headers, rows = spec
        import csv as _csv
        import io as _io

        buf = _io.StringIO()
        w = _csv.writer(buf)
        w.writerow(headers)
        w.writerows(rows)
        return buf.getvalue()
    except Exception:
        return None
