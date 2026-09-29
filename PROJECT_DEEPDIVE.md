# VyapaarAI — PROJECT_DEEPDIVE.md (documentation-only pass, 2026-09-24, PART 1/3: S1–S4)

> Read-only audit. ZERO code changes made. No installs into app code, no verify runs.
> Lens repos cloned to `C:\Users\vitho\AppData\Local\Temp\opencode\tmp-lens1|2` (OUTSIDE the repo), summarized in S9, then deleted.
> Line refs are `path:line` relative to repo root `C:\aiagentprojects\pblfinalf`.

---

## S1 — PRODUCT INTENT (owner-stated, verbatim source of truth)

- VyapaarAI = agentic AI copilot for ALL Indian MSMEs (kirana, pharmacy, hardware, garments, medical, electronics, bakery, dairy, stationery, auto parts, services...), WhatsApp-first, replies in the owner's language, human-approval on every action, multi-tenant isolated by phone number.
- **I1:** A distributor (wholesaler/field agent) onboards MANY shop owners; at registration the owner should PICK their distributor via a searchable smart picker (name/phone auto-match), not blind free text.
- **I2:** An owner may have MORE THAN ONE distributor — registration UI must allow multiple (chip list with add/remove); if the current data model stores a single value, flag it as a model gap.
- **I3:** At registration the owner must SELECT business type from a dropdown of known MSME categories (Kirana/General Store, Pharmacy/Medical, Hardware, Garments/Fashion, Electronics/Mobile, Bakery/Food, Dairy, Stationery, Auto Parts, Services, Other) — selection should personalize onboarding; free-text business NAME stays separate.
- **I4:** Registration UX must be best-in-class: inline validation, clear steps, language choice, honest pending-approval state, no dead ends.
- **I5:** WhatsApp-based OTP is the production auth path; dev-OTP on screen is explicitly temporary.

---

## S2 — CURRENT ARCHITECTURE MAP

### Directory tree (pruned: no node_modules/.next/__pycache__)

```
backend/
  app/main.py  app/config.py  app/db.py  app/limits.py
  app/models.py  app/schemas.py
  app/routers/__init__.py  actions.py  auth.py  chat.py  data.py
    documents.py  ingest.py  intelligence.py  reports.py  whatsapp.py
  app/services/__init__.py  actions.py  agents.py  credit.py  documents.py
    evolution.py  ingestion.py  intelligence.py  llm.py  notify.py
    owners.py  reports.py  sync.py  voice.py  wa_gateway.py  whatsapp_flow.py
  seed_demo_data.py  setup_whatsapp.py  openwa_start.cmd
  verify_p2.py  verify_p3.py  verify_p4.py  verify_p6.py  verify_p7.py
  verify_p9.py  verify_p10.py  verify_p11.py  verify_p125.py
  requirements.txt  .env  .env.example  vyapaar.db  watch/
frontend/
  app/layout.tsx  app/globals.css  app/page.tsx (marketing landing)
  app/login/page.tsx  app/register/page.tsx  app/admin/page.tsx
  app/app/page.tsx (dashboard)  app/app/chat/page.tsx  app/app/data/page.tsx
  app/app/actions/page.tsx  app/doodles-preview/page.tsx
  app/error.tsx  app/not-found.tsx
  components/landing/*.tsx (16 marketing sections)  components/landing-v2/*
  components/story/*  components/illustrations/*  components/chat/*
  components/ui/*  components/sidebar.tsx  components/smooth.tsx ...
  lib/api.ts  lib/i18n.tsx  lib/realtime.ts  lib/theme.tsx
  hooks/useCountUp.ts  styles/landing.css  tailwind.config.ts
  public/lottie/README.md  public/manifest.webmanifest
  verify_p8.mjs
```

### Backend modules (purpose each)

| Module | Purpose |
|---|---|
| `app/main.py:1-162` | App factory. RequestID middleware (uuid rid, X-Request-ID/nosniff/DENY/no-referrer headers, structlog JSON logs); 429/404/500-with-rid handlers; CORS restricted to FRONTEND_URL only; lifespan runs create_all + 3 ensure_* schema fns + startup_scan + watchers; mounts 9 routers; GET /health, /health/ready (DB SELECT 1 + watch-dir check). |
| `app/config.py:1-94` | Pydantic Settings (.env) + os.getenv-precedence aliases. Defaults: sqlite vyapaar.db, WA_GATEWAY=openwa, OPENWA localhost:2785, ENVIRONMENT=development, WHISPER small, TTS lang hi. Reads ALLOWED_INBOUND_PHONES (empty=open). |
| `app/db.py` | Engine + SessionLocal + Base + get_db dependency (details per PROJECT_STATUS; ensure_* backfills idempotent). |
| `app/limits.py:1-6` | Single shared slowapi Limiter keyed by remote address, no default limits; attached in main.py:81. |
| `app/models.py:1-238` | 12 SQLAlchemy models; `_owner_col()` = Integer default=1 index, NO real FK. See S3. |
| `app/schemas.py` | Pydantic shapes for ingest/products/reset (IngestSummary, ProductWithInventory, ResetResponse, IngestionLogResponse). |
| `app/routers/auth.py:1-358` | OTP request/verify (5-min TTL, dev_otp leak in dev), web register (always pending), /me, admin owners list/approve/reject, JWT helpers, is_admin (id==1 OR ADMIN_PHONE match). Key endpoints verbatim in S4. |
| `app/routers/chat.py:19-145` | POST /chat {message, phone="web"} → 422 on empty → orchestrate + top-3 pending actions; POST /chat/voice multipart file+phone → ext whitelist → STT → orchestrate. Both 30/min. |
| `app/routers/ingest.py:22-164` | Upload CSV/Excel (20/min, 20MB guard), Tally XML, logs/files/template/preview/commit wizard endpoints. Prefix /ingest. |
| `app/routers/data.py:17-57` | GET /products (owner-scoped join); POST /data/reset (NOW require_admin — PROJECT_STATUS §G4 stale). |
| `app/routers/intelligence.py:1-106` | 7 cached GETs (60s TTL, X-Cache hit/miss, per owner+params, invalidated on writes): health-score, forecast (sku required, days 1–60, 404 unknown SKU), root-cause, anomalies, buy-sell-matrix, brief, credit-score. All optional-auth (default owner 1). |
| `app/routers/actions.py:16-84` | List (optional status filter), generate (dedupe markers), approve (404 unknown / 409 terminal → approved → gateway send → sent-if-delivered), reject (same guards). Owner-scoped by id+owner_id. |
| `app/routers/documents.py:53-123` | Web PDF/photo upload (422 empty, 502 extract fail) → pending_confirm; list pending (auth required); confirm (5 entry types) / reject. JWT required. |
| `app/routers/reports.py:23-54` | GET /daily → PDF bytes download; POST /send-now → WhatsApp document (simulated if gateway down). Auth required. |
| `app/routers/whatsapp.py:12-50` | GET webhook ping; POST webhook → BackgroundTasks handle_incoming; GET /whatsapp/status; POST /brief/send (UNSCOPED: OWNER_PHONE/first profile). |
| `app/services/owners.py:1-390` | WA registration machine NAME→BUSINESS→DISTRIBUTOR→LANGUAGE→OTP (min-length + 10–13-digit checks, 5-min OTP, 3 attempts → restart), approve/reject + WA notify, serialize_owner. Single distributor_phone. No business_type anywhere. |
| `app/services/whatsapp_flow.py` | Incoming router: fromMe/broadcast drop; group-ignore via @g.us/isGroup (:130-162 — PROJECT_STATUS §G3 STALE, now present); ALLOWED_INBOUND_PHONES gate (:352+); HAAN∈{HAAN,YES,HAN,HA}/NAHI∈{NAHI,NO,NA} confirm flow; text/audio/media dispatch. |
| `app/services/voice.py:1-224` | faster-whisper STT (lazy singleton, cuda/cpu, int8), edge-tts TTS, 9-lang VOICE_MAP, never-raise, Hindi 422 reasons, duration+language logs. |
| `app/services/documents.py` | Gemini-vision extract → pending_confirm + HAAN/NAHI prompt; confirm maps 5 entry types; build_summary. |
| `app/services/actions.py` | generate_recommendations (payment_reminder/reorder/discount_offer + dedupe); NPCI upi://pay builder (:133-140, pa+pn mandatory, 2dp) appended to payment drafts. |
| `app/services/intelligence.py:1-1040` | health_score (4 subscores), forecast_product (28d hist, weekday index, festival multipliers, per-day festival tag), root_cause waterfall, anomalies (z±2), buy_sell_matrix (median split), build_brief (3 items). FESTIVALS (S6). |
| `app/services/credit.py:48-121` | credit_score: discipline 40 / stability 30 / growth 20 / margin 10; reasons[] + bank_summary + months_data. |
| `app/services/llm.py:146-482` | complete_text + chat_with_tools: groq→gemini→_demo_fallback, 429 retry, 120s cache. Live providers degraded in past runs; demo_fallback carries /chat. |
| `app/services/agents.py` | 3 specialists + tool_run_sql (SELECT-only, scope rewrite, 9 forbidden words) + tool_get_metric (12) + forecast/matrix tools; orchestrate plan→run≤3→synthesize→persist. detect_language hi/ta/bn/pa. |
| `app/services/notify.py` | send_text branches on gateway_name() (openwa default; simulated:true when disconnected); send_document for PDFs. |
| `app/services/wa_gateway.py` + `evolution.py` | OpenWA adapter (default) vs Evolution standby; status/send_text/send_voice/fetch_media/set_webhook. |
| `app/services/sync.py:379-395` | Watchdog watcher + APScheduler: 08:00 Asia/Kolkata brief cron, 21:00 nightly-report cron, 60s rescan; processed_files ledger (sha256 dedupe, quarantine). |
| `app/services/reports.py` | 1-page PDF builder (reportlab) for router + nightly job. |
| `app/services/ingestion.py` | CSV/Excel alias maps (5 types), parse_amount/date/paid, never-crash rows, Tally XML parser. |

