"""Seed story-locked demo data for Sharma Kirana Traders.

Re-runnable: wipes all tables first. random.seed(7).
Run:  python seed_demo_data.py   (from backend/)
"""

import random
from datetime import date, timedelta
from typing import Dict

from app.db import Base, SessionLocal, engine, ensure_access_schema, ensure_p4_schema, ensure_p15_schema, ensure_prod_schema
from app.models import (
    Action,
    ChatMessage,
    Customer,
    DocumentLog,
    Expense,
    IngestionLog,
    InventoryItem,
    Product,
    Receivable,
    Sale,
)

BUSINESS_NAME = "Sharma Kirana Traders"

# sku, name, category, sale_price, base_daily_qty
PRODUCTS = [
    # Staples - margin ~8%
    ("ST-ATTA-5KG", "Aashirvaad Atta 5kg", "Staples", 285.0, 14),
    ("ST-RICE-5KG", "India Gate Rice 5kg", "Staples", 420.0, 9),
    ("ST-SUGAR-1KG", "Sugar 1kg", "Staples", 48.0, 20),
    ("ST-DAL-1KG", "Toor Dal 1kg", "Staples", 165.0, 11),
    ("ST-OIL-1L", "Fortune Oil 1L", "Staples", 155.0, 12),
    ("ST-SALT-1KG", "Tata Salt 1kg", "Staples", 30.0, 18),
    # Personal Care - margin ~25%
    ("PC-SOAP", "Lux Soap 150g", "Personal Care", 45.0, 10),
    ("PC-SHAMPOO", "Clinic Shampoo 340ml", "Personal Care", 199.0, 5),
    ("PC-PASTE", "Colgate 150g", "Personal Care", 110.0, 7),
    ("PC-DETERGENT", "Surf Excel 1kg", "Personal Care", 135.0, 6),
    ("PC-CREAM", "Fair Cream 50g", "Personal Care", 85.0, 5),
    # Beverages - margin ~15%
    ("BV-TEA-500", "Tata Tea 500g", "Beverages", 285.0, 8),
    ("BV-COFFEE-200", "Bru Coffee 200g", "Beverages", 310.0, 4),
    ("BV-COLD-750", "Coke 750ml", "Beverages", 40.0, 16),
    ("BV-JUICE-1L", "Real Juice 1L", "Beverages", 130.0, 6),
    # Snacks - margin ~18%
    ("SN-BISC-300", "Parle Biscuits 300g", "Snacks", 35.0, 18),
    ("SN-CHIPS-150", "Lays Chips 150g", "Snacks", 50.0, 12),
    ("SN-NAMKEEN-400", "Haldiram Namkeen 400g", "Snacks", 95.0, 7),
]

MARGIN = {"Staples": 0.08, "Personal Care": 0.25, "Beverages": 0.15, "Snacks": 0.18}

CUSTOMERS = [
    ("Ramesh Verma", "9123456780"),
    ("Sunita Devi", "9234567891"),
    ("Imran Sheikh", "9345678902"),
    ("Amit Patel", "9456789013"),
    ("Priya Sharma", "9567890124"),
    ("Rohit Gupta", "9678901235"),
    ("Kavita Singh", "9789012346"),
    ("Mohan Lal", "9890123457"),
]

# 5 SKUs just below reorder; 2 dead SKUs (stock ~40, zero sales last 45 days)
LOW_STOCK_SKUS = ["ST-ATTA-5KG", "ST-RICE-5KG", "ST-SUGAR-1KG", "PC-SOAP", "BV-TEA-500"]
DEAD_SKUS = ["BV-JUICE-1L", "SN-NAMKEEN-400"]


def wipe(db) -> None:
    for m in (Sale, InventoryItem, Receivable, Expense, Action, DocumentLog, ChatMessage, IngestionLog):
        db.query(m).delete()
    for m in (Product, Customer):
        db.query(m).delete()
    db.commit()


