"""Voice in/out: faster-whisper STT + edge-tts TTS. Lazy, never crashes import."""

import asyncio
import logging
import os
import tempfile

logger = logging.getLogger("vyapaarai.voice")

VOICE_MAP = {
    "hi": "hi-IN-MadhurNeural",
    "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "bn": "bn-IN-TanishaaNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-MidhunNeural",
    "en": "en-IN-PrabhatNeural",
}

_model = None
_model_lock = None


def _get_lock():
    global _model_lock
    if _model_lock is None:
        try:
            import threading

            _model_lock = threading.Lock()
        except Exception:
            _model_lock = None
    return _model_lock


def _get_model():
    """Lazy singleton WhisperModel. Raises on any failure (caller handles)."""
    global _model
    if _model is not None:
        return _model
    lock = _get_lock()
    if lock is not None:
        lock.acquire()
    try:
        if _model is not None:
            return _model
        try:
            from app import config as _cfg

            model_name = os.getenv("WHISPER_MODEL", "") or str(
                getattr(_cfg, "WHISPER_MODEL", "small") or "small"
            )
        except Exception:
            model_name = os.getenv("WHISPER_MODEL", "small") or "small"
        try:
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
        compute_type = "int8_float16" if device == "cuda" else "int8"
        logger.info("Loading whisper model %s (device=%s)…", model_name, device)
        from faster_whisper import WhisperModel

        _model = WhisperModel(model_name.strip() or "small", device=device, compute_type=compute_type)
        return _model
    finally:
        try:
            if lock is not None:
                lock.release()
        except Exception:
            pass


def _voice_enabled() -> bool:
    raw = os.getenv("VOICE_ENABLED")
    if raw is not None:
        return raw.strip().lower() in ("1", "true", "yes", "y", "on")
    try:
        from app import config as _cfg

        return bool(getattr(_cfg, "VOICE_ENABLED", True))
    except Exception:
        return True


def _transcribe_file(path: str, model):
    """Returns (text, language, duration_s). Raises on failure."""
    segments, info = model.transcribe(path, language=None)
    parts = []
    try:
        for seg in segments:
            try:
                parts.append(str(getattr(seg, "text", "") or ""))
            except Exception:
                continue
    except Exception as exc:
        raise RuntimeError(f"transcribe failed: {exc}"[:200])
    lang = "hi"
    try:
        lang = str(getattr(info, "language", "") or "hi").strip() or "hi"
    except Exception:
        lang = "hi"
    dur = None
    try:
        dur = float(getattr(info, "duration", None) or 0) or None
    except Exception:
        dur = None
    return " ".join(parts).strip(), lang, dur


def _wav_via_pydub(raw: bytes) -> bytes | None:
    """Decode-anything -> wav bytes (ffmpeg backend). None when unavailable."""
    try:
        import io as _io

        from pydub import AudioSegment as _AS

        seg = _AS.from_file(_io.BytesIO(bytes(raw)))
        buf = _io.BytesIO()
        seg.export(buf, format="wav")
        return buf.getvalue()
    except Exception as exc:
        logger.info("pydub convert failed: %s", str(exc)[:200])
        return None


def stt(audio_bytes: bytes, suffix: str = ".ogg") -> dict:
    """Speech-to-text. Never raises; failures return text '' with Hindi-English error."""
    try:
        if not _voice_enabled():
            return {"text": "", "language": "hi", "error": "voice disabled"}
        try:
            raw = bytes(audio_bytes or b"")
        except Exception:
            raw = b""
        if len(raw) < 1024:
            return {"text": "", "language": "hi",
                    "error": "Audio bahut chhota hai — 2 second+ bolo 🎤"}
        try:
            model = _get_model()
        except Exception as exc:
            logger.warning("whisper load failed: %s", str(exc)[:200])
            return {"text": "", "language": "hi",
                    "error": "Voice engine taiyaar nahi hai — thodi der mein try karo 🎤"}
        suf = str(suffix or ".ogg").strip().lower() or ".ogg"
        if not suf.startswith("."):
            suf = "." + suf
        text, lang, dur = "", "hi", None
        try:
            with tempfile.NamedTemporaryFile(suffix=suf, delete=True) as tmp:
                tmp.write(raw)
                tmp.flush()
                text, lang, dur = _transcribe_file(tmp.name, model)
        except Exception as exc:
            msg = str(exc)[:300]
            # PyAV/ogg decode failures -> one pydub->wav retry (hardens WhatsApp .ogg too)
            retried, wav = False, None
            if any(k in msg.lower() for k in ("av", "decode", "ffmpeg", "moov", "ebml", "ogg", "webm")):
                wav = _wav_via_pydub(raw)
            if wav:
                try:
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp2:
                        tmp2.write(wav)
                        tmp2.flush()
                        text, lang, dur = _transcribe_file(tmp2.name, model)
                    retried = True
                except Exception as exc2:
                    msg = str(exc2)[:300]
            if not retried:
                logger.info("stt failed (%s): %s", suf, msg)
                return {"text": "", "language": "hi",
                        "error": "Audio samajh nahi aaya — dobara saaf bolo 🎤"}
        try:
            logger.info("stt ok: %.1fs lang=%s chars=%d (%s)",
                        float(dur or 0), lang, len(text or ""), suf)
        except Exception:
            pass
        if not (text or "").strip():
            return {"text": "", "language": lang,
                    "error": "Kuch sunai nahi diya — mic paas rakho, dobara bolo 🎤"}
        return {"text": text.strip(), "language": lang,
                **({"duration": round(float(dur), 1)} if dur else {})}
    except Exception as exc:
        return {"text": "", "language": "hi", "error": str(exc)[:300]}


def tts(text: str, language: str | None = None) -> bytes | None:
    """Text-to-speech via edge-tts. Returns mp3 bytes or None. Never raises."""
    try:
        if not _voice_enabled():
            return None
        body = str(text or "").strip()
        if not body:
            return None
        lang = str(language or "").strip().lower() or "hi"
        voice = VOICE_MAP.get(lang, VOICE_MAP["hi"])

        async def _run() -> bytes:
            import edge_tts

            communicate = edge_tts.Communicate(body[:2000], voice)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=True) as tmp:
                await communicate.save(tmp.name)
                tmp.seek(0)
                return tmp.read()

        try:
            return asyncio.run(_run())
        except RuntimeError:
            # already inside a running loop — use a fresh loop in this thread
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(_run())
            finally:
                try:
                    loop.close()
                except Exception:
                    pass
    except Exception as exc:
        logger.info("tts failed (falling back to text-only): %s", str(exc)[:200])
        return None
