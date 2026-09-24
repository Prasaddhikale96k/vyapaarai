"""WhatsApp inbound dispatcher + reply builder. Everything degrades gracefully."""

import logging
import os
import time
import traceback

logger = logging.getLogger("vyapaarai.whatsapp_flow")

_HAAN = {"HAAN", "YES", "HAN", "HA"}
_NAHI = {"NAHI", "NO", "NA"}


def _voice_reply_enabled() -> bool:
    raw = os.getenv("VOICE_REPLY")
    if raw is not None:
        reply = raw.strip().lower() in ("1", "true", "yes", "y", "on")
    else:
        try:
            from app import config as _cfg

            reply = bool(getattr(_cfg, "VOICE_REPLY", True))
        except Exception:
            reply = True
    raw2 = os.getenv("VOICE_ENABLED")
    if raw2 is not None:
        enabled = raw2.strip().lower() in ("1", "true", "yes", "y", "on")
    else:
        try:
            from app import config as _cfg

            enabled = bool(getattr(_cfg, "VOICE_ENABLED", True))
        except Exception:
            enabled = True
    return bool(reply and enabled)


def _openwa_digits(value) -> str:
    try:
        s = str(value or "")
        if "@" in s:
            s = s.split("@")[0]
        return "".join(ch for ch in s if ch.isdigit())
    except Exception:
        return ""


def _extract_openwa(payload: dict, data: dict) -> dict | None:
    """OpenWA webhook shape: {event:'message.received', data:{IncomingMessage}}.

    Media bytes INLINE aate hain (media.data base64) — koi extra download nahi.
    Sirf media-id ho to 'message' ref wapas dete hain taaki fallback fetch ho sake.
    """
    try:
        if not isinstance(data, dict):
            return None
        event = str(payload.get("event", "") or "")
        looks_openwa = (
            event == "message.received"
            or ("from" in data and ("chatId" in data or "type" in data))
        )
        if not looks_openwa:
            return None
        if data.get("fromMe"):
            return None
        chat_id = str(data.get("chatId", "") or "")
        # status/story broadcast skip (real conversation nahi)
        if data.get("isStatusBroadcast") or chat_id == "status@broadcast":
            return None
        phone = _openwa_digits(data.get("senderPhone")) or _openwa_digits(data.get("author")) or _openwa_digits(data.get("from"))
        if not phone:
            return None
        push = None
        try:
            contact = data.get("contact") or {}
            if isinstance(contact, dict):
                push = contact.get("name") or contact.get("pushName")
        except Exception:
            push = None
        mtype = str(data.get("type", "") or "").strip().lower()
        text = str(data.get("body", "") or "")
        media = data.get("media") if isinstance(data.get("media"), dict) else {}
        raw = None
        try:
            b64 = media.get("data") if isinstance(media, dict) else None
            if isinstance(b64, str) and b64.strip():
                s = b64.strip()
                if s.startswith("data:") and "," in s:
                    s = s.split(",", 1)[1]
                import base64 as _b64

                raw = _b64.b64decode(s)
        except Exception:
            raw = None
        fname = ""
        try:
            fname = str((media or {}).get("filename", "") or "")
        except Exception:
            fname = ""
        base = {
            "phone": phone, "pushName": push, "message": data,
            "chatId": chat_id, "messageId": str(data.get("id", "") or ""),
        }
        if mtype in ("text", "chat", "") and text.strip():
            return {"kind": "text", "text": text, **base}
        if mtype in ("audio", "voice", "ptt"):
            out = {"kind": "audio", **base}
            if raw is not None:
                out["bytes"] = raw
            return out
        if mtype == "image":
            out = {"kind": "image", "filename": fname or "photo.jpg", **base}
            if raw is not None:
                out["bytes"] = raw
            return out
        if mtype == "document":
            out = {"kind": "document", "filename": fname or "document", **base}
            if raw is not None:
                out["bytes"] = raw
            return out
        # button/poll/location wagera — body ho to text jaisa treat karo
        if text.strip():
            return {"kind": "text", "text": text, **base}
        return None
    except Exception:
        return None


