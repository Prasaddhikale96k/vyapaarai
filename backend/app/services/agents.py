"""VyapaarAI Agent tools + orchestration (P3)."""

import json
import logging
import os
import re
import threading
from datetime import date, timedelta

from sqlalchemy import func, text

logger = logging.getLogger("vyapaarai.agents")

ALLOWED_TABLES = ["products", "sales", "inventory", "receivables", "expenses", "customers", "actions"]

# Owner context: orchestrate() sets it; tools read it. Default 1 (legacy/CLI safe).
_owner_ctx = threading.local()


def _oid(owner_id=None) -> int:
    try:
        if owner_id is not None:
            v = int(owner_id)
            return v if v > 0 else 1
    except Exception:
        pass
    try:
        v = int(getattr(_owner_ctx, "owner_id", 1) or 1)
        return v if v > 0 else 1
    except Exception:
        return 1


def _set_owner(owner_id) -> None:
    try:
        _owner_ctx.owner_id = _oid(owner_id)
    except Exception:
        pass


def scope_sql(query: str, owner_id) -> str:
    """Har ALLOWED_TABLES table ko owner-scoped subquery me lapeto.

    FROM sales → FROM (SELECT * FROM sales WHERE owner_id=N) AS sales
    (alias ho to wahi alias rehta hai). Ek re.sub pass per table.
    Non-string ya khaali → wapas as-is (caller validate karega).
    """
    try:
        oid = _oid(owner_id)
        q = str(query or "")
        if not q.strip():
            return q
        for table in ALLOWED_TABLES:
            pat = re.compile(
                r"\b(FROM|JOIN)\s+" + re.escape(table) + r"(?:\s+(?:AS\s+)?([A-Za-z_][\w$]*))?",
                re.IGNORECASE,
            )

            def _repl(m, _t=table, _oid=oid):
                kw = m.group(1)
                alias = m.group(2) or _t
                # agar pehle se subquery/derived hai to chhodo (heuristic: alias '(' se shuru nahi hota kabhi)
                return f"{kw} (SELECT * FROM {_t} WHERE owner_id={_oid}) AS {alias}"

            q = pat.sub(_repl, q)
        return q
    except Exception:
        try:
            return str(query or "")
        except Exception:
            return ""

_FORBIDDEN = [
    "insert", "update", "delete", "drop", "alter",
    "truncate", "create", "attach", "pragma", "grant",
]


def _own_session():
    from app.db import SessionLocal

    return SessionLocal()


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

def tool_run_sql(query: str, owner_id=None) -> str:
    try:
        if not isinstance(query, str) or not query.strip():
            return "ERROR: empty query"
        # FIRST scope per owner, THEN safety checks (spec order).
        q = scope_sql(query.strip(), _oid(owner_id))
        if not q.strip():
            return "ERROR: empty query"
        q_stripped = q
        if not q_stripped[:6].lower() == "select" and not q_stripped.lower().startswith("select"):
            # case-insensitive start check after strip (also allow leading '(' ? no — must start with SELECT)
            return "ERROR: only SELECT queries allowed"
        # single statement: remove one trailing ';' then no ';' may remain
        tmp = q_stripped.rstrip()
        if tmp.endswith(";"):
            tmp = tmp[:-1]
        if ";" in tmp:
            return "ERROR: only single SELECT statement allowed"
        low = q.lower()
        for word in _FORBIDDEN:
            if re.search(r"\b" + re.escape(word) + r"\b", low):
                return "ERROR: forbidden keyword: " + word
        from app.db import SessionLocal

        db = SessionLocal()
        try:
            rows = db.execute(text(q)).fetchall()
            out = []
            for r in rows:
                try:
                    d = dict(r._mapping)
                except Exception:
                    d = {}
                # dates -> isoformat via default=str in dumps, but do explicitly
                for k, v in list(d.items()):
                    try:
                        if hasattr(v, "isoformat"):
                            d[k] = v.isoformat()
                    except Exception:
                        pass
                out.append(d)
            return json.dumps(out[:200], default=str)[:4000]
        except Exception as exc:
            return f"ERROR: {exc}"
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        return f"ERROR: {exc}"


