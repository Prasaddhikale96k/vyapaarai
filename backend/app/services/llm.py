"""VyapaarAI LLM abstraction — provider chain: Groq -> Gemini REST -> demo_fallback."""

import json
import logging
import os
import time

import requests
from fastapi import HTTPException

logger = logging.getLogger("vyapaarai.llm")

_CACHE_TTL = 120
_cache: dict = {}


def _purge_cache(now: float | None = None) -> None:
    now = now if now is not None else time.time()
    expired = [k for k, (_, exp) in _cache.items() if exp <= now]
    for k in expired:
        _cache.pop(k, None)


def _cache_get(key):
    _purge_cache()
    entry = _cache.get(key)
    if entry:
        result, _exp = entry
        return result
    return None


def _cache_set(key, result):
    _purge_cache()
    _cache[key] = (result, time.time() + _CACHE_TTL)


def _get_groq_key() -> str:
    v = os.getenv("GROQ_API_KEY")
    if v:
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GROQ_API_KEY", "") or "").strip()
    except Exception:
        return ""


def _get_gemini_key() -> str:
    v = os.getenv("GEMINI_API_KEY")
    if v:
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GEMINI_API_KEY", "") or "").strip()
    except Exception:
        return ""


def _get_groq_model() -> str:
    v = os.getenv("GROQ_MODEL")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GROQ_MODEL", "") or "").strip() or "llama-3.3-70b-versatile"
    except Exception:
        return "llama-3.3-70b-versatile"


def _get_gemini_model() -> str:
    v = os.getenv("GEMINI_MODEL")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "GEMINI_MODEL", "") or "").strip() or "gemini-2.5-flash"
    except Exception:
        return "gemini-2.5-flash"


def _demo_enabled() -> bool:
    raw = os.getenv("DEMO_MODE_FALLBACK")
    if raw is not None:
        return raw.strip().lower() in ("1", "true", "yes", "y", "on")
    try:
        from app import config as _cfg

        return bool(getattr(_cfg, "DEMO_MODE_FALLBACK", True))
    except Exception:
        return True


def _chain_order() -> list:
    primary = os.getenv("LLM_PRIMARY_PROVIDER")
    fallback = os.getenv("LLM_FALLBACK_PROVIDER")
    try:
        from app import config as _cfg

        if not primary:
            primary = str(getattr(_cfg, "LLM_PRIMARY_PROVIDER", "groq") or "groq")
        if not fallback:
            fallback = str(getattr(_cfg, "LLM_FALLBACK_PROVIDER", "gemini") or "gemini")
    except Exception:
        primary = primary or "groq"
        fallback = fallback or "gemini"
    order: list = []
    for p in (str(primary).lower().strip(), str(fallback).lower().strip()):
        if p in ("groq", "gemini") and p not in order:
            order.append(p)
    if not order:
        order = ["groq", "gemini"]
    return order


def _is_429(exc: Exception) -> bool:
    try:
        sc = getattr(exc, "status_code", None)
        if sc == 429:
            return True
    except Exception:
        pass
    try:
        if "429" in str(exc):
            return True
    except Exception:
        pass
    # requests HTTPError with response
    try:
        resp = getattr(exc, "response", None)
        if resp is not None and getattr(resp, "status_code", None) == 429:
            return True
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# Demo fallback (never raises)
# ---------------------------------------------------------------------------

