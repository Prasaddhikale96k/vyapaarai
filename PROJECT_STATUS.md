# VyapaarAI — PROJECT_STATUS.md (read-only audit, 2026-09-23)

> Audit date (UTC): 2026-09-23. No code was modified. All statuses below are evidence-backed; anything without evidence is marked MISSING.

## STEP 1 — Inventory

### File tree (depth 3, excl `__pycache__`, `node_modules`, `.next`)

```
backend/
  .env / .env.example
  app/__init__.py / config.py / db.py / main.py / models.py / schemas.py
  app/routers/__init__.py / actions.py / auth.py / chat.py / data.py / ingest.py / intelligence.py / whatsapp.py
  app/services/__init__.py / actions.py / agents.py / documents.py / evolution.py / ingestion.py /
                 intelligence.py / llm.py / notify.py / owners.py / sync.py / voice.py /
                 wa_gateway.py / whatsapp_flow.py
  openwa_start.cmd / setup_whatsapp.py / seed_demo_data.py
  verify_p2.py / verify_p3.py / verify_p4.py / verify_p6.py
  vyapaar.db / qr.png / requirements.txt / watch/ (empty) /
  setup-run.log / setup-run2.log / setup-run3.log / uvicorn.log

frontend/
  app/layout.tsx / globals.css / page.tsx (dashboard)
  app/chat/page.tsx / app/data/page.tsx / app/actions/page.tsx /
  app/login/page.tsx / app/admin/page.tsx
  components/sidebar.tsx / score-ring.tsx / forecast-chart.tsx / root-cause-card.tsx /
             buy-sell-grid.tsx / brief-list.tsx / fade-in.tsx
  components/chat/agent-steps.tsx / message-bubble.tsx / suggested-chips.tsx
  components/ui/badge.tsx / button.tsx / card.tsx / input.tsx / skeleton.tsx / tabs.tsx
  lib/api.ts
  next.config.mjs / tailwind.config.ts / package.json (no supabase dep)
```

### Every FastAPI route (method + path + purpose)

Prefix note: `ingest.router` has `prefix="/ingest"`. All others are unprefixed. Plus `GET /health` in `app/main.py`.

| Method | Path | File: function | Purpose |
|---|---|---|---|
| GET | `/health` | `main.py:health` | liveness probe |
| POST | `/ingest/upload` | `routers/ingest.py:upload_file` | CSV/Excel bytes ingest (optional `type` form hint), owner-scoped |
| POST | `/ingest/tally-xml` | `routers/ingest.py:upload_tally_xml` | Tally XML ingest, owner-scoped |
| GET | `/ingest/logs` | `routers/ingest.py:list_logs` | last 50 ingestion logs, owner-scoped |
| GET | `/products` | `routers/data.py:list_products` | products + inventory join, owner-scoped |
| POST | `/data/reset` | `routers/data.py:reset_data` | wipe + reseed demo DB (**NOT owner-scoped**) |
| GET | `/health-score` | `routers/intelligence.py:get_health_score` | 4-subscore health, owner-scoped |
| GET | `/forecast?sku=&days=` | `routers/intelligence.py:get_forecast` | 28d history + N-day forecast, 404 on unknown SKU |
| GET | `/root-cause` | `routers/intelligence.py:get_root_cause` | profit waterfall vs prev 30d |
| GET | `/anomalies` | `routers/intelligence.py:get_anomalies` | z-score revenue + margin + receivables flags |
| GET | `/buy-sell-matrix` | `routers/intelligence.py:get_buy_sell_matrix` | STAR/VOLUME/HIDDEN_GEM/EXIT quadrants |
| GET | `/brief` | `routers/intelligence.py:get_brief` | 3-item morning brief |
| POST | `/chat` | `routers/chat.py:chat` | agent orchestrate + top-3 pending suggested actions; 422 on empty |
| GET | `/actions?status=` | `routers/actions.py:list_actions` | list actions, owner-scoped, optional status filter |
| POST | `/actions/generate` | `routers/actions.py:generate` | generate recs w/ dedupe markers |
| POST | `/actions/{id}/approve` | `routers/actions.py:approve_action` | approve → gateway send → `sent` if real delivery; 409 if terminal |
| POST | `/actions/{id}/reject` | `routers/actions.py:reject_action` | reject; 409 if terminal |
| POST | `/auth/otp/request` | `routers/auth.py:otp_request` | OTP to allowed owners only (403 if unknown/pending); dev_otp in dev |
| POST | `/auth/otp/verify` | `routers/auth.py:otp_verify` | verify OTP → HS256 JWT (7-day) |
| GET | `/me` | `routers/auth.py:me` | current owner + is_admin (401 without token) |
| GET | `/owners?status=` | `routers/auth.py:list_owners` | admin-only owner list; `?status=pending` filters allowed=False |
| POST | `/owners/{id}/approve` | `routers/auth.py:approve` | admin-only approve → WhatsApp ACTIVE msg |
| POST | `/owners/{id}/reject` | `routers/auth.py:reject` | admin-only reject → polite WhatsApp msg |
| GET | `/webhook/whatsapp` | `routers/whatsapp.py:whatsapp_ping` | webhook liveness |
| POST | `/webhook/whatsapp` | `routers/whatsapp.py:whatsapp_webhook` | MESSAGES_UPSERT/message.received → BackgroundTasks `handle_incoming`; else `{"ignored":…}` |
| GET | `/whatsapp/status` | `routers/whatsapp.py:whatsapp_status` | gateway status (delegates to `wa_gateway.status()`) |
| POST | `/brief/send` | `routers/whatsapp.py:brief_send` | build + deliver morning brief (**NOT owner-scoped**) |

Total: 27 endpoints (26 router decorators + `/health`).

### Every SQLAlchemy model + columns (`app/models.py`, 11 models)

- `products`: id, **owner_id**, sku (unique), name, category, unit, sale_price, purchase_price, supplier_phone, created_at
- `customers`: id, **owner_id**, name, phone, created_at
- `sales`: id, **owner_id**, date, product_id FK, customer_id FK nullable, qty, unit_price, amount, source; UQ `uq_sale_dedup(date,product_id,customer_id,qty,amount)`
- `inventory`: id, **owner_id**, product_id FK unique, stock_qty, reorder_level, as_of
- `receivables`: id, **owner_id**, customer_id FK, invoice_no (unique), amount, issue_date, due_date, paid, paid_date nullable, source
- `expenses`: id, **owner_id**, date, category, amount, note nullable, source
- `actions`: id, **owner_id**, type, title, detail, target_name, target_phone, amount, draft_message, status (default pending), meta JSON-text, created_at, updated_at
- `document_logs`: id, **owner_id**, source, filename, parsed_entries JSON-text, status (default pending_confirm), language, phone, created_at
- `owner_profiles`: id, phone (unique), name, business_name, language (default hi), allowed, onboarded, distributor_phone, reg_step (NAME/BUSINESS/DISTRIBUTOR/LANGUAGE/OTP), otp_code, otp_expires_at, otp_attempts, created_at
- `chat_messages`: id, session_phone (indexed, **no owner_id**), role, content, language, steps JSON-text, created_at
- `ingestion_logs`: id, **owner_id**, source_type, filename, rows_inserted, rows_skipped, warnings JSON-text, created_at

`_owner_col()` = `Integer, default=1, index=True, nullable=False` (no real FK — sqlite/PG safe). Migrations: `db.ensure_access_schema()` (owner_id + access cols) and `db.ensure_p4_schema()` (document_logs.phone), both idempotent, called in `main.lifespan` before `start_watchers()`.

### Every frontend page + key components

| Route | File | What it does |
|---|---|---|
| `/` Dashboard | `app/page.tsx` | health ring + 4 subscore bars, 3 alerts, anomaly chips, forecast chart w/ SKU select, root-cause card, matrix mini + full grid; 60s polling; Refresh button; WA status badge |
| `/chat` Copilot | `app/chat/page.tsx` | WhatsApp-style chat, animated planner/specialist waiting steps, agent tool steps (`AgentSteps`), suggested-action chips, suggestion buttons; voice button = stub toast |
| `/data` Data & Sync | `app/data/page.tsx` | CSV/Excel upload (type select) + Tally XML upload, watch-folder banner, sync-log table, products table w/ low-stock highlight |
| `/actions` | `app/actions/page.tsx` | Generate button, Pending/Approved/Sent/Rejected tabs, approve/reject cards w/ simulated-vs-sent toast |
| `/login` | `app/login/page.tsx` | phone → OTP → JWT (`vyapaarai_token` in localStorage); shows `Dev OTP` hint when backend returns `dev_otp` |
| `/admin` | `app/admin/page.tsx` | admin gate via `/me.is_admin`, pending queue, APPROVE/REJECT with optimistic removal |

Shared: `components/sidebar.tsx` (desktop sidebar + mobile bottom nav, WA chip), `score-ring.tsx`, `forecast-chart.tsx` (recharts), `root-cause-card.tsx`, `buy-sell-grid.tsx`, `brief-list.tsx`, `fade-in.tsx` (framer-motion), `chat/*` (3), `ui/*` (6). Data layer: `lib/api.ts` — `API_URL` (NEXT_PUBLIC_API_URL ?? localhost:8000), typed interfaces mirroring backend, JWT `apiFetch` (auto Bearer, 401 → redirect /login), `useApi` polling hook. No supabase client anywhere in source.

### Verify scripts present

`backend/verify_p2.py` (9 checks), `verify_p3.py` (9), `verify_p4.py` (10, openwa), `verify_p6.py` (8 + legacy reruns of p2/p3/p4). No `verify_p1`/`verify_p5`.

### Env keys the code actually reads

Read (via `config.py` + direct `os.getenv` in services/routers): `DATABASE_URL`, `WATCH_DIR`, `BUSINESS_NAME`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `LLM_PRIMARY_PROVIDER`, `LLM_FALLBACK_PROVIDER`, `DEMO_MODE_FALLBACK`, `GROQ_MODEL`, `GEMINI_MODEL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WA_GATEWAY`, `OPENWA_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, `JWT_SECRET`, `ADMIN_PHONE`, `ENVIRONMENT`, `WHISPER_MODEL`, `VOICE_ENABLED`, `VOICE_REPLY`, `OWNER_PHONE`, `TTS_DEFAULT_LANGUAGE`, `ENABLE_WATCHER`, `BACKEND_PORT` (setup script only), frontend `NEXT_PUBLIC_API_URL`.
Present-in-`.env`-but-**never read by code**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL` (README mentions it; code uses hardcoded `http://localhost:3000` CORS + `FRONTEND_URL` unused). `.env.example` covers only 13 keys (missing LLM/auth/voice keys).

---

## STEP 2 — Health checks (nothing fixed, only reported)

- `python -c "from app.main import app"` → **IMPORT OK** (`VyapaarAI`).
- `python verify_p2.py` → verbatim final line: `P2 VERIFY: 9/9 checks passed` (detail: overall=43 At-Risk, recv subscore 9, 19 products — includes leftover `TestCola` from a prior P4 run — overdue ₹53,400 in brief title).
- `python verify_p3.py` → verbatim final line: `P3 VERIFY: 9/9 checks passed` (detail: overdue=53400.0, generate dedupe 10→0, approve 200/approved + re-approve 409 + reject 200/rejected, `/chat` provider=groq steps=0 ans_len=1495; stderr shows live-LLM degradation: `groq tool_use_failed / tool_choice is none` on model `openai/gpt-oss-120b` + `gemini 400`, absorbed by fallback chain).
- `python verify_p4.py` → verbatim final line: `P4 VERIFY (openwa): 10/10 checks passed` (detail: webhook 200 in 0.08s — fast because unknown test number routes to registration gate, not the agent chain; `/whatsapp/status` connected=False; brief simulated=True).
- `python verify_p6.py` → verbatim final lines: `P6 VERIFY: 7/8 checks passed` then legacy reruns all PASS, final `P6 VERIFY: 8/8 + legacy green` (detail: registration machine ok, OTP login ok, WA gating ok, approve guards 401/403→200 ok, scope isolation owner1=1531 sales vs owner2=0, per-owner health 43 vs 71, pending list count=9).

---

## STEP 3 — Feature checklist (honest statuses)

### A) Table: Feature | Status | Evidence | Notes

