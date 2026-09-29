@echo off
REM Tally sync agent: poll localhost:9000 XML -> POST /connectors/ingest
REM Token: connectors/token.txt me JWT save karo (pehle /login karo)
cd /d %~dp0..
set TALLY_URL=http://localhost:9000
set BACKEND_URL=http://localhost:8000
set TOKEN_FILE=.\connectors\token.txt
set POLL_SECONDS=60
python connectors\tally_sync.py
