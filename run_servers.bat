@echo off
start "VyapaarAI - Backend (Port 8000)" cmd /k "title VyapaarAI Backend && cd /d %~dp0backend && python -m uvicorn app.main:app --port 8000 --reload"
timeout /t 2 /nobreak >nul
start "VyapaarAI - Frontend (Port 3000)" cmd /k "title VyapaarAI Frontend && cd /d %~dp0frontend && npm run dev"
timeout /t 2 /nobreak >nul
start "VyapaarAI - WhatsApp OpenWA (Port 2785)" cmd /k "title VyapaarAI WhatsApp OpenWA && cd /d C:\aiagentprojects\openwa && npm start"
