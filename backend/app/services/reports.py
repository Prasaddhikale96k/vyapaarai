"""VyapaarAI reports — Bahi-Khata branded PDFs (WhatsApp + Web + Bank).

Design: saffron brand band, ledger section bars, KPI cards, hand-drawn-feel
bar charts (reportlab Drawing), stamp boxes. Latin-only text (Helvetica has
no Devanagari). Every builder never raises — minimal fallback PDF on failure.
"""

import io
import logging
from datetime import date, datetime, timedelta

logger = logging.getLogger("vyapaarai.reports")

# --- brand (mirrors frontend landing tokens) ---
SAFFRON = "#E8771A"
SAFFRON_DARK = "#B85A00"
SAFFRON_SOFT = "#FFF3E0"
EMERALD = "#065F46"
EMERALD_SOFT = "#ECFDF5"
GOLD_SOFT = "#FEF3C7"
ROSE = "#C0392B"
ROSE_SOFT = "#FEE2E2"
INK = "#1A1209"
MUTED = "#8B7355"
LINE = "#E8DDD0"


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def _inr(x) -> str:
    try:
        return f"Rs.{int(round(float(x or 0))):,}"
    except Exception:
        return "Rs.0"


_LATIN_MAP = {
    "₹": "Rs.", "—": "-", "–": "-", "•": "-", "·": "-",
    "✓": "(ok)", "✅": "(ok)", "⚡": "*", "📄": "",
    "❌": "X", "⏳": "", "🙏": "", "→": "->", "←": "<-",
    "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...",
}


def _tx(s) -> str:
    """Engine text -> PDF-safe latin (Helvetica me tofu boxes nahi)."""
    try:
        t = str(s or "")
    except Exception:
        return "-"
    for k, v in _LATIN_MAP.items():
        t = t.replace(k, v)
    out = "".join(ch for ch in t if ord(ch) < 256)
    out = " ".join(out.split())
    return out or "-"


def _ai_advice(facts: str, kind: str) -> list:
    """Best-model AI Salah (groq->gemini->openrouter chain, deterministic fallback).

    kind = "daily" | "credit". Returns max 5 PDF-safe lines. Never raises —
    LLM down ho to facts se seedhi lines (demo_fallback jaisa bharosa).
    """
    fallback = [ln.strip() for ln in facts.split("|") if ln.strip()][:5]
    try:
        from app.services import llm as llm_mod

        if kind == "credit":
            system = ("You are VyapaarAI credit adviser for an Indian kirana/MSME owner. "
                      "Given credit facts, write EXACTLY 4 short Hinglish lines: "
                      "1 sabse badi kamzori, 2 use sudharne ka upay, 3 bank ko khush karne wali baat, "
                      "4 is mahine ka ek action. No jargon, no English-only. Plain lines, no numbering.")
            user = f"Credit facts: {facts}"
        else:
            system = ("You are VyapaarAI adviser for an Indian kirana/MSME owner. "
                      "Given shop facts, write EXACTLY 4 short Hinglish lines: "
                      "1 aaj ki sabse zaroori baat, 2 paisa vasoolne ka upay, "
                      "3 stock ka upay, 4 kal ka pehla kaam. Plain lines, no numbering.")
            user = f"Shop facts: {facts}"
        res = llm_mod.complete_text(system, user, max_tokens=400)
        text = str((res or {}).get("text", "") or "")
        lines = []
        for ln in text.replace("\r", "\n").split("\n"):
            ln = ln.strip().lstrip("0123456789.-•* ").strip()
            if len(ln) >= 12:
                lines.append(_tx(ln)[:220])
            if len(lines) >= 5:
                break
        prov = str((res or {}).get("provider", "") or "")
        if lines and prov != "demo_fallback":
            return lines
    except Exception as exc:
        logger.info("ai advice fallback: %s", str(exc)[:150])
    return [_tx(ln)[:220] for ln in fallback][:5]


def _tone(score) -> str:
    try:
        s = float(score or 0)
    except Exception:
        return MUTED
    if s >= 65:
        return EMERALD
    if s >= 50:
        return SAFFRON_DARK
    return ROSE