def _looks_group(payload, data) -> bool:
    """Group traffic? id me '@g.us' ho ya payload/data me isGroup truthy ho."""
    try:
        for container in (payload, data):
            if not isinstance(container, dict):
                continue
            if container.get("isGroup"):
                return True
            for k in ("chatId", "from", "author", "senderPhone", "sender", "remoteJid", "id"):
                v = container.get(k)
                if isinstance(v, str) and "@g.us" in v:
                    return True
        key = data.get("key") if isinstance(data, dict) else None
        if isinstance(key, dict):
            for k in ("remoteJid", "id", "participant"):
                v = key.get(k)
                if isinstance(v, str) and (
                    "@g.us" in v or (k == "participant" and v.strip())
                ):
                    return True
    except Exception:
        pass
    return False


def extract_incoming(payload) -> dict | None:
    try:
        if not isinstance(payload, dict):
            return None
        data = payload.get("data", payload)
        if not isinstance(data, dict):
            return None
        if _looks_group(payload, data):
            logger.info("ignoring group message (g.us/isGroup)")
            return None
        openwa_hit = _extract_openwa(payload, data)
        if openwa_hit is not None:
            return openwa_hit
        key = data.get("key")
        if not isinstance(key, dict):
            return None
        if key.get("fromMe"):
            return None
        remote = str(key.get("remoteJid", "") or "")
        phone = remote.split("@")[0].strip() if remote else ""
        if not phone:
            return None
        msg = data.get("message", {}) or {}
        if not isinstance(msg, dict):
            return None
        push = data.get("pushName")
        if "conversation" in msg and isinstance(msg.get("conversation"), str):
            return {"kind": "text", "text": msg["conversation"], "phone": phone, "pushName": push}
        if "extendedTextMessage" in msg and isinstance(msg.get("extendedTextMessage"), dict):
            t = msg["extendedTextMessage"].get("text", "") or ""
            return {"kind": "text", "text": t, "phone": phone, "pushName": push}
        if "audioMessage" in msg:
            return {"kind": "audio", "message": data, "phone": phone, "pushName": push}
        if "imageMessage" in msg:
            return {
                "kind": "image", "message": data, "phone": phone,
                "pushName": push, "filename": "photo.jpg",
            }
        if "documentMessage" in msg:
            doc = msg.get("documentMessage") or {}
            fname = ""
            if isinstance(doc, dict):
                fname = str(doc.get("fileName", "") or doc.get("filename", "") or "")
            return {
                "kind": "document", "message": data, "phone": phone,
                "pushName": push, "filename": fname or "document",
            }
        return None
    except Exception:
        return None


def _upsert_profile(db, phone: str, push_name=None):
    from app.models import OwnerProfile

    try:
        prof = db.query(OwnerProfile).filter(OwnerProfile.phone == phone).first()
    except Exception:
        prof = None
    if prof is None:
        prof = OwnerProfile(phone=phone, name=str(push_name) if push_name else None, language="hi")
        try:
            db.add(prof)
            db.commit()
            db.refresh(prof)
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            try:
                prof = db.query(OwnerProfile).filter(OwnerProfile.phone == phone).first()
            except Exception:
                prof = None
    else:
        try:
            if push_name and not (prof.name or "").strip():
                prof.name = str(push_name)
                db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
    return prof


def _latest_pending(db, phone: str, owner_id: int = 1):
    try:
        from app.models import DocumentLog

        return (
            db.query(DocumentLog)
            .filter(DocumentLog.status == "pending_confirm", DocumentLog.phone == phone,
                    DocumentLog.owner_id == int(owner_id or 1))
            .order_by(DocumentLog.id.desc())
            .first()
        )
    except Exception as exc:
        # old DB without phone column → migrate once and retry
        try:
            from app.db import ensure_p4_schema

            ensure_p4_schema()
        except Exception:
            pass
        try:
            from app.models import DocumentLog

            return (
                db.query(DocumentLog)
                .filter(DocumentLog.status == "pending_confirm", DocumentLog.phone == phone,
                        DocumentLog.owner_id == int(owner_id or 1))
                .order_by(DocumentLog.id.desc())
                .first()
            )
        except Exception:
            logger.info("pending lookup failed: %s", str(exc)[:200])
            return None


def _reply(phone: str, text: str) -> None:
    try:
        from app.services import notify

        notify.send_text(phone, text)
    except Exception as exc:
        logger.info("reply failed: %s", str(exc)[:200])


