from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from app.config import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    poolclass=StaticPool if settings.database_url.startswith("sqlite") else None,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_access_schema() -> None:
    """Phase A access-control migration. Idempotent, sqlite+PG safe, never raises.

    - create_all for new columns on fresh DBs
    - ADD COLUMN owner_id (default 1) on business tables; existing rows -> owner 1
    - ADD access columns on owner_profiles
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from sqlalchemy import text as _text

        is_sqlite = str(engine.url).startswith("sqlite")
        biz_tables = [
            "products", "customers", "sales", "inventory", "receivables",
            "expenses", "actions", "document_logs", "ingestion_logs",
            "processed_files",
        ]
        prof_cols = {
            "allowed": "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE",
            "onboarded": "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE",
            "distributor_phone": "VARCHAR(32)",
            "reg_step": "VARCHAR(16)",
            "otp_code": "VARCHAR(16)",
            "otp_expires_at": "TIMESTAMP",
            "otp_attempts": "INTEGER DEFAULT 0",
            "upi_vpa": "VARCHAR(64)",
        }
        with engine.connect() as conn:
            if is_sqlite:
                try:
                    existing = {
                        t[0] for t in
                        conn.execute(_text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
                    }
                except Exception:
                    existing = set()

                def _cols(table: str) -> set:
                    try:
                        rows = conn.execute(_text(f"PRAGMA table_info({table})")).fetchall()
                        return {r[1] for r in rows} if rows else set()
                    except Exception:
                        return set()

                for tbl in biz_tables:
                    if tbl not in existing:
                        continue
                    if "owner_id" not in _cols(tbl):
                        try:
                            conn.execute(_text(f"ALTER TABLE {tbl} ADD COLUMN owner_id INTEGER DEFAULT 1"))
                            conn.commit()
                        except Exception:
                            pass
                    try:
                        conn.execute(_text(f"UPDATE {tbl} SET owner_id=1 WHERE owner_id IS NULL"))
                        conn.commit()
                    except Exception:
                        pass
                if "owner_profiles" in existing:
                    have = _cols("owner_profiles")
                    for col, ddl in prof_cols.items():
                        if col not in have:
                            try:
                                conn.execute(_text(f"ALTER TABLE owner_profiles ADD COLUMN {col} {ddl}"))
                                conn.commit()
                            except Exception:
                                pass
                    try:
                        conn.execute(_text(
                            "UPDATE owner_profiles SET allowed=0 WHERE allowed IS NULL"))
                        conn.execute(_text(
                            "UPDATE owner_profiles SET onboarded=0 WHERE onboarded IS NULL"))
                        conn.execute(_text(
                            "UPDATE owner_profiles SET otp_attempts=0 WHERE otp_attempts IS NULL"))
                        conn.commit()
                    except Exception:
                        pass
            else:
                # Postgres: ADD COLUMN IF NOT EXISTS + backfill
                for tbl in biz_tables:
                    try:
                        conn.execute(_text(
                            f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS owner_id INTEGER DEFAULT 1"))
                        conn.execute(_text(
                            f"UPDATE {tbl} SET owner_id=1 WHERE owner_id IS NULL"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
                for col, ddl in {
                    "allowed": "BOOLEAN DEFAULT FALSE",
                    "onboarded": "BOOLEAN DEFAULT FALSE",
                    "distributor_phone": "VARCHAR(32)",
                    "reg_step": "VARCHAR(16)",
                    "otp_code": "VARCHAR(16)",
                    "otp_expires_at": "TIMESTAMP",
                    "otp_attempts": "INTEGER DEFAULT 0",
                    "upi_vpa": "VARCHAR(64)",
                }.items():
                    try:
                        conn.execute(_text(
                            f"ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS {col} {ddl}"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
    except Exception:
        pass


def ensure_p4_schema() -> None:
    """Create P4 tables and backfill new nullable columns on old DB files.

    Safe to call repeatedly; never raises to caller.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from sqlalchemy import text as _text

        with engine.connect() as conn:
            try:
                rows = conn.execute(_text("PRAGMA table_info(document_logs)")).fetchall()
                cols = {r[1] for r in rows} if rows else set()
            except Exception:
                cols = set()
            if rows is not None and "phone" not in cols:
                try:
                    conn.execute(_text("ALTER TABLE document_logs ADD COLUMN phone VARCHAR(32)"))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass


def ensure_p15_schema() -> None:
    """P15: owner_profiles.business_type + distributors (JSON array of phones).
    One-shot P1: + nudge_sent_at (one-time morning nudge stamp).

    Additive + non-destructive, idempotent, sqlite+PG safe, never raises.
    Backfill: distributors from existing distributor_phone; distributor_phone
    mirrored to distributors[0] (both always exposed).
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from sqlalchemy import text as _text

        is_sqlite = str(engine.url).startswith("sqlite")
        prof_cols = {
            "business_type": "VARCHAR(32)",
            "distributors": "TEXT",
            "nudge_sent_at": "TIMESTAMP",
            "blocked": "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE",
        }
        with engine.connect() as conn:
            if is_sqlite:
                try:
                    rows = conn.execute(_text("PRAGMA table_info(owner_profiles)")).fetchall()
                    have = {r[1] for r in rows} if rows else set()
                except Exception:
                    have = set()
                for col, ddl in prof_cols.items():
                    if col not in have:
                        try:
                            conn.execute(_text(f"ALTER TABLE owner_profiles ADD COLUMN {col} {ddl}"))
                            conn.commit()
                        except Exception:
                            pass
            else:
                for col, ddl in prof_cols.items():
                    try:
                        conn.execute(_text(
                            f"ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS {col} {ddl}"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
        # Backfill distributors <- distributor_phone (one-time, non-destructive)
        try:
            from app.models import OwnerProfile

            db = SessionLocal()
            try:
                rows = db.query(OwnerProfile).all()
                changed = False
                for prof in rows:
                    try:
                        existing = getattr(prof, "distributors", None)
                        arr = []
                        if existing:
                            try:
                                import json as _json

                                parsed = _json.loads(existing)
                                if isinstance(parsed, list):
                                    arr = [str(x) for x in parsed]
                            except Exception:
                                arr = []
                        dphone = str(getattr(prof, "distributor_phone", "") or "").strip()
                        if dphone and dphone not in arr:
                            arr.insert(0, dphone)
                        if arr:
                            import json as _json

                            prof.distributors = _json.dumps(arr)
                            if not dphone:
                                prof.distributor_phone = arr[0]
                            changed = True
                    except Exception:
                        continue
                if changed:
                    db.commit()
            finally:
                try:
                    db.close()
                except Exception:
                    pass
        except Exception:
            pass
    except Exception:
        pass


def ensure_contacts_schema() -> None:
    """One-shot P2: contacts table + backfill from products.supplier_phone
    (kind=supplier) and customers (kind=customer), deduped by (owner_id, phone).

    Additive + non-destructive, idempotent, sqlite+PG safe, never raises.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from app.models import Contact, Customer, Product

        db = SessionLocal()
        try:
            seen: set = set()
            try:
                for c in db.query(Contact).all():
                    try:
                        seen.add((int(getattr(c, "owner_id", 1) or 1),
                                  str(getattr(c, "phone", "") or "")))
                    except Exception:
                        continue
            except Exception:
                pass
            changed = False
            try:
                prods = db.query(Product).all()
            except Exception:
                prods = []
            for p in prods:
                try:
                    oid = int(getattr(p, "owner_id", 1) or 1)
                    ph = "".join(ch for ch in str(getattr(p, "supplier_phone", "") or "") if ch.isdigit())
                    if not ph or (oid, ph) in seen:
                        continue
                    db.add(Contact(owner_id=oid, kind="supplier",
                                   name=str(getattr(p, "name", "") or "") or "Supplier",
                                   phone=ph, note=f"from product {getattr(p, 'sku', '') or ''}"))
                    seen.add((oid, ph))
                    changed = True
                except Exception:
                    continue
            try:
                custs = db.query(Customer).all()
            except Exception:
                custs = []
            for cu in custs:
                try:
                    oid = int(getattr(cu, "owner_id", 1) or 1)
                    ph = "".join(ch for ch in str(getattr(cu, "phone", "") or "") if ch.isdigit())
                    if not ph or (oid, ph) in seen:
                        continue
                    db.add(Contact(owner_id=oid, kind="customer",
                                   name=str(getattr(cu, "name", "") or "") or "Customer",
                                   phone=ph))
                    seen.add((oid, ph))
                    changed = True
                except Exception:
                    continue
            if changed:
                db.commit()
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception:
        pass