# ---------------------------------------------------------------------------
# Shared brand kit
# ---------------------------------------------------------------------------

def _styles():
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("rTitle", parent=base["Heading1"], fontSize=17,
                                leading=20, textColor=colors.HexColor(INK), spaceAfter=0),
        "kicker": ParagraphStyle("rKicker", parent=base["Normal"], fontSize=8,
                                 leading=10, textColor=colors.HexColor(SAFFRON_DARK),
                                 spaceAfter=1),
        "sub": ParagraphStyle("rSub", parent=base["Normal"], fontSize=8.5,
                              leading=11, textColor=colors.HexColor(MUTED)),
        "sec": ParagraphStyle("rSec", parent=base["Heading2"], fontSize=11,
                              leading=14, textColor=colors.HexColor(INK), spaceAfter=0,
                              spaceBefore=0),
        "secsub": ParagraphStyle("rSecSub", parent=base["Normal"], fontSize=7.5,
                                 leading=10, textColor=colors.HexColor(MUTED)),
        "cell": ParagraphStyle("rCell", parent=base["Normal"], fontSize=8,
                               leading=10.5, textColor=colors.HexColor(INK)),
        "cellmut": ParagraphStyle("rCellMut", parent=base["Normal"], fontSize=8,
                                  leading=10.5, textColor=colors.HexColor(MUTED)),
        "kpinum": ParagraphStyle("rKpiNum", parent=base["Normal"], fontSize=14,
                                 leading=16, textColor=colors.HexColor(INK)),
        "kpilab": ParagraphStyle("rKpiLab", parent=base["Normal"], fontSize=7.5,
                                 leading=9, textColor=colors.HexColor(MUTED)),
        "stamp": ParagraphStyle("rStamp", parent=base["Normal"], fontSize=13,
                                leading=15, textColor=colors.HexColor(INK)),
        "quote": ParagraphStyle("rQuote", parent=base["Normal"], fontSize=8.5,
                                leading=12, textColor=colors.HexColor(INK),
                                leftIndent=8, borderPadding=4),
    }


def _top_rule(width_mm: float):
    """Saffron brand band with thin gold under-line."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Table, TableStyle

    t = Table([[""]], colWidths=[width_mm * mm], rowHeights=[3.2 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(SAFFRON)),
        ("LINEBELOW", (0, 0), (-1, -1), 1.2, colors.HexColor(SAFFRON_DARK)),
    ]))
    return t


def _section_head(title: str, hint: str = ""):
    """Ledger section header: saffron spine bar + title + hint."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    st = _styles()
    title, hint = _tx(title), _tx(hint)
    left = Table([[""]], colWidths=[2.2 * mm], rowHeights=[7 * mm])
    left.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(SAFFRON)),
        ("ROUNDEDCORNERS", [1 * mm, 1 * mm, 1 * mm, 1 * mm]),
    ]))
    title_p = Paragraph(f"<b>{title}</b>", st["sec"])
    if hint:
        body = Table([[title_p], [Paragraph(hint, st["secsub"])]],
                     colWidths=[160 * mm])
        body.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
    else:
        body = Table([[title_p]], colWidths=[160 * mm])
        body.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 3 * mm)]))
    outer = Table([[left, body]], colWidths=[4 * mm, 164 * mm])
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return outer


