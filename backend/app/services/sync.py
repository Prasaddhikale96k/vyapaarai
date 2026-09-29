"""Watchdog folder watcher + APScheduler + processed-files ledger. No n8n.

- Observer on WATCH_DIR (created if missing). on_created / on_moved with 2s debounce.
- process_file(): sha256 ledger first (restart-safe, no re-ingest), filename routing
  THEN header inference (columns passed — upload/watch parity), exceptions ->
  quarantined + file moved to WATCH_DIR/_quarantine/ (never deleted).
- startup_scan(): every regular file in WATCH_DIR (runs in lifespan even when the
  observer is disabled; TestClient lifespan excluded by starlette itself).
- APScheduler: daily 08:00 Asia/Kolkata morning brief + 60s ledger rescan.
"""

import hashlib
import json
import logging
import shutil
import time
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.config import ENABLE_WATCHER, WATCH_DIR
from app.db import SessionLocal

logger = logging.getLogger("vyapaarai.sync")

_observer: Observer | None = None
_scheduler: BackgroundScheduler | None = None

QUARANTINE_DIRNAME = "_quarantine"


def _ensure_ledger() -> None:
    """ProcessedFile table exists (fresh + old DBs). Never raises."""
    try:
        from app.db import Base, engine
        import app.models  # noqa: F401

        Base.metadata.create_all(bind=engine)
    except Exception:
        pass


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def serialize_processed(p) -> dict:
    try:
        created = p.created_at.isoformat() if getattr(p, "created_at", None) else None
    except Exception:
        created = str(getattr(p, "created_at", None))
    try:
        warns = json.loads(p.warnings) if getattr(p, "warnings", None) else []
        if not isinstance(warns, list):
            warns = [str(warns)]
    except Exception:
        warns = [str(getattr(p, "warnings", "") or "")] if getattr(p, "warnings", None) else []
    try:
        sha = str(getattr(p, "sha256", "") or "")
    except Exception:
        sha = ""
    return {
        "id": getattr(p, "id", None),
        "filename": getattr(p, "filename", ""),
        "sha256": sha,
        "sha8": sha[:8],
        "size": getattr(p, "size", 0),
        "source": getattr(p, "source", "watch"),
        "status": getattr(p, "status", ""),
        "rows_inserted": getattr(p, "rows_inserted", 0),
        "warnings": warns,
        "created_at": created,
    }


def _ledger_row(owner_id: int, filename: str, digest: str, size: int,
                source: str, status: str, rows: int, warnings: list) -> None:
    """Best-effort ledger insert on its own session. Never raises."""
    try:
        _ensure_ledger()
        from app.models import ProcessedFile

        db = SessionLocal()
        try:
            db.add(ProcessedFile(
                owner_id=_oid(owner_id), filename=filename or "", sha256=digest or "",
                size=int(size or 0), source=source or "watch", status=status,
                rows_inserted=int(rows or 0),
                warnings=json.dumps((warnings or [])[:10], default=str),
            ))
            db.commit()
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.info("ledger insert failed: %s", str(exc)[:200])


def _quarantine_move(p: Path) -> str:
    """Move bad file aside (unique name). Never raises; returns dest str or reason."""
    try:
        qdir = WATCH_DIR / QUARANTINE_DIRNAME
        qdir.mkdir(parents=True, exist_ok=True)
        dest = qdir / p.name
        i = 1
        while dest.exists():
            dest = qdir / f"{p.stem}-{i}{p.suffix}"
            i += 1
        shutil.move(str(p), str(dest))
        return str(dest)
    except Exception as exc:
        return f"move failed: {exc}"[:200]


