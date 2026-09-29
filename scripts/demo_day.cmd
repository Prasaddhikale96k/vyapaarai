@echo off
REM P18 demo_day: start backend + warmup + status + checklist. Run from repo root.
REM Usage: scripts\demo_day.cmd
cd /d "%~dp0..\backend"
echo === 1/4 backend starting (port 8000) ===
start "vyapaarai-backend" cmd /k "uvicorn app.main:app --host 0.0.0.0 --port 8000"
timeout /t 12 /nobreak >nul
echo === 2/4 warmup (whisper + orchestrate + health + credit PDF + forecast) ===
python ..\scripts\warmup.py
echo === 3/4 whatsapp bridge status ===
curl -s http://localhost:8000/whatsapp/status
echo.
echo === 4/4 DEMO CHECKLIST (human phones needed) ===
echo [ ] old SIM 919511996418 phone ON + OpenWA connected (backend\openwa_start.cmd + setup_whatsapp.py QR)
echo [ ] owner 919834854511 WA "hi" -^> machine replies
echo [ ] /login OTP ARRIVES ON WHATSAPP -^> verify -^> /app loads
echo [ ] forward a scheme text -^> scheme_alert in /app/actions
echo [ ] send ONE bill photo -^> pending_confirm -^> HAAN applies
echo [ ] voice note -^> transcript + answer
echo [ ] /app "Bank-ready PDF" downloads loan file
echo BACKEND: http://localhost:8000  APP: http://localhost:3000 (npm run dev in frontend/)
