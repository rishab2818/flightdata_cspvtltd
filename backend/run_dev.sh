#!/usr/bin/env bash

set -euo pipefail

python -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

[ -f .env ] || cp .env.example .env

python scripts/seed_admin.py

uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