def process_file(path, owner_id: int = 1, source: str = "watch") -> dict:
    """Ingest one file idempotently via the sha256 ledger. Never raises."""
    result: dict = {
        "filename": "", "status": "error", "rows_inserted": 0,
        "rows_skipped": 0, "warnings": [],
    }
    try:
        _ensure_ledger()
        p = Path(str(path))
        result["filename"] = p.name
        if not p.is_file():
            result["warnings"] = ["not a file — skipped"]
            return result
        try:
            content = p.read_bytes()
        except Exception as exc:
            result["warnings"] = [f"cannot read file: {exc}"[:200]]
            return result
        if not content:
            result["warnings"] = ["empty file — skipped"]
            _ledger_row(_oid(owner_id), p.name, hashlib.sha256(b"").hexdigest(),
                        0, source, "error", 0, ["empty file — skipped"])
            return result

        digest = hashlib.sha256(bytes(content)).hexdigest()
        size = len(bytes(content))
        oid = _oid(owner_id)

        db = SessionLocal()
        try:
            from app.models import ProcessedFile

            dup = (
                db.query(ProcessedFile)
                .filter(ProcessedFile.owner_id == oid,
                        ProcessedFile.sha256 == digest,
                        ProcessedFile.status == "ingested")
                .first()
            )
            if dup is not None:
                db.add(ProcessedFile(
                    owner_id=oid, filename=p.name, sha256=digest, size=size,
                    source=source or "watch", status="skipped_same",
                    rows_inserted=0, warnings="[]",
                ))
                db.commit()
                result.update(status="skipped_same", rows_inserted=0,
                              rows_skipped=0, warnings=["same sha256 already ingested"])
                return result

            # --- route: filename first, THEN header inference (columns passed) ---
            from app.services.ingestion import (
                ingest_file_bytes, ingest_tally_xml, read_upload_to_df, route_type,
            )

            if p.suffix.lower() == ".xml":
                import xml.etree.ElementTree as _ET

                try:
                    _ET.fromstring(content)
                except Exception as exc:
                    raise ValueError(f"xml parse error: {exc}"[:200])
                summary = ingest_tally_xml(db, content, p.name, owner_id=oid)
            else:
                stype = route_type(p.name)
                if not stype:
                    # header inference needs real columns (fixes old watch-path gap)
                    try:
                        df = read_upload_to_df(content, p.name)
                        stype = route_type(p.name, [str(c) for c in df.columns])
                    except Exception as exc:
                        raise ValueError(f"could not parse file: {exc}"[:200])
                if not stype:
                    raise ValueError(
                        f"could not determine file type for '{p.name}' "
                        "(prefix sales/inventory/receivables/expenses/products "
                        "or recognizable headers chahiye)"
                    )
                summary = ingest_file_bytes(db, content, p.name,
                                            type_hint=stype, owner_id=oid)

            rows_in = int(summary.get("rows_inserted", 0) or 0)
            rows_sk = int(summary.get("rows_skipped", 0) or 0)
            warns = summary.get("warnings", []) or []
            db.add(ProcessedFile(
                owner_id=oid, filename=p.name, sha256=digest, size=size,
                source=source or "watch", status="ingested",
                rows_inserted=rows_in, warnings=json.dumps(warns[:10], default=str),
            ))
            db.commit()
            result.update(status="ingested", rows_inserted=rows_in,
                          rows_skipped=rows_sk, warnings=warns[:10])
            logger.info("watch: ingested %s (%d rows)", p.name, rows_in)
            return result
        except Exception as exc:
            try:
                db.rollback()
            except Exception:
                pass
            err = str(exc)[:300] or "ingest failed"
            moved = _quarantine_move(p)
            _ledger_row(oid, p.name, digest, size, source, "quarantined", 0,
                        [err, f"moved: {moved}"])
            logger.warning("watch: quarantined %s: %s", p.name, err)
            result.update(status="quarantined", rows_inserted=0,
                          rows_skipped=0, warnings=[err, f"moved: {moved}"])
            return result
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        result["warnings"] = [str(exc)[:300]]
        return result


def startup_scan(owner_id: int = 1) -> list:
    """Process every regular file in WATCH_DIR (idempotent via ledger). Never raises."""
    out: list = []
    try:
        _ensure_ledger()
        WATCH_DIR.mkdir(parents=True, exist_ok=True)
        try:
            entries = sorted(WATCH_DIR.iterdir(), key=lambda e: e.name)
        except Exception as exc:
            logger.info("startup_scan list failed: %s", str(exc)[:200])
            return out
        for entry in entries:
            try:
                if entry.is_dir():
                    continue  # _quarantine bhi skip (dobara process nahi)
                name = entry.name
                if name.startswith(".") or name.startswith("~"):
                    continue
                out.append(process_file(entry, owner_id=owner_id, source="watch"))
            except Exception as exc:
                logger.info("startup_scan entry failed: %s", str(exc)[:200])
                continue
    except Exception as exc:
        logger.info("startup_scan failed: %s", str(exc)[:200])
    return out