def _kpi_strip(cards: list):
    """Row of tinted KPI mini-cards: [(label, value, delta, tone)]."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    st = _styles()
    n = max(len(cards), 1)
    w = 168.0 / n
    row, bgs = [], []
    for i, (label, value, delta, tone) in enumerate(cards):
        inner = [
            [Paragraph(f"<b>{value}</b>", st["kpinum"])],
            [Paragraph(label, st["kpilab"])],
        ]
        if delta:
            inner.append([Paragraph(
                f"<font color='{tone}'>{delta}</font>", st["kpilab"])])
        cell = Table(inner, colWidths=[(w - 4) * mm])
        cell.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ]))
        row.append(cell)
        bgs.append(tone)
    t = Table([row], colWidths=[w * mm] * n, spaceBefore=2 * mm, spaceAfter=2 * mm)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(LINE)),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(LINE)),
    ]
    for i, tone in enumerate(bgs):
        soft = {"#065F46": EMERALD_SOFT, "#B85A00": SAFFRON_SOFT,
                "#C0392B": ROSE_SOFT}.get(str(tone).upper(), SAFFRON_SOFT)
        style.append(("BACKGROUND", (i, 0), (i, 0), colors.HexColor(soft)))
    t.setStyle(TableStyle(style))
    return t


def _score_bar(score, width_mm: float = 120.0):
    """Ledger score bar: filled tone segment + ink remainder + big number."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    st = _styles()
    try:
        s = max(0.0, min(100.0, float(score or 0)))
    except Exception:
        s = 0.0
    tone = _tone(s)
    fill = max(width_mm * s / 100.0, 2.0 if s > 0 else 0.0)
    bar = Table([["", ""]], colWidths=[fill * mm, max(width_mm - fill, 0.5) * mm],
                rowHeights=[4.5 * mm])
    bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(tone)),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(LINE)),
        ("ROUNDEDCORNERS", [2 * mm, 2 * mm, 2 * mm, 2 * mm]),
    ]))
    num = Paragraph(f"<b><font size=22>{int(round(s))}</font></b>"
                    f"<font size=10 color='{MUTED}'>/100</font>", st["stamp"])
    outer = Table([[num, bar]], colWidths=[30 * mm, (width_mm + 4) * mm])
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    return outer


def _bars_chart(pairs: list, width_mm: float = 168.0, height_mm: float = 42.0,
                bar_color: str = SAFFRON, hi_color: str = EMERALD):
    """Hand-drawn-feel vertical bars with value + month labels."""
    from reportlab.graphics.shapes import Drawing, Line, Rect, String
    from reportlab.lib import colors
    from reportlab.lib.units import mm

    d = Drawing(width_mm * mm, height_mm * mm)
    if not pairs:
        return d
    try:
        vals = [max(float(v or 0), 0.0) for _, v in pairs]
    except Exception:
        return d
    vmax = max(vals) if vals and max(vals) > 0 else 1.0
    n = len(pairs)
    slot = (width_mm * mm) / n
    bw = min(slot * 0.52, 14 * mm)
    base = 8 * mm
    top = height_mm * mm - 4 * mm
    hi = max(range(n), key=lambda i: vals[i])
    for i, ((label, _v), v) in enumerate(zip(pairs, vals)):
        h = max((top - base) * (v / vmax), 1.2 * mm)
        x = i * slot + (slot - bw) / 2
        d.add(Rect(x, base, bw, h, fillColor=colors.HexColor(
            hi_color if i == hi else bar_color),
            strokeColor=colors.HexColor(
                SAFFRON_DARK if i != hi else EMERALD), strokeWidth=0.6))
        try:
            short = _inr(v) if v >= 1000 else str(int(round(v)))
        except Exception:
            short = ""
        d.add(String(x + bw / 2, base + h + 1.2 * mm, short,
                     fontSize=5.5, textAnchor="middle",
                     fillColor=colors.HexColor(MUTED)))
        d.add(String(x + bw / 2, 2.2 * mm, str(label or "")[:7],
                     fontSize=5.5, textAnchor="middle",
                     fillColor=colors.HexColor(MUTED)))
    d.add(Line(0, base, width_mm * mm, base, strokeColor=colors.HexColor(LINE),
               strokeWidth=0.7))
    return d


