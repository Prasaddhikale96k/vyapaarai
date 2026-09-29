@echo off
REM Excel sync agent: watch folder -> POST /connectors/ingest
REM Token: connectors/token.txt me JWT save karo (pehle /login karo)
cd /d %~dp0..
set BACKEND_URL=http://localhost:8000
set TOKEN_FILE=.\connectors\token.txt
set WATCH_DIR=.\watch
python connectors\excel_sync.py
