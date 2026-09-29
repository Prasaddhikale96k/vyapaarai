"""P8-F2 Scheme Radar: supplier scheme messages -> savings verdict + pending action.

Flow: owner forwards a supplier scheme text/photo-caption (e.g. "Parle-G 10+1
free till Diwali") -> extract {product, buy_qty, free_qty, price, valid_till}
(regex first, then existing LLM chain with strict-JSON instruction) ->
effective_unit_price = price*buy/(buy+free) vs product.purchase_price ->
owner-language reply (summary + savings % + stock-days verdict) + pending
ACTION type scheme_alert (approvable like others).

Honest fallback: parse fail -> "scheme samajh nahi aayi" reply, NO action.
Never raises.
"""

import json
import logging
import re

logger = logging.getLogger("vyapaarai.schemes")

FALLBACK_MSG = (
    "📦 Scheme samajh nahi aayi — product ka naam, quantity (jaise 10+1) "
    "aur price saaf-saaf dobara bhejo 🙏"
)

_TRIGGER_RE = re.compile(
    r"(\d+\s*\+\s*\d+|scheme|offer|free|muft|discount|%|off\b)",
    re.IGNORECASE,
)

_BUYFREE_RE = re.compile(r"(\d+)\s*\+\s*(\d+)")

_PRICE_RE = re.compile(
    r"(?:rs\.?|rs|inr|price|mrp|rate|₹)\s*\.?\s*(\d+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

_VALID_RE = re.compile(
    r"(?:till|tak|valid(?:\s+till|\s+upto|\s+up\s+to)?|last\s+date)\s+([a-zA-Z\u0900-\u097F0-9\-/ ]{2,30})",
    re.IGNORECASE,
)

_SCHEME_JSON_INSTRUCTION = (
    "Extract the supplier SCHEME from the message below. Reply with ONLY a "
    "single-line JSON object, no other text, with keys: product (string), "
    "buy_qty (integer), free_qty (integer), price (number or null, total price "
    "for the buy quantity), valid_till (string or null). "
    'Example: {"product":"Parle-G","buy_qty":10,"free_qty":1,"price":null,'
    '"valid_till":"Diwali"}. If no scheme is present, reply exactly: {}.'
)


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def looks_like_scheme(text: str) -> bool:
    """Cheap trigger gate so normal chat never enters the scheme path."""
    try:
        return bool(_TRIGGER_RE.search(str(text or "")))
    except Exception:
        return False


_UNIT_TOKENS = {"kg", "gm", "g", "ml", "ltr", "l", "pcs", "pc", "pack",
                "pkt", "packet", "bottle", "tin", "box", "pouch", "sachet"}


def _clean_product(raw: str) -> str:
    try:
        # symbols/digits stripped WITHOUT IGNORECASE (else R/S classes eat letters)
        s = re.sub(r"[₹\d+\-/,.:()]+", " ", str(raw or ""))
        s = re.sub(
            r"\b(rs|inr|free|scheme|offer|muft|discount|till|tak|valid|price|mrp|rate|walla|wala|mein|main|par|ke|ka|ki)\b",
            " ", s, flags=re.IGNORECASE)
        toks = [t for t in re.sub(r"\s+", " ", s).strip(" -:.,").split(" ")
                if t and t.lower() not in _UNIT_TOKENS]
        return " ".join(toks)[:64]
    except Exception:
        return ""


def regex_parse(text: str) -> dict | None:
    """Deterministic parse for the common 'Product 10+1 ... Rs X ... till Y' shape."""
    try:
        t = str(text or "").strip()
        if not t:
            return None
        m = _BUYFREE_RE.search(t)
        if not m:
            return None
        buy, free = int(m.group(1)), int(m.group(2))
        if buy < 1 or free < 1 or buy > 10000 or free > 10000:
            return None
        pm = _PRICE_RE.search(t)
        price = float(pm.group(1)) if pm else None
        vm = _VALID_RE.search(t)
        valid_till = vm.group(1).strip()[:32] if vm else None
        product = _clean_product(t[:m.start()])
        if not product:
            product = _clean_product(t[m.end():m.end() + 40])
        if not product:
            return None
        return {"product": product, "buy_qty": buy, "free_qty": free,
                "price": price, "valid_till": valid_till}
    except Exception:
        return None


def llm_parse(text: str) -> dict | None:
    """Strict-JSON extraction via the existing Groq->Gemini->demo chain."""
    try:
        from app.services import llm as _llm

        res = _llm.complete_text(
            "You extract supplier schemes as strict JSON. No explanations.",
            _SCHEME_JSON_INSTRUCTION + "\nMESSAGE: " + str(text or "")[:500],
            max_tokens=300,
        )
        raw = str((res or {}).get("text", "") or "").strip()
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            return None
        data = json.loads(raw[start:end + 1])
        if not isinstance(data, dict) or not data:
            return None
        buy = int(data.get("buy_qty") or 0)
        free = int(data.get("free_qty") or 0)
        if buy < 1 or free < 1:
            return None
        product = str(data.get("product") or "").strip()[:64]
        if not product:
            return None
        try:
            price = float(data["price"]) if data.get("price") is not None else None
        except Exception:
            price = None
        valid_till = str(data.get("valid_till") or "").strip()[:32] or None
        return {"product": product, "buy_qty": buy, "free_qty": free,
                "price": price, "valid_till": valid_till}
    except Exception as exc:
        logger.info("scheme llm_parse failed: %s", str(exc)[:150])
        return None


def extract_scheme(text: str) -> dict | None:
    """Regex first (offline-safe), LLM strict-JSON as backup. None = not parsed."""
    try:
        if not looks_like_scheme(text):
            return None
        hit = regex_parse(text)
        if hit:
            return hit
        return llm_parse(text)
    except Exception:
        return None


def match_product(db, owner_id: int, name: str):
    """Fuzzy product match (name/sku substring both directions). None if ambiguous/absent."""
    try:
        from app.models import Product

        oid = _oid(owner_id)
        q = str(name or "").strip().lower()
        if not q:
            return None
        rows = db.query(Product).filter(Product.owner_id == oid).all()

        def _norm(s: str) -> str:
            try:
                toks = [t for t in re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).split()
                        if t and t not in _UNIT_TOKENS]
                return "".join(toks)
            except Exception:
                return ""

        def _tokens(s: str) -> set:
            try:
                return {t for t in re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).split()
                        if t and t not in _UNIT_TOKENS and len(t) > 1}
            except Exception:
                return set()

        qn = _norm(q)
        if not qn:
            return None
        scored = []
        for p in rows:
            try:
                nm = str(getattr(p, "name", "") or "").lower()
                sku = str(getattr(p, "sku", "") or "").lower()
                if not nm:
                    continue
                if q == nm or q == sku or qn == _norm(nm) or (sku and qn == _norm(sku)):
                    return p
                nmn, skun = _norm(nm), _norm(sku)
                if (nmn and (qn in nmn or nmn in qn)) or (skun and (qn in skun or skun in qn)):
                    scored.append((len(nmn), p))
                elif q in nm or nm in q or (sku and (q in sku or sku in q)):
                    scored.append((len(nm), p))
                    continue
                # token overlap: all query tokens inside name tokens (unit-agnostic)
                qt, nt = _tokens(q), _tokens(nm)
                if qt and qt <= nt:
                    scored.append((len(nmn), p))
            except Exception:
                continue
        if len(scored) == 1:
            return scored[0][1]
        return None
    except Exception:
        return None


