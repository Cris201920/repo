#!/usr/bin/env bash
# Instalação para desenvolvimento em Linux/macOS (Python 3.10–3.13).
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt pytest
[ -f .env ] || cp .env.example .env
echo "Pronto. Execute: scripts/run.sh   |   testes: QT_QPA_PLATFORM=offscreen pytest"
