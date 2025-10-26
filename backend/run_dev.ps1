# PowerShell script: create venv, install deps, run server

$ErrorActionPreference = "Stop"

python -m venv .venv

./.venv/Scripts/Activate.ps1

pip install -r requirements.txt

if (-Not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

python scripts/seed_admin.py

uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