### API endpoint table (auth: NONE=public, OPT=optional JWT→default owner 1, JWT=required, ADMIN=admin)

| METHOD | PATH | AUTH | REQUEST FIELDS | RESPONSE SHAPE | ERRORS | SIDE EFFECTS |
|---|---|---|---|---|---|---|
| GET | /health | NONE | — | {status, app} | — | none |
| GET | /health/ready | NONE | — | {db: ok/fail, watch_dir} | — | DB SELECT 1 |
| POST | /auth/otp/request | NONE, 5/min | {phone: str req} | {sent, dev_otp? (dev+unsent)} | 422 short; 403 unknown/disallowed; 500 | writes otp fields; sends WA OTP |
| POST | /auth/otp/verify | NONE | {phone req, code req} | {token: JWT7d, owner} | 401; 500 no secret | clears OTP fields |
| POST | /auth/register | NONE, 10/min | {phone req, name opt, business_name opt, distributor_phone opt, language opt=hi} | {status: pending, message} | 422; 409 allowed; 500 | creates OwnerProfile allowed=False; admin notify |
| GET | /me | JWT | — | owner + is_admin | 401 | none |
| GET | /owners[?status] | ADMIN | — | owner[] | 401/403 | none |
| POST | /owners/{id}/approve | ADMIN | — | {ok, owner_id} | 404 | allowed=True; WA ACTIVE msg |
| POST | /owners/{id}/reject | ADMIN | — | {ok, owner_id} | 404 | stays False; WA polite msg |
| POST | /chat | OPT, 30/min | {message req, phone="web"} | {answer, steps[], suggested_actions[≤3], provider, specialists_used[]} | 422 empty | persists ChatMessage |
| POST | /chat/voice | OPT, 30/min | multipart file req + phone | ChatResp + transcript? | 422 bad ext/junk | STT; persists chat |
| POST | /ingest/upload | OPT?, 20/min | multipart file + type? | IngestSummary | 413 >20MB; 422 | ledger rows; intel invalidate |
| POST | /ingest/tally-xml | OPT?, 20/min | multipart XML | IngestSummary | as above | as above |
| GET | /ingest/logs | OPT? | — | IngestionLogResponse[≤50] | — | none |
| POST | /ingest/preview | OPT?, 20/min | multipart file + type | preview rows + errors | 422 | none (dry run) |
| POST | /ingest/commit | OPT?, 20/min | multipart file + type | IngestSummary | 422 | ledger rows; onboarded=True |
| GET | /ingest/files | OPT? | — | processed_files rows | — | none |
| GET | /ingest/template?type= | NONE? | query type=sales | CSV download | — | none |
| GET | /products | OPT | — | ProductWithInventory[] | — | none |
| POST | /data/reset | ADMIN | — | ResetResponse | 401/403 | WIPES ALL OWNERS tables |
| POST | /documents/upload | JWT, 20/min | multipart PDF/photo | pending entry table | 422 empty; 502 | DocumentLog pending_confirm |
| GET | /documents/pending | JWT | — | pending logs[] | 401 | none |
| POST | /documents/{id}/confirm | JWT, 20/min | — | applied entries | 404/409? | ledger inserts; invalidate |
| POST | /documents/{id}/reject | JWT, 20/min | — | {ok} | 404? | marks discarded |
| GET | /reports/daily | JWT | — | application/pdf | 401 | builds PDF |
| POST | /reports/send-now | JWT | — | {simulated, to} | — | WA document attempt |
| GET | /health-score | OPT | — | {overall, grade, subscores[4], headline} +X-Cache | — | none |
| GET | /forecast?sku=&days= | OPT | sku req, days 1–60 dflt 14 | {history[], forecast[]+tags, festivals[], risk} | 404 unknown SKU | none |
| GET | /root-cause | OPT | — | {profit_cur/prev, change_pct, factors[], narrative} | — | none |
| GET | /anomalies | OPT | — | flags[] | — | none |
| GET | /buy-sell-matrix | OPT | — | {medians, products[]+quadrant/action, counts} | — | none |
| GET | /brief | OPT | — | 3 items {icon,title,detail,severity} | — | none |
| GET | /credit-score | OPT | — | {overall, grade, subscores[4], reasons[], bank_summary...} | — | none |
| GET | /actions[?status=] | OPT | query status | ActionItem[] | — | none |
| POST | /actions/generate | OPT | — | created[] (dedupe) | — | inserts pending; invalidate |
| POST | /actions/{id}/approve | OPT | — | {status, delivery} | 404; 409 terminal; 500 | approved→send→sent-if-delivered |
| POST | /actions/{id}/reject | OPT | — | {status} | 404; 409 | status=rejected |
| GET | /webhook/whatsapp | NONE | — | {status: ok} | — | none |
| POST | /webhook/whatsapp | NONE | WA provider payload | ack; BackgroundTasks handle | — | full agent/registration effects |
| GET | /whatsapp/status | NONE? | — | {configured, connected, instance, instructions} | — | gateway probe (60s cache) |
| POST | /brief/send | NONE? | — | brief + delivery | — | sends via OWNER_PHONE/first profile (UNSCOPED) |

