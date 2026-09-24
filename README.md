# VyapaarAI — AI Business Copilot for Indian Kirana Stores

> **AI suggests. Owner decides.**

VyapaarAI turns messy shop data (CSVs, Tally XML, register photos, WhatsApp voice notes)
into a daily health score, profit root-cause analysis, demand forecasts, and
owner-approved actions (payment reminders, reorders, clearance offers) — delivered over
WhatsApp.

## Architecture

```
┌──────────────┐   CSV/Excel    ┌──────────────┐   health/forecast   ┌──────────────┐
│  Shop owner  │───Tally XML───▶│   FastAPI    │──────JSON──────────▶│  Next.js 14  │
│  (WhatsApp)  │◀──replies──────│   backend    │◀─────POST /chat─────│  frontend    │
└──────┬───────┘   voice/photo  └──────┬───────┘                     └──────────────┘
       │  Evolution API                │ Groq → Gemini → demo_fallback
       ▼                               ▼
┌──────────────┐                ┌──────────────┐
│ WhatsApp app │                │ SQLite + watch│
└──────────────┘                │ folder sync   │
                                └──────────────┘
```

## Features

- **Dashboard** — animated health ring (0→score), 4 subscore bars, 3 morning alerts,
  anomaly chips, demand forecast chart, profit root-cause, buy/sell 2×2 matrix.
- **Copilot chat** — WhatsApp-style UI, sales/inventory/finance agents with visible
  tool steps, suggested actions, Hindi + English.
- **Data & Sync** — CSV/Excel + Tally XML upload, `./watch` folder auto-sync, sync logs,
  products table with low-stock highlights.
- **Action Copilot** — Generate → Approve/Reject with WhatsApp delivery (simulated
  until Evolution connects).
- **WhatsApp layer** — Evolution API webhook, Hindi voice notes (Whisper STT + edge-TTS),
  register/bill photo parsing (Gemini Vision) with HAAN/NAHI confirm flow, morning brief.

## Quickstart

Backend:

```bash
cd backend
pip install -r requirements.txt
python seed_demo_data.py
uvicorn app.main:app --reload   # http://localhost:8000
```

DB is **Supabase Postgres** (Session pooler, Tokyo) — `DATABASE_URL` in
`backend/.env` (sqlite line kept as commented fallback). `seed_demo_data.py`
runs `create_all` + both `ensure_*` migrations, so a fresh PG instance works,
and bootstraps owner 1 (admin) + owner 2 (P6 fixture) when missing.

Supabase Dashboard → Database → Replication: enable Realtime for
`sales, actions, ingestion_logs, owner_profiles, processed_files,
document_logs, receivables, inventory, products, expenses`.
Frontend listens via `lib/realtime.ts` (`postgres_changes`, 300ms debounce)
with a 300s safety poll + Live/Polling chip in the sidebar. Tables are
currently RLS-off (fine for demo; add policies for production).

Phase B wow features: **UPI deep-links** in payment reminders (`upi_vpa` per
owner, "💳 Open UPI link" chip in /actions), **daily PDF report**
(`GET /reports/daily`, `POST /reports/send-now`, 21:00 nightly cron),
**business credit score** (`GET /credit-score`, dashboard card + copyable bank
summary), **festival-aware forecasts** (Diwali/Holi/Eid/Rakhi multipliers,
amber chip + chart band).

Frontend:

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

Evolution (WhatsApp) setup — STANDBY only. Default gateway is **OpenWA**:

```cmd
backend\openwa_start.cmd
```

```bash
cd backend
uvicorn app.main:app --reload   # http://localhost:8000
python setup_whatsapp.py        # session + QR (backend/qr.png) + webhook
```

`setup_whatsapp.py` sets the webhook itself:
`POST /api/sessions/<id>/webhooks {url: http://localhost:8000/webhook/whatsapp,
events: [message.received, session.status]}`.
`OPENWA_PATH` env (optional) overrides the gateway folder used by `openwa_start.cmd`.

Evolution API (Docker standby, only when `WA_GATEWAY=evolution`):

```bash
docker run -d --name evolution-api -p 8080:8080 -e AUTHENTICATION_API_KEY=vyapaar123 atendai/evolution-api:v2.2.3
curl -X POST http://localhost:8080/instance/create -H "apikey: vyapaar123" -H "Content-Type: application/json" -d "{\"instanceName\":\"vyapaarai\",\"qrcode\":true}"
curl -X POST http://localhost:8080/webhook/set/vyapaarai -H "apikey: vyapaar123" -H "Content-Type: application/json" -d "{\"webhook\":{\"enabled\":true,\"url\":\"http://host.docker.internal:8000/webhook/whatsapp\",\"events\":[\"MESSAGES_UPSERT\"]}}"
```