def _styled_table(header: list, rows: list, widths_mm: list, head_bg: str):
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    st = _styles()
    data = [[Paragraph(f"<b>{h}</b>", st["cell"]) for h in header]]
    for r in rows:
        data.append([Paragraph(str(c or "—")[:64],
                               st["cell"] if j < 2 else st["cellmut"])
                     for j, c in enumerate(r)])
    t = Table(data, colWidths=[w * mm for w in widths_mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_bg)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(LINE)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#FDF8F0")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def _stamp_box(big: str, small: str, tone: str):
    """Rotated-stamp feel: thick tone border box with big text."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    st = _styles()
    inner = Table([
        [Paragraph(f"<b>{big}</b>", st["stamp"])],
        [Paragraph(small, st["sub"])],
    ], colWidths=[60 * mm])
    inner.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 1.6, colors.HexColor(tone)),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor(tone)),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    return inner


def _page_footer(stamp: str):
    def _footer(canvas, _doc):
        from reportlab.lib import colors
        from reportlab.lib.units import mm

        try:
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor(SAFFRON))
            canvas.setLineWidth(1.2)
            canvas.line(14 * mm, 12 * mm, 196 * mm, 12 * mm)
            canvas.setFont("Helvetica", 7)
            canvas.setFillColor(colors.HexColor(MUTED))
            canvas.drawString(
                14 * mm, 8.5 * mm,
                f"AI suggests. Owner decides.  |  Generated by VyapaarAI  |  {stamp}")
            canvas.drawRightString(
                196 * mm, 8.5 * mm, "vyapaarai")
            canvas.restoreState()
        except Exception:
            pass
    return _footer


def _doc(buf, title: str):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate

    return SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=10 * mm, bottomMargin=16 * mm, title=title)


def _identity(db, oid: int):
    biz, owner_name, owner_phone, prof = "", "", "", None
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        biz = str(getattr(prof, "business_name", "") or "").strip()
        owner_name = str(getattr(prof, "name", "") or "").strip()
        owner_phone = str(getattr(prof, "phone", "") or "").strip()
    except Exception:
        pass
    if not biz:
        try:
            from app import config as _cfg

            biz = str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip()
        except Exception:
            biz = ""
    return (biz or "Sharma Kirana Traders"), owner_name, owner_phone


def _daily_trend(db, oid: int, days: int = 14) -> list:
    """Last-N-days revenue bars (dd/mm labels)."""
    out = []
    try:
        from app.services import intelligence as eng

        today = date.today()
        for i in range(max(int(days or 14), 1) - 1, -1, -1):
            d = today - timedelta(days=i)
            try:
                rev = float(eng.revenue_between(db, d, d, oid) or 0)
            except Exception:
                rev = 0.0
            out.append((d.strftime("%d/%m"), round(rev, 2)))
    except Exception:
        pass
    return out


# ---------------------------------------------------------------------------
# Daily report
# ---------------------------------------------------------------------------

def build_daily_pdf(db, owner_id: int = 1) -> bytes:
    """ONE-page A4 daily hisab. Returns PDF bytes (always, never raises)."""
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer

    from app.services import intelligence as eng

    oid = _oid(owner_id)
    today = date.today()
    biz, owner_name, _phone = _identity(db, oid)
    st = _styles()

    try:
        hs = eng.health_score(db, owner_id=oid)
        overall = int(hs.get("overall") or 0)
        grade = str(hs.get("grade") or "")
        subs = hs.get("subscores", []) or []
        headline = str(hs.get("headline") or "")
    except Exception:
        overall, grade, subs, headline = 0, "", [], ""

    try:
        rev_today = eng.revenue_between(db, today, today, oid)
        w_end, w_start = today, today - timedelta(days=6)
        p_end, p_start = today - timedelta(days=7), today - timedelta(days=13)
        rev_7 = eng.revenue_between(db, w_start, w_end, oid)
        rev_prev7 = eng.revenue_between(db, p_start, p_end, oid)
        pct = ((rev_7 - rev_prev7) / rev_prev7 * 100) if rev_prev7 > 0 else 0.0
    except Exception:
        rev_today, rev_7, rev_prev7, pct = 0.0, 0.0, 0.0, 0.0

    low_rows: list = []
    try:
        from app.models import InventoryItem, Product

        invs = (
            db.query(InventoryItem, Product)
            .join(Product, InventoryItem.product_id == Product.id)
            .filter(InventoryItem.owner_id == oid, Product.owner_id == oid,
                    InventoryItem.stock_qty <= InventoryItem.reorder_level)
            .order_by(InventoryItem.stock_qty)
            .limit(5)
            .all()
        )
        for inv, prod in invs:
            try:
                avg = eng._avg_daily_28(db, prod.id, today, oid)
                sd = (float(inv.stock_qty or 0) / avg) if avg and avg > 0 else None
                sd_txt = f"{sd:.0f} din" if sd is not None else "—"
            except Exception:
                sd_txt = "—"
            low_rows.append([
                _tx(prod.name or "")[:28],
                f"{float(inv.stock_qty or 0):.0f}",
                f"{float(inv.reorder_level or 0):.0f}",
                sd_txt,
            ])
    except Exception:
        low_rows = []

    od_rows: list = []
    od_total = 0.0
    try:
        from app.models import Customer, Receivable

        recs = (
            db.query(Receivable, Customer)
            .join(Customer, Receivable.customer_id == Customer.id)
            .filter(Receivable.owner_id == oid,
                    Receivable.paid.is_(False), Receivable.due_date < today)
            .order_by(Receivable.due_date)
            .limit(8)
            .all()
        )
        for rec, cust in recs:
            try:
                late = (today - rec.due_date).days if rec.due_date else 0
            except Exception:
                late = 0
            try:
                od_total += float(rec.amount or 0)
            except Exception:
                pass
            od_rows.append([
                _tx((cust.name if cust else "") or "")[:20],
                _tx(rec.invoice_no or ""),
                _inr(rec.amount),
                f"{late}d late" if late > 30 else f"{late}d",
            ])
    except Exception:
        od_rows = []

    act_rows: list = []
    try:
        from app.models import Action

        acts = (
            db.query(Action)
            .filter(Action.owner_id == oid, Action.status == "pending")
            .order_by(Action.id.desc())
            .limit(3)
            .all()
        )
        for a in acts:
            act_rows.append(_tx(a.title or "")[:70])
    except Exception:
        act_rows = []

    trend = _daily_trend(db, oid, 14)

    buf = io.BytesIO()
    doc = _doc(buf, f"VyapaarAI Daily {today.isoformat()}")
    story = [
        _top_rule(182),
        Paragraph("VYAPAARAI - DAILY HISAB", st["kicker"]),
        Paragraph(_tx(biz), st["title"]),
        Paragraph(
            _tx(f"{today.strftime('%d %b %Y')} - Malik: {owner_name or '-'}"
                + (f" - {headline}" if headline else "")), st["sub"]),
        Spacer(1, 2 * mm),
    ]

    story.append(_section_head("Dukaan ki sehat", f"Grade: {grade or '—'}"))
    story.append(_score_bar(overall))
    if subs:
        srows = []
        for s in subs[:4]:
            try:
                sc = s.get("score", "")
                srows.append([_tx(s.get("name", "")),
                              ("-" if sc is None else _tx(sc)),
                              _tx(s.get("breakdown", ""))[:80]])
            except Exception:
                continue
        story.append(_styled_table(["Area", "Score", "Driver"], srows,
                                   [34, 16, 118], EMERALD_SOFT))

    story.append(_section_head("Paisa — 7 din ka khel",
                               f"pichhle 7 din se {pct:+.1f}%"))
    story.append(_kpi_strip([
        ("Aaj ki bikri", _inr(rev_today), "", EMERALD),
        ("7-din bikri", _inr(rev_7), f"{pct:+.1f}% vs pichhle 7",
         EMERALD if pct >= 0 else ROSE),
        ("Atka udhaar", _inr(od_total),
         f"{len(od_rows)} bills" if od_rows else "sab vasool",
         ROSE if od_total > 0 else EMERALD),
        ("Low stock", str(len(low_rows)),
         "turant lao" if low_rows else "sab thik", ROSE if low_rows else EMERALD),
    ]))
    if trend and any(v for _, v in trend):
        story.append(_bars_chart(trend))

    story.append(_section_head("AI Salah", "aaj ke numbers par aadharit"))
    facts = (
        f"Health {overall}/100 ({grade}) | 7-din bikri {_inr(rev_7)} ({pct:+.1f}%) | "
        f"Atka udhaar {_inr(od_total)} ({len(od_rows)} bills) | "
        f"Low stock {len(low_rows)} items | Pending actions {len(act_rows)}"
    )
    for i, line in enumerate(_ai_advice(facts, "daily"), start=1):
        story.append(Paragraph(f"<b>{i}.</b> {line}", st["cell"]))

    story.append(_section_head("Khatm hone wala maal", "top 5 — ye pehle lao"))
    if low_rows:
        story.append(_styled_table(["Item", "Stock", "Level", "Bachega"],
                                   low_rows, [86, 26, 26, 30], GOLD_SOFT))
    else:
        story.append(Paragraph("Sabhi products me paryaapt stock hai.", st["cell"]))

    story.append(_section_head("Udhaar — paisa atka hai", f"total {_inr(od_total)}"))
    if od_rows:
        story.append(_styled_table(["Party", "Bill", "Rakam", "Late"],
                                   od_rows, [62, 40, 36, 30], ROSE_SOFT))
    else:
        story.append(Paragraph("Koi overdue payment nahi.", st["cell"]))

    story.append(_section_head("Kal ke 3 kaam", "malik approve karega"))
    if act_rows:
        for i, title in enumerate(act_rows, start=1):
            story.append(Paragraph(
                f"<font color='{SAFFRON_DARK}'>[ ]</font> <b>{i}.</b> {_tx(title)}",
                st["cell"]))
    else:
        story.append(Paragraph("Koi pending action nahi — app me Generate dabao.",
                               st["cell"]))

    stamp = datetime.now().strftime("%d-%b %H:%M")
    try:
        doc.build(story, onFirstPage=_page_footer(stamp),
                  onLaterPages=_page_footer(stamp))
    except Exception as exc:
        logger.warning("pdf build failed: %s", str(exc)[:200])
        buf = io.BytesIO()
        from reportlab.lib.styles import getSampleStyleSheet as _gss
        from reportlab.platypus import SimpleDocTemplate as _SDT

        _SDT(buf, title="VyapaarAI Daily").build(
            [Paragraph(f"{biz} daily report unavailable",
                       _gss()["Normal"])])
    return buf.getvalue()


def _monthly_trend(db, owner_id: int, months: int = 6) -> list:
    """Last-N-months revenue buckets (portable: bucketed in Python, sqlite+PG safe)."""
    from datetime import date as _date

    from app.models import Sale

    oid = _oid(owner_id)
    today = _date.today()
    buckets: dict = {}
    order: list = []
    y, m = today.year, today.month
    for _ in range(max(int(months or 6), 1)):
        key = f"{y:04d}-{m:02d}"
        order.append(key)
        buckets[key] = 0.0
        m -= 1
        if m < 1:
            m, y = 12, y - 1
    order.reverse()
    try:
        first = order[0] + "-01"
        rows = (
            db.query(Sale.date, Sale.amount)
            .filter(Sale.owner_id == oid, Sale.date >= _date.fromisoformat(first))
            .all()
        )
        for d, amt in rows:
            try:
                key = d.strftime("%Y-%m") if d else ""
            except Exception:
                key = ""
            if key in buckets:
                try:
                    buckets[key] += float(amt or 0)
                except Exception:
                    pass
    except Exception as exc:
        logger.info("monthly trend failed: %s", str(exc)[:150])
    return [(k, round(buckets.get(k, 0.0), 2)) for k in order]


# ---------------------------------------------------------------------------
# Credit (bank-ready) report
# ---------------------------------------------------------------------------

def build_credit_pdf(db, owner_id: int = 1) -> bytes:
    """Bank-ready loan file: stamp + subscores + reasons + 6-month chart +
    bank summary. Returns PDF bytes (always, never raises)."""
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer

    from app.services import credit as cred

    oid = _oid(owner_id)
    today = date.today()
    biz, owner_name, owner_phone = _identity(db, oid)
    st = _styles()

    try:
        cs = cred.credit_score(db, owner_id=oid)
    except Exception:
        cs = {}
    overall = int(cs.get("overall", 0) or 0)
    grade = str(cs.get("grade", "") or "")
    subs = cs.get("subscores", []) or []
    reasons = cs.get("reasons", []) or []
    bank_summary = str(cs.get("bank_summary", "") or "")
    months_data = cs.get("months_data", 0)
    monthly_avg = cs.get("monthly_revenue_avg", 0.0)
    overdue_total = cs.get("overdue_total", 0.0)
    overdue_count = cs.get("overdue_count", 0)
    trend = _monthly_trend(db, oid, 6)

    buf = io.BytesIO()
    doc = _doc(buf, f"VyapaarAI Credit {today.isoformat()}")
    tone = _tone(overall)
    story = [
        _top_rule(182),
        Paragraph("VYAPAARAI - BANK-READY CREDIT FILE", st["kicker"]),
        Paragraph(_tx(biz), st["title"]),
        Paragraph(
            _tx(f"Malik: {owner_name or '-'} - Phone: {owner_phone or '-'} - "
                f"Date: {today.strftime('%d %b %Y')}"), st["sub"]),
        Spacer(1, 2 * mm),
        _stamp_box(f"{overall}/100  •  {grade or '—'}",
                   "Business Credit Score — bank isi ko dekhta hai", tone),
        Spacer(1, 2 * mm),
    ]

    story.append(_section_head("Score ke 4 hisse", "wazan ke saath"))
    if subs:
        srows = []
        for s in subs[:4]:
            try:
                srows.append([_tx(s.get("name", "")),
                              _tx(s.get("weight", "")),
                              _tx(s.get("score", "")),
                              _tx(s.get("breakdown", ""))[:70]])
            except Exception:
                continue
        story.append(_styled_table(["Hissa", "Wazan", "Score", "Driver"],
                                   srows, [56, 20, 20, 72], EMERALD_SOFT))

    story.append(_section_head("AI Salah", "bank-file ke liye best-model raay"))
    cfacts = (
        f"Score {overall}/100 ({grade}) | Ausat {_inr(monthly_avg)}/mahina ({months_data} mahine) | "
        f"Overdue {_inr(overdue_total)} ({overdue_count} bills) | "
        f"Reasons: {'; '.join([str(r)[:80] for r in reasons[:2]])}"
    )
    for i, line in enumerate(_ai_advice(cfacts, "credit"), start=1):
        story.append(Paragraph(f"<b>{i}.</b> {line}", st["cell"]))

    if reasons:
        story.append(_section_head("Bank kya sochega", "sabse kamzor pehle"))
        for i, r in enumerate(reasons[:4], start=1):
            story.append(Paragraph(f"<b>{i}.</b> {_tx(r)[:220]}", st["cell"]))

    story.append(_section_head("6 mahine ki kamai", f"ausat {_inr(monthly_avg)}/mahina"))
    if trend and any(v for _, v in trend):
        story.append(_bars_chart(
            [(k[5:], v) for k, v in trend], hi_color=EMERALD))
    story.append(Paragraph(
        f"{months_data} mahine ka data • overdue {_inr(overdue_total)} "
        f"({overdue_count} bills)", st["sub"]))

    if bank_summary:
        story.append(_section_head("Bank ke liye summary", "copy-paste ready"))
        for line in bank_summary.splitlines()[:8]:
            story.append(Paragraph(_tx(line.strip() or " ")[:220], st["quote"]))

    stamp = datetime.now().strftime("%d-%b %H:%M")
    try:
        doc.build(story, onFirstPage=_page_footer(stamp),
                  onLaterPages=_page_footer(stamp))
    except Exception as exc:
        logger.warning("credit pdf build failed: %s", str(exc)[:200])
        buf = io.BytesIO()
        from reportlab.lib.styles import getSampleStyleSheet as _gss
        from reportlab.platypus import SimpleDocTemplate as _SDT

        _SDT(buf, title="VyapaarAI Credit").build(
            [Paragraph(f"{biz} credit report unavailable",
                       _gss()["Normal"])])
    return buf.getvalue()