def stock_days(db, owner_id: int, product) -> float | None:
    """Days the current stock will last (avg daily 28d). None if unknown."""
    try:
        from datetime import date as _date

        from app.models import InventoryItem
        from app.services import intelligence as eng

        oid = _oid(owner_id)
        inv = (
            db.query(InventoryItem)
            .filter(InventoryItem.owner_id == oid,
                    InventoryItem.product_id == int(getattr(product, "id", 0) or 0))
            .first()
        )
        if inv is None:
            return None
        avg = eng._avg_daily_28(db, int(product.id), _date.today(), oid)
        if not avg or avg <= 0:
            return None
        return float(getattr(inv, "stock_qty", 0) or 0) / float(avg)
    except Exception:
        return None


def evaluate(db, owner_id: int, parsed: dict) -> dict:
    """Compare effective unit price vs purchase_price + stock-days verdict."""
    out = {"parsed": parsed, "product": None, "effective": None,
           "savings_pct": None, "stock_days": None, "verdict": "unknown"}
    try:
        oid = _oid(owner_id)
        prod = match_product(db, oid, parsed.get("product", ""))
        buy = int(parsed.get("buy_qty") or 0)
        free = int(parsed.get("free_qty") or 0)
        price = parsed.get("price")
        if prod is None:
            out["verdict"] = "no_product"
            return out
        out["product"] = prod
        try:
            purchase = float(getattr(prod, "purchase_price", 0) or 0)
        except Exception:
            purchase = 0.0
        if price is not None and purchase > 0 and (buy + free) > 0:
            # price = TOTAL lot price for the buy qty (owners forward "Rs 200" for
            # "10+1"): effective unit = total / total units. (Spec note: if price
            # were per-unit, multiply by buy first — same result.)
            try:
                eff = float(price) / (buy + free)
            except Exception:
                eff = None
            out["effective"] = round(eff, 2) if eff is not None else None
            if eff is not None and eff > 0:
                out["savings_pct"] = round((purchase - eff) / purchase * 100, 1)
        out["stock_days"] = stock_days(db, oid, prod)
        sv = out["savings_pct"]
        sd = out["stock_days"]
        if sv is not None and sv <= 0:
            out["verdict"] = "skip"
        elif sv is not None and sv > 5 and (sd is None or sd < 60):
            out["verdict"] = "lena_faydemand"
        elif sv is not None and sv > 5:
            out["verdict"] = "neutral_high_stock"
        elif sv is None:
            out["verdict"] = "no_price"
        else:
            out["verdict"] = "neutral"
        return out
    except Exception as exc:
        logger.info("scheme evaluate failed: %s", str(exc)[:150])
        return out