def _incoming_bytes(incoming: dict):
    """Inline bytes (OpenWA) pehle; na ho to gateway/evolution se fetch. None on failure."""
    try:
        b = incoming.get("bytes")
        if isinstance(b, (bytes, bytearray)) and len(b) > 0:
            return bytes(b)
    except Exception:
        pass
    # OpenWA fallback: sirf media-id aaya ho to stored media lao
    try:
        from app.services import wa_gateway

        media = wa_gateway.fetch_media(
            str(incoming.get("chatId", "") or ""), str(incoming.get("messageId", "") or "")
        )
        if media:
            return bytes(media)
    except Exception:
        pass
    try:
        from app.services import evolution

        return evolution.download_media(incoming.get("message") or {})
    except Exception:
        return None


def _maybe_voice_reply(phone: str, lang: str, text: str) -> None:
    try:
        if not _voice_reply_enabled():
            return
        from app.services import voice

        audio = voice.tts(text, lang)
        if audio:
            try:
                try:
                    from app.services import wa_gateway as _gw

                    use_openwa = _gw.gateway_name() == "openwa"
                except Exception:
                    use_openwa = True
                if use_openwa:
                    from app.services import wa_gateway

                    wa_gateway.send_voice(phone, audio)
                else:
                    from app.services import evolution

                    evolution.send_voice(phone, audio)
            except Exception as exc:
                logger.info("voice send failed: %s", str(exc)[:200])
    except Exception as exc:
        logger.info("voice reply failed: %s", str(exc)[:200])


def _owner_id_of(profile) -> int:
    try:
        return int(getattr(profile, "id", 1) or 1)
    except Exception:
        return 1


# phone -> monotonic timestamp of last allowlist-gate reply (10-min throttle)
_allow_reply_at: dict = {}


def _allowed_phones() -> set:
    """ALLOWED_INBOUND_PHONES comma list (live env read so tests can override)."""
    try:
        raw = os.getenv("ALLOWED_INBOUND_PHONES", "")
        if not raw:
            try:
                from app import config as _cfg

                raw = str(getattr(_cfg, "ALLOWED_INBOUND_PHONES", "") or "")
            except Exception:
                raw = ""
        out = set()
        for part in str(raw or "").replace(";", ",").split(","):
            d = _openwa_digits(part)
            if d:
                out.add(d)
        return out
    except Exception:
        return set()


def _handle_text(db, profile, incoming: dict, owner_id: int = 1) -> None:
    from app.services import documents
    from app.services.agents import detect_language, orchestrate

    oid = int(owner_id or 1)
    phone = incoming["phone"]
    text = str(incoming.get("text", "") or "")
    t = text.strip().upper()
    lang_of_profile = "hi"
    try:
        lang_of_profile = str(getattr(profile, "language", "") or "hi") or "hi"
    except Exception:
        pass
    # pending confirm short-circuit
    try:
        pending = _latest_pending(db, phone, oid)
    except Exception:
        pending = None
    if pending is not None and t:
        if t in _HAAN:
            try:
                res = documents.confirm_document(db, pending.id, True, phone=phone, owner_id=oid)
                _reply(phone, str(res.get("message") or res.get("error") or "Ho gaya ✅"))
            except Exception as exc:
                _reply(phone, "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏")
                logger.info("confirm HAAN failed: %s", traceback.format_exc()[:500])
            return
        if t in _NAHI:
            try:
                res = documents.confirm_document(db, pending.id, False, phone=phone, owner_id=oid)
                _reply(phone, str(res.get("message") or res.get("error") or "Discard ho gaya ❌"))
            except Exception:
                _reply(phone, "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏")
            return
    # normal chat path
    try:
        lang = detect_language(text)
    except Exception:
        lang = "hi"
    try:
        if profile is not None:
            profile.language = lang
            db.commit()
            lang_of_profile = lang
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    try:
        result = orchestrate(text, phone=phone, owner_id=oid)
        reply_text = str(result.get("answer", "") or "")
    except Exception as exc:
        logger.info("orchestrate failed: %s", str(exc)[:300])
        reply_text = "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏"
    if not reply_text.strip():
        reply_text = "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏"
    _reply(phone, reply_text)
    _maybe_voice_reply(phone, lang_of_profile, reply_text)