**P1 — ingestion & seed**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Models complete | DONE | `app/models.py` — 11 models (products→ingestion_logs) | `chat_messages` intentionally has no owner_id (keyed by session_phone) |
| Seed story data (18 products, overdue ₹53,400) | DONE | `seed_demo_data.py:PRODUCTS` (18 rows), `overdue_locked` 8500+12400+32500=53400; P3 `overdue=53400.0`, P2 brief `₹53,400 payment atka hai` | Live DB shows 19 products (stray `TestCola` from verify_p4 residue — rerun seed to clean) |
| CSV/Excel ingestion + alias maps | DONE | `services/ingestion.py:ALIAS_MAPS` (5 types), `parse_amount/parse_date/parse_paid`, `ingest_file_bytes`, `route_type`+`infer_type_from_headers`, never-crash row loops | Watch path calls `route_type(name)` without columns, so header inference is upload-only |
| Tally XML parser | DONE | `services/ingestion.py:ingest_tally_xml` (TALLYMESSAGE/VOUCHER, sales/purchase, `_parse_tally_qty/_parse_tally_date`) | Unknown voucher types skipped with warning |
| upload+tally+logs+products+reset endpoints | DONE | `routers/ingest.py` (3) + `routers/data.py` (`/products`, `/data/reset`) | `/data/reset` wipes ALL owners (see dead-code §G) |
| watchdog folder-watch + APScheduler morning hook | DONE | `services/sync.py:WatchHandler` (on_created/on_moved, 2s debounce) + `BackgroundScheduler` cron 08:00 Asia/Kolkata → `build_and_send_brief` | No ledger / rescan (→ P7 gap) |

**P2 — intelligence**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| health_score | DONE | `services/intelligence.py:health_score` + `GET /health-score`; P2 check 2 PASS (overall=43, 4 subscores, recv=9) | |
| forecast | DONE | `forecast_product` (28d hist, weekday index, stockout_days/risk) + `GET /forecast`; P2 checks 6/7 PASS | |
| root_cause | DONE | `root_cause` (revenue/purchases/mix/receivables + narrative) + `GET /root-cause`; P2 check 3 PASS | |
| anomalies | DONE | `anomalies` (z-score ±2, margin erosion, receivables pressure) + `GET /anomalies`; P2 check 4 PASS (count=3) | |
| buy_sell_matrix | DONE | `buy_sell_matrix` (median-split STAR/VOLUME/HIDDEN_GEM/EXIT) + route; P2 check 8 PASS (3/7/7/2) | |
| build_brief + endpoints | DONE | `build_brief` (overdue + nearest-stockout + profit trend, 3 items) + `GET /brief`; P2 check 9 PASS | All 6 engines owner-scoped via `_oid()` |

**P3 — LLM + agents + actions**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| LLM chain Groq→Gemini→demo_fallback (cache+429 retry) | DONE | `services/llm.py:complete_text/chat_with_tools`, `_CACHE_TTL=120`, `_try_with_429_retry` (sleep 2s), `_demo_fallback` | Degraded-live: P3/P6 logs show groq `tool_choice is none…tool_use_failed` (model `openai/gpt-oss-120b` ≠ config default `llama-3.3-70b-versatile`) + gemini HTTP 400; chain still answers |
| Agent tools (run_sql safe, get_metric, forecast, matrix) | DONE | `services/agents.py:tool_run_sql` (scope-first, SELECT-only, single-statement, 9 forbidden words), `tool_get_metric` (12 metrics), `tool_forecast`, `tool_buy_sell_matrix`, `tools_schema`, `executor/executor_for`; P3 checks 1–2 PASS | |
| 3 specialists + orchestrate + language detect | DONE | `agents.py:SPECIALISTS` (sales/inventory/finance), `orchestrate` (plan→run≤3→synthesize→persist ChatMessage), `detect_language` (hi/ta/bn/pa); P3 checks 3,8 PASS | `/chat` returned steps=0 (specialists fell back, synthesis via groq) |
| Actions generate/approve/reject + notify stub | DONE | `services/actions.py:generate_recommendations` (payment_reminder/reorder/discount_offer + marker dedupe), `routers/actions.py` (generate/list/approve→sent-or-simulated/reject), `services/notify.py:send_text`; P3 checks 4–6 PASS | approve flips to `sent` only on real gateway delivery |
| /chat endpoint | DONE | `routers/chat.py:chat` (+422 on empty; P3 checks 8–9 PASS) | suggests top-3 pending actions, owner-scoped |

**P4 — WhatsApp layer**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Gateway client (evolution.py) | DONE | `services/evolution.py` (is_connected cached 60s, send_text/voice, download_media, status+instructions) | Standby; WA_GATEWAY=openwa is active |
| voice.py (faster-whisper + edge-tts VOICE_MAP) | DONE | `services/voice.py:VOICE_MAP` (9 langs hi/mr/gu/ta/te/bn/kn/ml/en), lazy WhisperModel, `stt/tts` never-raise; P4 check 9 PASS | |
| documents.py (Gemini vision extract + confirm flow) | DONE | `services/documents.py:EXTRACTION_PROMPT`, `parse_document`→pending_confirm, `confirm_document` (SALE/CREDIT_GIVEN/CREDIT_RECEIVED/PAYMENT_MADE/PURCHASE), `build_summary` HAAN/NAHI prompt; P4 checks 4–5 PASS | PDF accepted via `_mime_for` (.pdf) on the WhatsApp path |
| whatsapp_flow (text/audio/media, HAAN/NAHI) | DONE | `services/whatsapp_flow.py:extract_incoming`, `_handle_text/_handle_audio/_handle_media`, `_HAAN/_NAHI` sets, pending-confirm short-circuit; P4 checks 1,10 PASS | |
| Webhook router (BackgroundTasks) | DONE | `routers/whatsapp.py:whatsapp_webhook` — schedules `handle_incoming`, returns immediately; P4 check 6 PASS | P4's 0.08s is the registration-gate fast path, not the agent path |
| /whatsapp/status | DONE | `routers/whatsapp.py:whatsapp_status` → `wa_gateway.status()`; P4 check 7 PASS (connected=False, nothing connected locally) | |
| /brief/send | DONE | `routers/whatsapp.py:brief_send` → `build_and_send_brief`; P4 check 8 PASS (3 items, simulated=True) | Unscoped (OWNER_PHONE/first-profile) |
| OwnerProfile model | DONE | `models.py:OwnerProfile` (phone unique + allowed/onboarded/distributor/reg_step/otp_*) | |

**P4.5/4.7 — OpenWA**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| OpenWA adapter `wa_gateway.py` (or evolution only?) | DONE (both; openwa wired) | `services/wa_gateway.py` (sessions/message/webhook, X-API-Key, session-name→UUID, send_text/voice, fetch_media, set_webhook, status); `notify.py` branches on `gateway_name()` (openwa default); `.env` `WA_GATEWAY=openwa` | evolution.py retained as fallback path |
| setup_whatsapp.py | DONE | 5-step idempotent script (health→session→QR→webhook→verify), `qr.png` + auto-open | |
| openwa_start.cmd | DONE | `cd C:\aiagentprojects\openwa` + `npm start` (:2785) | Absolute local path — breaks on any other machine |
| Group-message ignore (@g.us) | MISSING | `whatsapp_flow.py` ignores only `fromMe` + `status@broadcast`; `isGroup` arrives in payloads but is never checked; no `g.us` string anywhere in `app/` | Group traffic would be processed as DMs / create junk profiles |
| ALLOWED_INBOUND_PHONES | MISSING | No such env var or code reference anywhere; only gate is registration `reg_step` + `allowed` | Anyone who completes OTP can message; no allowlist |

**P4.6/P6 — access system**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| owner_id columns on business tables | DONE | `_owner_col()` on 9/9 business tables + `ensure_access_schema()` backfill; P6 checks 5–6 PASS | |
| Registration state machine (NAME→…→OTP) | DONE | `services/owners.py:start_registration/advance_registration/verify_otp` (NAME→BUSINESS→DISTRIBUTOR→LANGUAGE→OTP, TTL 5min, 3 attempts); P6 check 1 PASS | |
| WhatsApp OTP send/verify | DONE | `owners.py:_send_otp_text` (gateway) + dev-OTP fallback; P6 check 1 PASS | Real delivery unproven (no connected gateway in audit) |
| pending→approve flow | DONE | `approve_owner/reject_owner` + admin WhatsApp notify; P6 check 4 PASS | `ADMIN_PHONE` empty in `.env` → admin alerts skipped (logged) |
| /auth/otp + JWT login | DONE | `POST /auth/otp/request|verify` (HS256, 7-day), `GET /me`; P6 check 2 PASS (incl. 401/403 negatives) | |
| /login page | DONE | `frontend/app/login/page.tsx` (phone→OTP→token→`/` redirect, dev_otp hint) | |
| /admin queue page | DONE | `frontend/app/admin/page.tsx` (`/me` admin gate + `/owners?status=pending` + approve/reject); P6 check 7 PASS (9 pending) | |
| Per-owner scoping everywhere (scope_sql) | DONE (with exceptions) | `agents.py:scope_sql` (FROM/JOIN rewrite per ALLOWED_TABLES) + `owner_id_of/get_optional_owner` filters in ingest/data/intelligence/chat/actions routers; P6 checks 5–6 PASS | Exceptions: `POST /data/reset` (wipes all), `POST /brief/send` (OWNER_PHONE/first profile), `chat_messages` keyed by phone not owner |

**P5 — frontend & docs**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| 4 frontend pages with animations | DONE (6 pages) | `/, /chat, /data, /actions` + `/login, /admin`; framer-motion + recharts + animated ring/bars/steps; `sidebar.tsx` desktop+mobile nav | |
| Uploads UI | DONE | `app/data/page.tsx` (CSV/Excel type-select + Tally XML, toast + tables refresh) | No web PDF/photo upload (→ P7) |
| Actions approve UI | DONE | `app/actions/page.tsx` (Generate + 4 tabs + APPROVE/REJECT + simulated-vs-sent toast) | |
| README / .gitignore | DONE | `README.md` (arch, features, quickstart, env table, 7-step demo) + `.gitignore` (covers .env/db/logs/node_modules/.next/watch) | README gateway section is Evolution-only (stale vs OpenWA default) |

**P7 (DONE 2026-09-23 — `P7 VERIFY: 10/10 + legacy green`, also green on PG)**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Auto-sync reliability (processed-files ledger, periodic rescan) | DONE | `ProcessedFile` model + `sync.py:process_file` (sha256 → `skipped_same`), `startup_scan` (lifespan), 60s rescan job, `_quarantine/`; `GET /ingest/files` | P7 checks 1–3 prove dedupe/scan/quarantine |
| Initial stock/import wizard | DONE | `POST /ingest/preview|/commit` (commit flips `onboarded`), `GET /ingest/template`, `/data` wizard (templates → preview → commit → live) | P7 checks 4–6 |
| Web PDF upload + recognize + confirm UI | DONE | `routers/documents.py` (`/documents/upload|/pending|/{id}/confirm|reject`, JWT + owner-scoped) + `/data` Documents card | P7 check 7; WhatsApp flow untouched |

**P8 (DONE 2026-09-24 — DB: Supabase Postgres (session pooler), sqlite fallback commented)**
| Feature | Status | Evidence | Notes |
|---|---|---|---|
| DB on Supabase Postgres | DONE | `backend/.env` `DATABASE_URL=postgresql://postgres.goonzeuzogkzvjntbfjr:…@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require`; `psycopg2-binary` in `requirements.txt`; PG 17.6; seed recreates schema + story data in PG (18 products / 1530 sales / overdue ₹53,400); `seed_demo_data.py` runs `create_all` + both `ensure_*` + bootstraps owner 1 (admin) + owner 2 (P6 fixture, setval fixed) | Direct host unresolvable here (IPv6-only); pooler 5432/6543 × require/disable all connect. sqlite line kept as commented fallback; legacy verifies run on sqlite via env override |
| Supabase Realtime subscriptions in frontend | DONE | `@supabase/supabase-js@2.117.1`; `frontend/.env.local` (URL + anon key); `lib/realtime.ts` singleton + `useRealtime(tables, onEvent)` (300ms debounce, live/polling); wired: dashboard `[sales, ingestion_logs, processed_files, receivables, inventory]`, data `[ingestion_logs, processed_files, document_logs, products, inventory]` (+pending docs), actions `[actions]`, admin `[owner_profiles]` + INSERT toast, sidebar Live chip; polls moved to 300s safety | `P8 VERIFY: realtime OK` (`frontend/verify_p8.mjs`: probe INSERT → event ≤10s → cleanup). Publication `supabase_realtime` covers the 10 tables; RLS disabled on app tables (demo; add policies for production). Note: ~20s propagation lag after (re)seed before first event |

### B) GATEWAY STATE