def tool_get_metric(name: str, owner_id=None) -> str:
    try:
        from app.db import SessionLocal
        from app.services import intelligence as eng
        from app.models import InventoryItem, Receivable, Sale

        oid = _oid(owner_id)
        key = str(name or "").strip()
        valid = {
            "revenue_30d", "revenue_prev_30d",
            "gross_margin_30d", "gross_margin_prev_30d",
            "profit_cur", "profit_prev",
            "overdue_total", "overdue_count", "outstanding_total",
            "stock_below_reorder_count", "dead_stock_count",
            "health_overall",
        }
        if key not in valid:
            return "ERROR: unknown metric"
        db = SessionLocal()
        try:
            cur_start, cur_end, prev_start, prev_end = eng.windows()
            if key == "revenue_30d":
                return json.dumps(float(eng.revenue_between(db, cur_start, cur_end, oid)))
            if key == "revenue_prev_30d":
                return json.dumps(float(eng.revenue_between(db, prev_start, prev_end, oid)))
            if key == "gross_margin_30d":
                return json.dumps(float(eng.gross_margin_between(db, cur_start, cur_end, oid)))
            if key == "gross_margin_prev_30d":
                return json.dumps(float(eng.gross_margin_between(db, prev_start, prev_end, oid)))
            if key in ("profit_cur", "profit_prev"):
                rc = eng.root_cause(db, owner_id=oid)
                return json.dumps(float(rc.get(key, 0.0)))
            if key in ("overdue_total", "overdue_count", "outstanding_total"):
                t = date.today()
                try:
                    outstanding = db.query(func.sum(Receivable.amount)).filter(
                        Receivable.owner_id == oid, Receivable.paid.is_(False)).scalar()
                except Exception:
                    outstanding = None
                try:
                    overdue_amount = db.query(func.sum(Receivable.amount)).filter(
                        Receivable.owner_id == oid, Receivable.paid.is_(False), Receivable.due_date < t).scalar()
                except Exception:
                    overdue_amount = None
                try:
                    overdue_count = db.query(func.count(Receivable.id)).filter(
                        Receivable.owner_id == oid, Receivable.paid.is_(False), Receivable.due_date < t).scalar()
                except Exception:
                    overdue_count = 0
                if key == "overdue_total":
                    return json.dumps(float(overdue_amount) if overdue_amount is not None else 0.0)
                if key == "overdue_count":
                    return json.dumps(int(overdue_count) if overdue_count is not None else 0)
                return json.dumps(float(outstanding) if outstanding is not None else 0.0)
            if key == "stock_below_reorder_count":
                try:
                    n = db.query(func.count(InventoryItem.id)).filter(
                        InventoryItem.owner_id == oid,
                        InventoryItem.stock_qty <= InventoryItem.reorder_level).scalar()
                except Exception:
                    n = 0
                return json.dumps(int(n or 0))
            if key == "dead_stock_count":
                t = date.today()
                cutoff = t - timedelta(days=44)
                try:
                    sold_ids = {
                        r[0] for r in db.query(Sale.product_id).filter(
                            Sale.owner_id == oid, Sale.date >= cutoff, Sale.date <= t).distinct().all()
                    }
                except Exception:
                    sold_ids = set()
                try:
                    inv_rows = db.query(InventoryItem.product_id, InventoryItem.stock_qty).filter(
                        InventoryItem.owner_id == oid).all()
                except Exception:
                    inv_rows = []
                dead = sum(1 for pid, sq in inv_rows if (sq or 0) > 0 and pid not in sold_ids)
                return json.dumps(int(dead))
            if key == "health_overall":
                hs = eng.health_score(db, owner_id=oid)
                return json.dumps(int(hs.get("overall") or 0))
            return "ERROR: unknown metric"
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        return f"ERROR: {exc}"


