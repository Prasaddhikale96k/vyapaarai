"""P20 factory reset drill — REAL-ONLY DB policy tool.

Usage (cwd=backend/):
  python ../scripts/reset_owner.py --phone 919834854511              # delete profile only
  python ../scripts/reset_owner.py --phone 919834854511 --wipe-business yes   # + wipe business rows

Deletes the owner_profiles row; --wipe-business ALSO deletes that owner's rows in:
products, customers, sales, inventory, receivables, expenses, actions,
document_logs, ingestion_logs, processed_files, chat_messages, voice_logs,
contacts, connectors.

Literal "yes" required for --wipe-business. Prints counts removed. Idempotent
(missing rows/owner = 0 removed, exit 0). Operates on the LIVE app engine —
this is the point: factory-reset the live DB, then re-onboard through REAL flows.
"""
import argparse
import os
import sys

if os.path.basename(os.getcwd()) != "backend":
    print("reset_owner.py must run with cwd=backend/")
    sys.exit(2)
sys.path.insert(0, os.getcwd())

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

os.environ.setdefault("ENABLE_WATCHER", "false")

WIPABLE = [
    "products", "customers", "sales", "inventory", "receivables", "expenses",
    "actions", "document_logs", "ingestion_logs", "processed_files",
    "chat_messages", "voice_logs", "contacts", "connectors",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phone", required=True)
    ap.add_argument("--wipe-business", default="no")
    args = ap.parse_args()
    digits = "".join(ch for ch in (args.phone or "") if ch.isdigit())
    wipe = str(args.wipe_business or "").strip().lower() == "yes"

    from app.db import SessionLocal, engine
    from app.models import OwnerProfile
    from sqlalchemy import text as _text

    print(f"engine: {engine.url}", flush=True)
    db = SessionLocal()
    try:
        cands = [digits]
        stripped = digits[2:] if len(digits) > 10 and digits.startswith("91") else digits
        if stripped not in cands:
            cands.append(stripped)
        if len(stripped) == 10 and ("91" + stripped) not in cands:
            cands.append("91" + stripped)
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone.in_(cands)).first()
        if prof is None:
            print(f"owner not found for {digits} — nothing to do (idempotent ok)", flush=True)
            return 0
        oid = int(prof.id)
        print(f"owner id={oid} phone={prof.phone} allowed={prof.allowed} onboarded={prof.onboarded}",
              flush=True)
        removed = {}
        if wipe:
            # children before parents (sales/inventory reference products)
            order = [t for t in WIPABLE if t not in ("customers", "products")]
            order += ["customers", "products"]
            for tbl in order:
                try:
                    res = db.execute(_text(f"DELETE FROM {tbl} WHERE owner_id = :oid"),
                                     {"oid": oid})
                    removed[tbl] = int(res.rowcount or 0)
                except Exception as e:
                    removed[tbl] = f"ERR {str(e)[:100]}"
            try:
                db.commit()
            except Exception:
                db.rollback()
        for tbl, n in removed.items():
            print(f"  wiped {tbl}: {n}", flush=True)
        try:
            db.delete(prof)
            db.commit()
            print(f"deleted owner_profiles id={oid}", flush=True)
        except Exception as e:
            db.rollback()
            print(f"profile delete failed: {str(e)[:200]}", flush=True)
            return 1
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