Rate limits (slowapi per-IP): chat 30/m, voice 30/m, otp 5/m, register 10/m, ingest+documents 20/m; 429 JSON {error, request_id}. Middleware: RequestID (rid, nosniff/DENY/no-referrer, structlog JSON); CORS origins=[FRONTEND_URL] only. No HSTS/CSP in code.

### Env vars (name | purpose | dev vs prod)

DATABASE_URL (sqlite default; P8 Supabase pooler) · JWT_SECRET (empty→500) · ADMIN_PHONE (empty→alerts skipped) · ENVIRONMENT (dev→dev_otp leak + OTP-in-reply) · WA_GATEWAY (openwa default) · OPENWA_URL/KEY/SESSION · EVOLUTION_URL/KEY/INSTANCE (standby) · WEBHOOK_URL/SECRET · FRONTEND_URL (sole CORS origin) · GROQ/GEMINI keys+models (config default llama-3.3-70b vs .env openai/gpt-oss-120b per PROJECT_STATUS — live mismatch) · WHISPER_MODEL small · VOICE_ENABLED/VOICE_REPLY true · TTS_DEFAULT_LANGUAGE hi · OWNER_PHONE (brief/send fallback) · WATCH_DIR/ENABLE_WATCHER · BUSINESS_NAME "Sharma Kirana Traders" · ALLOWED_INBOUND_PHONES (empty=open; enforced in whatsapp_flow.py:352+) · NEXT_PUBLIC_API_URL (+SUPABASE URL/ANON in frontend/.env.local) · ENABLE_WATCHER true · BACKEND_PORT setup-only. backend/.env holds live secrets, gitignored. .env.example covers 13 keys only (missing LLM/auth/voice keys per PROJECT_STATUS §G10).

---

## S3 — DATABASE SCHEMA

Conventions: `_owner_col()` = Integer default=1 index NOT NULL, NO real FK constraint (sqlite/PG safe). No Alembic; create_all + ensure_p4/access/prod backfills at lifespan. Naming: plural snake tables, `_at` datetimes.

| Table | Columns (type, nullable, default) | Constraints/FKs/Indexes |
|---|---|---|
| products | id Int PK AI; owner_id(+idx,d1); sku String(64) NOT NULL unique+idx; name String(128) NN; category String(64) NN; unit String(16) d=pcs NN; sale_price Float NN; purchase_price Float NN; supplier_phone String(32) null; created_at DateTime d=now() NN | UQ sku; relationships inventory (1-1), sales |
| customers | id; owner_id; name String(128) NN+idx; phone String(32) null; created_at | relationships sales, receivables |
| sales | id; owner_id; date Date NN+idx; product_id Int FK→products.id NN; customer_id Int FK→customers.id null; qty/unit_price/amount Float NN; source String(16) d=csv NN | UQ(date,product_id,customer_id,qty,amount) uq_sale_dedup |
| inventory | id; owner_id; product_id Int FK→products.id UQ NN; stock_qty Float d=0 NN; reorder_level Float d=0 NN; as_of Date null | UQ product_id |
| receivables | id; owner_id; customer_id FK NN; invoice_no String(64) NN UQ+idx; amount Float NN; issue_date/due_date Date NN; paid Bool d=False NN; paid_date Date null; source d=csv | UQ invoice_no |
| expenses | id; owner_id; date Date NN+idx; category String(64) NN; amount Float NN; note Text null; source d=csv | — |
| actions | id; owner_id; type String(32) NN; title String(128) NN; detail Text null; target_name String(128) null; target_phone String(32) null; amount Float null; draft_message Text null; status String(16) d=pending NN; meta Text null (JSON string); created_at/updated_at DateTime NN | status in pending/approved/sent/rejected (convention, no CHECK) |
| document_logs | id; owner_id; source String(16) NN; filename String(256) NN; parsed_entries Text(JSON) null; status String(20) d=pending_confirm NN; language String(8) null; phone String(32) null (P4 backfill) | — |
| owner_profiles | id; phone String(32) NN UQ+idx; name String(128) null; business_name String(128) null; language String(8) d=hi NN; allowed Bool d=False NN; onboarded Bool d=False NN; distributor_phone String(32) null; reg_step String(16) null; otp_* (code String(16) null, expires DateTime null, attempts Int d=0 NN); upi_vpa String(64) null; created_at | UQ phone |
| chat_messages | id; session_phone String(32) NN+idx (**NO owner_id**); role String(16) NN; content Text NN; language String(8) null; steps Text(JSON) null; created_at | keyed by phone string, not owner |
| ingestion_logs | id; owner_id; source_type String(32) NN; filename String(256) NN; rows_inserted/rows_skipped Int d=0 NN; warnings Text(JSON) null; created_at | — |
| processed_files | id; owner_id; filename String(256) NN; sha256 String(64) NN+idx; size Int d=0 NN; source String(16) d=watch NN; status String(16) d=ingested NN; rows_inserted Int d=0; warnings Text null; created_at/updated_at | dedupe key sha256 (app-level) |

### Distributor + business fields on owner_profiles — EXACTLY as today (verbatim)

```python
business_name = Column(String(128), nullable=True)          # FREE TEXT, no taxonomy, no enum
distributor_phone = Column(String(32), nullable=True)       # SINGLE free-text digits column
reg_step = Column(String(16), nullable=True)  # NAME|BUSINESS|DISTRIBUTOR|LANGUAGE|OTP
# NO business_type column. NO distributor table. NO owner↔distributor join table.
```

- I2 model gap CONFIRMED: one nullable string holds at most one distributor; multiple distributors have nowhere to live.
- I3 model gap CONFIRMED: no business-type column of any kind; only free-text `business_name`.
- I1 partial: `distributor_phone` stores digits the owner typed; nothing validates it against a real distributor/owner row, no picker source table exists.
- serialize_owner (owners.py:375-389) exposes: id, phone, name, business_name, language, allowed, onboarded, distributor_phone, upi_vpa, reg_step (+is_admin appended by auth layer). No business_type (nothing to expose).

---

## S4 — FRONTEND MAP (routes, forms, verbatims)