def _handle_audio(db, profile, incoming: dict, owner_id: int = 1) -> None:
    from app.services.agents import orchestrate
    from app.services import voice

    oid = int(owner_id or 1)
    phone = incoming["phone"]
    apology = "Aawaz saaf nahi aayi, dobara bhejein 🙏"
    try:
        media = _incoming_bytes(incoming)
    except Exception:
        media = None
    if not media:
        _reply(phone, apology)
        return
    try:
        r = voice.stt(bytes(media))
    except Exception:
        r = {"text": "", "language": "hi"}
    transcript = str((r or {}).get("text", "") or "").strip()
    if not transcript:
        _reply(phone, apology)
        return
    lang = str((r or {}).get("language", "") or "hi").strip() or "hi"
    try:
        if profile is not None:
            profile.language = lang
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    try:
        result = orchestrate(transcript, phone=phone, owner_id=oid)
        answer = str(result.get("answer", "") or "")
    except Exception:
        answer = "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏"
    reply_text = f"🎤 {transcript}\n\n{answer}" if answer else f"🎤 {transcript}"
    _reply(phone, reply_text)
    _maybe_voice_reply(phone, lang, answer or transcript)


def _handle_media(db, profile, incoming: dict, owner_id: int = 1) -> None:
    from app.services import documents

    oid = int(owner_id or 1)
    phone = incoming["phone"]
    try:
        media = _incoming_bytes(incoming)
    except Exception:
        media = None
    if not media:
        _reply(phone, documents.FAILURE_MSG)
        return
    try:
        res = documents.parse_document(
            db, bytes(media), incoming.get("filename") or "photo.jpg",
            source="whatsapp", phone=phone, owner_id=oid,
        )
    except Exception as exc:
        logger.info("parse_document crashed: %s", str(exc)[:300])
        _reply(phone, documents.FAILURE_MSG)
        return
    if isinstance(res, dict) and res.get("error"):
        _reply(phone, str(res["error"]))
    else:
        _reply(phone, str(res.get("summary_text") or "📗 Entries mili. Reply: HAAN ya NAHI"))


def handle_incoming(payload: dict) -> None:
    phone_hint = ""
    try:
        incoming = extract_incoming(payload)
        if not incoming:
            return
        phone_hint = incoming.get("phone", "") or ""
        try:
            from app.db import SessionLocal, ensure_p4_schema

            try:
                ensure_p4_schema()
            except Exception:
                pass
        except Exception:
            from app.db import SessionLocal
        db = SessionLocal()
        try:
            from app.services import owners as _owners

            phone = incoming.get("phone", "") or ""
            kind = incoming.get("kind")
            text = str(incoming.get("text", "") or "")
            try:
                profile = _owners.get_profile(db, phone)
            except Exception:
                profile = None

            # ---- GATE 1: unknown number OR registration in progress ----
            needs_reg = False
            try:
                needs_reg = profile is None or bool(getattr(profile, "reg_step", None))
            except Exception:
                needs_reg = True
            try:
                in_reg_flow = profile is not None and bool(getattr(profile, "reg_step", None))
            except Exception:
                in_reg_flow = False
            if not in_reg_flow:
                # ---- GATE 1b: optional inbound allowlist (no profile side-effects) ----
                try:
                    allow = _allowed_phones()
                except Exception:
                    allow = set()
                if allow and phone not in allow:
                    try:
                        now = time.monotonic()
                        last = float(_allow_reply_at.get(phone, 0.0) or 0.0)
                        if now - last >= 600:
                            _allow_reply_at[phone] = now
                            _reply(
                                phone,
                                "🙏 Ye number VyapaarAI par registered nahi hai. "
                                "Pehle WhatsApp par register karein ya admin se sampark karein.",
                            )
                    except Exception as exc:
                        logger.info("allowlist gate reply failed: %s", str(exc)[:200])
                    return
            if needs_reg:
                try:
                    if profile is None:
                        res = _owners.start_registration(db, phone, incoming.get("pushName"))
                    elif kind == "text" and text.strip():
                        res = _owners.advance_registration(db, phone, text)
                    else:
                        res = _owners.start_registration(db, phone, incoming.get("pushName"))
                        if isinstance(res, dict) and res.get("resumed"):
                            pass
                        else:
                            # non-text during registration → current step dobara batao
                            try:
                                step = str(getattr(profile, "reg_step", "") or "NAME")
                                from app.services.owners import _STEP_ASK as _ASK

                                res = {"reply": _ASK.get(step, _ASK["NAME"])}
                            except Exception:
                                pass
                    _reply(phone, str((res or {}).get("reply") or "Apna NAAM bhejiye 🙏"))
                except Exception as exc:
                    logger.info("registration route failed: %s", str(exc)[:200])
                return

            # ---- GATE 2: registered but approval pending ----
            try:
                allowed = bool(getattr(profile, "allowed", False))
            except Exception:
                allowed = False
            if not allowed:
                try:
                    _reply(phone, "⏳ Aapka account approval pending hai. Admin approve karega to shuru hoga 🙏")
                except Exception:
                    pass
                return

            # ---- GATE 3: allowed → normal flows, owner-scoped ----
            try:
                oid = _owner_id_of(profile)
            except Exception:
                oid = 1
            if kind == "text":
                _handle_text(db, profile, incoming, oid)
            elif kind == "audio":
                _handle_audio(db, profile, incoming, oid)
            elif kind in ("image", "document"):
                _handle_media(db, profile, incoming, oid)
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception:
        logger.warning("handle_incoming crashed: %s", traceback.format_exc()[:800])
        try:
            if phone_hint:
                _reply(phone_hint, "Kuch gadbad ho gayi, thodi der mein dobara try karein 🙏")
        except Exception:
            pass


