"""Single phone-normalization util (one-shot P5 S8#25). All phone parsing
across routers/services goes through here. Never raises."""

from typing import List, Optional


def normalize_phone(raw, strip_country: bool = False) -> str:
    """JID-safe digits extraction.

    - strips "@c.us"/"@g.us" JID suffixes (OpenWA payloads)
    - keeps digits only
    - strip_country=True: strip leading 91 country code when longer than 10
      (web-form storage convention; register stores the stripped form)
    """
    try:
        s = str(raw or "")
        if "@" in s:
            s = s.split("@")[0]
        d = "".join(ch for ch in s if ch.isdigit())
    except Exception:
        return ""
    if strip_country and len(d) > 10 and d.startswith("91"):
        d = d[2:]
    return d


def phone_candidates(raw) -> List[str]:
    """All stored-form variants of a typed phone (register stores stripped)."""
    d = normalize_phone(raw)
    stripped = normalize_phone(raw, strip_country=True)
    cands = [d]
    if stripped not in cands:
        cands.append(stripped)
    if len(stripped) == 10 and ("91" + stripped) not in cands:
        cands.append("91" + stripped)
    return cands


def find_profile_by_phone(db, raw) -> Optional[object]:
    """Find OwnerProfile by any phone variant. None if no match. Never raises."""
    try:
        from app.models import OwnerProfile

        return db.query(OwnerProfile).filter(
            OwnerProfile.phone.in_(phone_candidates(raw))).first()
    except Exception:
        return None
