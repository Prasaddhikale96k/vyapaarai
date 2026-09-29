# VyapaarAI — RUNBOOK (P15)

## ROLE MODEL (FINEL — owner-stated)

| Role | Phone | Identity |
|---|---|---|
| OWNER / ADMIN | **919834854511** | Owner's main phone. Logs in, receives WhatsApp OTPs, approvals, alerts, nightly report. Seed/demo owner. |
| ASSISTANT / BRIDGE | **919511996418** | Old spare SIM, low traffic. This WhatsApp account IS VyapaarAI. Owners message IT; IT sends OTPs/alerts/reports. OpenWA session identity. |

- Bridge number is **never** stored in `owner_profiles` or seed.
- Inbound fromMe messages (bridge's own sends) are auto-dropped by `whatsapp_flow.py`.
- `ALLOWED_INBOUND_PHONES=919834854511` — sirf owner's main number message kar sakta hai (registration gate).

## PRODUCTION AUTH (WhatsApp OTP)

Production auth path: owner WA-messages the assistant (919511996418) → registration machine → admin approval → `/login` with 919834854511 → OTP request → **OTP arrives on WhatsApp (assistant→owner)** → verify → JWT → `/app` loads.

`ENVIRONMENT=production` is set in `backend/.env`. Enforcement:
- `POST /auth/otp/request` **never** returns `dev_otp` in production; if the gateway can't send, it returns `{"sent": false, "error": "..."}` (honest failure).
- WhatsApp registration replies **never echo the OTP code** in production.
- Startup assertion `_assert_prod_auth_guard()` in `app/main.py` fails fast if the guard is missing.
- Pinned by `verify_p15.py`.

### PRODUCTION SMOKE (human-assisted — exact steps)

1. **Human:** put OLD SIM **919511996418** in a spare phone with WhatsApp installed and charged.
2. **Human:** run `backend\openwa_start.cmd` (starts OpenWA on :2785).
3. **Human:** run `python setup_whatsapp.py` (from `backend/`) → QR appears → **scan QR FROM THAT OLD PHONE**.
4. **Human:** confirm `GET /whatsapp/status` shows `connected: true` and session = bridge number.
5. **Human:** from OWNER phone **919834854511**, WA-message the assistant "hi" → registration machine replies (NAME → BUSINESS → DISTRIBUTOR → LANGUAGE → OTP).
6. **Human:** approve via `/admin` (or WA OTP verify → admin notify).
7. **Human:** `/login` with 919834854511 → OTP request → **OTP arrives on WhatsApp (assistant→owner)** → verify → JWT → `/app` loads.
8. **Human:** test pending-register path (new number → pending message) and wrong-OTP 3-attempt restart.

> **NOTE FOR RUNBOOK:** the old phone (919511996418) must stay **ON + connected** during demos. If it dies, OTPs stop arriving.

## BRIDGE-DOWN DRILL (WhatsApp bridge offline)

Symptom: `/whatsapp/status` shows `connected: false`, or OTPs don't arrive.

1. Check the old phone (919511996418): **charged? WhatsApp open? internet on?**
2. Restart OpenWA: run `backend\openwa_start.cmd` (from `backend/`).
3. If session expired: `python setup_whatsapp.py` → **re-scan QR on the old phone**.
4. Verify: `GET http://localhost:8000/whatsapp/status` → `connected: true`.
5. Keep the old phone **charged** — a dead SIM = no OTPs = no login.

## INCIDENT MODE (dev OTP for local testing only)

If you need dev-OTP (on-screen code) for local testing:

1. Flip `ENVIRONMENT=development` in `backend/.env` (one line).
2. Restart backend.
3. **REVERT after testing:** flip back to `ENVIRONMENT=production`.

> Never run production demos in `development` mode — dev_otp leaks the code on screen.

## ROADMAP — Day-8 APK + Vision pipeline

- **Day-8 APK = Capacitor wrap of this PWA (same codebase, ~1 day).** The PWA manifest (`frontend/public/manifest.webmanifest`, display standalone, PNG icons) is already install-ready; the APK step is a Capacitor shell around the same Next.js build — no rewrite, no second codebase.
- **Vision pipeline chosen over on-device OpenCV — reasons:** (1) accuracy on handwritten/messy bills (Gemini Vision reads what contour detection cannot); (2) zero client weight (no OpenCV.js bundle, no WASM download on 2G); (3) single extraction path shared by WhatsApp photo/PDF, web Documents upload, and grid Scan Bill (one code path to maintain).
