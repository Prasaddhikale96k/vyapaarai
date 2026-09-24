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