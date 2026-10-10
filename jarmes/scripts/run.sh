#!/usr/bin/env bash
# Execução em Linux/macOS (desenvolvimento). O alvo principal do JARMES é o Windows.
cd "$(dirname "$0")/.."
[ -d .venv ] && source .venv/bin/activate
exec python run_jarmes.py "$@"
