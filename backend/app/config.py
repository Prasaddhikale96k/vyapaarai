import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./vyapaar.db"
    watch_dir: str = "./watch"
    business_name: str = "Sharma Kirana Traders"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    llm_primary_provider: str = "groq"
    llm_fallback_provider: str = "gemini"
    demo_mode_fallback: bool = True
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_model: str = "gemini-2.5-flash"
    evolution_api_url: str = "http://localhost:8080"
    evolution_api_key: str = "vyapaar123"
    evolution_instance: str = "vyapaarai"
    wa_gateway: str = "openwa"
    openwa_url: str = "http://localhost:2785"
    openwa_api_key: str = ""
    openwa_session: str = "vyapaarai"
    webhook_url: str = "http://localhost:8000/webhook/whatsapp"
    webhook_secret: str = "vyapaar_hmac_secret_2026"
    jwt_secret: str = ""
    admin_phone: str = ""
    allowed_inbound_phones: str = ""
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    whisper_model: str = "small"
    voice_enabled: bool = True
    voice_reply: bool = True
    owner_phone: str = ""
    assistant_phone: str = ""
    tts_default_language: str = "hi"


settings = Settings()

# Convenience aliases (P3 LLM layer reads via these).
# os.getenv takes precedence so tests / runtime env overrides work
# even if Settings was imported before env was set.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", settings.groq_api_key or "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", settings.gemini_api_key or "")
LLM_PRIMARY_PROVIDER = os.getenv("LLM_PRIMARY_PROVIDER", settings.llm_primary_provider or "groq").lower()
LLM_FALLBACK_PROVIDER = os.getenv("LLM_FALLBACK_PROVIDER", settings.llm_fallback_provider or "gemini").lower()
_demo_raw = os.getenv("DEMO_MODE_FALLBACK", None)
if _demo_raw is None:
    DEMO_MODE_FALLBACK = bool(settings.demo_mode_fallback)
else:
    DEMO_MODE_FALLBACK = _demo_raw.strip().lower() in ("1", "true", "yes", "y", "on")
GROQ_MODEL = os.getenv("GROQ_MODEL", settings.groq_model or "llama-3.3-70b-versatile")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", settings.gemini_model or "gemini-2.5-flash")
BUSINESS_NAME = os.getenv("BUSINESS_NAME", settings.business_name or "Sharma Kirana Traders")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", settings.whisper_model or "medium")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "y", "on")


VOICE_ENABLED = _env_bool("VOICE_ENABLED", bool(settings.voice_enabled))
VOICE_REPLY = _env_bool("VOICE_REPLY", bool(settings.voice_reply))
OWNER_PHONE = os.getenv("OWNER_PHONE", settings.owner_phone or "").strip()
ASSISTANT_PHONE = os.getenv("ASSISTANT_PHONE", settings.assistant_phone or "").strip()
TTS_DEFAULT_LANGUAGE = os.getenv("TTS_DEFAULT_LANGUAGE", settings.tts_default_language or "hi").strip() or "hi"
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", settings.evolution_api_url or "http://localhost:8080").rstrip("/")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", settings.evolution_api_key or "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", settings.evolution_instance or "vyapaarai")
WA_GATEWAY = (os.getenv("WA_GATEWAY", settings.wa_gateway or "openwa") or "openwa").strip().lower()
OPENWA_URL = (os.getenv("OPENWA_URL", settings.openwa_url or "http://localhost:2785") or "http://localhost:2785").rstrip("/")
OPENWA_API_KEY = os.getenv("OPENWA_API_KEY", settings.openwa_api_key or "")
OPENWA_SESSION = os.getenv("OPENWA_SESSION", settings.openwa_session or "vyapaarai") or "vyapaarai"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", settings.webhook_url or "http://localhost:8000/webhook/whatsapp") or "http://localhost:8000/webhook/whatsapp"
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", settings.webhook_secret or "vyapaar_hmac_secret_2026") or "vyapaar_hmac_secret_2026"
JWT_SECRET = os.getenv("JWT_SECRET", settings.jwt_secret or "")
ADMIN_PHONE = "".join(ch for ch in (os.getenv("ADMIN_PHONE", settings.admin_phone or "") or "") if ch.isdigit())
FRONTEND_URL = (os.getenv("FRONTEND_URL", settings.frontend_url or "") or "http://localhost:3000").strip().rstrip("/") or "http://localhost:3000"
ENVIRONMENT = (os.getenv("ENVIRONMENT", settings.environment or "development") or "development").strip().lower()
# Comma-separated digit phones allowed to message the bot. Empty = everyone (registration gate only).
ALLOWED_INBOUND_PHONES = os.getenv("ALLOWED_INBOUND_PHONES", "") or ""

ENABLE_WATCHER = os.getenv("ENABLE_WATCHER", "true").lower() == "true"

WATCH_DIR = Path(settings.watch_dir).resolve()
WATCH_DIR.mkdir(parents=True, exist_ok=True)