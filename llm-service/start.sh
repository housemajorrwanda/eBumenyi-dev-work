#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-11434}"
export OLLAMA_HOST="0.0.0.0:${PORT}"
MODEL="${OLLAMA_MODEL:-llama3.2}"

ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama to start on ${OLLAMA_HOST}..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "http://127.0.0.1:${PORT}/api/tags" >/dev/null 2>&1; then
  echo "Ollama failed to start within 60s" >&2
  exit 1
fi

echo "Pulling model: ${MODEL}"
ollama pull "${MODEL}"

echo "Ollama ready — model ${MODEL} loaded"
wait "${SERVER_PID}"