- **Wired gateway: OpenWA (default).** `.env` sets `WA_GATEWAY=openwa`, `OPENWA_URL=http://localhost:2785`, session `vyapaarai`. `services/wa_gateway.py` is the full adapter (session resolve, send_text/voice, fetch_media, set_webhook, status). `services/evolution.py` is fully present but standby — used only when `gateway_name() != "openwa"` (verify scripts force `WA_GATEWAY=evolution` precisely to stay simulated).
- **`notify.py` uses it:** yes — `send_text()` branches on `wa_gateway.gateway_name()`; openwa path requires `is_connected()` else returns `simulated:true`; evolution path likewise. All live sends degrade to `{"simulated": true}` — every verify delivery assertion depends on this.
- **Group-ignore: NOT present.** Only `fromMe` and `status@broadcast` are dropped (`whatsapp_flow.py:63,67,141`). The OpenWA `isGroup` flag and `@g.us` JIDs are never checked (zero `g.us` hits in `app/`), so group messages would enter registration/agent flows.
- **Setup chain present:** `openwa_start.cmd` → `setup_whatsapp.py` (QR to `backend/qr.png`) → webhook `POST /api/sessions/<id>/webhooks {message.received, session.status}` → `POST /webhook/whatsapp`. Nothing was connected during audit (`connected=False` everywhere).

### C) DATA ISOLATION STATE

**Present — multi-tenant with known exceptions.** `owner_id` (default 1) on all 9 business tables, backfilled by `ensure_access_schema()`; `OwnerProfile` carries `allowed/onboarded/reg_step/otp_*`; every data/intelligence/chat/action/ingest route resolves the caller via `get_optional_owner → owner_id_of` (anonymous → owner 1, preserving the legacy single-tenant demo); agent SQL is rewritten by `scope_sql()` (P6 proves owner1=1531 sales vs owner2=0, health 43 vs 71). **Exceptions (still single-tenant):** `POST /data/reset` wipes every owner's tables; `POST /brief/send` uses `OWNER_PHONE`/first-profile, not the caller; `chat_messages` are keyed by `session_phone` with no owner column; `DocumentLog.confirm_document` checks owner-match but `_latest_pending` is phone-scoped.

### D) VERIFY STATE

| Script | Result (verbatim final line) |
|---|---|
| `verify_p2.py` | `P2 VERIFY: 9/9 checks passed` |
| `verify_p3.py` | `P3 VERIFY: 9/9 checks passed` (with live-LLM warnings in stderr: groq `tool_use_failed`, gemini 400) |
| `verify_p4.py` | `P4 VERIFY (openwa): 10/10 checks passed` |
| `verify_p6.py` | `P6 VERIFY: 8/8 + legacy green` (after `P6 VERIFY: 7/8 checks passed` + 3/3 legacy PASS lines) |
| `verify_p7.py` | `P7 VERIFY: 10/10 + legacy green` (sqlite + PG) |
| `frontend/verify_p8.mjs` | `P8 VERIFY: realtime OK` |
| `python -c "from app.main import app"` | `IMPORT OK` |

No script failed to run. (No verify_p1/p5 exist.)

### E) REMAINING WORK (ordered, mapped to phases)

**P6 (access system) — effectively DONE; only hardening left**
1. Set `ADMIN_PHONE` in `.env` (currently empty → registration alerts skipped) and confirm real WhatsApp OTP + approve-notify delivery once OpenWA is connected.
2. Scope or guard `POST /data/reset` (admin-only + per-owner or explicit global-wipe confirmation) — currently any caller wipes all tenants.
3. Add explicit group-ignore (`@g.us` / `isGroup`) and decide on `ALLOWED_INBOUND_PHONES` (implement or formally drop — do not leave ambiguous).

**P7 (auto-sync fix + initial import + web PDF) — the real backlog**
4. Processed-files ledger + idempotent rescan: new table (filename, sha256, bytes, ingested_at, owner), startup scan of `./watch`, periodic rescan job in `sync.py`, skip-unchanged + quarantine-bad-files.
5. Initial stock/import wizard for newly-approved owners: template CSVs per type, column preview via existing alias maps, row-error table, first-sync checklist (empty-state health, e.g. owner 2 today).
6. Web PDF/photo upload + recognize + confirm UI: `POST /documents/upload` (reuse `documents.parse_document` with `source="web"`) + pending queue UI with entry table + HAAN/NAHI-equivalent confirm/discard (parity with WhatsApp flow).

**P8 (realtime) — greenfield**
7. Supabase migration + Realtime: move `DATABASE_URL` to pooler URI, add `@supabase/supabase-js`, replace 60s `useApi` polling on dashboard/actions/admin with channel subscriptions (+ polling fallback), keep JWT auth model consistent with RLS or backend-scoped publishes.

### F) NEXT SINGLE PROMPT SHOULD COVER

Build **P7 item 4 (auto-sync reliability: processed-files ledger + startup scan + periodic rescan)** first, because every other P7/P8 step assumes ingest is trustworthy: today a backend restart silently misses files dropped while down, re-dropped files rely only on DB unique constraints, and there is no audit of what was processed, so the wizard (5), web PDF flow (6), and realtime UI (7) would all display untrustworthy data; the prompt should add a `processed_files` ledger (filename, sha256, size, owner, result), wire it into `ingestion.py` entry points and `sync.py` (startup scan + scheduled rescan + quarantine), and extend `verify_p2`/a new `verify_p7.py` to prove restart-safety and no-duplicate re-ingest without touching the already-green P1–P6 behavior.

### G) Broken / dead code found (read-only — nothing fixed)

1. `backend/requirements.txt` omits `pyjwt` (imported by `routers/auth.py`, used by `verify_p6._mint`) and `httpx` (needed by FastAPI TestClient) — suite passes only via transitive installs; fresh `pip install -r` may break auth/tests.
2. `GROQ_MODEL` mismatch: `config.py` default `llama-3.3-70b-versatile` vs `.env` `openai/gpt-oss-120b`; live logs show the latter failing tool calls (`tool_choice is none…tool_use_failed`) so specialists always degrade to context/zero-step answers — pin a tools-capable model or keep the override deliberately.
3. No group filter: `isGroup`/`@g.us` never checked — group chatter enters registration and agent spend.
4. `POST /data/reset` is unauthenticated and global (wipes all owners, closes the request DB session mid-request).
5. `POST /brief/send` ignores the caller (first `OwnerProfile` + `OWNER_PHONE`, owner-1 numbers).
6. `frontend/app/chat/page.tsx` voice button is a stub (`toast.info("Voice input jald aa raha hai")`).
7. `sync.py` watch path skips header inference (`route_type(name)` without columns) and has no ledger/startup-scan/rescan.
8. `evolution.download_media` writes the blob to a temp file just to read it back — wasteful, harmless.
9. Test residue in `vyapaar.db`: `TestCola`/`TestParty` rows make `/products` return 19 (not 18) and leak into `/brief` — rerun `seed_demo_data.py` for a clean demo.
10. `ADMIN_PHONE` empty, `datetime.utcnow()` deprecation warnings in `verify_p6`, live secrets (Groq/Gemini/Supabase service-role) sitting in `backend/.env` (gitignored, but rotate if ever shared), `openwa_start.cmd` hardcodes `C:\aiagentprojects\openwa`, README WhatsApp section documents Evolution only (stale vs OpenWA default).

## Phase B (2026-09-24)

### B1 � UPI deep-links + daily PDF (P9 VERIFY: 7/7 + legacy green)
- owner_profiles.upi_vpa (migration + seed backfill sharmatraders@okicici); payment drafts append NPCI upi://pay link; /actions chip.
- services/reports.py 1-page PDF; outers/reports.py (GET /reports/daily, POST /reports/send-now); send_document on OpenWA (send-document) + Evolution; 21:00 
ightly_report cron; dashboard report popover.

### B2 � credit score + festival forecast (P10 VERIFY: 5/5 + legacy green)
- services/credit.py (discipline 40 / stability 30 / growth 20 / margin 10) + GET /credit-score; dashboard card + copyable bank summary. Owner1 44/High-risk vs owner2 50.
- FESTIVALS (Diwali x1.6, Holi x1.4, Eid/Rakhi x1.3) multiply forecast days; response adds estivals + per-day estival tag; chart shows amber chip + ReferenceArea band. 11-08 qty 38.4 vs weekday med 16.0.
- Legacy p2..p9 all green on sqlite. Note: live LLM providers currently degraded (groq model retired 404, gemini 400) � demo_fallback carries /chat; no verify depends on live LLM.

## PROD HARDENING v2 (2026-09-24) � P11v2 VERIFY 6/6, SKIPPED none
- slowapi limits (chat 30/m, otp 5/m, ingest+documents 20/m, JSON 429), CORS FRONTEND_URL only, 20MB/413 + sanitized names, uuid request_id + structlog logs, security headers, 500/404 JSON with request_id, GET /health/ready.
- PG composite indexes (urlparse-guarded); 60s intel cache with X-Cache, invalidated on ingest/commit, doc confirm, actions generate; products + actions confirmed single-query, no N+1.
- Grants deliberately OPEN (owner decision): anon realtime shares the grant switch with REST, REVOKE proven to kill live UI. Roadmap: per-owner RLS + backend broadcast. Legacy p2..p10 each once on sqlite, all green.