def _inr(x) -> str:
    try:
        return f"₹{float(x or 0):,.0f}"
    except Exception:
        return "₹0"


def build_reply(ev: dict, lang: str = "hi") -> str:
    """Owner-language reply: summary + savings % + stock-days verdict."""
    try:
        parsed = ev.get("parsed", {}) or {}
        pname = str(parsed.get("product", "") or "Scheme")
        buy = parsed.get("buy_qty", "?")
        free = parsed.get("free_qty", "?")
        eff = ev.get("effective")
        sv = ev.get("savings_pct")
        sd = ev.get("stock_days")
        valid = parsed.get("valid_till")
        verdict = ev.get("verdict", "unknown")
        en = str(lang or "").strip().lower() == "en"

        if verdict == "no_product":
            return (f"📦 {pname} meri list me nahi mila — scheme note ho gayi, "
                    "pehle product add karo phir bataunga faydemand hai ya nahi 🙏"
                    if not en else
                    f"📦 {pname} is not in my list — noted the scheme; add the "
                    f"product first, then I'll judge it 🙏")
        sd_txt = f"{sd:.0f} din" if sd is not None else "pata nahi"
        if en and sd is not None:
            sd_txt = f"{sd:.0f} days"
        if verdict == "lena_faydemand":
            v = (f"aapka stock {sd_txt} chalega — SCHEME LENA FAYDEMAND ✅"
                 if not en else
                 f"your stock lasts {sd_txt} — WORTH TAKING ✅")
        elif verdict == "skip":
            v = ("is rate par bachat nahi — SKIP karo ⏭️"
                 if not en else "no savings at this rate — SKIP ⏭️")
        elif verdict == "neutral_high_stock":
            v = (f"bachat hai par stock {sd_txt} chalega — abhi SKIP, baad me lena ⏭️"
                 if not en else
                 f"savings exist but stock lasts {sd_txt} — SKIP for now ⏭️")
        elif verdict == "no_price":
            v = ("price nahi mili — supplier se rate poochho, phir bachat nikalunga 📝"
                 if not en else
                 "no price found — ask the supplier for the rate 📝")
        else:
            v = ("soch-samajh kar lo — bachat halki hai ⚖️"
                 if not en else "decide carefully — savings are thin ⚖️")

        if en:
            head = f"📦 Scheme: {pname} {buy}+{free} free"
            save = (f"savings {sv:.1f}% vs purchase {_inr(getattr(ev.get('product'), 'purchase_price', 0))}"
                    if sv is not None else "savings unknown (no price)")
        else:
            head = f"📦 Scheme: {pname} {buy}+{free} free"
            save = (f"bachat {sv:.1f}% (kharid {_inr(getattr(ev.get('product'), 'purchase_price', 0))} se)"
                    if sv is not None else "bachat pata nahi (price nahi mili)")
        tail = f" (valid: {valid})" if valid else ""
        return f"{head}{tail}\n{save}\n{v}"
    except Exception:
        return FALLBACK_MSG