def build_and_send_brief(owner=None) -> dict:
    """Build morning brief and deliver via notify. Never raises.

    JWT caller (owner profile) wins when present; else OWNER_PHONE/first profile.
    Brief numbers are always scoped to the resolved owner.
    """
    try:
        from app.db import SessionLocal, ensure_p4_schema

        try:
            ensure_p4_schema()
        except Exception:
            pass
        from app.models import OwnerProfile
        from app.services import notify
        from app.services.intelligence import build_brief

        try:
            from app import config as _cfg

            cfg_owner = (os.getenv("OWNER_PHONE", "") or str(getattr(_cfg, "OWNER_PHONE", "") or "")).strip()
            default_lang = (os.getenv("TTS_DEFAULT_LANGUAGE", "") or str(
                getattr(_cfg, "TTS_DEFAULT_LANGUAGE", "hi") or "hi")).strip() or "hi"
        except Exception:
            cfg_owner, default_lang = "", "hi"
        db = SessionLocal()
        try:
            lang = default_lang
            to = ""
            oid = 1
            if owner is not None:
                # JWT caller: apna data, apni bhasha, apna number
                try:
                    oid = _owner_id_of(owner)
                except Exception:
                    oid = 1
                try:
                    to = _openwa_digits(str(getattr(owner, "phone", "") or ""))
                except Exception:
                    to = ""
                try:
                    if str(getattr(owner, "language", "") or "").strip():
                        lang = str(owner.language).strip()
                except Exception:
                    pass
            else:
                try:
                    profile = db.query(OwnerProfile).order_by(OwnerProfile.id).first()
                except Exception:
                    profile = None
                try:
                    if profile is not None and (profile.language or "").strip():
                        lang = str(profile.language).strip()
                except Exception:
                    pass
                to = cfg_owner or (str(profile.phone) if profile is not None else "")
                try:
                    oid = _owner_id_of(profile) if profile is not None else 1
                except Exception:
                    oid = 1
            try:
                brief = build_brief(db, owner_id=oid)
            except Exception:
                brief = []
            lines = []
            for idx, item in enumerate(brief or [], start=1):
                try:
                    lines.append(f"{idx}. {item.get('title','')} — {item.get('detail','')}")
                except Exception:
                    continue
            if str(lang).lower() == "en":
                header = "Good morning! VyapaarAI brief:"
            else:
                header = "🙏 सुप्रभात! VyapaarAI brief:"
            text = header + ("\n" + "\n".join(lines) if lines else "")
            try:
                res = notify.send_text(to or "", text)
            except Exception:
                res = {"simulated": True}
            simulated = bool((res or {}).get("simulated", True))
            return {"delivered": (not simulated), "simulated": simulated, "items": brief or []}
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.warning("build_and_send_brief failed: %s", str(exc)[:300])
        return {"delivered": False, "simulated": True, "items": []}