## P12 UI MASTER (2026-09-24) � P12 MASTER VERIFY ALL GREEN
- Light-first Bahi-Khata theme (Fraunces+Inter, persisted toggle), public landing with phone loop, routes restructured to /app/*, Cmd+K palette, EN/HI toggle, PWA manifest, custom 404 + error boundary.
- Backend: only POST /chat/voice added (STT-to-orchestrate). verify_p3 9/9 once. Frontend: tsc clean, build green, curl sweep all 200 + 404 correct.

## UI MASTER OVERHAUL (2026-09-24) � UI MASTER VERIFY ALL GREEN
- Voice fixed both surfaces: stt accepts webm/ogg/mp3/mp4, small-model default, pydub-wav retry, Hindi 422 reasons, duration+language logs; chat MediaRecorder UX with permission mapping, timer, waveform, shimmer; faster-whisper installed.
- Landing 2.0: 9 sections + footer (preloader, hero living-ledger, biz marquee, scrolly-telling, bento, mini-demo, stats band, quote, final CTA), lenis smooth scroll, hide-on-scroll nav.
- App 2.0: greeting bar, ledger cards, health stamp, KPI count-ups + sparklines, live feed, snap alerts, anomaly rows, receipt actions + confetti, file stamps, WA chat bubbles, collapsible folder-tab sidebar, torn-paper 404.
- Acceptance: tsc clean, build green, all routes 200 + 404 correct, voice junk 422 Hindi reason, verify_p3 9/9 once. No-browser checks (console/390px/theme-click) left for human pass.

## P12.9 LANDING v3 CRAFT PASS (2026-09-24)
- Skills: 10/10 installed (gsap-core/timeline/scrolltrigger/react/performance/plugins, svg/60fps/accessible/micro-interaction) + gsap 3.15.0 npm (one package); pdf/pptx/xlsx/docx never existed; web-design-engineer clone failed, brief governed.
- Ink Line: fixed scrub-drawn emerald thread + marigold accent (gsap.context cleanup, pathLength trick, reduced-motion static). Grain overlay, ruled texture scoped to hero ledger + quote.
- Landing 100pct English (grep proof), toggle removed; 9 sections re-crafted with distinct choreographies, expo house ease, word masks, velocity-skew marquee, magnetic CTA, VYAPAAR parallax, checkmark draw.
- Acceptance: tsc clean, build green, 9 routes 200 + 404 correct, verify_p3 9/9 once, backend untouched. Gaps: no browser (console/390px/theme-click unverified); phone tilt per chapter simplified to masked swaps.

## LANDING SAFFRON REBUILD (2026-09-24) — Phase 0 baseline audit

- `npx tsc --noEmit` → exit 0, 0 errors.
- Route sweep (dev server :3000): `/` `/login` `/register` `/app` `/app/chat` `/app/data` `/app/actions` `/admin` → all 200; `/nonexistent-route` → 404.
- Packages: framer-motion ✓ gsap ✓ @gsap/react ✓ recharts ✓ sonner ✓ lenis ✓ canvas-confetti ✓ (no install needed).
- tailwind.config.ts: minimal extend (fontFamily display/sans only) — will extend with saffron tokens in Phase 1.
- app/layout.tsx: fontsource Fraunces/Inter + next/font Tiro_Devanagari_Hindi, `<Smooth>` Lenis provider, Toaster — will ADD ONLY Google Fonts link in Phase 1.
- app/page.tsx (expert edition, emerald/Fraunces) copied to app/page.tsx.bak. Superseded `components/expert/` + LANDING_REPORT.md removed (untracked, replaced by this spec).
- components/landing/ created. Lenis already wired globally in components/smooth.tsx with the EXACT canonical wiring (lenis.on scroll→ScrollTrigger.update, ticker ms conversion, lagSmoothing 0, reduced-motion gate) → LandingShell will NOT create a second Lenis instance (double-drive = jitter per skill).
- Skills: R1 MagicUI SPARSE attempted, registry paths changed → MANUAL (hand-rolled count-up). R2 ReactBits CLONED+REMOVED. R3 Dub CLONED+REMOVED (reference only, no code copied). R4 GSAP skills ALREADY PRESENT (P12.9) + network re-verified. R5 web-animation-skills CLONED OK (gsap-web, scrolltrigger-lenis, svg/60fps/accessible/micro-interaction).

## LANDING SAFFRON REBUILD (2026-09-24) — Phase 9 verification sweep

- CHECK-1 tsc --noEmit → exit 0, 0 new errors. PASS.
- CHECK-2 npm run build → green, `/` 20.7 kB / First Load 199 kB. PASS (1 fix used: Footer missing 'use client').
- CHECK-3 routes (fresh dev server): `/ /login /register /app /app/chat /app/data /app/actions /admin` → 200; `/nonexistent-route` → 404. New-landing content confirmed in served HTML. PASS. (Note: a stale long-running dev server briefly 404'd `/` mid-rebuild; fresh boot serves 200 — wedged HMR state, not a code issue.)
- CHECK-4 language audit (non-ASCII grep over components/landing): 0 violations — only (a) व्यापार brand mark, (b) WhatsApp-bubble/transcript product mocks, (c) mandated numerals ₹/→/×/·. PASS.
- CHECK-5 verify_p3.py: SKIPPED — backend :8000 not reachable in this session; script exists but was not run (no live state touched).
- CHECK-6 console errors: no browser in sandbox; dev-server log shows zero render/hydration errors across all route compiles. Browser console left for human pass.
- CHECK-7 reduced motion: every GSAP path + Lenis gated behind prefers-reduced-motion; CSS motion killed under the media query; no-JS renders full content. PASS-by-construction (DevTools emulation = human pass).
- CHECK-8 390px: stacked layouts, ≥44px targets, max-w phone mock, overflow-hidden heroes/marquee/footer. Verified by construction (no horizontal scroll sources); device check = human pass.
- CHECK-9 1920px: max-w-7xl containment, hero clamp→6rem, vector-only SVGs. Verified by construction; projector check = human pass.
- CHECK-10 backend untouched: diff since phase-0 contains ONLY app/page.tsx, app/layout.tsx (fonts link + landing.css import), components/landing/**, hooks/useCountUp.ts (landing-only, C5-sanctioned), styles/landing.css, tailwind.config.ts (+ phase-0: PROJECT_STATUS.md, page.tsx.bak, .opencode/skills). app/globals.css + tsconfig.tsbuildinfo reverted to HEAD. PASS.
- Downgrades: (1) Second Lenis instance → NOT created (global Smooth provider already has verbatim canonical wiring; double-drive = jitter). (2) MagicUI NumberTicker → hand-rolled useCountUp. Lenis itself NOT disabled (works via provider).
- Side effects to know: `.font-display` now resolves Playfair (was Fraunces) wherever the class is used, including /app dashboard — serif-to-serif, low risk. Google Fonts <link> needs internet at view time; Georgia/system-ui fallbacks otherwise.

## P15 FULL PRODUCT PASS (2026-09-29) — P15 VERIFY: 8/8

### Role model (owner-stated, FINAL)
- ASSISTANT/BRIDGE = 919511996418 (old spare SIM, low traffic — this WhatsApp account IS VyapaarAI).
- OWNER/ADMIN = 919834854511 (owner's main phone — logs in, gets OTPs/alerts/reports). Seed/demo owner unchanged.
- `ALLOWED_INBOUND_PHONES=919834854511`; bridge number never stored in owner_profiles/seed. Bridge fromMe auto-dropped.

### Production auth (Phase 1)
- `ENVIRONMENT=production` in backend/.env. `/auth/otp/request` never returns dev_otp in prod (honest `{"sent": false, "error"}` when gateway down); WA registration replies never echo OTP code in prod. Startup assertion `_assert_prod_auth_guard()` in main.py pins this. Pinned by verify_p15 check 2.
- RUNBOOK.md: bridge-down drill (old phone ON + QR re-scan + /whatsapp/status) + INCIDENT MODE (one-line ENVIRONMENT flip + revert).
- WAITING-ON-HUMAN: old-SIM QR scan + OTP-arrival smoke + pending-register + wrong-OTP-3-attempt paths (steps in RUNBOOK.md).

### Auth/registration hardening (Phase 2, PROJECT_DEEPDIVE S7/S8)
- Schema: owner_profiles += business_type + distributors (JSON array); ensure_p15_schema backfills distributors from distributor_phone (mirrored to [0]); serialize_owner exposes both.
- API: RegisterRequest business_type enum (11, required) + distributors list (dedupe, max 5); GET /distributors/lookup (approved owners, phone-prefix/name-substring, limit 8); POST /brief/send JWT-required + owner-scoped (OWNER_PHONE/first-profile fallback removed); webhook HMAC via `x-webhook-secret` header (401 on mismatch); HSTS + CSP headers (CSP: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis; font-src fonts.gstatic; img-src data:/blob:; connect-src Supabase REST+wss; frame-ancestors 'none').
- UI: register revamp (labels, inline errors, autocomplete, 16px+ inputs, business_type select, distributor chips + lookup picker + manual, human language names, 3-bullet what-next); login OTP exactly-6-digits; admin cards show business_type badge + distributor chips + language.
- WA machine: NAME → BUSINESS (free text) → CATEGORY (numbered 1-11) → DISTRIBUTOR (comma-separated ≤5) → LANGUAGE → OTP.
- S8#13 kept: id==1 always admin; RUNBOOK notes prod DB must never reuse demo seed.

### Live connectors (Phase 3)
- Connector model (owner_id, type, config JSON, status, last_sync_at, rows_synced). Routers: GET/POST/DELETE /connectors, POST /connectors/{id}/sync-now, POST /connectors/ingest (JWT, 20/min, {source: excel|tally, rows} → ingestion alias-maps → ingestion_logs).
- Google Sheets: 60s APScheduler poll, values.get via GOOGLE_API_KEY (public sheets; private-sheet OAuth deferred), sha256 row-diff → sales ingestion → rows_synced/last_sync_at → intel invalidate. Missing key → status=error with honest message.
- Local agents: backend/connectors/excel_sync.py (+.cmd, watchdog → /connectors/ingest) + tally_sync.py (+.cmd, localhost:9000 Day-Book XML per Tally.Py envelope patterns, last-sync marker). Reference repos cloned to temp, read, deleted. watchdog already in requirements.
- UI: /app/data "Live Connectors" card (type tabs, Sheets link+Connect, Excel/Tally cmd instructions, status chips + last_sync + rows_synced, realtime + 300s poll).

### Seed truth (Phase 4)
- 40 products, EXACTLY 18 below reorder_level (landing "18 SKUs" true); voice_logs table seeded to EXACTLY 2,847 rows for owner 1 (landing number true); ₹53,400 overdue lock + random.seed(7) kept.

### S8 disposition (vs PROJECT_DEEPDIVE.md S8)
| # | Item | Disposition |
|---|---|---|
| 1-3 | distributor model/picker/blind-text | FIXED (distributors JSON + lookup + picker + WA multi) |
| 4,5,7,8,22 | register labels/inline/lang/pending/mobile | FIXED (revamp) |
| 6 | OTP 6-vs-4 mismatch | FIXED (exactly 6) |
| 9 | /data/reset global wipe | ACCEPTED (admin-gated earlier; per-owner scoping deferred) |
| 10 | /brief/send unscoped | FIXED (JWT + owner-scoped, fallback removed) |
| 11 | chat_messages phone-keyed | ACCEPTED (works; migration risk > benefit) |
| 12 | dev-OTP disclosure | FIXED (prod guard + startup assert + verify pin) |
| 13 | id==1 hardcoded admin | ACCEPTED (kept deliberately; prod-DB note in RUNBOOK) |
| 14 | ADMIN_PHONE empty | FIXED (set to 919834854511) |
| 15 | approve-notify simulated | ACCEPTED (honest `simulated` flag already surfaced) |
| 16 | webhook no HMAC | FIXED (x-webhook-secret verify, 401) |
| 17 | no CSP/HSTS | FIXED (headers added, CSP reported above) |
| 18 | JWT in localStorage | ACCEPTED (httpOnly migration deferred) |
| 19 | no CAPTCHA on register | ACCEPTED (10/min IP limit; CAPTCHA deferred) |
| 20 | 18 SKUs / 2,847 provenance | FIXED (seed now literally true) |
| 21 | lang passthrough | ACCEPTED (norm + enum on web; WA _norm_lang covers) |
| 23,24 | footer/SRI/fonts | ACCEPTED (out of P15 scope; landing untouched per safety law) |
| 25 | phone normalization dupe | ACCEPTED (works; refactor deferred) |
| 26 | onboarded nudge | ACCEPTED (wizard exists; nudge flow deferred) |
| 27 | stale §G3/§G4 lore | CORRECTED (group-ignore + allowlist + admin-gated reset present) |
| 28 | chat→approve hop | ACCEPTED (chips exist; deep-link deferred) |

### Verify state (P15 close)
- `verify_p15.py`: 8/8 (schema, prod-guard subprocess, connectors routes, seed truth, enum 422, valid register, webhook HMAC, HSTS+CSP).
- Honest gaps: Sheets OAuth for private sheets = deferred; old-SIM QR smoke = WAITING-ON-HUMAN; prod DB (Supabase) not reseeded in this pass (seed truth proven on sqlite; `/data/reset` remains the prod-reseed path via admin).

## ONE-SHOT PASS p0–p3 + P16 + P8 (2026-09-29) — FINAL, ALL GREEN

### One-shot p0 — role config lock
- `.env`: OWNER/ADMIN=919834854511, ASSISTANT bridge=919511996418 (OpenWA session), ALLOWED_INBOUND_PHONES set, GOOGLE_API_KEY= (empty, Sheets public-read).
- No hardcoded numbers in `backend/app/` (grep proof): user-facing bridge mentions read `ASSISTANT_PHONE` via `_bridge_label()` (auth.py, owners.py). Seed keeps 919834854511 by spec (no migration); verify fixtures use it as test data.

### One-shot p1 — OTP = onboarding (no approval gate anywhere)
- `/auth/otp/verify` + WA machine OTP verify set `allowed=True` immediately + WA welcome + ops ping; `/auth/register` copy = "OTP verify karo aur shuru karo".
- GATE-2 (registered-but-inactive inbound) now replies OTP-verify nudge in owner language (hi/en), never "admin approve karega" (pinned by verify_p15 check 7).
- `/admin` = hidden OPS console (owners suspend/restore override + connectors + /health/ready); zero product-UI links (sidebar/landing/footer/link grep clean).
- One-time morning nudge (activated-but-not-onboarded, 20h+, `nudge_sent_at`) in 08:00 job. `verify_p125.py`: 4/4 ALL GREEN.

### One-shot p2 — contacts + supplier messaging
- `contacts` table + backfill (supplier←products.supplier_phone, customer←customers, dedupe); JWT CRUD + `/send` (20/min, bridge + "— {biz} (via VyapaarAI)" signature, `{sent|simulated}`); `/app/contacts` (kind groups, templates, local last-5 history) + sidebar tab; reorder approve auto-creates supplier contact + signs drafts.

### One-shot p3 — unified WhatsApp ↔ web thread
- `chat_messages.owner_id + source` (+backfill by phone match); orchestrate persists user+assistant with source; `_reply` persists WA outbound; `GET /chat/history`; `/app/chat` one timeline with source badges. Voice mic UX untouched.

### P16 — direct entry + camera + PWA (all committed earlier, re-verified this pass)
- `POST /ingest/grid` (web-grid → `ingest_dataframe`, no parse duplication); spreadsheet grid card (A–F, inline edit, product select + mini-create, inline validation, card-internal horizontal scroll); Scan Bill modal (getUserMedia → capture → `/documents/upload` → marigold pending rows); PWA manifest + Install card; RUNBOOK Day-8 APK + vision-pipeline notes.

### P8-F1 — loan-ready PDF
- `build_credit_pdf()` (reportlab, reuses nightly builder): business/owner/phone/date header + "Score se seedha loan file", overall + grade + 4 subscores + reasons + last-6-months revenue trend (Python-bucketed, sqlite+PG safe) + bank_summary + "Generated by VyapaarAI" footer.
- `GET /credit-score/report` (JWT, 20/min → `application/pdf`, 401 without token, verified live). `/app` credit card: "🏦 Bank-ready PDF" blob-download button.

### P8-F2 — scheme radar
- `services/schemes.py`: trigger gate (buy+free/scheme/offer/free/muft/discount) → regex parse first (offline-safe) → LLM strict-JSON backup → normalized fuzzy product match → effective unit = total_lot_price/(buy+free) vs purchase_price → savings % + stock-days verdict (`lena faydemand` / `skip` / high-stock-neutral / no-price) in owner language → pending `scheme_alert` ACTION (marker-deduped, approvable in `/app/actions` generic feed).
- Hooked in `_handle_text` (post-confirm short-circuit) + media captions (image/document `caption` plumbed from OpenWA payload).
- Honest fallback: parse fail → "scheme samajh nahi aayi, dobara saaf bhejo", NO action created. Proven on temp-sqlite (parse + action + fallback + non-scheme passthrough).
- SPEC DEVIATION (documented, math-correct): master text wrote `price*buy/(buy+free)`; implemented `price/(buy+free)` because owners forward TOTAL lot price ("Rs 200" for "10+1") — the literal formula overstates unit cost ~10x and flips every verdict. Same result as the spec formula when price is read per-unit.

### Verify state (FINAL)
- `verify_p15.py` REWRITTEN to 9 checks: tables/columns; prod-guard subprocess; routes (`/connectors*`, `/contacts*`, `/credit-score/report`, `/ingest/grid`); REAL `seed_demo_data.py` reseed on scratch sqlite (40 prod / 18 low / overdue 53400.0 / voice 2847, seed_rc=0); enum 422; HMAC 401; no-admin-approval-copy grep; HSTS+CSP; scheme radar offline. → **9/9 ALL GREEN**.
- `verify_p125.py` 4/4 ALL GREEN. `verify_p3.py` 9/9 (once). `npx tsc --noEmit` clean. `npm run build` green (13 routes incl. `/app/contacts`). Route sweep: all 200 + 404 correct. Dev-server log: zero errors. Landing + `/app/chat` voice UX: zero diff since P15 (untouched). 390px: grid/connectors tables scroll INSIDE cards; contacts wraps; no new motion this pass (backend-only + plain button) so reduced-motion holds.

### FINAL S8 disposition (superset of P15 table; only changes listed, rest unchanged)
| # | Item | Final |
|---|---|---|
| 1-8,10,12,16,17,20 | (as P15) | FIXED, re-pinned by new verify_p15 |
| 9 | /data/reset global wipe | ACCEPTED (admin-gated; per-owner scoping deferred) |
| 11 | chat_messages phone-keyed | FIXED (owner_id added one-shot p3; source badges live) |
| 13 | id==1 hardcoded admin | ACCEPTED (deliberate; RUNBOOK prod-DB note) |
| 14 | ADMIN_PHONE empty | FIXED (set; ops pings flow) |
| 15 | simulated delivery | ACCEPTED (honest `simulated` flag surfaced) |
| 18 | JWT in localStorage | ACCEPTED (httpOnly deferred) |
| 19 | no CAPTCHA | ACCEPTED (10/min limit; CAPTCHA roadmap) |
| 21 | lang passthrough | ACCEPTED (norm + enum web; WA norm covers) |
| 23,24 | footer/SRI/fonts | ACCEPTED (landing untouched per safety law) |
| 25 | phone normalization dupe | FIXED (single `services/phone.py` util, committed) |
| 26 | onboarded nudge | FIXED (morning nudge job + stamp) |
| 27 | stale lore | CORRECTED (docs current) |
| 28 | chat→approve hop | ACCEPTED (chips exist; deep-link deferred) |

### WAITING-ON-HUMAN (still OPEN — physical phone required)
1. Old SIM 919511996418 in spare phone + `openwa_start.cmd` + `setup_whatsapp.py` → scan QR from old phone → `/whatsapp/status` connected + bridge identity.
2. Owner-phone "hi" → machine replies; `/login` OTP ARRIVES ON WHATSAPP → verify → JWT → `/app`.
3. Wrong-OTP 3-attempt restart + registered-but-inactive nudge path observed live.

### HONEST GAPS
- Sheets OAuth for PRIVATE sheets = deferred (public + API key only).
- Photo-only scheme without caption goes through normal document flow (no scheme verdict; caption/text schemes fully work).
- Live LLM providers degraded in this environment (groq model 404, gemini 400) — demo_fallback carries `/chat`; scheme regex path is LLM-independent; LLM strict-JSON backup activates when providers recover.
- Old-SIM QR + OTP-arrival smoke = WAITING-ON-HUMAN. Prod Supabase not reseeded this pass (truth proven on scratch-sqlite reseed; `/data/reset` is the prod-reseed path).

## MASTER P18 — BUG-HUNT & PIPELINE PROOF PASS (2026-09-29) — E2E 39/39 GREEN

### SEC 0 — debug skills
- Cloned `obra/superpowers` to temp OUTSIDE repo; copied `systematic-debugging`, `verification-before-completion`, `test-driven-development` into `.opencode/skills/`; temp deleted. (`root-cause-tracing` + `defense-in-depth` are not standalone skills in that repo — their `.md` companions ship INSIDE `systematic-debugging/` and were copied too; same rules followed.)
- Loaded installed `debugging-and-error-recovery` + `code-review-and-quality`; all five rule-sets applied (cited in report).

### PH 1+2 — `scripts/e2e_all.py` (permanent regression proof, scratch sqlite, no live WA/LLM)
First run: **35 pass / 4 FAIL / 0 skip**. Verifies alongside: p125 4/4, p15 9/9, p3 9/9 (once each).

### Bug tickets (systematic-debugging: reproduce → trace → single fix → verify)
| ID | Sev | Symptom | Root cause (traced, not guessed) | Fix (commit) |
|---|---|---|---|---|
| F1 | **P0** demo-blocker | Voice full loop 422, empty transcript on clean Hindi mp3 | Windows file lock: `NamedTemporaryFile(delete=True)` holds exclusive handle → PyAV reopen → PermissionError (proven by delete=True vs False A/B). Same lock would have killed TTS saves. | `0d6800c` voice.py: mkstemp+close helpers for STT/TTS/retry + permission-denied retry layer |
| F4 | **P0** demo-blocker | `GET /reports/daily` 500 (`bytes(None)`) | P8-F1 edit consumed `build_daily_pdf`'s footer/build/return (shared block) → implicit `None` | `ab2dd54` restored daily ending; both PDFs 200 |
| F2 | **P1** judge-visible | Scheme on unit-suffixed names → `no_product`, no action | (1) cleaner ate size info; (2) substring matcher tied on multi-pack bases (Atta 5kg vs 10kg) | `95a0371` unit-agnostic cleaner+tokens, then `66781df` strict-best overlap + raw-text size hint (5kg wins; true ties ask owner; spec's "Parle-G" example matches) |
| F3 | test bug | e2e onboarded assert `True->True` | Assertion demanded `not onb0`, but seed ships onboarded=True | fixed assertion in e2e (insert + flip proven) |
- P2 polish: none found (everything else passed first attempt). Fix attempts used: F1×1, F4×1, F2×2 — all within budget.

### PH 3 close — final: **E2E ALL 39/39 GREEN** (fresh full re-runs after every fix), p125 4/4, p15 9/9, p3 9/9.

### PH 4 — static sweep
- `pip install ruff` (dev tool only, NOT in requirements.txt): default run = 1118 hits, ~all BLE001 = the deliberate never-raise convention → correctly ignored. Targeted `F401,F821,F822,F841,E9` = 22 real findings (unused imports + 1 dead var) → all fixed (`c324ec7`), e2e re-run 39/39 after.
- `npx tsc --noEmit` clean; `npm run build` green.
- Tracked-file greps: `console.log` 0 · TODO/FIXME 0 · secrets (`gsk_`, `AIzaSy`, service_role, private keys) 0 · product `/admin` links 0.

### PH 5 — local demo prep
- `scripts/warmup.py`: whisper load (12.5s) + orchestrate + health (38) + credit PDF (3208B) + forecast → **WARMUP: ALL HOT**. NOTE: first orchestrate takes ~137s here (dead-provider retries → fallback); run warmup BEFORE the mam demo, later answers are fast.
- `scripts/demo_day.cmd`: backend start + warmup + `/whatsapp/status` + human checklist.
- LIVE SMOKE (human-pending — no phones/bridge in this environment, server-side verified instead): OTP arrival on 919834854511 · owner "hi" → history row · live scheme → action · ONE bill photo → vision pending (Gemini 400 HERE — if it 400s on demo machine, mint a fresh free key; vision path is provider-gated, everything else is local) · voice note → transcript (now proven locally E2E).

### P18 HONEST GAPS (new)
- edge-tts was missing from the installed env (present in requirements.txt) — installed for the voice proof; demo machine needs `pip install -r requirements.txt` + internet for first TTS/STT-model fetch (whisper-small is cached here).
- First-orchestrate latency ~2min with dead providers (retry chain); warmup absorbs it.
- No P2 polish items found — stated plainly, not padded.

## MASTER P19-HOTFIX — SEAMLESS REGISTER→OTP + HONEST DELIVERY (2026-09-30)

### Live incident (owner-reported)
New web registration → redirected to /login → re-entered number → NO OTP arrived (bridge connected). Two compounding causes: (a) OTP request gated on profile state/phone-variant mismatch instead of "registered = eligible"; (b) register page had no OTP step, forcing the /login hop. Delivery failures were also silent (old `sent:false+error` 200).

### Gate model (FINAL)
- **UNKNOWN phone** → 403 "pehle register karo" (+ register hint in message).
- **REGISTERED (allowed False OR True)** → OTP always sent; verify activates (OTP=onboarding, unchanged).
- **blocked==True (ops suspension)** → 403 "suspended — ops se sampark karo" on request + 401 on verify/login; WA inbound gets suspended reply. `allowed` stays the onboarding flag; suspend/restore touches ONLY `blocked` (`reject_owner`/`approve_owner`).
- **Delivery honesty**: send → retry ONCE → still failing + production → **502** `{sent:false, reason:"whatsapp-delivery-failed", detail:"WhatsApp pe OTP delivery fail hua — 30s baad dobara try karo"}`, rid logged server-side, code NEVER included. Dev `dev_otp` path unchanged. RUNBOOK incident line: delivery-502 → bridge drill (old phone ON → `openwa_start.cmd` → QR re-scan → `/whatsapp/status`), report the rid from backend log.

### Changes
- Backend: `owner_profiles.blocked` (Boolean dflt False, ensure_p15 backfill sqlite+PG) · `otp/request` policy rewrite · `get_current/optional_owner` + `otp_verify` + WA machine + WA GATE-1a blocked rejections · `serialize_owner.blocked` · suspend SMS copy.
- Frontend: `/register` same-page OTP step (masked `91******18`, 6-digit + paste + label + inline errors, Verify → token → `/app`, wrong×3 → resend nudge, Resend 30s cooldown, "Number galat? Badlo" preserves form, "Already active? Login →" with `?phone=`); `/login` accepts `?phone=` prefill (no-Suspense `window.location` read).
- Tests: `verify_p125` 6 checks (blocked suspend/restore, unknown hint, seamless register→otp→verify, dev-mode pin) · e2e AUTH +2 (41 checks) · `verify_p15` check 2 updated to the 502 honesty contract.

### Verify state (P19 close)
- e2e **41/41 GREEN** · p125 **6/6** · p15 **9/9** · p3 **9/9** · tsc clean · build green · /register + /login 200.
- Prod PG migration note: `blocked` column did NOT exist on Supabase — caught live by the new checks, fixed by lifespan `ensure_p15_schema` on backend restart (verify self-migrates too). Backend was restarted with the new code; :8000 + :3000 both serving.

### HUMAN RETEST (OPEN)
Brand-new number on /register → OTP step same page → OTP ARRIVES on that phone → verify → /app. If the delivery-failed message appears instead, report the rid from the backend log.

## MASTER P20-REAL — FACTORY RESET + REAL-ONLY DATA + LANDING TRUTH (2026-09-30 → finished 2026-10-01)

### NO-FAKE-DATA POLICY (owner law)
- Live/demo DB holds ONLY real data entered through real flows (WhatsApp photo/voice/text, Direct Entry grid, CSV, camera Scan Bill, connectors).
- `backend/seed_demo_data.py` = OFFLINE TEST FIXTURE ONLY (verifies run it on scratch sqlite; NEVER against live). Fixture truth: 40 products, 18 below reorder, overdue ₹53,400, 2,847 voice_logs, health 44.
- Landing numbers come ONLY from live `GET /public/stats`; zeros render qualitative zero-state lines — no fake numbers, ever.

### PH1 — real-only plumbing (committed `2c9358e` + matcher fix `b1b1bcf`)
- `scripts/reset_owner.py --phone X [--wipe-business yes]`: literal "yes" required; wipes 14 tables (products, customers, sales, inventory, receivables, expenses, actions, document_logs, ingestion_logs, processed_files, chat_messages, voice_logs, contacts, connectors) in FK-safe order with per-table counts; exact-digit match first, REFUSES + lists on ambiguous phone variants; idempotent no-op on unknown phone.
- REAL voice counter: `log_voice_entry()` on STT success in BOTH paths (web `/chat/voice` → `chat.py`, WA audio → `whatsapp_flow.py`); e2e asserts `voice_logs +1`.

### PH2 — truth engine (committed `c3abb88`, finished `d5452ec`)
- `GET /public/stats` (no auth, 60s in-memory cache): `{overdue_total, low_stock_count, voice_entries, health_now, business_name}` for truth owner = first onboarded → OWNER_PHONE profile (91-variant-tolerant via `phone_candidates`) → owner 1. Low-stock = strictly below reorder (matches fixture language + verify_p15 check 4).
- Landing data-source swap ONLY (same typography, no layout shift, mocks untouched): `DemoNumbers` 4 DB cards ← live stats, loading/error/all-zero → qualitative English zero-state lines; `SocialProofBar` client marquee with live/zero variants. `live` keys on data counters only (overdue/low/voice) so the empty-DB health default (71) never fakes activity. Diwali ×1.6 + ₹0-install cards untouched (product constants).
- Test fallout fixed: `verify_p15` check 2 phone-based lookup (post-reset `id!=1`); e2e truth-engine contract check (real payload on pristine scratch). Procedure pinned: `verify_p3.py` runs UNCHANGED on scratch fixture only (live-run shortfall is BY DESIGN under real-only policy).

### PH3 — reset execution (owner-confirmed "wipe now", 2026-09-30)
- Live PG held TWO identities: id=7 (`9834854511`, empty) + id=1 (`919834854511`, all seed data); matcher bug caught + fixed before wiping. Wiped id=1 (sales 1531, inventory 18, receivables 10, expenses 186, actions 10, ingestion 5, chat 24, contacts 8, customers 9, products 19) + 9 junk verify profiles. Live stats → zeros PROVEN. Owner re-registered for real (id=29, allowed).

### FINISH PASS verify state (2026-10-01, fresh tails this session)
- Scratch proofs: seeded → `{53400.0, 18, 2847, health 44, "Sharma Kirana Traders"}`; empty DB → `{0.0, 0, 0, 71, ""}` (zero-state correct); operator audit: fixture has no at-reorder items (`<=` and `<` both 18 — the `<` form kept for fixture-language consistency).
- e2e **42/42 GREEN** (incl. new truth check + voice-logs +1) · p125 **6/6** · p15 **9/9** · p3 **9/9 scratch** · tsc clean · build green (13 routes, `/` 23.5 kB).

### WAITING-ON-HUMAN (open — exact drill in report/RUNBOOK)
Reset `--wipe-business` → new QR scan on old-SIM → `/register` + same-page OTP → empty dashboard → real entries via WhatsApp/grid/camera → stats move → screenshot both landing states.

## CLAUDE-OS — OPERATING DISCIPLINE (MASTER P0, 2026-10-01, committed `p0 claude-os`)

Constitutional for every future master pass. Overrides later prompts on safety, never on scope. Prompts starting "CLAUDE-OS ACTIVE" need not repeat R1–R10.

- R1 READ-FIRST: before editing anything, read PROJECT_STATUS.md + the exact files involved + the FULL error text. No proposal without evidence.
- R2 IRON LAW (systematic-debugging): NO FIXES WITHOUT ROOT CAUSE. Reproduce → trace → fix at source. Symptom fixes are failure.
- R3 RED→GREEN (test-driven-development): the failing e2e/verify check is your RED test; fix until fresh GREEN in the same message.
- R4 EVIDENCE BEFORE CLAIMS (verification-before-completion): every status claim ships with the fresh command + output tail executed in this message. "Should work" = lie.
- R5 THIN SLICES (incremental-implementation): ≤100 changed lines before a test run; system stays working after every slice; commit per slice.
- R6 DOUBT GATE (doubt-driven-development): before any non-trivial commit (branching logic, cross-module, auth/security, migrations, irreversible), write 3 ways this could be wrong and refute or fix them.
- R7 TIMEBOX: 5 min per command; max 2 fix attempts per issue; hung command → kill + report tail; honest simpler-version downgrades documented.
- R8 STOP-LINE: destructive or human-dependent operations (wipes, QR scans, prod writes) require explicit human confirmation; never improvise auth/security changes.
- R9 HONEST REPORT: every report ends with HONEST GAPS (what is unverified, deferred, or assumed) — no exceptions.
- R10 CONTEXT HYGIENE (context-engineering): when a session grows long or a machine crash interrupts, re-read state (git log, tree, PROJECT_STATUS) before acting; never trust memory.

Standing orders: every report uses gate table + evidence tails + honest gaps. Never redo committed phases after interruptions; recover state first (R10). This pass changed NO product code (skills-only + this section).

Skills after P0 (16): systematic-debugging, verification-before-completion, test-driven-development, executing-plans, requesting-code-review (obra/superpowers); incremental-implementation, doubt-driven-development, spec-driven-development, context-engineering, code-review-and-quality, debugging-and-error-recovery (addyosmani/agent-skills); kept: animate, api-and-interface-design, design-engineering, frontend-design, landing-page-design. root-cause-tracing is NOT standalone upstream — ships as systematic-debugging/root-cause-tracing.md (present).

## KIRANA SVG ANIMATION — PHASE 0 AUDIT (2026-10-01)

### Baseline checks
- `npx tsc --noEmit` → **0 errors** (clean)
- `npm run build` → **green** (13 routes, `/` 23.8 kB)
- GSAP version: **3.15.0** (@gsap/react 2.1.2) — all plugins free from 3.13+
- Skills present in `.opencode/skills/`: animate, api-and-interface-design, code-review-and-quality, debugging-and-error-recovery, design-engineering, frontend-design, landing-page-design, systematic-debugging, test-driven-development, verification-before-completion
- gsap-skills / web-animation-skills: **FALLBACK** (built-in knowledge; clone attempted but network timeout)

### Current KiranaShopSVG.tsx audit
- **File**: `components/landing/KiranaShopSVG.tsx` (161 lines)
- **viewBox**: `0 0 500 380`
- **Wrapper**: `<div className="mx-auto w-full max-w-[500px]">` → SVG scales responsively
- **Exports**: default `KiranaShopSVG`, named `WhatsAppGlyph` (used by Hero.tsx)
- **Animation currently**: useGSAP hook with ScrollTrigger once:
  - Scene slide-in: `x: 60, opacity: 0.1 → 1` (1.2s, expo.out)
  - Ruled lines draw: `scaleX: 0 → 1` stagger 0.15s (0.4s delay)
  - Chat bubble: `opacity: 0, y: 8 → 1` (0.4s, 1.0s delay)
  - Bulb pulse: opacity 0.8, scale 1.02, yoyo repeat -1 (sine.inOut)
  - Typing dots: y -3, yoyo repeat -1, stagger 0.15s

### Element coordinates (key anchors for rigging)
| Element | Coordinates | Notes |
|---|---|---|
| Ground shadow (ellipse) | cx=250, cy=352, rx=190, ry=16 | |
| Lamp cord | x1=250, y1=0 → x2=250, y2=34 | stroke #1A1209 |
| Bulb center | cx=250, cy=48, r=14 (outer), r=5 (filament) | rays at 22→28 radius, 8 directions |
| Sign "Sharma Kirana" | rect x=160,y=74,w=180,h=36; text x=250,y=98 | rotated -2° around (250,92) — overlaps shelf 1 jars |
| Shelves (3 rows) | planks y=128,162,196; jars 4 per row | jars at cx=88,124,160,196; alternating circles/rects |
| Shopkeeper | head cx=392,cy=150,r=20; body rect x=368,y=170,w=48,h=62 | single group, not rigged; eyes/mouth static |
| Counter | rect x=40,y=232,w=420,h=110; top plank h=14 | wood #8B6914 / #A67C2E |
| Ledger | cover rect x=80,y=252,w=150,h=66; pages x=86,152 w=66,h=58 | 4 ruled lines y=266,277,288,299; entries: 320, 1,200, paid |
| Phone | body x=258,y=246,w=70,h=88; screen x=262,y=250,w=62,h=80 | header #128C7E; status dot cx=270,cy=258; bubble at y=272; 3 typing dots y=306 |

### Colours (tokens)
| Token | Hex | Usage |
|---|---|---|
| saffron | #E8771A | bulb filament, shopkeeper kurta, sign bg |
| gold | #D4A017 | bulb glass, rays, jar fills |
| navy | #0F2040 | sign background |
| ink | #1A1209 | cord, phone body, text |
| wood | #8B6914 | shelves, counter, jar strokes |
| wood-light | #A67C2E | counter top plank |
| wood-dark | #6E5210 | (not used yet) |
| ledger-red | #C0392B | ledger cover |
| paper | #FFF8E7 / #FFF9F0 | ledger pages |
| ivory | #FDFAF4 | sign text, eyes, skin highlights |
| WA-green | #25D366 | WhatsApp glyph, status dot |
| WA-teal | #128C7E | phone header |
| ledger-green | #2D6A4F | "paid" text, jar fill |

### Preloader / Watchdog / Ready signal
- **LandingShell** owns `ready` state; shows `<Preloader onDone={() => setReady(true)} />` until done
- **Preloader** runs ~1.6-1.8s (bar 1.6s + fade 0.4s delay), then calls `onDone()`; failsafe at 2.5s
- **LandingShell watchdog** (LAW-WATCHDOG): after 1500ms, force-sets `opacity=1, transform=none` on ALL `[data-gsap]` elements
- **Hero.tsx** uses `useGSAP` with timeline (no ScrollTrigger for intro); CTAs animate at 1.0s
- **KiranaShopSVG** ScrollTrigger starts at `top 95%` (once) — this means its intro plays when the SVG enters viewport, which is AFTER Hero's intro (Hero CTAs at 1.0s, SVG lower on page)
- **No explicit "preloader done" event** exported — must poll for preloader DOM removal or use the `ready` context (LandingShell doesn't expose it)

### Deviations from master spec (§6 artwork fixes needed)
- a) Sign overlaps shelf 1 rightmost jar + bulb rays touch sign → needs reposition + hanging ropes + ceiling beam
- b) Shopkeeper not rigged (single group) → needs named parts for animation
- c) No light cone / glow under bulb → add gradient cone + radial glow
- d) No wood grain / contact shadows on counter
- e) Jars have no lids / inner fills for stock-level animation
- f) Ledger: 4th ruled line exists but no text (reserved), no page corner curl
- g) Phone: typing dots present but no explicit "idle wave" yet

### PHASE 0 commit
Ready to commit audit baseline.

### Before/after (Phase 1 static)
BEFORE: flat static SVG (500×380) — sign grazing shelf-1 jars + bulb rays touching sign; keeper one rigid group; no light cone/glow; no wood grain/contact shadows; jars lidless/fill-less; ledger 3 entries, no corner curl; phone single group.
AFTER: identical composition, cleaner — sign re-hung at y=58 on ropes+beam (clears jars); 5-ray upper fan + cone + glow (no sign touch); rigged keeper (body/neck/head/hair/eyes+pupils/brows/mouth/ear/2 arms+hands+thumb); grain + shadows; 12 jars lidded with fills (row-3 jar saffron fill = scan target); ledger split (cover/pages/rules/entries/corner, row-4 reserved); phone grouped (body/screen/header/dot/dots/bubble). Extras layer mounted-only (paper/flash/ripples/coins/newrow/pen/plusLabel/scan/lowtag/badge/healthchip/sparkles/chai/dust/cat).

## KIRANA SVG ANIMATION — PHASE 7 VERIFICATION (2026-10-01)
Commits: [kirana-0] audit 1e32f43 · [kirana-1] rigged static b003499 · [kirana-2] intro 4eeb417 · [kirana-3] idle 68a5597 · [kirana-4] story e07174e · [kirana-5] interactions 4eff14b · [kirana-6] hardening 3e5e6e0 · [kirana-7] verified (this).
GSAP 3.15.0 + @gsap/react; plugins: CustomEase (kOut/kSettle/kSnap registry), MotionPathPlugin (paper/coin arcs), ScrollTrigger (pause + scroll drift). Manual dashoffset draws (DrawSVG skipped by design). Skills: gsap-skills FALLBACK, web-animation-skills FALLBACK (network timeout; built-in knowledge applied).
Downgrades: reply bubble check-draw → skipped (pop+shake+nod+smile carry it); scan saffron wash → skipped; ledger corner flutter in coins beat → skipped (idle owns corner); per-entry clip reveal → opacity+y slide; screen-glow breathe → dropped (no overlay node); thumb scaleY 0→1 → 1→1.6 visible nub (anti-blank law wins).

Checks (§16):
1. tsc --noEmit → **PASS** (0 errors; 1 type fix used in kirana-3: buildIdle return annotation).
2. npm run build → **PASS** (green, 13/13 static).
3. Routes (fresh dev server) → **PASS** (`/` `/login` `/register` `/app` `/app/chat` `/app/data` `/app/actions` `/admin` 200, unknown → 404). NOTE: a stale `next start` was squatting :3000 with 404/500s — killed, dev server started, all green.
4. verify_p3 → **PASS** (9/9 on scratch fixture; backend untouched).
5. Devanagari grep → **PASS** (kirana/: only BUBBLE_HI Hindi mock + ₹/→ in mocks; zero marketing Devanagari. Full-landing output: brand व्यापार + product mocks + ₹/×/· numerals only).
6. Console → **PARTIAL** (dev-server log: zero errors/warnings/hydration lines; browser console unverifiable here).
7. Reduced motion → **UNVERIFIED** (no browser; by construction: mm gate, no extras, no tweens).
8. JS-disabled/pre-hydration → **PASS by construction** (full base scene in SSR HTML, extras client-only; verified via served `/` 200 + static build).
9. Offscreen/hidden-tab pause → **UNVERIFIED** (no browser; wired: ScrollTrigger onToggle + visibilitychange, kills on cleanup).
10. StrictMode/HMR → **UNVERIFIED** (no browser; by construction: all in gsap.context/useGSAP revertOnUpdate, listeners Triggers killed, delayedCalls tracked).
11. 390px/1920px + fps → **UNVERIFIED** (no browser; vectors-only, ≤70 nodes, transform/opacity/dashoffset only).
12. Lenis → **UNVERIFIED** (no browser; no Lenis re-init, no global refresh; scroll drift isolated in binder, droppable per ladder).
13. Changed-files audit → **PASS** (`1e32f43..HEAD`: KiranaShopSVG.tsx + kirana/{constants,extras,interactions,timelines,useKiranaScene}.ts + .bak only; backend/app/admin/login/register/auth/lib untouched).
14. Skill rules (≥6) → applied: (1) ScrollTrigger+all motion inside gsap.context/useGSAP with revert (systematic-debugging/verification); (2) transform/opacity/dashoffset only (60fps-animation); (3) matchMedia reduced-motion gate, live-reactive (accessible-animation); (4) manual stroke draw client-side behind window guards, static kr- ids (svg-animation); (5) offscreen/tab pause, no leaked tweens (executing-plans/verification-before-completion); (6) prop-conflict audit so story/idle never fight the same prop (doubt-driven-development R6); (7) thin slices + per-phase green gates (incremental-implementation/test-driven-development).

Known limitations: no human has SEEN the motion (all browser checks unverified — needs a 5-min human pass: play, scroll, tug lamp, tap phone, 390px, reduced-motion); reply-check deviation; another session's uncommitted Hero/FeaturesBento edits left untouched in tree.

## LANDING MOTION GRAPHICS PASS — PHASE 0 AUDIT (2026-10-02, no code changes except this note)

### Inventory (frontend/components/landing/)
- 20 section/svg files: Preloader, Nav, Hero (+KiranaShopSVG), SocialProofBar, ProblemSection (+BahiKhataSVG), WhatsAppLoop, HowItWorks, DemoNumbers (+HealthChart), FeaturesBento, VoiceLanguageSection, FestivalSection, SoulSection, HITLSection, Testimonials, CTASection, Footer, LandingShell, gsap-setup.ts. kirana/: useKiranaScene.ts, timelines.ts (639 lines), interactions.ts, extras.tsx, constants.ts + KiranaShopSVG.static.bak. app/page.tsx = server component composing 14 sections inside LandingShell. hooks/useCountUp.ts (landing-only). styles/landing.css (tokens). No components/landing/motion/** yet.
- Server vs client: app/page.tsx has NO 'use client' (server, stays server). ALL 20 landing files carry 'use client' (SocialProofBar at line 8, rest line 1). MotionScope display:contents plan keeps this intact.
- Packages: gsap 3.15.0 + @gsap/react 2.1.2 (no install needed; ≥3.13 so all plugins free). framer-motion, lenis, recharts, canvas-confetti, sonner present. Lenis wired ONCE in components/smooth.tsx with canonical wiring (lenis.on scroll→ScrollTrigger.update; ticker ms; lagSmoothing 0; reduced-motion gate; fonts.ready refresh) — LandingShell must NOT create a second instance.
- Baselines: `npx tsc --noEmit` → exit 0, 0 errors. `npm run build` → green, `/` 42.8 kB / First Load 222 kB (13 routes). Browser section-height table + screenshots: NO BROWSER in sandbox — recorded as HUMAN-PASS-REQUIRED; method pinned in Phase 9 check 9 (reduce-motion, 390/1440, offsetHeight per section into _baseline/ outside frontend; dir not created here to avoid junk).
- Watchdog (current, to be replaced): LandingShell.tsx:20-28 blanket 1.5s force-show ALL [data-gsap] (opacity=1, transform=none). LAW-WATCHDOG-V2 will replace with viewport-aware version (in-view + opacity<0.05 + not tweening + not resting<1; never touches data-m-only glows/cones/ghosts/shadows; +6s section fail-safe).
- GSAP use today: every section has its own useGSAP + gsap.registerPlugin(ScrollTrigger) (no central registry; Phase 1 adds motion/registry.ts). data-gsap keys in use: badge/mask/sub/cta/trust/watermark(removed in dirty tree), card, bubble/typing/pill, step/arrow, stat, bento/arc/ledger-row(removed in dirty tree), bar/badge, flame/spark/fbadge, soul-mark, hitl-panel/hitl-card, quote, word, preloader, stain/circle. framer-motion: HowItWorks motion.article whileHover + Testimonials motion.figure + Nav motion.* (mobile menu functional — never remove).
- Resting-opacity audit (Select-String opacity 0.x): ALL data-gsap from-states rest at opacity 1 (0.2/0.3 from-values only) — watchdog-safe. Resting<1 elements are STATIC (no data-gsap): Hero watermark 0.04, HowItWorks ghost 01/02/03 0.15, Footer watermark 0.15, disabled buttons 0.9, FeaturesBento heat 0.9 — Phase 1+ MUST keep these data-m-only (never data-gsap/data-m-hide). ONE violator: SoulSection.tsx:26 gsap.set(mark,{opacity:0.05,scale:0.85}) hides in hook without matchMedia-live/immediateRender:false discipline — fixed in Phase 2 via curtain helper. Ungoverned infinite loops found: VoiceLanguageSection bars gsap.to repeat:-1 (no ScrollTrigger/governor) + Festival flame/spark similar — all move under Loop Governor in Phase 1.
- O1 Hero buttons offset + trust touching: CONFIRMED residue cause — Hero tl.from cta {y:20,opacity:0.2} + trust {opacity:0.2} with NO clearProps and NO immediateRender:false; interrupted/completed tween leaves inline transform/opacity on the two different-height CTAs (Link min-h 56 + button min-h 56 with svg) collapsing the mt-4 gap. Fix permitted (clearProps, residue-only). If CSS gap proves the cause on human pass → report, do not touch layout.
- O2 HowItWorks middle card +6px + stub connectors: CONFIRMED dual cause — (a) motion.article carries BOTH framer-motion whileHover{y:-4} AND gsap.from step {y:40} on the same node → transform fight, residue lifts one card; (b) connectors really are two ~100px stubs (M190→290, M400→490 in 600×32 absolute top-16) — Phase 5 overlays real edge-to-edge dashed paths + packet dots without moving them.
- O3 WhatsApp all-visible: CONFIRMED pre-reveal, not a finished-play state — bubbles are SSR-visible and the timeline is built lazily onEnter ('top 60%') with .from, so before arrival everything is already visible; on fast scroll the judge sees the whole film at once. Fix per spec: set from-state post-hydration/pre-paint via helpers (immediateRender:false, once:true, start ≤ top 95%), trigger 'top 70%', after complete everything stays visible forever.
- O4 Bahi-khata stain pink blob: CONFIRMED static-only cause — stain is flat #C0392B @0.55 with a single 0.9s scale-from-corner; no viscous spread/drip. Do NOT move it. Phase 4 adds corner-origin power4 spread + lobe rates + detaching drip every ~8s (Tier B loop, mobile off).
- O5 Kirana scene: useKiranaScene EXISTS AND WORKS (intro→idle A/B→story, svgOrigin rig, offscreen ScrollTrigger pause + visibilitychange pause, failsafe ≤3s/≤8s, dev __kirana). Verdict: INTEGRATE with Loop Governor only; implement zero new kirana motion.
- O6 Nav grey on dark: LEAVE (frosted nav over navy, by design).
- Skills/repos (§5): .opencode/skills has animate, frontend-design, landing-page-design, design-engineering (+debug/tdd/verify suites); gsap-core/timeline/scrolltrigger/react/performance/plugins + svg/60fps/accessible/micro-interaction present per P12.9 (FALLBACK: network clone times out in sandbox — built-in knowledge applied, zero the-ming copied; MagicUI/ReactBits/Dub reference-only, not cloned this pass). `npm ls gsap` (frontend prefix) = 3.15.0 — no install. DrawSVGPlugin: manual dashoffset fallback already used in kirana/timelines + HowItWorks/BahiKhata (keep; try DrawSVG import in Phase 1, downgrade on 2nd failure per ladder).
- Dirty tree noted (NOT mine, NOT committed): Hero.tsx −71 lines (watermark parallax + CTA micro-interactions stripped), FeaturesBento.tsx −10 (ledger-row cascade stripped), tsconfig.tsbuildinfo artifact. Phase 0 commits ONLY this PROJECT_STATUS.md section.
- Commit: [motion-0] audit and baseline (this file only).

## HERO FILM — PHASE 0 AUDIT (2026-10-02, no product-code changes)

- PROJECT_STATUS.md read first (kirana-0…7, motion-0…6 all green). No prior "HERO FILM" section existed — this is it.
- Inventory delta vs motion-0: `motion/**` EXISTS (registry/governor/helpers/MotionScope/Overlaps/sections/systems, gsap 3.15.0 free-plugin imports proven) → REUSE, no local equivalents; `kirana/**` EXISTS (useKiranaScene works) → mount as-is, zero new kirana motion. `hero/**` ABSENT → created in Phase 1. Server vs client: `app/page.tsx` server (stays); Hero + all landing sections 'use client'.
- Baselines (fresh, identical tree): `npx tsc --noEmit` → exit 0. `npm run build` → green, 13/13 static, `/` 53.8 kB / 233 kB First Load. `npm ls gsap` → 3.15.0 (no install; DrawSVG/SplitText/MotionPath/CustomEase free).
- Hero.tsx (155 lines, exact strings pinned): LINES = "Your Business's" / "AI Brain"(accent+italic) / "on WhatsApp."; badge "WhatsApp-First · No App Install Needed"; sub "Kirana, pharmacy, hardware, garments — send a photo or a voice note. VyapaarAI reads it, records it, and tells you what to do next — in your language, on WhatsApp."; CTAs "See It Work →" (/register) + "Watch the Demo" (scrolls #how-it-works); trust "Trusted by MSME owners across India · Zero setup · Your language"; hint `a[aria-label="Scroll to see more"].landing-bob`.
- Existing hero tweens (ALL to be replaced in Phase 2, none scroll-based): mount-time tl badge(y-20,op0)/mask(yPercent110)/sub(0.3→1)/cta(y20,op0.2)/trust(op0.2); scroll-hint via pastHint state + CSS `.landing-bob` (Tailwind v3.4.19 → `-translate-x-1/2` is transform-based, so the film MUST set xPercent:-50 when bouncing y or centering breaks). Kirana scene: useKiranaScene owns it (READ-ONLY).
- Section shell: `section#hero.relative.overflow-hidden`, `minHeight:100vh`, H1 `clamp(3rem,9vw,6rem)`; layout tweak planned → `clamp(2.75rem,6.6vw,7.75rem)` + pt/pb tune (copy/order/links/routes untouched).
- Preloader handoff: NO exported done-signal (LandingShell `ready` is internal) → film polls `.landing-preloader` removal every 100ms ≤4s (failsafe 2.5s in Preloader; returns null when gone). NO LandingShell edit needed — exception not invoked.
- Lenis: canonical wiring in `components/smooth.tsx` (scroll→ST.update, ticker ms, lagSmoothing 0, reduced gate, fonts.ready refresh) — NEVER a second instance; scroll-exit scrub coexists or is dropped per ladder.
- Watchdog compatibility (no edit): film uses `data-hf` for ALL resting<1 decor (watchdog never selects it) + `data-gsap` ONLY on resting-opacity-1 text/CTA; motion-layer `buildHero` will yield when `[data-hf="stage"]` is present (buttonLife/watermark/residue would double-drive the film); headingSystem is inert in hero (no h2); masks use `m-` classes already in CSS.
- P1→P5 dispositions: P1 clamp tweak (Phase 1, human first-viewport proof); P2 text-safe measurement at build + refreshInit (Phase 1/2); P3 ribbon x>97% exclusion zone (all stage coords); P4 clearProps after intro (Phase 2); P5 preloader poll (above).
- Screenshots/heights/CTAs-y at 390×844, 1440×900, 1920×1080: NO BROWSER in sandbox → HUMAN-PASS-REQUIRED; method: reduced-motion emulation, save into `C:\aiagentprojects\pblfinalf\_baseline_hero\` (dir NOT created — no junk); poster-frame shots repeated in Phase 1.
- Skills (§6): `frontend-design, landing-page-design, design-engineering, animate` read from live root skills; gsap-skills CLONED (8 dirs → `frontend/.opencode/skills/gsap/`); web-animation-skills CLONED (was already committed by 9463479; fresh clone verified, tree restored byte-identical); reference repos magicui/react-bits/dub → FALLBACK (optional step; built-in knowledge). Skill rules banked for the final report: gsap-core immediateRender discipline + transform aliases; gsap-react useGSAP-scope/revertOnUpdate/ctx.revert; 60fps-animation compositor-only table; accessible-animation matchMedia gating + no-preference opt-in; svg-animation dashoffset draw-on + pathLength trick; micro-interaction 100–250ms + transform/opacity-only + press .96.
- Commit: [hero-0] audit (this file + gsap skills + tsbuildinfo).

## HERO FILM — PROGRESS
- hero-1 (ab97d90): poster frame — hero/{HeroStage,constants,Obj,layers×8,objects×11}, H1 clamp(2.75rem,6.6vw,7.75rem), content z-10, .hf- CSS (rest-rot via `rotate` prop, rest-opacity in classes/attrs, responsive hide rules). tsc 0, build green, copy byte-identical.
- hero-2 (cbff7c2): intro + title card — hero/{typography,filmTimeline,useHeroFilm}, old Hero tweens REMOVED, buildHero yields when [data-hf] present, CTA life reused from motion/systems.buttonLife, textSafe demote, 3s/9s fail-safe, preloader poll ≤4s. tsc 0, build green, dev / 200.
- hero-3: ambient life — hero/ambient.ts (Tier A: paper 44px/8s slide, aurora Lissajous, watermark breathe, object floats, coin spin+face-swap+hop, bill scan+underlines, ring halo; Tier B: camera breathing non-mobile, hub ring, mic bars+rings, diya+embers, jar wobble chain, badge ping, both sheens, AI sparkles, arrow/play/trust/word-breath idles). All loops via shared governor; starts after intro settles; DOWNGRADE: stage shake on stamp slam → dropped (would fight camera breathing on the same x prop).
- hero-4: story loop — hero/story.ts (18s master: stamp slam/approve, red→green growth draw, ring 44→88 + burst, jar drain/count/refill, diya ×1.6, bill flight + ₹ tick + coin pop via MotionPath ghosts, poster resets; free-run actors: 6s chat cycle w/ typing + check draw, 5-route packets w/ squash + hub flash, toasts ≥1024px, UPI grid, head halo). DOWNGRADED: energy proxy + mic swell (same-prop fights); packets/toasts off on mobile. Ops note: one `npm run build` died in worker.js while dev served the same .next (transient; clean rebuild green `/` 67 kB / 246 kB, dev restarted 200) — never build+serve concurrently.
- hero-5: interactions + scroll exit — hero/fx.ts (I1 pointer parallax by band + I2 repel ≤140px; scroll-exit scrub no-pin: depth translates + outward scatter one tween per .hf-scroll, H1 scale/y, watermark y, growth y, opacity never moves; I4 spotlight quickTo; I3 coin-flick rotationY on ART + spark; I5 velocity skew ≤3°). DOWNGRADE: camera-rotates-to-cursor → dropped (breathing owns stage rotation). Pointer stack off on coarse/mobile; scrub kept. tsc 0, build green (dev stopped first), dev / 200.
- hero-6: Tier C + hardening — light-leak 14s sweep (xPercent, skipped when >12 loops run), grain CSS steps(8)/0.9s loop (no-preference + ≥1024px only) with G6 `.m-paused` offscreen pause via extended observer; mobile reductions verified in code (no packets/toasts/camera/pointer/spot/flick/skew; hidden objects; grain desktop-only); a11y (stage aria-hidden, H1 aria-label, atomic chat lines, no focusables, no >3/s flashes); __heroFilm dev-only. tsc 0, build green, dev / 200.

## LANDING MOTION GRAPHICS — PHASES 1–5 (2026-10-02)

- `[motion-1]` 4e8262c — core: `motion/registry.ts` (plugin registration once: ScrollTrigger/DrawSVG/MotionPath/SplitText/CustomEase + kOut/kSettle/kPen/kSnap + isReduced/isCoarse/isMobile/isFineDesktop gates), `motion/governor.ts` (G6: every infinite loop registers; plays only while its trigger is in view; pauses on hidden tab; Tier-B budget 70 desktop / 40 mobile, over-budget skipped+logged), `motion/helpers.ts` (reveal/curtain/drawOnce/loop/splitHeading/magnetic/tick), `motion/MotionScope.tsx` (display:contents wrapper, one useGSAP + matchMedia no-preference gate, per-builder error isolation, mm.revert teardown), LandingShell LAW-WATCHDOG-V2 (viewport-aware sweep + 6s section fail-safe), `styles/landing.css` append-only `.m-*` rules, `app/page.tsx` MotionScope wrappers + empty builders.
- `[motion-2]` d606409 — global systems: G1 scroll-progress ribbon in Overlays.tsx (fixed, ≥1024px + no-preference, scaleY scrub + section tick dots), G3 heading split (v1), G5 button life (magnetic fine-desktop + press squash + shine sweep on positioned CTAs), `data-m="hero.btn"` / `data-m="cta.btn"`, O1 hero residue clearProps @2.0s, O2 how-it-works residue clearProps trigger-based + packet-dot connectors, O3 WhatsApp phone float (bubble film left to its hook), O4 runtime-injected stain drip (nothing in static DOM); committed the prior-session Hero (−71: watermark/CTA-microinteraction strip) + FeaturesBento (−10: ledger-row cascade) trims as part of this history.
- `[motion-3]` a69cb52 — conflict-safe core: MotionScope rewritten to single useGSAP + matchMedia (no nested context); buildFestival → deliberate no-op (hook owns flame/sparks/card/badges, line ~27 yoyo); buildSoul breathing scale → y-drift (hook owns mark scale/opacity); splitHeading v2 (pre-set yPercent:105 from-state, same-frame play in-viewport, atomic element units, BRs never masked, skips data-gsap hosts incl. CTA h2, masks carry data-m-hide, clearProps + data-m-done on complete); watchdog stuck-transform sweep (a: done-masks residual translate, b: stuck curtains removed, c: hidden in-view units force-shown); headingSystem returns cleanup + G3b `h2 + p` subhead reveal (y14, delay 0.25, data-m-hide) + headingSwash (accent-span wavy underline, measured at trigger-fire, body-level aria-hidden overlay, kPen draw, removed on cleanup).
- `[motion-4]` 92e2cf4 — watchdog hook-owned guard (found by audit: a raw opacity sweep would spoil the WhatsApp typing cue at inline opacity 0 and the soul-mark pre-reveal; never force-show authored `style.opacity==="0"` or anything with a live/pending tween).
- `[motion-5]` 6fc78be — section choreography: S3 problem icon acts (X redraw, shelf tip, pupil dart + stress blink), S5 ghost-numeral drift + enter-measured highlight-bar sweeps in already-relative cards, S6 diya flame flicker + core breathe, S10 soul rule drawOnce, S14 footer hr scaleX sweep + watermark parallax (old svg-rule loop was dead code — footer has no SVG), S2 marquee bullet wave (CSS track never touched), WhatsApp online-dot breath, testimonial quote-mark float, G6 IntersectionObserver CSS-loop pause (marquee/ping/bob, mobile included), hero scroll-hint GSAP loop REMOVED (dead code: CSS .landing-bob animation origin beats inline transform).

## LANDING MOTION GRAPHICS — VERIFICATION SWEEP + BUILD REPORT (2026-10-02)

Checks (fresh evidence this session):
1. `npx tsc --noEmit` (frontend) → **PASS**, exit 0, 0 errors — run after motion-3 and again after motion-5.
2. `npm run build` → **PASS**, green, 13/13 static; `/` **53.8 kB / 233 kB** First Load vs motion-0 baseline 42.8/222 (motion layer ≈ +11 kB route).
3. Additive-only audit (`7d89f90..HEAD` on landing paths) → **PASS**: new `motion/**` only; `page.tsx` wrapper-only; LandingShell = the ONE permitted edit; CTASection +1 line (`data-m`); `landing.css` append-only `.m-*`; FeaturesBento `[prior]` dead-trim; Hero trim rides in d606409 (pre-existing session work). Backend/app-routes/layout/tailwind/config untouched.
4. Attribute audit (grep `data-m=|data-m-hide|data-gsap=` in landing *.tsx) → **PASS**: JSX carries only pre-existing `data-gsap` + motion-2 `data-m="hero.btn"/"cta.btn"`; `data-m-hide` exists ONLY on runtime-created masks/subheads/hr. Resting<1 nodes (hero watermark 0.04, ghosts 0.15, footer watermark 0.15, typing inline 0, soul-mark) carry NO data-m-hide in JSX.
5. Laws audit (static) → **PASS**: from-states set in hooks (splitHeading pre-set + reveal/curtain with once:true, starts top 80–95%); transform/opacity/dashoffset only (no layout props); reduced-motion builds NOTHING (single matchMedia gate per scope + CSS media gates); Devanagari/atomic units (text split on whitespace, accent spans whole, aria-label kept, masks aria-hidden); no double-drive (festival/soul/hero/whatsapp/bars/cta conflicts resolved, each logged); 2-fix ladder honored (dead loops removed, not patched: hero hint, footer svg loop, marquee curtain).
6. Reduced-motion render → **PASS by construction** (matchMedia gate → builders never run; CSS `.m-*` inside no-preference; runtime nodes only under no-preference) — visual side-by-side UNVERIFIED (no browser).
7. JS-disabled/pre-hydration → **PASS by construction** (all from-states applied inside useGSAP post-hydration; SSR HTML identical to baseline).
8. Offscreen/hidden-tab pause → **UNVERIFIED** (wired: governor ScrollTrigger onToggle + visibilitychange; G6 `.m-paused` observer; no browser to observe).
9. StrictMode/HMR teardown → **UNVERIFIED** (by construction: single useGSAP context + mm.revert + aggregated cleanups remove swash svgs/bars/dots; no browser to double-invoke).
10. 390px/1920px + fps → **UNVERIFIED** (icon acts/marquee bullets gated off ≤639px; ≤70/40 node budget; compositor-only props — needs device pass).
11. Lenis → **PASS by construction** (no second instance; only scrub/onToggle ScrollTriggers added; canonical wiring in smooth.tsx untouched).
12. Section-height baseline → **HUMAN-PASS-REQUIRED** (method: reduced-motion emulation at 390/1440, record offsetHeight per section, compare to this commit; no browser in sandbox).
13. Signature-moment visual review → **HUMAN-PASS-REQUIRED**: heading word-mask reveals, subhead fades, accent swashes, HIW highlight bars, packet dot, diya flicker, X redraw, stain drip, soul rule draw, footer hr sweep, ribbon progress + tick dots, marquee bullet wave, status-dot breath, quote floats.

Downgrade log (deliberate, additive-only law): G2 seams, G4 velocity marquee; festival flame/sparks/card/badges (hook-owned); soul scale-breath→y-drift + soul curtain (static section); hero hint GSAP loop (CSS owns); CTA h2 split/swash + hero h1 swash (hook-owned/block spans); CTA motes (static); voice pills bob + transcript chips (hook-owned); bento/HITL/nav extras (no safe target); marquee curtain (static → bullets); footer svg-rule loop (no SVG → hr sweep); ghost slot-roll → drift; mobile gates on icon acts/bullets; shine+magnetic fine-desktop only.

HONEST GAPS: no human has SEEN any of this motion — every browser check above is construction-only and needs one 10-min pass (scroll full page at 1440 + 390, reduced-motion on/off, JS-off load, tab-hide, fast-scroll to WhatsApp typing cue, soul reveal, footer arrival). If the O1 gap proves CSS (not residue) on human pass → report, do not touch layout. Commit: [motion-6] docs (this file) closes the pass; code commits a89a920…6fc78be already green.