def _demo_fallback(question: str) -> str:
    """Deterministic rule-based answer composed from intelligence engines."""
    try:
        from app.db import SessionLocal
        from app.services import intelligence as eng

        q = (question or "")[:300]
        db = SessionLocal()
        try:
            try:
                hs = eng.health_score(db)
            except Exception:
                hs = {}
            try:
                brief = eng.build_brief(db)
            except Exception:
                brief = []
            try:
                rc = eng.root_cause(db)
            except Exception:
                rc = {}
        finally:
            try:
                db.close()
            except Exception:
                pass

        headline = str(hs.get("headline", "") or "").strip() if isinstance(hs, dict) else ""
        overall = hs.get("overall", "") if isinstance(hs, dict) else ""
        grade = hs.get("grade", "") if isinstance(hs, dict) else ""
        top_title = ""
        top_detail = ""
        if isinstance(brief, list) and brief:
            top = brief[0] if isinstance(brief[0], dict) else {}
            top_title = str(top.get("title", "") or "")
            top_detail = str(top.get("detail", "") or "")
        narrative = str(rc.get("narrative", "") or "") if isinstance(rc, dict) else ""
        # overdue total — parse from health receivables subscore or recompute
        overdue_txt = ""
        try:
            if isinstance(hs, dict):
                for s in hs.get("subscores", []) or []:
                    if isinstance(s, dict) and "eceiv" in str(s.get("name", "")).lower():
                        overdue_txt = str(s.get("breakdown", "") or "")
                        break
        except Exception:
            overdue_txt = ""
        parts = ["Demo mode: offline answer (live LLM unavailable)."]
        if headline:
            parts.append(f"Health {overall}/100 ({grade}): {headline}")
        elif overall != "":
            parts.append(f"Health score {overall}/100 ({grade}).")
        if top_title or top_detail:
            parts.append(f"Top focus: {top_title} — {top_detail}".strip(" —"))
        if overdue_txt:
            parts.append(f"Receivables: {overdue_txt}.")
        if narrative:
            parts.append(narrative)
        parts.append(
            "What happened: see health drivers above. Why: purchase costs and "
            "receivables pressure plus high-margin sales mix shift. Risk: cash blocked "
            "in overdue invoices. Next steps: follow up overdue invoices, reorder low-stock "
            "SKUs, push high-margin movers."
        )
        if q:
            parts.append(f"Your question was: {q}")
        text = " ".join(p for p in parts if p).strip()
        if len(text) < 60:
            text = (
                f"Demo mode: business summary currently limited. Your question was: {q}. "
                "Please check health-score, root-cause and brief endpoints for numbers."
            )
        return text
    except Exception:
        q = str(question or "")[:200]
        return (
            f"Demo mode: unable to compose intelligence summary. Your question was: {q}. "
            "Health, receivables and stock data are available via the app endpoints."
        )


# alias (spec names it demo_fallback)
demo_fallback = _demo_fallback


# ---------------------------------------------------------------------------
# Groq + Gemini low-level calls
# ---------------------------------------------------------------------------

def _call_groq_text(system: str, user: str, max_tokens: int) -> str:
    from groq import Groq

    api_key = _get_groq_key()
    if not api_key:
        raise RuntimeError("missing GROQ_API_KEY")
    model = _get_groq_model()
    client = Groq(api_key=api_key, timeout=30.0)
    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    try:
        text = resp.choices[0].message.content or ""
    except Exception:
        text = ""
    if not text or not text.strip():
        raise RuntimeError("empty Groq response")
    return text.strip()


def _call_groq_tools(
    system: str, user: str, tools_schema: list, executor, max_iterations: int = 5,
    max_tokens: int = 900,
) -> tuple[str, list]:
    from groq import Groq

    api_key = _get_groq_key()
    if not api_key:
        raise RuntimeError("missing GROQ_API_KEY")
    model = _get_groq_model()
    client = Groq(api_key=api_key, timeout=30.0)
    messages: list = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    tool_trace: list = []
    kwargs: dict = dict(
        model=model, temperature=0.2, max_tokens=max_tokens, messages=messages,
    )
    if tools_schema:
        kwargs["tools"] = tools_schema
        kwargs["tool_choice"] = "auto"
    iterations = 0
    while True:
        kwargs["messages"] = messages
        resp = client.chat.completions.create(**kwargs)
        try:
            msg = resp.choices[0].message
        except Exception:
            raise RuntimeError("empty Groq response")
        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            text = (getattr(msg, "content", None) or "").strip()
            if not text:
                raise RuntimeError("empty Groq response")
            return text, tool_trace
        # Append assistant message EXACTLY as returned (with tool_calls)
        try:
            tc_list = []
            for tc in tool_calls:
                fn = getattr(tc, "function", None)
                tc_list.append(
                    {
                        "id": getattr(tc, "id", ""),
                        "type": "function",
                        "function": {
                            "name": getattr(fn, "name", "") if fn else "",
                            "arguments": getattr(fn, "arguments", "") if fn else "",
                        },
                    }
                )
            messages.append(
                {
                    "role": "assistant",
                    "content": getattr(msg, "content", None) or "",
                    "tool_calls": tc_list,
                }
            )
        except Exception:
            messages.append({"role": "assistant", "content": getattr(msg, "content", None) or ""})
        for tc in tool_calls:
            try:
                fn = getattr(tc, "function", None)
                name = (getattr(fn, "name", "") if fn else "") or ""
                raw_args = (getattr(fn, "arguments", "") if fn else "") or ""
            except Exception:
                name, raw_args = "", ""
            try:
                args = json.loads(raw_args) if raw_args else {}
                if not isinstance(args, dict):
                    args = {}
            except Exception:
                args = {}
            try:
                result = executor(name, args)
            except Exception as exc:
                result = f"ERROR: {exc}"
            result_str = str(result)
            tool_trace.append(
                {"name": name, "args": args, "result_preview": result_str[:500]}
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": getattr(tc, "id", ""),
                    "content": result_str[:1500],
                }
            )
        iterations += 1
        if iterations >= max_iterations:
            # Force final answer without tools
            final_kwargs = dict(
                model=model, temperature=0.2, max_tokens=max_tokens, messages=messages,
            )
            resp2 = client.chat.completions.create(**final_kwargs)
            try:
                text2 = (resp2.choices[0].message.content or "").strip()
            except Exception:
                text2 = ""
            if not text2:
                raise RuntimeError("empty Groq response after tools")
            return text2, tool_trace