def ensure_chat_thread_schema() -> None:
    """One-shot P3: chat_messages.owner_id + source; backfill owner_id by
    phone match where possible (unmatched/'web' rows stay owner 1).

    Additive + non-destructive, idempotent, sqlite+PG safe, never raises.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from sqlalchemy import text as _text

        is_sqlite = str(engine.url).startswith("sqlite")
        cols = {"owner_id": "INTEGER DEFAULT 1", "source": "VARCHAR(8) DEFAULT 'web'"}
        with engine.connect() as conn:
            if is_sqlite:
                try:
                    rows = conn.execute(_text("PRAGMA table_info(chat_messages)")).fetchall()
                    have = {r[1] for r in rows} if rows else set()
                except Exception:
                    have = set()
                for col, ddl in cols.items():
                    if col not in have:
                        try:
                            conn.execute(_text(f"ALTER TABLE chat_messages ADD COLUMN {col} {ddl}"))
                            conn.commit()
                        except Exception:
                            pass
            else:
                ddls = {"owner_id": "INTEGER DEFAULT 1", "source": "VARCHAR(8) DEFAULT 'web'"}
                for col, ddl in ddls.items():
                    try:
                        conn.execute(_text(
                            f"ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS {col} {ddl}"))
                        conn.commit()
                    except Exception:
                        try:
                            conn.rollback()
                        except Exception:
                            pass
        try:
            from app.models import ChatMessage, OwnerProfile

            db = SessionLocal()
            try:
                pmap = {}
                try:
                    for p in db.query(OwnerProfile).all():
                        try:
                            pmap[str(getattr(p, "phone", "") or "")] = int(getattr(p, "id", 1) or 1)
                        except Exception:
                            continue
                except Exception:
                    pass
                if pmap:
                    rows = db.query(ChatMessage).filter(
                        (ChatMessage.owner_id.is_(None)) | (ChatMessage.owner_id == 1)).all()
                    changed = False
                    for m in rows:
                        try:
                            sp = "".join(ch for ch in str(getattr(m, "session_phone", "") or "") if ch.isdigit())
                            hit = None
                            for ph, oid in pmap.items():
                                if sp and (sp == ph or sp.endswith(ph) or ph.endswith(sp)):
                                    hit = oid
                                    break
                            if hit and int(getattr(m, "owner_id", 1) or 1) != hit:
                                m.owner_id = hit
                                changed = True
                        except Exception:
                            continue
                    if changed:
                        db.commit()
            finally:
                try:
                    db.close()
                except Exception:
                    pass
        except Exception:
            pass
    except Exception:
        pass


def ensure_connectors_schema() -> None:
    """Connect-hub: connectors.api_key (Zapier/Make/custom API auth).

    Additive + non-destructive, idempotent, sqlite+PG safe, never raises.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        from sqlalchemy import text as _text

        is_sqlite = str(engine.url).startswith("sqlite")
        with engine.connect() as conn:
            if is_sqlite:
                try:
                    rows = conn.execute(_text("PRAGMA table_info(connectors)")).fetchall()
                    have = {r[1] for r in rows} if rows else set()
                except Exception:
                    have = set()
                if "connectors" in {
                    t[0] for t in
                    conn.execute(_text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
                } and "api_key" not in have:
                    try:
                        conn.execute(_text("ALTER TABLE connectors ADD COLUMN api_key VARCHAR(64)"))
                        conn.commit()
                    except Exception:
                        pass
            else:
                try:
                    conn.execute(_text(
                        "ALTER TABLE connectors ADD COLUMN IF NOT EXISTS api_key VARCHAR(64)"))
                    conn.commit()
                except Exception:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
    except Exception:
        pass


def ensure_prod_schema() -> None:
    """Production indexes for Postgres (idempotent, PG-only, never raises).

    Hot-path composite indexes (IF NOT EXISTS). NOTE: anon/authenticated GRANTS
    are intentionally left open (owner decision 2026-09-24): Supabase Realtime
    postgres_changes shares the anon grant switch with PostgREST, so locking
    grants kills the live UI. Demo-grade = open; production path = RLS policies
    or backend-published broadcast (see README Production notes).
    """
    try:
        from urllib.parse import urlparse

        if urlparse(str(engine.url)).scheme == "sqlite":
            return
        from sqlalchemy import text as _text

        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_sales_owner_date ON sales (owner_id, date)",
            "CREATE INDEX IF NOT EXISTS ix_receivables_owner_paid ON receivables (owner_id, paid)",
            "CREATE INDEX IF NOT EXISTS ix_actions_owner_status ON actions (owner_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_inventory_owner ON inventory (owner_id)",
            "CREATE INDEX IF NOT EXISTS ix_expenses_owner ON expenses (owner_id)",
            "CREATE INDEX IF NOT EXISTS ix_document_logs_owner_status "
            "ON document_logs (owner_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_processed_files_sha256 ON processed_files (sha256)",
        ]
        with engine.begin() as conn:
            for ddl in indexes:
                try:
                    conn.execute(_text(ddl))
                except Exception:
                    continue
    except Exception:
        pass