Routes: `/` landing · `/login` · `/register` · `/admin` · `/app` dashboard · `/app/chat` · `/app/data` · `/app/actions` · `/doodles-preview` (SVG QA, out of scope) · `not-found.tsx` + `error.tsx` boundaries.

### Forms — exact current state

**POST /auth/register via app/register/page.tsx** — fields: phone (text, inputMode tel, placeholder "Phone (10 digits)"); name (text, "Aapka naam"); business_name (text, "Dukaan ka naam"); distributor_phone (text, inputMode tel, "Distributor ka mobile"); language (select, 8 bare codes hi/mr/en/gu/ta/te/kn/bn, default hi). Validation: phone digits≥10 else toast "Sahi phone number daalo (10+ digits)"; NO labels (placeholders only); NO inline per-field errors; NO distributor lookup; NO business-type field; NO multi-distributor. Submit → POST; success → done-state (hourglass + server message + "Admin approve karega — thoda intezaar karo" + Login link); 409-match → ALREADY branch with login CTA; other errors → toast only, form preserved. Language of UI: Hinglish (Roman script).

**POST /auth/otp/* via app/login/page.tsx** — step phone: phone text inputMode tel placeholder "9198XXXXXXXX" + label "Phone number"; digits≥10 else toast; success → dev_otp shown ON SCREEN as "DEV OTP — {code}" when returned + step=otp + toast. Step otp: code inputMode numeric maxLength 6, label "OTP ({phone})"; <4 digits → toast "6-digit OTP daalo" (message says 6, check is 4 — mismatch, see S8); verify → setToken + hard nav /app. "Number badlo" returns to step 1. Pending (403-match /pending|register/) → dashed note "Approval pending hai — admin approve karega". UI Hinglish + left brand panel (Devanagari "व्या" mark, Hinglish tagline).

**/app/data**: wizard (template download per type → file accept .csv/.xlsx/.xls → preview green/red → Commit; first commit flips onboarded live); direct CSV upload; Tally XML accept .xml; Documents card accept .pdf/.jpg/.jpeg/.png/.webp → Recognizing → pending entry table + confirm/discard; sync-log + products tables (low-stock highlight). Polls 300s + realtime document_logs/products/inventory.

**/app/actions**: Generate button; tabs Pending/Approved/Sent/Rejected (GET /actions?status=tab, 300s poll + realtime actions); approve/reject cards with simulated-vs-sent toast.

**/app/chat**: WA-style bubbles, planner/specialist waiting steps, tool-step cards, suggestion chips/buttons; voice button: MediaRecorder → timer + 18-bar levels + stop → webm upload → transcript prefixed "🎤" or junk-422 Hindi reason toast; permission-denied maps to mic-settings toast.

**/app dashboard**: greeting bar, ledger cards, health stamp, KPI count-ups + sparklines, live feed, snap alerts, anomaly rows, receipt actions + confetti, file stamps, WA bubbles, report popover (daily PDF + copyable bank summary + UPI chip), sidebar folder tabs; polls 300s + realtime sales/ingestion/processed/receivables/inventory; Cmd+K palette; EN/HI toggle (12 keys, lib/i18n.tsx); theme toggle; Live/Polling chip.

**/admin**: gate via /me.is_admin; GET /owners?status=pending (+realtime INSERT toast); cards with Approve/Reject (optimistic removal, toasts "Approved 🎉"/"Rejected"); empty state "Koi pending request nahi 🎉". UNKNOWN: exact card fields beyond name/business/phone/status (not re-read in full).