def _call_gemini_text(system: str, user: str, max_tokens: int) -> str:
    api_key = _get_gemini_key()
    if not api_key:
        raise RuntimeError("missing GEMINI_API_KEY")
    model = _get_gemini_model()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens},
    }
    r = requests.post(url, json=body, timeout=30)
    if r.status_code == 429:
        exc = RuntimeError(f"Gemini 429: {r.text[:300]}")
        setattr(exc, "status_code", 429)
        raise exc
    r.raise_for_status()
    data = r.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        raise RuntimeError(f"unexpected Gemini response: {str(data)[:500]}")
    if not text or not str(text).strip():
        raise RuntimeError("empty Gemini response")
    return str(text).strip()


def _try_with_429_retry(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        if _is_429(exc):
            time.sleep(2)
            return fn(*args, **kwargs)
        raise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def complete_text(system: str, user: str, max_tokens: int = 900) -> dict:
    system = system or ""
    user = user or ""
    cache_key = ("text", system[:50], user, int(max_tokens))
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("llm cache hit provider=%s", cached.get("provider"))
        return cached
    order = _chain_order()
    last_err: Exception | None = None
    for provider in order:
        try:
            if provider == "groq":
                text = _try_with_429_retry(_call_groq_text, system, user, int(max_tokens))
                result = {"text": text, "provider": "groq"}
                logger.info("llm served by groq")
                _cache_set(cache_key, result)
                return result
            elif provider == "gemini":
                text = _try_with_429_retry(_call_gemini_text, system, user, int(max_tokens))
                result = {"text": text, "provider": "gemini"}
                logger.info("llm served by gemini")
                _cache_set(cache_key, result)
                return result
        except Exception as exc:
            last_err = exc
            logger.warning("llm provider %s failed: %s", provider, str(exc)[:300])
            continue
    if _demo_enabled():
        text = _demo_fallback(user)
        result = {"text": text, "provider": "demo_fallback"}
        logger.info("llm served by demo_fallback (after %s)", last_err)
        _cache_set(cache_key, result)
        return result
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {last_err}")


def chat_with_tools(
    system: str,
    user: str,
    tools_schema: list,
    executor,
    max_iterations: int = 5,
) -> dict:
    system = system or ""
    user = user or ""
    tools_schema = tools_schema or []
    cache_key = ("tools", system[:50], user)
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("llm-tools cache hit provider=%s", cached.get("provider"))
        return cached
    order = _chain_order()
    last_err: Exception | None = None
    for provider in order:
        try:
            if provider == "groq":
                text, trace = _try_with_429_retry(
                    _call_groq_tools, system, user, tools_schema, executor, int(max_iterations),
                )
                result = {"text": text, "tool_trace": trace, "provider": "groq"}
                logger.info("llm-tools served by groq (%d tool calls)", len(trace))
                _cache_set(cache_key, result)
                return result
            elif provider == "gemini":
                # Gemini fallback runs WITHOUT tools
                text = _try_with_429_retry(_call_gemini_text, system, user, 900)
                result = {"text": text, "tool_trace": [], "provider": "gemini"}
                logger.info("llm-tools served by gemini (no tools)")
                _cache_set(cache_key, result)
                return result
        except Exception as exc:
            last_err = exc
            logger.warning("llm-tools provider %s failed: %s", provider, str(exc)[:300])
            continue
    if _demo_enabled():
        text = _demo_fallback(user)
        result = {"text": text, "tool_trace": [], "provider": "demo_fallback"}
        logger.info("llm-tools served by demo_fallback (after %s)", last_err)
        _cache_set(cache_key, result)
        return result
    raise HTTPException(status_code=503, detail=f"LLM unavailable: {last_err}")
