@echo off
REM VyapaarAI: OpenWA gateway restart helper (API :2785, Swagger :2785/api/docs)
REM npm start = API only (dashboard UI disabled rehta hai — zaroorat nahi)
REM OPENWA_PATH env set ho to wahi use hota hai, warna neeche fallback path.
if defined OPENWA_PATH (
  cd /d "%OPENWA_PATH%"
) else (
  cd /d C:\aiagentprojects\openwa
)
npm start