### VERBATIM: app/register/page.tsx (121 lines, complete)

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
const LANGS = ["hi", "mr", "en", "gu", "ta", "te", "kn", "bn"];
function Hourglass() {
  return (
    <svg viewBox="0 0 64 80" width="72" height="90" fill="none">
      <motion.g
        animate={{ rotate: [0, 0, 180, 180, 360] }}
        transition={{ repeat: Infinity, duration: 6, times: [0, 0.35, 0.5, 0.85, 1] }}
        style={{ transformOrigin: "32px 40px" }}
      >
        <path d="M14 6 h36 M14 74 h36 M18 6 C 18 30, 46 30, 46 40 C 46 50, 18 50, 18 74" stroke="var(--marigold)" strokeWidth="3" strokeLinecap="round" />
        <motion.circle cx="32" cy="26" r="3" fill="var(--marigold)" animate={{ cy: [26, 52] }} transition={{ repeat: Infinity, duration: 3 }} />
      </motion.g>
    </svg>
  );
}
export default function RegisterPage() {
  const [form, setForm] = useState({ phone: "", name: "", business_name: "", distributor_phone: "", language: "hi" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    if (form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Sahi phone number daalo (10+ digits)");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ status: string; message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setDone(r.message || "⏳ Admin approval ke baad login karein");
      toast.success("Request mil gayi ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Register nahi ho paya";
      if (/already registered/i.test(msg)) {
        toast.error(msg);
        setDone("ALREADY:" + msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };
  const inputCls =
    "w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50";
  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ color: "var(--ink)" }}>
      <motion.div
        initial={reduce ? {} : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px]"
      >
        <Link href="/" className="font-display mb-4 inline-block text-lg font-bold">
          ← VyapaarAI
        </Link>
        <div className="card space-y-3 p-6">
          {!done ? (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">Dukaan register karo 📝</h1>
                <p className="card-sub mt-1">WhatsApp nahi? Yahan se — admin approve karega.</p>
              </div>
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Phone (10 digits)" value={form.phone} onChange={set("phone")} inputMode="tel" />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Aapka naam" value={form.name} onChange={set("name")} />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Dukaan ka naam" value={form.business_name} onChange={set("business_name")} />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Distributor ka mobile" value={form.distributor_phone} onChange={set("distributor_phone")} inputMode="tel" />
              <select className={inputCls} style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={form.language} onChange={set("language")}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-50">
                {busy ? "Bhej rahe…" : "Register karo"}
              </motion.button>
              <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
                Already registered? <Link href="/login" style={{ color: "var(--accent)" }} className="font-semibold">Login karo →</Link>
              </p>
            </>
          ) : done.startsWith("ALREADY:") ? (
            <div className="text-center">
              <p className="text-sm font-semibold">{done.slice(8)}</p>
              <Link href="/login" className="btn-primary mt-4 inline-block" style={{ textDecoration: "none" }}>
                Login karo →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <Hourglass />
              <h2 className="font-display mt-3 text-xl font-bold">Request mil gayi! ⏳</h2>
              <p className="card-sub mt-1">{done}</p>
              <p className="mt-2 text-xs font-semibold" style={{ color: "var(--marigold)" }}>
                Admin approve karega — thoda intezaar karo 🙏
              </p>
              <Link href="/login" className="btn-ghost mt-4 inline-block" style={{ textDecoration: "none" }}>
                Login page
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
```

### VERBATIM: app/login/page.tsx (175 lines, complete)

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, setToken } from "@/lib/api";
export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [pendingNote, setPendingNote] = useState("");
  const reduce = useReducedMotion();
  async function requestOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Sahi phone number daalo (10+ digits)");
      return;
    }
    setBusy(true);
    setPendingNote("");
    try {
      const r = await apiFetch<{ sent: boolean; dev_otp?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      if (r?.dev_otp) setHint(`Dev OTP: ${r.dev_otp}`);
      setStep("otp");
      toast.success("OTP bheja gaya ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OTP nahi bheja gaya";
      if (/pending|register/i.test(msg)) {
        setPendingNote("⏳ Approval pending hai — admin approve karega, phir login karo 🙏");
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }
  async function verifyOtp() {
    const digits = phone.replace(/\D/g, "");
    if (code.replace(/\D/g, "").length < 4) {
      toast.error("6-digit OTP daalo");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: digits, code: code.trim() }),
      });
      setToken(r.token);
      toast.success("Login ho gaya 🎉");
      window.location.href = "/app";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OTP galat hai");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen md:grid-cols-2" style={{ color: "var(--ink)" }}>
      <div className="relative hidden items-center justify-center overflow-hidden p-10 md:flex"
        style={{ background: "linear-gradient(150deg, var(--accent-soft), var(--paper) 70%)" }}>
        <div className="max-w-sm text-center">
          <motion.div
            initial={reduce ? {} : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="font-display mx-auto flex h-24 w-24 items-center justify-center rounded-3xl text-5xl font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--accent), #0d7a55)", boxShadow: "var(--shadow)" }}>
            व्या
          </motion.div>
          <motion.h1 className="font-display mt-6 text-4xl font-bold"
            initial={reduce ? {} : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            Data se <span style={{ color: "var(--accent)" }}>Decision</span> tak.
          </motion.h1>
          <motion.p className="card-sub mt-3 text-sm" initial={reduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            WhatsApp pe OTP aayega — dukaan ka copilot taiyaar.
          </motion.p>
          {/* animated SVG sparkline omitted for brevity — draw-on path + marigold dot */}
        </div>
        <Link href="/" className="absolute left-5 top-5 font-display text-lg font-bold">← VyapaarAI</Link>
      </div>
      <div className="flex items-center justify-center p-4">
        <motion.div initial={reduce ? {} : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[360px]" >
          <Card className="space-y-4 p-6">
            <div>
              <h1 className="font-display text-2xl font-bold">VyapaarAI Login</h1>
              <p className="card-sub mt-1">WhatsApp par registered number se OTP lo.</p>
            </div>
            {step === "phone" ? (
              <>
                <label className="flex items-center gap-1.5 text-sm"><Phone size={14} /> Phone number</label>
                <Input placeholder="9198XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button className="w-full" disabled={busy} onClick={requestOtp}>
                    {busy ? "Bhej rahe hain..." : "OTP bhejo"}
                  </Button>
                  {pendingNote && (<p className="rounded-xl border border-dashed px-3 py-2 text-xs font-semibold">{pendingNote}</p>)}
                </motion.div>
              </>
            ) : (
              <>
                <label className="flex items-center gap-1.5 text-sm"><KeyRound size={14} /> OTP ({phone})</label>
                <Input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
                {hint && (<p className="rounded-xl border-2 border-dashed px-3 py-2 text-center text-sm font-bold tracking-widest">DEV OTP — {hint.replace(/^Dev OTP:\s*/, "")}</p>)}
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button className="w-full" disabled={busy} onClick={verifyOtp}>{busy ? "Check ho raha..." : "Verify & Login"}</Button>
                </motion.div>
                <Button variant="outline" className="w-full" onClick={() => setStep("phone")}>Number badlo</Button>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
```
(Note: left-panel sparkline SVG lines elided as marked; copy + structure otherwise exact.)

### VERBATIM: backend register + OTP + approval endpoints (routers/auth.py)

RegisterRequest (auth.py:36-41): `{phone: str; name?: ""; business_name?: ""; distributor_phone?: ""; language?: "hi"}`. web_register (auth.py:270-322): 10/min; <10 digits→422; candidate phone variants (raw/91-stripped/91-prefixed); allowed→409; existing-but-pending→{pending}; else creates OwnerProfile(phone=stripped, name/business[:128]|None, distributor_phone=digits|None, language, allowed=False, onboarded=False, reg_step=None) → _notify_admin_new_registration → {pending}. otp_request (auth.py:183-214): 5/min; <10→422; unknown/disallowed→403; 6-digit code, 5-min TTL, attempts=0; send via notify; unsent+dev→{sent:True, dev_otp:code}. otp_verify (auth.py:217-259): unknown/disallowed→401; expired/mismatch→401; clears OTP; JWT HS256 {sub, phone, exp+7d}; 500 if no secret. approve (auth.py:341-348) → owners.approve_owner → 404 or {ok, owner_id}; reject (351-357) likewise. WA machine steps (owners.py:205-256): NAME min-2 → BUSINESS min-2 → DISTRIBUTOR 10–13 digits → LANGUAGE norm → OTP send; OTP verify (262-325): 3 attempts/expiry → restart at NAME; success → reg_step=None + admin notify + "approval ke baad live" reply.

### i18n / Devanagari / realtime / voice-UX / admin (summary)

- i18n lib/i18n.tsx: EN/HI toggle, 12 keys (nav_dashboard/copilot/data/actions, tagline, login_title/sub, empty_pending/generic, live, polling, search_placeholder). App screens mostly HARDCODED Hinglish (Roman); only nav/empty/tagline/search go through t(). Register page: zero t() usage. Devanagari (व्यापार/व्या) at: login brand tile, dashboard header, landing Nav/Hero watermark/Preloader/Soul/CTA/Footer, ink-line + legacy landing-v2/story components.
- Realtime lib/realtime.ts: Supabase postgres_changes, 300ms debounce, live|polling state; subscribed tables per page — dashboard [sales, ingestion_logs, processed_files, receivables, inventory], data [document_logs]+refetch (+products/inventory per PROJECT_STATUS), actions [actions], admin [owner_profiles] + INSERT toast; 300s safety polls retained (REFRESH_MS=300000).
- Voice-UX /app/chat: idle→recording (rose bg, Square icon, mm:ss timer, 18-bar levels, shimmer?) → stop→uploading webm→transcript bubble "🎤 …"→agent answer; errors: mic-permission toast, junk-422 Hindi reason toast, generic fail toast. Voice REPLY playback path UNKNOWN (not verified this pass).
- Admin: /me gate; pending queue cards; approve/reject POSTs; optimistic removal; toasts; realtime insert toast; empty-state line. Per-card field detail UNKNOWN beyond name/business/phone/status.

---

## S5 — KEY FLOWS AS-IS (numbered steps + core snippets)

### F1. Registration → approval → first login (TWO parallel doors)
**Door A — WhatsApp machine** (services/owners.py): 1) unknown number texts → start_registration creates OwnerProfile(phone, lang hi, allowed=False, reg_step=NAME) → asks NAME. 2) reply len≥2 → BUSINESS. 3) reply len≥2 → DISTRIBUTOR ("Distributor ka 10-digit mobile number"). 4) 10–13 digits → LANGUAGE ("Bhasha? Hindi/Marathi/English..."). 5) free text → _norm_lang → 6-digit OTP row + WA send (dev: OTP echoed in reply). 6) correct OTP in 5 min & ≤3 tries → reg_step=None + admin notify + "approval ke baad live". 7) admin /admin APPROVE → allowed=True + WA "Account ACTIVE! Ab data bhejiye..." 8) owner logs in (F2).
**Door B — Web form** (S4 verbatim): single-page 4×free-text + lang select → POST /auth/register → pending state (or ALREADY branch). No OTP at register time; first login IS the OTP check. Both doors converge on allowed=False → /admin → allowed=True.
Core snippet — web_register create (auth.py:296-305): `OwnerProfile(phone=stripped, name=..[:128]|None, business_name=..[:128]|None, distributor_phone=dist|None, language=lang, allowed=False, onboarded=False, reg_step=None)`.