## Env table

| Var | Where | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:8000` |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | backend `.env` | — (demo fallback) |
| `LLM_PRIMARY_PROVIDER` / `LLM_FALLBACK_PROVIDER` | backend `.env` | `groq` / `gemini` |
| `DEMO_MODE_FALLBACK` | backend `.env` | `true` |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | backend `.env` | `http://localhost:8080` / `vyapaar123` / `vyapaarai` |
| `WHISPER_MODEL` / `VOICE_ENABLED` / `VOICE_REPLY` | backend `.env` | `medium` / `true` / `true` |
| `OWNER_PHONE` / `TTS_DEFAULT_LANGUAGE` | backend `.env` | — / `hi` |

## Demo script (7 steps)

1. **Register photo** — send a bill/register photo on WhatsApp → "📗 N entries mili… HAAN/NAHI?"
2. **Confirm** — reply HAAN → rows appear in products/sales.
3. **Morning brief** — `POST /brief/send` → 3 alerts in Hindi.
4. **Dashboard** — open `/` → score ~46, overdue ₹53,400, forecast chart animates.
5. **Copilot** — `/chat` → "Why did my profit fall this month?" → agent steps animate in.
6. **Actions** — `/actions` → Generate → Approve → simulated-delivery toast.
7. **Language switch** — ask "मेरा प्रॉफिट क्यों गिरा?" → reply comes back in Hindi.

## Production notes

- **DB access:** backend connects as `postgres` (pooler). Anon/authenticated grants are
  deliberately OPEN (demo-grade) because Supabase Realtime `postgres_changes` shares
  the anon grant switch with PostgREST — revoking grants kills the live UI too
  (verified empirically). Roadmap for strict setups: RLS policies or
  backend-published broadcast channels.
- **Rate limits:** `POST /chat` 30/min, `POST /auth/otp/request` 5/min,
  `POST /ingest/*` 20/min → JSON 429. Uploads capped at 20MB (413), filenames
  sanitized. Every error carries `request_id` (+ `X-Request-ID` header);
  `GET /health/ready` reports db + watch_dir.
- **Speed:** composite PG indexes on hot paths (`ensure_prod_schema`); intelligence
  GETs cached 60s (`X-Cache: hit|miss`), invalidated on ingest/commit, doc confirm,
  actions generate.
- **CORS:** only `FRONTEND_URL` (default `http://localhost:3000`) + 127.0.0.1:3000.

## Known limitations (accepted risk)

- UPI reminders carry a pay-link only — no auto-confirm/reconciliation with the bank.
- WhatsApp runs on the unofficial OpenWA gateway (Evolution standby), not the
  official Cloud API — link flags possible on rapid test sends.
- Realtime is open by design (see Production notes); no per-owner RLS yet.
- Live LLM providers currently degraded (groq model retired, gemini 400) —
  `/chat` serves via `demo_fallback` until keys/model are refreshed.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, framer-motion, recharts, lucide-react, sonner |
| Backend | FastAPI, SQLAlchemy, SQLite, watchdog, APScheduler |
| AI | Groq (llama-3.3-70b), Gemini REST, faster-whisper, edge-tts |
| Messaging | Evolution API (WhatsApp) |

*AI suggests. Owner decides.*

## Screens (v2 product UI)

- `/` public landing: animated phone mockup, pipeline, bento, mini-demo, marquee
- `/login` split-screen OTP login with animated ledger illustration
- `/app` bento dashboard: KPI count-ups, live activity feed, credit card, forecast
- `/app/chat` copilot with typing dots, step timeline, real voice notes
- `/app/data` wizard + restart-safe ledger + documents recognize/confirm
- `/app/actions` approve/reject with UPI deep-link chips
(Screenshots: capture 1440px + 390px light/dark after `npm run dev` — pending.)

## Skills credits

UI built with: `frontend-design` (anthropic/skills), `web-design-engineer`
principles (ConardLi/garden-skills — clone failed twice, brief spec governed),
`landing-page-design` (elayadesign), `design-engineering` + `animate`
(emilkowalski/skills). Backend verify chain p2→p11 + `verify_p8.mjs` untouched.
