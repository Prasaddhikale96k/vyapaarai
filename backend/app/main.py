import logging
import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app import config as _cfg
from app.limits import limiter
from app.db import Base, engine, ensure_access_schema, ensure_chat_thread_schema, ensure_contacts_schema, ensure_p4_schema, ensure_p15_schema, ensure_prod_schema
from app.routers import actions, auth, chat, connectors, contacts, data, documents, ingest, intelligence, reports, whatsapp
from app.services.sync import start_watchers, startup_scan, stop_watchers

# Import models so metadata is populated before create_all
import app.models  # noqa: F401

logger = logging.getLogger("vyapaarai.http")

structlog.configure(
    processors=[structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.JSONRenderer()],
    wrapper_class=structlog.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)
slog = structlog.get_logger("vyapaarai.http")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = uuid.uuid4().hex
        request.state.request_id = rid
        t0 = time.time()
        try:
            response = await call_next(request)
            status = getattr(response, "status_code", 0)
        except Exception:
            logger.exception("unhandled %s %s rid=%s", request.method, request.url.path, rid)
            response = JSONResponse(
                status_code=500, content={"error": "internal error", "request_id": rid})
            status = 500
        ms = (time.time() - t0) * 1000
        try:
            response.headers["X-Request-ID"] = rid
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "no-referrer"
            # S8#17: HSTS + CSP (frontend-safe: inline styles/scripts + Google Fonts + Supabase realtime)
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: blob:; "
                "connect-src 'self' https://goonzeuzogkzvjntbfjr.supabase.co wss://goonzeuzogkzvjntbfjr.supabase.co; "
                "frame-ancestors 'none'"
            )
        except Exception:
            pass
        try:
            slog.info("request", rid=rid, method=request.method,
                      path=request.url.path, status=status, ms=round(ms, 1))
        except Exception:
            logger.info("%s %s %s %.1fms rid=%s",
                        request.method, request.url.path, status, ms, rid)
        return response


def _assert_prod_auth_guard() -> None:
    """P15 startup pin: ENVIRONMENT != development me dev_otp + WA OTP-echo disabled.

    Functional check (not just log): dev_otp sirf _is_dev() branch me banta hai,
    aur owners machine production me code echo nahi karta. Fail hard = misconfig.
    """
    try:
        env = str(getattr(_cfg, "ENVIRONMENT", "development") or "development").strip().lower()
        if env == "development":
            return
        import inspect

        from app.routers import auth as _auth
        from app.services import owners as _owners

        src_auth = inspect.getsource(_auth)
        src_owners = inspect.getsource(_owners)
        problems = []
        if "dev_otp" in src_auth and "_is_dev()" not in src_auth:
            problems.append("auth.py: dev_otp bina _is_dev() guard")
        if "dev OTP: {code}" in src_owners and "_is_dev()" not in src_owners:
            problems.append("owners.py: OTP echo bina _is_dev() guard")
        if problems:
            raise RuntimeError("PRODUCTION AUTH GUARD FAIL: " + "; ".join(problems))
        logger.info("PRODUCTION auth mode ON (ENVIRONMENT=%s): dev_otp disabled, WA OTP-echo disabled", env)
    except RuntimeError:
        raise
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    _assert_prod_auth_guard()
    Base.metadata.create_all(bind=engine)
    ensure_p4_schema()
    ensure_access_schema()
    ensure_p15_schema()
    ensure_chat_thread_schema()
    ensure_contacts_schema()
    ensure_prod_schema()
    try:
        startup_scan()  # restart-safe: ledger skips already-ingested files
    except Exception:
        pass
    start_watchers()
    try:
        from app.services.connectors import start_connector_scheduler

        start_connector_scheduler()
    except Exception:
        pass
    yield
    stop_watchers()


app = FastAPI(title="VyapaarAI", lifespan=lifespan)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _ratelimit_handler(request: Request, exc: RateLimitExceeded):
    rid = getattr(getattr(request, "state", None), "request_id", "") or ""
    return JSONResponse(
        status_code=429,
        content={"error": "rate limit exceeded, thoda ruk kar try karo", "request_id": rid},
    )


@app.exception_handler(404)
async def _not_found_handler(request: Request, exc):
    rid = getattr(getattr(request, "state", None), "request_id", "") or ""
    try:
        detail = str(getattr(exc, "detail", "") or "Not Found")
    except Exception:
        detail = "Not Found"
    return JSONResponse(status_code=404, content={"detail": detail, "request_id": rid})


@app.exception_handler(Exception)
async def _unhandled_handler(request: Request, exc):
    rid = getattr(getattr(request, "state", None), "request_id", "") or ""
    logger.exception("unhandled error rid=%s: %s", rid, exc)
    return JSONResponse(
        status_code=500, content={"error": "internal error", "request_id": rid})


_frontend = ""
try:
    _frontend = str(getattr(_cfg, "FRONTEND_URL", "") or "").strip().rstrip("/") or "http://localhost:3000"
except Exception:
    _frontend = "http://localhost:3000"
_origins = [_frontend]  # ONLY FRONTEND_URL — no extra origins

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(data.router)
app.include_router(documents.router)
app.include_router(reports.router)
app.include_router(intelligence.router)
app.include_router(chat.router)
app.include_router(actions.router)
app.include_router(auth.router)
app.include_router(whatsapp.router)
app.include_router(connectors.router)
app.include_router(contacts.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "VyapaarAI"}


@app.get("/health/ready")
def ready():
    from sqlalchemy import text as _text

    from app.config import WATCH_DIR

    db_ok = False
    try:
        with engine.begin() as conn:
            if not str(engine.url).startswith("sqlite"):
                conn.execute(_text("SET LOCAL statement_timeout = 3000"))
            conn.execute(_text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    try:
        watch_ok = bool(WATCH_DIR.exists())
    except Exception:
        watch_ok = False
    return {"db": "ok" if db_ok else "fail", "watch_dir": watch_ok}