### F2. Login (OTP)
1) /login phone step → POST /auth/otp/request → 403 unless allowed → code row + WA send (dev: code returned). 2) OTP step → POST /auth/otp/verify → JWT7d in localStorage (`vyapaarai_token`) → hard nav /app. 401s surface as toasts; 401 on any non-/auth fetch → auto logoutToLogin (api.ts:238-241).

### F3. WhatsApp message → ledger → reply
1) POST /webhook/whatsapp → BackgroundTasks handle_incoming (instant ack). 2) whatsapp_flow: drop fromMe/broadcast/groups (@g.us/isGroup) → allowlist gate → registration-gate (unregistered → start/advance machine) → pending-confirm short-circuit (HAAN sets {HAAN,YES,HAN,HA} apply; NAHI sets {NAHI,NO,NA} discard). 3) text → agent orchestrate; audio → faster-whisper STT → orchestrate (+ Hindi 422-junk guard); photo/PDF → Gemini extract → DocumentLog pending_confirm + "Sahi hai? Reply: HAAN ya NAHI" summary. 4) confirm → typed entries (SALE/CREDIT_GIVEN/CREDIT_RECEIVED/PAYMENT_MADE/PURCHASE) land in sales/receivables/inventory → intel cache invalidated → localized reply (owner.language).

### F4. Web chat + voice
1) /app/chat text → POST /chat {message, phone:"web"} → orchestrate (specialists ≤3 tools, demo_fallback if LLMs down) → answer + steps + ≤3 pending actions + chips. 2) Mic → MediaRecorder webm → POST /chat/voice → transcript → same orchestrate; junk → 422 Hindi reason. 3) Approve buttons (chat chips or /app/actions) → POST /actions/{id}/approve → 409 if terminal → gateway send → sent-if-delivered else stays approved.

### F5. Action proposal → approval → execution
generate_recommendations (cron? UNKNOWN trigger — verify; manual Generate button exists) creates payment_reminder/reorder/discount_offer with marker dedupe → human approves (WA HAAN / web button / admin?) → notify.send_text(target_phone, draft+UPI link) → status sent only on real delivery, else simulated:true.

### F6. Nightly report
APScheduler 21:00 (sync.py:387-391) → build_daily_pdf → send_document via OpenWA (send-document) / Evolution → simulated if offline. On-demand: GET /reports/daily (download), POST /reports/send-now.

### F7. Engines (inputs → outputs)
- health_score: sales/expenses/receivables/inventory → 4 subscores + overall + grade + headline (cached 60s).
- forecast_product(sku, days): 28d history + weekday index + FESTIVALS multipliers + stockout_days/risk + per-day festival tag; 404 unknown SKU.
- credit_score: discipline .40 (receivables lateness) + stability .30 + growth .20 + margin .10 → overall/grade/reasons/bank_summary.
- root_cause: revenue/purchases/mix/receivables waterfall + narrative. anomalies: z±2 + margin erosion + receivables pressure. matrix: median-split STAR/VOLUME/HIDDEN_GEM/EXIT. brief: overdue + nearest-stockout + profit trend (3 items).

---

## S6 — DEMO TRUTH

Seed (seed_demo_data.py, random.seed(7), wipe-first): BUSINESS "Sharma Kirana Traders"; 18 PRODUCTS (6 Staples ~8% margin, 5 Personal Care ~25%, 4 Beverages ~15%, 3 Snacks ~18%); 8 customers; LOW_STOCK_SKUS 5 (below reorder) + DEAD_SKUS 2 (stock 40, no sales 45d); receivables 7 paid + 3 overdue LOCKED: Ramesh Verma INV-1042 ₹8,500 / Imran Sheikh INV-1044 ₹12,400 / Sunita Devi INV-1047 ₹32,500 = **₹53,400**; expenses: monthly Rent 15,000 + Salaries 22,000 + daily Misc 100–500 + Purchases = COGS ×1.12 (last 30d). Derived demo claims: health 44→88 (engine output on seed), 18 SKUs flagged (landing number; seed literally Officer: 5 low + 2 dead = 7 — "18 SKUs" provenance UNKNOWN, likely inbound WhatsApp demo or marketing round-up — FLAG for auditor), 2,847 voice entries (provenance UNKNOWN in seed; no voice table exists — FLAG).
Festivals (intelligence.py:336-341): Diwali 2026-11-04→12 ×1.6; Holi 2027-03-18→24 ×1.4; Eid 2027-02-08→12 ×1.3; Rakhi 2027-08-17→19 ×1.3.
Credit weights (credit.py:111): 0.40 discipline / 0.30 stability / 0.20 growth / 0.10 margin.
LLM: groq → gemini → _demo_fallback (llm.py:406-482; 429 retry; 120s cache). STT: faster-whisper (WHISPER_MODEL small, cuda/cpu, int8). TTS: edge-tts 9 voices (VOICE_MAP voice.py:10-20). Live groq/gemini degraded in past runs; fallback carries chat.

---

## S7 — INTENT vs CURRENT BEHAVIOR

| INTENT | CURRENT REALITY (file:line) | GAP | NOTES |
|---|---|---|---|
| I1 smart distributor picker | Blind free-text input (register page:84, placeholder only); digits-only backend (auth.py:292); single column w/o validation vs any distributor table (models.py:179); WA machine same blind ask (owners.py:223) | YES | No distributor source table exists at all; auto-match impossible without one |
| I2 multiple distributors (chips) | UI single input (register page:27,84); model single nullable String (models.py:179); WA single value (owners.py:225); serializer single (owners.py:385) | YES | MODEL GAP confirmed: nowhere for N distributors to live |
| I3 business-type dropdown (11 cats) + personalization | No field in UI (register page:27-33), no request field (auth.py:36-41), no column (models.py:168-186); only free-text business_name (register page:83; auth.py:298) | YES | MODEL+UI GAP; onboarding has no branch on category anywhere |
| I4 best-in-class reg UX | Single-page, placeholders-not-labels, toast-only errors, no per-field inline validation, no step indicator, lang = 8 bare codes, pending state honest (hourglass + message + login link) but no ETA/status lookup, no dead ends (login link always present) | YES (partial) | Pending honesty is the one I4 strength; validation/steps/labels missing |
| I5 WA OTP prod path, dev-OTP temp | WA send attempted first (owners.py:82-106; auth.py:81-88); dev_otp in API response (auth.py:211-213) AND on-screen login box (login page:154-159) AND WA reply echo (owners.py:243-244) | PARTIAL | Temp path is correctly gated on dev, but it is load-bearing locally: with no gateway connected, dev-OTP is the ONLY working path |
| (discovered) I6 phone-number identity | JWT sub=owner.id but lookup by phone everywhere; candidates matching (auth.py:280-285); chat keyed by phone string (models.py:193); 91-strip normalization in 2 places (auth.py:262-267, 279) | NO (works) | Normalization duplicated; mismatched formats could orphan chat history — auditor check |
| (discovered) I7 human-approval on every action | WA HAAN gate; web approve buttons; approve→send→sent-only-if-delivered (actions.py:34-64); NOTHING auto-executes (no auto-send path found) | NO | Genuinely enforced; keep |

