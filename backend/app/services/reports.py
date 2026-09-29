"""Daily one-page PDF report (WhatsApp + Web). Pure reportlab platypus. Never raises."""

import io
import logging
from datetime import date, datetime, timedelta

logger = logging.getLogger("vyapaarai.reports")


def _oid(owner_id) -> int:
    try:
        v = int(owner_id or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def _inr(x) -> str:
    try:
        return f"₹{int(round(float(x or 0))):,}"
    except Exception:
        return "₹0"


def build_daily_pdf(db, owner_id: int = 1) -> bytes:
    """ONE-page A4 daily report. Returns PDF bytes (always, never raises)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from app.services import intelligence as eng

    oid = _oid(owner_id)
    today = date.today()

    # --- owner + business name ---
    biz = ""
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        biz = str(getattr(prof, "business_name", "") or "").strip()
    except Exception:
        prof = None
    if not biz:
        try:
            from app import config as _cfg

            biz = str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip()
        except Exception:
            biz = ""
    biz = biz or "Sharma Kirana Traders"

    # --- block 1: health ---
    try:
        hs = eng.health_score(db, owner_id=oid)
        overall = int(hs.get("overall", 0))
        grade = str(hs.get("grade", ""))
        subs = hs.get("subscores", []) or []
    except Exception:
        overall, grade, subs = 0, "", []

    # --- block 2: revenue ---
    try:
        rev_today = eng.revenue_between(db, today, today, oid)
        w_end, w_start = today, today - timedelta(days=6)
        p_end, p_start = today - timedelta(days=7), today - timedelta(days=13)
        rev_7 = eng.revenue_between(db, w_start, w_end, oid)
        rev_prev7 = eng.revenue_between(db, p_start, p_end, oid)
        pct = ((rev_7 - rev_prev7) / rev_prev7 * 100) if rev_prev7 > 0 else 0.0
    except Exception:
        rev_today, rev_7, pct = 0.0, 0.0, 0.0

    # --- block 3: low stock top 5 ---
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
                sd_txt = f"{sd:.0f}d" if sd is not None else "—"
            except Exception:
                sd_txt = "—"
            low_rows.append([
                str(prod.name or "")[:28],
                f"{float(inv.stock_qty or 0):.0f}",
                f"{float(inv.reorder_level or 0):.0f}",
                sd_txt,
            ])
    except Exception:
        low_rows = []

    # --- block 4: overdue ---
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
                str((cust.name if cust else "") or "")[:20],
                str(rec.invoice_no or ""),
                _inr(rec.amount),
                f"{late}d",
            ])
    except Exception:
        od_rows = []

    # --- block 5: pending actions top 3 ---
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
            act_rows.append([str(a.title or "")[:60]])
    except Exception:
        act_rows = []

    # --- compose ---
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=14 * mm,
        title=f"VyapaarAI Daily Report {today.isoformat()}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=15, leading=18, spaceAfter=1)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=10, leading=13,
                        spaceBefore=6, spaceAfter=3, textColor=colors.HexColor("#065f46"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7.5, leading=10)
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=7.5, leading=10)
    big = ParagraphStyle("big", parent=styles["Normal"], fontSize=26, leading=28)

    story = [
        Paragraph(f"{biz} — VyapaarAI Daily Report", h1),
        Paragraph(f"{today.strftime('%d %b %Y')} • one page, har subah", small),
        Spacer(1, 2),
    ]

    # health
    story.append(Paragraph(f"Health: {overall}/100 ({grade})", h2))
    story.append(Paragraph(f"<font size=26><b>{overall}</b></font>"
                           f" &nbsp; <font color='#065f46'>{grade}</font>", big))
    if subs:
        data = [["Area", "Score", "Driver"]]
        for s in subs[:4]:
            try:
                data.append([str(s.get("name", "")), str(s.get("score", "")),
                             str(s.get("breakdown", ""))[:90]])
            except Exception:
                continue
        t = Table(data, colWidths=[28 * mm, 14 * mm, 138 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)

    # revenue
    story.append(Paragraph(
        f"Revenue: aaj {_inr(rev_today)} • last 7d {_inr(rev_7)} "
        f"({pct:+.1f}% vs prev 7d)", h2))

    # low stock
    story.append(Paragraph("Low stock (top 5)", h2))
    if low_rows:
        t = Table([["SKU", "Stock", "Reorder", "Bachega"]] + low_rows,
                  colWidths=[100 * mm, 26 * mm, 26 * mm, 28 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("Sabhi products mein paryaapt stock hai ✅", cell))

    # overdue
    story.append(Paragraph(f"Overdue udhaar — total {_inr(od_total)}", h2))
    if od_rows:
        t = Table([["Party", "Invoice", "Amount", "Late"]] + od_rows,
                  colWidths=[70 * mm, 40 * mm, 36 * mm, 34 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fee2e2")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("Koi overdue payment nahi ✅", cell))

    # actions
    story.append(Paragraph("Aaj ke actions (top 3 pending)", h2))
    if act_rows:
        for i, (title,) in enumerate(act_rows, start=1):
            story.append(Paragraph(f"{i}. {title}", cell))
    else:
        story.append(Paragraph("Koi pending action nahi — Generate dabao ⚡", cell))

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


def build_credit_pdf(db, owner_id: int = 1) -> bytes:
    """P8-F1: bank-ready loan file. Score + grade + 4 subscores + reasons +
    last-6-months trend + bank_summary + owner/business/phone header +
    'Generated by VyapaarAI' footer. Returns PDF bytes (always, never raises)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from app.services import credit as cred

    oid = _oid(owner_id)
    today = date.today()

    # --- header identity ---
    biz, owner_name, owner_phone = "", "", ""
    try:
        from app.models import OwnerProfile

        prof = db.query(OwnerProfile).filter(OwnerProfile.id == oid).first()
        biz = str(getattr(prof, "business_name", "") or "").strip()
        owner_name = str(getattr(prof, "name", "") or "").strip()
        owner_phone = str(getattr(prof, "phone", "") or "").strip()
    except Exception:
        prof = None
    if not biz:
        try:
            from app import config as _cfg

            biz = str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip()
        except Exception:
            biz = ""
    biz = biz or "Sharma Kirana Traders"

    # --- credit facts (single source: credit_score) ---
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
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=14 * mm,
        title=f"VyapaarAI Credit Report {today.isoformat()}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=15, leading=18, spaceAfter=1)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=10, leading=13,
                        spaceBefore=6, spaceAfter=3, textColor=colors.HexColor("#065f46"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7.5, leading=10)
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=7.5, leading=10)
    big = ParagraphStyle("big", parent=styles["Normal"], fontSize=26, leading=28)

    story = [
        Paragraph(f"{biz} — Loan-Ready Credit Report", h1),
        Paragraph(
            f"Owner: {owner_name or '—'} • Phone: {owner_phone or '—'} • "
            f"Date: {today.strftime('%d %b %Y')} • Score se seedha loan file.",
            small),
        Spacer(1, 2),
        Paragraph(f"Credit Score: {overall}/100 ({grade})", h2),
        Paragraph(f"<font size=26><b>{overall}</b></font>"
                  f" &nbsp; <font color='#065f46'>{grade}</font>", big),
    ]

    if subs:
        data = [["Subscore", "Weight", "Score", "Driver"]]
        for s in subs[:4]:
            try:
                data.append([str(s.get("name", "")), str(s.get("weight", "")),
                             str(s.get("score", "")), str(s.get("breakdown", ""))[:80]])
            except Exception:
                continue
        t = Table(data, colWidths=[52 * mm, 18 * mm, 18 * mm, 92 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)

    if reasons:
        story.append(Paragraph("Reasons (weakest first)", h2))
        for i, r in enumerate(reasons[:4], start=1):
            story.append(Paragraph(f"{i}. {r}"[:220], cell))

    story.append(Paragraph("Last 6 months revenue trend", h2))
    if trend:
        tdata = [["Month", "Revenue"]]
        for k, v in trend:
            tdata.append([k, _inr(v)])
        t = Table(tdata, colWidths=[60 * mm, 60 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ]))
        story.append(t)
        story.append(Paragraph(
            f"{months_data} months of sales data • monthly avg {_inr(monthly_avg)} • "
            f"overdue {_inr(overdue_total)} across {overdue_count} invoices", cell))

    if bank_summary:
        story.append(Paragraph("Bank summary", h2))
        for line in bank_summary.splitlines()[:8]:
            story.append(Paragraph(line[:220] or " ", cell))

    stamp = datetime.now().strftime("%d-%b %H:%M")

    def _footer(canvas, _doc):
        try:
            canvas.saveState()
            canvas.setFont("Helvetica", 7)
            canvas.setFillColor(colors.grey)
            canvas.drawString(14 * mm, 10 * mm, f"Generated by VyapaarAI • {stamp}")
            canvas.restoreState()
        except Exception:
            pass

    try:
        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    except Exception as exc:
        logger.warning("credit pdf build failed: %s", str(exc)[:200])
        buf = io.BytesIO()
        doc2 = SimpleDocTemplate(buf, pagesize=A4)
        doc2.build([Paragraph(f"{biz} credit report unavailable: {exc}"[:200],
                              styles["Normal"])])
    return buf.getvalue()