def ensure_bootstrap_owners(db) -> None:
    """Fresh PG (or wiped DB) needs at least the admin owner or nobody can log in
    (OTP requires an allowed profile; /data/reset is admin-guarded). Owner 2 is the
    long-standing P6 fixture (919812345678). Get-or-create only — never overwrites.
    """
    from app.models import OwnerProfile

    for oid, phone, name, biz, allowed, onboarded in [
        (1, "919834854511", "Admin", BUSINESS_NAME, True, True),
        (2, "919812345678", "Test Owner 2", None, False, False),
    ]:
        try:
            prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
            if prof is None:
                prof = db.query(OwnerProfile).filter(OwnerProfile.phone == phone).first()
            if prof is None:
                prof = OwnerProfile(
                    id=oid, phone=phone, name=name, business_name=biz,
                    language="hi", allowed=allowed, onboarded=onboarded,
                )
                if oid == 1:
                    prof.upi_vpa = "sharmatraders@okicici"
                db.add(prof)
                db.flush()
            elif oid == 1 and not (getattr(prof, "upi_vpa", "") or "").strip():
                # backfill UPI VPA on existing owner 1 (never overwrites)
                prof.upi_vpa = "sharmatraders@okicici"
                db.flush()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
    try:
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    # explicit ids on PG would desync the serial sequence — reset it to max(id)
    try:
        if not str(engine.url).startswith("sqlite"):
            from sqlalchemy import text as _text
            db.execute(_text(
                "SELECT setval('owner_profiles_id_seq', "
                "(SELECT COALESCE(MAX(id), 1) FROM owner_profiles))"))
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def run_seed() -> Dict[str, int]:
    random.seed(7)
    # Fresh PG instances need schema first (sqlite path is a no-op for create_all).
    Base.metadata.create_all(bind=engine)
    ensure_p4_schema()
    ensure_access_schema()
    ensure_p15_schema()
    ensure_prod_schema()
    db = SessionLocal()
    try:
        wipe(db)
        ensure_bootstrap_owners(db)
        today = date.today()
        start = today - timedelta(days=89)  # 90 days ending today

        # --- products ---
        prod_by_sku: Dict[str, Product] = {}
        for sku, name, cat, sale_price, _base in PRODUCTS:
            purchase = round(sale_price / (1 + MARGIN[cat]), 2)
            p = Product(sku=sku, name=name, category=cat, unit="pcs",
                        sale_price=sale_price, purchase_price=purchase)
            db.add(p)
            db.flush()
            prod_by_sku[sku] = p

        # --- customers ---
        cust_by_name: Dict[str, Customer] = {}
        for nm, ph in CUSTOMERS:
            c = Customer(name=nm, phone=ph)
            db.add(c)
            db.flush()
            cust_by_name[nm] = c
        cust_list = list(cust_by_name.values())

        base_qty = {sku: b for sku, _n, _c, _s, b in PRODUCTS}

        # --- 90 days of sales ---
        cogs_per_day: Dict[date, float] = {}
        sales_rows = 0
        for offset in range(89, -1, -1):
            d = today - timedelta(days=offset)
            wd = d.weekday()  # Mon=0..Sun=6
            if wd == 6:
                wfactor = 1.5  # Sunday peak
            elif wd == 5:
                wfactor = 1.2
            else:
                wfactor = 1.0
            for sku, name, cat, sale_price, _b in PRODUCTS:
                if sku in DEAD_SKUS and offset < 45:
                    continue  # dead stock: zero sales last 45 days
                noise = random.uniform(0.8, 1.2)
                story = 1.0
                if offset < 30:  # last 30 days story
                    if cat == "Personal Care":
                        story = 0.70  # down 30%
                    elif cat == "Staples":
                        story = 1.12  # up 12%
                qty = int(round(base_qty[sku] * wfactor * noise * story))
                if qty < 1:
                    qty = 1
                cust = random.choice(cust_list)
                amount = round(qty * sale_price, 2)
                db.add(Sale(date=d, product_id=prod_by_sku[sku].id,
                            customer_id=cust.id, qty=float(qty),
                            unit_price=sale_price, amount=amount, source="seed"))
                sales_rows += 1
                cogs_per_day[d] = cogs_per_day.get(d, 0.0) + qty * prod_by_sku[sku].purchase_price

        # --- inventory ---
        for sku, _n, _c, _s, _b in PRODUCTS:
            pid = prod_by_sku[sku].id
            if sku in LOW_STOCK_SKUS:
                reorder = 20.0
                stock = reorder - random.choice([2.0, 3.0])
            elif sku in DEAD_SKUS:
                reorder = 15.0
                stock = 40.0
            else:
                reorder = float(random.randint(12, 22))
                stock = float(random.randint(25, 60))
            db.add(InventoryItem(product_id=pid, stock_qty=stock, reorder_level=reorder, as_of=today))

        # --- receivables: 7 paid + exactly 3 unpaid overdue ---
        paid_invoices = [
            ("INV-1031", "Amit Patel", 6500.0, 60),
            ("INV-1033", "Priya Sharma", 4200.0, 55),
            ("INV-1035", "Rohit Gupta", 9800.0, 50),
            ("INV-1036", "Kavita Singh", 3100.0, 44),
            ("INV-1038", "Mohan Lal", 7600.0, 38),
            ("INV-1040", "Amit Patel", 5200.0, 30),
            ("INV-1041", "Priya Sharma", 8900.0, 22),
        ]
        for inv, cnm, amt, days_ago in paid_invoices:
            issue = today - timedelta(days=days_ago)
            due = issue + timedelta(days=15)
            db.add(Receivable(customer_id=cust_by_name[cnm].id, invoice_no=inv,
                              amount=amt, issue_date=issue, due_date=due,
                              paid=True, paid_date=min(due, today), source="seed"))

        overdue_locked = [
            ("Ramesh Verma", "INV-1042", 8500.0, 6),
            ("Imran Sheikh", "INV-1044", 12400.0, 11),
            ("Sunita Devi", "INV-1047", 32500.0, 3),
        ]
        for cnm, inv, amt, due_ago in overdue_locked:
            due = today - timedelta(days=due_ago)
            issue = due - timedelta(days=15)
            db.add(Receivable(customer_id=cust_by_name[cnm].id, invoice_no=inv,
                              amount=amt, issue_date=issue, due_date=due,
                              paid=False, paid_date=None, source="seed"))

        # --- expenses ---
        # rent + salaries on the 1st of each month in window
        seen_months = set()
        d = start
        while d <= today:
            seen_months.add((d.year, d.month))
            d += timedelta(days=1)
        for y, m in sorted(seen_months):
            first = date(y, m, 1)
            if start <= first <= today:
                db.add(Expense(date=first, category="Rent", amount=15000.0, note="Shop rent", source="seed"))
                db.add(Expense(date=first, category="Salaries", amount=22000.0, note="Staff salaries", source="seed"))
        # daily misc + daily purchases (= COGS, last 30d x1.12)
        for offset in range(89, -1, -1):
            d = today - timedelta(days=offset)
            misc = float(random.randint(100, 500))
            db.add(Expense(date=d, category="Misc", amount=misc, note="Daily misc", source="seed"))
            cogs = cogs_per_day.get(d, 0.0)
            mult = 1.12 if offset < 30 else 1.0
            db.add(Expense(date=d, category="Purchases", amount=round(cogs * mult, 2),
                           note="Stock purchases", source="seed"))

        db.commit()

        counts = {
            "products": db.query(Product).count(),
            "customers": db.query(Customer).count(),
            "sales": db.query(Sale).count(),
            "inventory": db.query(InventoryItem).count(),
            "receivables": db.query(Receivable).count(),
            "expenses": db.query(Expense).count(),
        }
        return counts
    finally:
        db.close()


def print_summary() -> None:
    counts = run_seed()
    db = SessionLocal()
    try:
        today = date.today()
        this_m = db.query(Sale).filter(Sale.date >= today.replace(day=1)).all()
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        first_prev = last_prev.replace(day=1)
        prev_m = db.query(Sale).filter(Sale.date >= first_prev, Sale.date <= last_prev).all()
        rev_this = round(sum(s.amount for s in this_m), 2)
        rev_prev = round(sum(s.amount for s in prev_m), 2)
        overdue = db.query(Receivable).filter(Receivable.paid.is_(False)).all()
        overdue_total = round(sum(r.amount for r in overdue), 2)
        print(f"Business: {BUSINESS_NAME}")
        print(f"Products: {counts['products']}")
        print(f"Total sales rows: {counts['sales']}")
        print(f"Revenue this month: Rs.{rev_this} | last month: Rs.{rev_prev}")
        print(f"Overdue total: Rs.{overdue_total} ({len(overdue)} unpaid)")
        print(f"Counts: {counts}")
    finally:
        db.close()


if __name__ == "__main__":
    print_summary()