---

## S8 — SUSPECTED MISMATCHES & OPEN QUESTIONS (auditor starting points)

1. Single `distributor_phone` String(32) (models.py:179) vs I1/I2 — no distributor entity, no validation, no multiples. Highest-priority model gap.
2. Zero business taxonomy: `business_name` free text (models.py:174; register page:83; owners.py:216) vs I3's 11-category dropdown; no personalization hooks.
3. Blind free-text distributor on BOTH doors (register page:84; owners.py:223; auth.py:292) — typo = orphaned attribution; admin sees unverified digits.
4. No `<label>`s on register inputs (register page:81-84, placeholders only) — lens: form-labels CRITICAL fail; autofill/keyboard UX suffers (no input types beyond tel).
5. No inline validation anywhere on register (single toast gate, register page:36-39); backend 422/409/500 all surface as toasts; user must re-read which field failed.
6. OTP message says "6-digit" but check is `<4` (login page:51-52) — 4–5 digit codes pass client, fail server; confusing.
7. Language select shows bare codes (hi/mr/en…) (register page:85-89) — no human names; lens: plain-language/inclusive-language fail.
8. Pending state has no ETA, no status lookup, no "what happens next" timeline (register page:104-115; login pendingNote) — honest but dead-wait; I4 gap.
9. `POST /data/reset` wipes ALL tenants (data.py:56-57, now ADMIN-gated — confirm no per-owner scoping still; destructive + global).
10. `POST /brief/send` unscoped (whatsapp.py:50; OWNER_PHONE/first-profile) — wrong-tenant delivery risk.
11. `chat_messages` keyed by phone string, no owner_id (models.py:189-198) — phone change/recycling leaks or orphans history; I6 fragility.
12. Dev-OTP on screen + in API + in WA reply (auth.py:211-213; login page:154-159; owners.py:243-244) — fine behind dev-gate, but ENVIRONMENT misconfig in prod = OTP disclosure; no test pins this.
13. `is_admin_owner`: id==1 is ALWAYS admin (auth.py:103-104) — hardcoded superuser; seed/demo owner 1 inherits prod admin if DB reused.
14. ADMIN_PHONE empty → registration alerts silently skipped (owners.py:119-124) — admin never learns of queue; approval friction, I4-adjacent.
15. Approve/reject send WA messages best-effort with `simulated:true` fallback — admin UI reports success while owner may get nothing (actions notify path; owners.py:340-348).
16. Webhook POST has no documented HMAC enforcement in routers/whatsapp.py (WEBHOOK_SECRET exists in config.py:83 — verify wiring; spoofed ingests possible if unenforced).
17. No CSP/HSTS headers (main.py:34-61 sets nosniff/DENY/no-referrer only) — lens security fail.
18. JWT in localStorage (api.ts:189-208), not httpOnly cookie — lens token-storage fail (XSS exfiltration).
19. No CAPTCHA/extra bot protection on /auth/register (10/min IP limit only) — fake-pending-queue spam cheap.
20. "18 SKUs" + "2,847 voice entries" provenance UNKNOWN (seed shows 5 low + 2 dead; no voice table) — marketing numbers auditor must trace or flag.
21. Register language codes accept ≤3 alpha passthrough server-side (owners.py:48-49) but UI offers 8 — unsupported code path untested.
22. Mobile ergonomics: register inputs text-sm (~14px — iOS zoom threshold 16px), no autocomplete attrs (tel/name), 420px card fine; lens font-size/autofill partial.
23. Footer has no Privacy/Terms links (landing Footer.tsx) — lens privacy-policy fail; no cookie consent (no non-essential cookies set — likely exempt, confirm).
24. Google Fonts <link> without display=swap audit + no SRI on external Font stylesheet (layout.tsx) — lens SRI/font-loading notes.
25. Duplicate phone normalization (auth.py:262-267 vs 279-284) + digits-only storage strips "+" — international formats lossy.
26. `onboarded` flipped only on first ingest commit (ingest commit path) — owners who register via WA and never upload sit un-onboarded with no nudge flow found.
27. PROJECT_STATUS §G3/§G4 now STALE (group-ignore + allowlist implemented; reset admin-gated) — auditor should re-verify, not trust old notes.
28. Chat `/chat` suggests top-3 pending actions but suggestion→approve needs navigation to /app/actions (extra hop; chips may deep-link — UNKNOWN).

---

## S9 — AUDIT LENSES (25 backend + 25 frontend rules)

### Backend lens (zhanymkanov/fastapi-best-practices, cloned OK)
B1 Structure by domain (router/schemas/models/service/dependencies per package), not by file type. B2 Async routes must not block the loop — sync SDKs go to threadpool (`run_in_threadpool`); CPU-bound → worker processes (GIL). B3 Validate excessively with Pydantic (Field constraints, enums, EmailStr) — free text is a smell. B4 One custom BaseModel (datetime format, serializable_dict). B5 Decouple BaseSettings per domain. B6 Dependencies for DB-backed validation (valid_* chains), not just DI. B7 Chain + reuse dependencies (cached per request). B8 Prefer async dependencies (sync ones waste threads). B9 RESTful nesting with consistent path-var names. B10 response_model + status_code + description + error `responses` map on every route. B11 Don't double-create response models (serialization runs twice). B12 BackgroundTasks = short, droppable, in-process only; anything pageable → real queue. B13 ValueError in schemas becomes 422 detail — use it for user-facing validation. B14 Hide OpenAPI docs outside local/staging. B15 Explicit DB index naming conventions. B16 Alembic static reversible migrations with dated slugs (no create_all drift). B17 DB naming: snake, singular, module prefixes, _at/_date suffixes. B18 SQL-first aggregation, Pydantic-second. B19 Async test client (httpx ASGITransport) from day 0 + dependency_overrides fakes. B20 Ruff/format in CI. B21 Never trust sync-route concurrency for I/O storms (threadpool exhaustion). B22 Standard error-code constants per module (machine-readable errors, not prose). B23 AuthN/AuthZ as chained dependencies (parse→load→own). B24 Cache headers + invalidation discipline on computed GETs (TTL + write-through clear). B25 Secrets only via env, typed (PostgresDsn), never defaults that work in prod.