def tool_forecast(sku: str, days: int = 14, owner_id=None) -> str:
    try:
        from app.db import SessionLocal
        from app.services import intelligence as eng

        if not sku or not str(sku).strip():
            return "ERROR: missing sku"
        try:
            d = int(days)
        except Exception:
            d = 14
        db = SessionLocal()
        try:
            res = eng.forecast_product(db, str(sku).strip(), d, owner_id=_oid(owner_id))
        finally:
            try:
                db.close()
            except Exception:
                pass
        return json.dumps(res, default=str)[:4000]
    except Exception as exc:
        return f"ERROR: {exc}"


def tool_buy_sell_matrix(owner_id=None) -> str:
    try:
        from app.db import SessionLocal
        from app.services import intelligence as eng

        db = SessionLocal()
        try:
            res = eng.buy_sell_matrix(db, owner_id=_oid(owner_id))
        finally:
            try:
                db.close()
            except Exception:
                pass
        prods = res.get("products", []) if isinstance(res, dict) else []
        slim = [
            {
                "sku": p.get("sku"),
                "quadrant": p.get("quadrant"),
                "action": p.get("action"),
                "velocity_30": p.get("velocity_30"),
                "margin_pct": p.get("margin_pct"),
            }
            for p in prods if isinstance(p, dict)
        ]
        return json.dumps(slim, default=str)[:4000]
    except Exception as exc:
        return f"ERROR: {exc}"


tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": "Run a read-only SELECT query against the business SQLite DB and return rows as JSON.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A single SELECT statement, e.g. SELECT COUNT(*) AS n FROM products",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metric",
            "description": "Get a precomputed business metric for last-30d vs prev-30d windows.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": (
                            "One of: revenue_30d, revenue_prev_30d, gross_margin_30d, "
                            "gross_margin_prev_30d, profit_cur, profit_prev, overdue_total, "
                            "overdue_count, outstanding_total, stock_below_reorder_count, "
                            "dead_stock_count, health_overall"
                        ),
                    }
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "forecast",
            "description": "Forecast daily demand for a product SKU.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "Product SKU, e.g. ST-ATTA-5KG"},
                    "days": {"type": "integer", "description": "Forecast horizon in days (1-60)", "default": 14},
                },
                "required": ["sku"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buy_sell_matrix",
            "description": "Get product quadrant classification (STAR/VOLUME/HIDDEN_GEM/EXIT) with velocity and margin.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def executor(name: str, args: dict, owner_id=None) -> str:
    try:
        oid = _oid(owner_id)
        n = str(name or "").strip()
        # accept both bare and tool_-prefixed names
        if n.startswith("tool_"):
            n = n[len("tool_"):]
        a = args if isinstance(args, dict) else {}
        if n == "run_sql":
            return tool_run_sql(str(a.get("query", "") or ""), oid)
        if n == "get_metric":
            return tool_get_metric(str(a.get("name", "") or ""), oid)
        if n == "forecast":
            sku = str(a.get("sku", "") or "")
            days = a.get("days", 14)
            try:
                days_i = int(days)
            except Exception:
                days_i = 14
            return tool_forecast(sku, days_i, oid)
        if n == "buy_sell_matrix":
            return tool_buy_sell_matrix(oid)
        return "ERROR: unknown tool"
    except Exception as exc:
        return f"ERROR: {exc}"


def executor_for(owner_id):
    """Owner-bound executor closure (LLM tools ke liye)."""
    oid = _oid(owner_id)

    def _exec(name: str, args: dict) -> str:
        return executor(name, args, oid)

    return _exec


# ---------------------------------------------------------------------------
# Language + specialists + orchestration
# ---------------------------------------------------------------------------

_COMMON_RULES = (
    "Use tools before answering. Never invent numbers. "
    "If data insufficient, say so. Reply in 5-8 bullet findings with numbers."
)

SPECIALISTS = {
    "sales": (
        "You are the SALES AGENT of VyapaarAI. Investigate revenue, product "
        "performance, growth, margin mix. Use tools; ground every number; INR \u20b9. "
        + _COMMON_RULES
    ),
    "inventory": (
        "You are the INVENTORY AGENT of VyapaarAI. Investigate stock levels, "
        "velocity, stockout risk, dead stock, reordering. Use tools; ground every "
        "number; INR \u20b9. " + _COMMON_RULES
    ),
    "finance": (
        "You are the FINANCE AGENT of VyapaarAI. Investigate receivables, "
        "expenses, margins, cash pressure. Use tools; ground every number; INR \u20b9. "
        + _COMMON_RULES
    ),
}

_PLANNER_SYSTEM = (
    "You are a planner for VyapaarAI. Given the owner's question, decide which "
    "specialist agents should investigate. MUST return JSON only, no other text: "
    '{"specialists": ["sales"|"inventory"|"finance", ...], "focus": "<one line>"}'
)


def detect_language(text: str) -> str:
    try:
        s = str(text or "")
        for ch in s:
            o = ord(ch)
            if 0x0900 <= o <= 0x097F:
                return "hi"
        for ch in s:
            o = ord(ch)
            if 0x0B80 <= o <= 0x0BFF:
                return "ta"
        for ch in s:
            o = ord(ch)
            if 0x0980 <= o <= 0x09FF:
                return "bn"
        for ch in s:
            o = ord(ch)
            if 0x0A00 <= o <= 0x0A7F:
                return "pa"
        return "en"
    except Exception:
        return "en"


def _parse_plan(text: str) -> tuple[list, str]:
    try:
        m = re.search(r"\{.*\}", text or "", re.DOTALL)
        if not m:
            raise ValueError("no json")
        data = json.loads(m.group(0))
        specs = data.get("specialists", [])
        focus = str(data.get("focus", "") or "")
        if not isinstance(specs, list):
            raise ValueError("bad specialists")
        cleaned = [s for s in specs if s in ("sales", "inventory", "finance")]
        if not cleaned:
            raise ValueError("empty specialists")
        return cleaned[:3], focus
    except Exception:
        return (["sales", "inventory", "finance"], "")


def _business_name() -> str:
    v = os.getenv("BUSINESS_NAME")
    if v and v.strip():
        return v.strip()
    try:
        from app import config as _cfg

        return str(getattr(_cfg, "BUSINESS_NAME", "") or "").strip() or "Sharma Kirana Traders"
    except Exception:
        return "Sharma Kirana Traders"


def _prefetch_context_block(owner_id=None) -> str:
    try:
        from app.db import SessionLocal
        from app.services import intelligence as eng

        oid = _oid(owner_id)
        db = SessionLocal()
        try:
            try:
                hs = eng.health_score(db, owner_id=oid)
            except Exception:
                hs = {}
            metrics = {}
            for m in (
                "revenue_30d", "revenue_prev_30d", "profit_cur", "profit_prev",
                "overdue_total", "overdue_count", "outstanding_total",
                "stock_below_reorder_count", "dead_stock_count", "health_overall",
            ):
                try:
                    metrics[m] = json.loads(tool_get_metric(m, oid))
                except Exception:
                    pass
            ctx = (
                f"Health summary: {json.dumps(hs, default=str)[:2000]}. "
                f"Key metrics: {json.dumps(metrics, default=str)[:2000]}."
            )
            return ctx
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        return f"Context unavailable: {exc}"


def orchestrate(question: str, phone: str = "web", owner_id: int = 1,
                source: str = "web") -> dict:
    from app.services import llm as llm_mod

    q = str(question or "").strip()
    if not q:
        raise ValueError("empty question")
    phone = str(phone or "web")
    oid = _oid(owner_id)
    _set_owner(oid)
    bound_executor = executor_for(oid)

    # 1. PLAN
    try:
        plan_res = llm_mod.complete_text(_PLANNER_SYSTEM, q, max_tokens=300)
        plan_text = plan_res.get("text", "")
        specialists, focus = _parse_plan(plan_text)
        plan_provider = plan_res.get("provider", "demo_fallback")
    except Exception as exc:
        logger.warning("plan failed: %s", exc)
        specialists, focus = (["sales", "inventory", "finance"], "")
        plan_provider = "demo_fallback"

    # 2. RUN specialists
    findings: list = []
    steps: list = []
    providers: list = []
    providers.append(plan_provider)
    for agent in specialists[:3]:
        sys_prompt = SPECIALISTS.get(agent, "")
        if focus:
            sys_prompt = sys_prompt + f" Focus: {focus}"
        try:
            res = llm_mod.chat_with_tools(
                system=sys_prompt, user=q,
                tools_schema=tools_schema, executor=bound_executor, max_iterations=5,
            )
            text = res.get("text", "")
            trace = res.get("tool_trace", []) or []
            providers.append(res.get("provider", "demo_fallback"))
        except Exception as exc:
            logger.warning("specialist %s tools failed: %s", agent, exc)
            # Fallback inside specialist: skip tools, pre-fetched context
            ctx = _prefetch_context_block(oid)
            try:
                res2 = llm_mod.complete_text(
                    sys_prompt,
                    f"{q}\n\nPre-fetched business context (use these numbers, no tools): {ctx}",
                    max_tokens=900,
                )
                text = res2.get("text", "")
                trace = []
                providers.append(res2.get("provider", "demo_fallback"))
            except Exception as exc2:
                logger.warning("specialist %s fallback failed: %s", agent, exc2)
                text = llm_mod._demo_fallback(q)
                trace = []
                providers.append("demo_fallback")
        findings.append(f"[{agent}] {text}")
        for t in trace:
            try:
                steps.append(
                    {
                        "agent": agent,
                        "tool": t.get("name", ""),
                        "args": t.get("args", {}),
                        "result_preview": str(t.get("result_preview", ""))[:500],
                    }
                )
            except Exception:
                continue

    # 3. SYNTHESIZE
    biz = _business_name()
    synth_system = (
        f"You are VyapaarAI, business copilot for {biz}. Using ONLY the specialist "
        "findings below, answer the owner's question. Structure: **What happened** / **Why** / "
        "**Risk** / **Next steps**. Use \u20b9 INR numbers. IMPORTANT: respond in EXACTLY the same "
        "language the question was asked in."
    )
    synth_user = q + "\n\nSpecialist findings:\n" + "\n\n".join(findings)
    try:
        synth = llm_mod.complete_text(synth_system, synth_user, max_tokens=900)
        answer = synth.get("text", "")
        synth_provider = synth.get("provider", "demo_fallback")
    except Exception as exc:
        logger.warning("synthesize failed: %s", exc)
        answer = llm_mod._demo_fallback(q)
        synth_provider = "demo_fallback"
    providers.append(synth_provider)
    if not answer or not answer.strip():
        answer = llm_mod._demo_fallback(q)
        synth_provider = "demo_fallback"

    # final provider: synthesis provider if live, else best available
    provider = synth_provider
    if provider == "demo_fallback":
        # if any specialist got live data, still report demo only if synthesis is demo?
        # Keep synthesis provider as truthful (it generated the final text).
        pass

    lang = detect_language(q)

    # 4. Persist ChatMessage rows (one-shot P3: owner_id + source thread)
    # WA path persists the assistant reply via _reply(); only the user row here.
    try:
        from app.db import SessionLocal
        from app.models import ChatMessage

        src = str(source or "web").strip().lower() or "web"
        if src not in ("web", "whatsapp"):
            src = "web"
        db = SessionLocal()
        try:
            db.add(ChatMessage(session_phone=phone, owner_id=oid, role="user",
                               content=q, language=lang, source=src))
            if src != "whatsapp":
                db.add(
                    ChatMessage(
                        session_phone=phone, owner_id=oid, role="assistant", content=answer,
                        language=lang, steps=json.dumps(steps, default=str), source=src,
                    )
                )
            db.commit()
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception as exc:
        logger.warning("chat persist failed: %s", exc)

    return {
        "answer": answer,
        "steps": steps,
        "provider": provider,
        "specialists_used": specialists[:3],
    }
