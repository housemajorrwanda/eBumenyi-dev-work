#!/usr/bin/env bash
# Usage: ./scripts/test-llm.sh [base-url]

set -euo pipefail

BASE="${1:-http://localhost:11434}"
BASE="${BASE%/}"

echo "=== GET /api/tags ==="
curl -sS -m 15 -w "\nHTTP %{http_code} in %{time_total}s\n" "${BASE}/api/tags" | head -c 400
echo

echo "=== GET /v1/models ==="
curl -sS -m 15 -w "\nHTTP %{http_code} in %{time_total}s\n" "${BASE}/v1/models" | head -c 400
echo

echo "=== POST /v1/chat/completions (stream, 120s max) ==="
curl -sS -m 120 -N -w "\nHTTP %{http_code} total %{time_total}s\n" \
  -X POST "${BASE}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2","stream":true,"messages":[{"role":"user","content":"Say hello in one short sentence."}]}' \
  | head -c 800
echo

echo "=== POST /api/generate (120s max) ==="
curl -sS -m 120 -w "\nHTTP %{http_code} in %{time_total}s\n" \
  -X POST "${BASE}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2","prompt":"Say hi","stream":false}' \
  | head -c 400
echo