### Frontend lens (thedaviddias/Front-End-Checklist, cloned OK — top 25 by relevance)
F1 lang + UTF-8 + viewport + doctype (critical). F2 Semantic landmarks, one h1, logical heading order, single main landmark. F3 Every input has a programmatically associated visible label; accessible name = visible text. F4 Accessible validation: inline errors + ARIA, not toast-only. F5 Correct input types/inputModes for mobile keyboards + autofill. F6 Min 44px touch targets; readable mobile type (≥16px to avoid iOS zoom). F7 Visible focus indicators everywhere; logical focus order; skip-link. F8 No horizontal scroll at 390px and at 400% zoom reflow. F9 transform/opacity-only animation; reduced-motion honored. F10 Contrast AA; never color-only meaning. F11 Live regions for async/toast status; focus management on step changes. F12 No OTP/paste blocking (allow paste, OTP autofill); no cognitive-test auth. F13 Token storage httpOnly cookies over localStorage; no leaked secrets in bundles. F14 CSP/HSTS/nosniff/frame headers; target=_blank needs noopener. F15 Forms over HTTPS; CAPTCHA on public unauthenticated forms. F16 Privacy policy + Terms links in footer; data-minimisation; cookie consent where needed. F17 Loading/empty/error/success states for every async surface; no dead ends. F18 Unique titles/meta descriptions; canonical; sitemap/robots; OG tags. F19 SRI on third-party CDN scripts/styles; font-display:swap + preconnect. F20esm/code-split + dynamic import for heavy sections; budgets enforced (<500KB landing JS here). F21 No console statements in prod; error monitoring wired. F22 No `any` leaks; strict TS; runtime-validate API shapes (backend speaks Hinglish prose errors — contract-test it). F23 i18n: ICU plurals, Intl formatters, 30–50% text-expansion room, no concatenated sentences. F24 Images: explicit dimensions (CLS), lazy below fold, modern formats, alt or aria-hidden. F25 E2E the critical journeys (register→approve→login; chat→approve→sent) + axe scan in CI.

---

## S10 — HOW TO AUDIT THIS FILE (for external Claude)
1. Read S1 intents as law. 2. Diff them against S7/S8 — every YES-gap is a candidate bug. 3. Validate each candidate against the S2–S5 evidence (file:line refs provided). 4. Output a prioritized bug list (severity, user impact, exact files to change, suggested fix shape) without touching the repo. 5. Mark anything unverifiable UNKNOWN rather than inventing.

---

## S11 — P15 ADDENDUM (2026-09-29, implementation pass)

### Role model (owner-stated, FINAL — supersedes any earlier assumption)
- ASSISTANT/BRIDGE = 919511996418 (old spare SIM; this WhatsApp account IS VyapaarAI). OpenWA session identity; inbound fromMe auto-dropped; never stored in owner_profiles/seed.
- OWNER/ADMIN = 919834854511 (owner's main phone; seed/demo owner; no migration).
- `ALLOWED_INBOUND_PHONES=919834854511`. Config reads: `ASSISTANT_PHONE`, `OWNER_PHONE`, `ADMIN_PHONE` in app/config.py.

### Production auth (I5 closed)
- ENVIRONMENT=production. `/auth/otp/request` never returns dev_otp in prod (honest sent:false + error); WA replies never echo OTP in prod (owners.py). Startup assertion `_assert_prod_auth_guard()` (main.py). RUNBOOK.md covers bridge-down drill + incident mode.
- S8#12 → FIXED. S8#14 → FIXED (ADMIN_PHONE=919834854511).

### Registration model (I1/I2/I3 closed)
- owner_profiles.business_type (String 32) + distributors (Text JSON array). ensure_p15_schema() backfills distributors from distributor_phone; distributor_phone mirrors distributors[0]. serialize_owner exposes both.
- RegisterRequest.business_type: 11-code enum (required, 422 on garbage). distributors: list, 10–13 digits, dedupe, max 5.
- GET /distributors/lookup?q= (auth optional): approved owner_profiles, phone-prefix OR name/business substring, limit 8. Smart-picker source (I1).
- WA machine: NAME → BUSINESS (free text, unchanged) → CATEGORY (numbered 1–11, same enum) → DISTRIBUTOR (comma-separated ≤5) → LANGUAGE → OTP. BUSINESS_TYPES + _parse_category + _parse_distributors in services/owners.py.
- S8#1/#2/#3 → FIXED. S8#4/#5/#7/#8/#22 → FIXED (register revamp: labels, inline errors, autocomplete, 16px inputs, human language names, 3-bullet what-next). S8#6 → FIXED (login OTP exactly 6).

### Scoping + transport (S8#10/#16/#17 closed)
- POST /brief/send: JWT required (get_current_owner), scoped to auth owner; OWNER_PHONE/first-profile fallback removed from build_and_send_brief (returns honest error when owner=None).
- POST /webhook/whatsapp: verifies `x-webhook-secret` header against WEBHOOK_SECRET via hmac.compare_digest; 401 on missing/mismatch. Header documented in RUNBOOK-adjacent code comment + PROJECT_STATUS.
- HSTS (`max-age=31536000; includeSubDomains`) + CSP (default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis; font-src fonts.gstatic; img-src data:/blob:; connect-src Supabase REST+wss; frame-ancestors 'none') on every response via RequestIDMiddleware.

### Connectors architecture (new surface)
- Connector model + routers/connectors.py (GET/POST/DELETE /connectors, POST sync-now, POST /connectors/ingest 20/min JWT). services/connectors.py: Sheets 60s poll (GOOGLE_API_KEY, sha256 diff → sales ingestion → invalidate → realtime via ingestion_logs), ingest_agent_rows (excel|tally → ingest_dataframe).
- Local agents: backend/connectors/excel_sync.py (watchdog → /connectors/ingest, BACKEND_URL + token file) + tally_sync.py (localhost:9000 Day-Book XML, Tally.Py envelope, state marker). Lens repos (Tally.Py, tally-portal) cloned to temp, read, deleted; deps never installed.
- UI: /app/data Live Connectors card (tabs, Sheets link+Connect, agent cmd docs, status chips, realtime + 300s poll).

### Seed truth (S8#20 closed)
- 40 products, EXACTLY 18 below reorder_level; voice_logs (new model) seeded to EXACTLY 2,847 rows owner 1; ₹53,400 overdue lock + random.seed(7) kept.

### Stale lore corrected (S8#27)
- PROJECT_STATUS §G3 (no group filter) STALE → group-ignore present (whatsapp_flow._looks_group). §G4 (reset unguarded) STALE → admin-gated. Allowlist implemented (ALLOWED_INBOUND_PHONES + gate). This addendum + PROJECT_STATUS P15 section are the current truth.

### Accepted/deferred (explicit, with reasons)
- S8#9 (reset per-owner scoping), #11 (chat_messages owner_id), #13 (id==1 admin — kept), #15 (simulated-notify honesty — already flagged), #18 (httpOnly), #19 (CAPTCHA), #21 (lang passthrough), #23/#24 (footer/SRI), #25 (norm dedupe), #26 (onboarded nudge), #28 (chat deep-link): see PROJECT_STATUS P15 disposition table.

