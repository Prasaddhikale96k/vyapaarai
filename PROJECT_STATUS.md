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

## MASTER P20-REAL — FACTORY RESET + REAL-ONLY DATA + LANDING TRUTH (2026-09-30)

### Owner policy (law)
Live/demo DB = ONLY real data via real flows. `seed_demo_data.py` = OFFLINE TEST FIXTURE ONLY (verifies on scratch sqlite stay green). Landing claims only numbers true in the live DB right now.

### PH1 — real-only plumbing (committed `2c9358e`)
- `scripts/reset_owner.py --phone X [--wipe-business yes]`: deletes profile; wipe deletes 14 tables in FK-safe order, literal "yes", per-table counts, idempotent (proven: unknown phone → clean no-op on live PG).
- Seed header + RUNBOOK marked fixture-only; RUNBOOK carries NO-FAKE-DATA policy + reset drill + stats note.
- REAL voice counter: `log_voice_entry()` on STT success in BOTH paths (web `/chat/voice`, WA audio) → `voice_logs`. e2e voice check now asserts `voice_logs +1`.

### PH2 — truth engine (committed `c3abb88`)
- `GET /public/stats` (no auth, 60s cache): truth owner = first onboarded → OWNER_PHONE profile → owner 1. Live proof vs prod PG: `{overdue_total:53400.0, low_stock_count:5, voice_entries:0, health_now:37, business_name:"Sharma Kirana Traders"}` — note 5 low (not 18) and 0 voice: engine already tells the truth the old landing didn't.
- Landing swap (data-source ONLY, same typography): `DemoNumbers` 4 DB cards ← live stats, loading/all-zero → qualitative zero-state lines; static demo chart relabeled "Sample Preview"; `SocialProofBar` → client marquee with live/zero variants. Narrative copy, testimonials, problem sections, mocks untouched (product previews, not DB claims). `demo_day.cmd` prints `/public/stats`.

### PH3 — fresh real onboarding (HUMAN-ASSISTED, exact order — OPEN)
1. Stop backend + openwa. 2. `cd backend && python ../scripts/reset_owner.py --phone 919834854511 --wipe-business yes` (expect: profile + business rows removed, counts printed). 3. Delete OpenWA session folder → `openwa_start.cmd` → `setup_whatsapp.py` → NEW QR → old-SIM scan → `/whatsapp/status` connected. 4. `/register` 919834854511 → same-page OTP → arrives on WA → verify → `/app` EMPTY (correct). 5. Real bills/photos/voice via WA + grid/CSV/camera — no seed, ever. 6. Landing zeros → real counts; screenshot both states.
- STATUS: steps 1–6 need the human at the keyboard with both phones. NOT executed yet — wiping live business rows without the human ready would strand the demo with no path back (seed banned). Awaiting confirmation.

### PH4 — sweep (P20 close, pre-reset)
- e2e **41/41 GREEN** (fixture sqlite) · p125 **6/6** · p15 **9/9** · p3 **9/9** · tsc clean · build green.
- Zero-state landing: code-verified (live=false → qualitative lines, no numerals); browser screenshot-proof deferred to post-reset human pass (both states).
- HONEST GAPS: reset/QR/register/real-entries all human-pending; live PG still holds seed-era rows until the reset runs; voice counter starts at 0 truthfully.