def morning_brief_placeholder() -> None:
    """08:00 job: brief to every allowed owner + one-time nudge if activated but
    never onboarded (account older than 20h, nudge not yet sent). Never raises."""
    try:
        from datetime import datetime, timedelta

        from app.db import SessionLocal, ensure_p15_schema
        from app.models import OwnerProfile
        from app.services import notify
        from app.services.whatsapp_flow import build_and_send_brief
        import json

        try:
            ensure_p15_schema()
        except Exception:
            pass
        db = SessionLocal()
        try:
            owners = db.query(OwnerProfile).filter(OwnerProfile.allowed.is_(True)).all()
            for prof in owners:
                try:
                    oid = int(getattr(prof, "id", 0) or 0)
                    phone = str(getattr(prof, "phone", "") or "")
                    onboarded = bool(getattr(prof, "onboarded", False))
                    nudge_at = getattr(prof, "nudge_sent_at", None)
                    try:
                        created = getattr(prof, "created_at", None)
                        age_h = ((datetime.utcnow() - created).total_seconds() / 3600
                                 if created else 999.0)
                    except Exception:
                        age_h = 999.0
                    if not onboarded and nudge_at is None and age_h >= 20 and phone:
                        res = notify.send_text(
                            phone,
                            "🙏 VyapaarAI me swagat! Pehli entry bhejo — stock list ki photo, ya seedha likh do. Main likh lunga!",
                        )
                        if isinstance(res, dict) and not res.get("simulated", True):
                            try:
                                prof.nudge_sent_at = datetime.utcnow()
                                db.commit()
                            except Exception:
                                try:
                                    db.rollback()
                                except Exception:
                                    pass
                        logger.info("morning nudge owner=%d", oid)
                        continue
                    result = build_and_send_brief(owner=prof)
                    logger.info("morning brief owner=%d: %s", oid,
                                json.dumps(result.get("items", []), ensure_ascii=False))
                except Exception as exc:
                    logger.warning("morning brief owner failed: %s", str(exc)[:200])
                    continue
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.warning("morning brief failed: %s", exc)


def rescan_job() -> None:
    """APScheduler 60s idempotent rescan. Never raises."""
    try:
        startup_scan()
    except Exception as exc:
        logger.warning("rescan failed: %s", exc)


def nightly_report_job() -> None:
    """21:00 daily PDF to every allowed+onboarded owner. Gateway down -> skip+log."""
    try:
        from datetime import date as _date

        from app.db import SessionLocal
        from app.models import OwnerProfile
        from app.services import notify
        from app.services.reports import build_daily_pdf

        db = SessionLocal()
        try:
            try:
                owners = (
                    db.query(OwnerProfile)
                    .filter(OwnerProfile.allowed.is_(True),
                            OwnerProfile.onboarded.is_(True))
                    .order_by(OwnerProfile.id)
                    .all()
                )
            except Exception as exc:
                logger.warning("nightly report owner list failed: %s", exc)
                return
            for o in owners:
                try:
                    oid = int(getattr(o, "id", 1) or 1)
                    phone = str(getattr(o, "phone", "") or "")
                    pdf = build_daily_pdf(db, oid)
                    res = notify.send_document(
                        phone, bytes(pdf),
                        f"report-{_date.today().isoformat()}.pdf",
                        "📄 VyapaarAI Daily Report",
                    )
                    if isinstance(res, dict) and not res.get("simulated", True):
                        logger.info("nightly report sent owner=%d", oid)
                    else:
                        logger.info("nightly report skipped (gateway down) owner=%d", oid)
                except Exception as exc:
                    try:
                        logger.warning("nightly report owner failed: %s", str(exc)[:200])
                    except Exception:
                        pass
                    continue
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.warning("nightly report failed: %s", exc)


class WatchHandler(FileSystemEventHandler):
    def on_created(self, event):  # type: ignore[override]
        if not event.is_directory:
            self._handle(Path(str(event.src_path)))

    def on_moved(self, event):  # type: ignore[override]
        dest = getattr(event, "dest_path", None)
        if dest:
            self._handle(Path(str(dest)))

    def _handle(self, path: Path) -> None:
        # debounce: file may still be copying
        time.sleep(2.0)
        if not path.is_file():
            return
        name = path.name
        if name.startswith(".") or name.startswith("~"):
            return
        if QUARANTINE_DIRNAME in path.parts:
            return
        try:
            process_file(path, owner_id=1, source="watch")
        except Exception as exc:
            logger.warning("watch: failed %s: %s", name, exc)


def start_watchers() -> None:
    global _observer, _scheduler
    if not ENABLE_WATCHER:
        logger.info("watchers disabled")
        return
    WATCH_DIR.mkdir(parents=True, exist_ok=True)

    if _observer is None:
        _observer = Observer()
        _observer.schedule(WatchHandler(), str(WATCH_DIR), recursive=False)
        _observer.start()
        logger.info("watching %s", WATCH_DIR)

    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
        _scheduler.add_job(
            morning_brief_placeholder,
            "cron",
            hour=8,
            minute=0,
            id="morning_brief",
            replace_existing=True,
        )
        _scheduler.add_job(
            nightly_report_job,
            "cron",
            hour=21,
            minute=0,
            id="nightly_report",
            replace_existing=True,
        )
        _scheduler.add_job(
            rescan_job,
            "interval",
            seconds=60,
            id="watch_rescan",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("scheduler started (morning brief 08:00 + nightly report 21:00 + 60s rescan Asia/Kolkata)")


def stop_watchers() -> None:
    global _observer, _scheduler
    if _observer is not None:
        _observer.stop()
        _observer.join(timeout=5)
        _observer = None
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