def handle_scheme(db, profile, text: str, owner_id: int = 1) -> dict:
    """Full scheme path. Returns {handled: bool, reply: str}.

    handled=False -> caller continues normal flow. Parse fail -> handled=True
    with honest fallback and NO action created.
    """
    try:
        t = str(text or "").strip()
        if not looks_like_scheme(t):
            return {"handled": False}
        oid = _oid(owner_id)
        try:
            lang = str(getattr(profile, "language", "") or "hi").strip() or "hi"
        except Exception:
            lang = "hi"
        parsed = extract_scheme(t)
        if not parsed:
            return {"handled": True, "reply": FALLBACK_MSG}
        ev = evaluate(db, oid, parsed)
        reply = build_reply(ev, lang)
        if ev.get("verdict") in ("unknown", "no_product") or ev.get("product") is None:
            return {"handled": True, "reply": reply}
        # pending ACTION (approvable like others), marker-deduped
        try:
            from app.models import Action

            prod = ev["product"]
            marker = f"scheme:{getattr(prod, 'sku', '') or prod.id}:{parsed['buy_qty']}+{parsed['free_qty']}"
            existing = (
                db.query(Action)
                .filter(Action.owner_id == oid, Action.type == "scheme_alert",
                        Action.status.in_(["pending", "approved", "sent"]),
                        Action.detail.like(f"%{marker}%"))
                .first()
            )
            if existing is None:
                sv = ev.get("savings_pct")
                sv_txt = f"{sv:.1f}% bachat" if sv is not None else "scheme"
                db.add(Action(
                    owner_id=oid, type="scheme_alert",
                    title=f"Scheme: {getattr(prod, 'name', '') or parsed['product']} "
                          f"{parsed['buy_qty']}+{parsed['free_qty']} ({sv_txt})",
                    detail=f"{marker} | effective={ev.get('effective')} "
                           f"savings={sv} stock_days={ev.get('stock_days')}",
                    target_name=getattr(prod, "name", "") or parsed["product"],
                    target_phone=getattr(prod, "supplier_phone", "") or "",
                    draft_message=reply, status="pending",
                ))
                db.commit()
        except Exception as exc:
            logger.info("scheme action create failed: %s", str(exc)[:150])
            try:
                db.rollback()
            except Exception:
                pass
        return {"handled": True, "reply": reply}
    except Exception as exc:
        logger.info("handle_scheme failed: %s", str(exc)[:150])
        return {"handled": False}
