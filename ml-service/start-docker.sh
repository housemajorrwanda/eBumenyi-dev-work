#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-${ML_PORT:-8100}}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
