#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-11434}"
export OLLAMA_HOST="0.0.0.0:${PORT}"
export OLLAMA_KEEP_ALIVE=-1
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_CONTEXT_LENGTH="${OLLAMA_CONTEXT_LENGTH:-4096}"
export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-0}"
export OLLAMA_NEW_ENGINE="${OLLAMA_NEW_ENGINE:-0}"
export OLLAMA_VULKAN="${OLLAMA_VULKAN:-0}"
MODEL="${OLLAMA_MODEL:-llama3.2}"

ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama on ${OLLAMA_HOST}..."
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

echo "Warming up ${MODEL}..."
if ! curl -sf -m 600 -X POST "http://127.0.0.1:${PORT}/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL}\",\"prompt\":\"ok\",\"stream\":false}" >/dev/null; then
  echo "Model warmup failed (inference did not respond within 10 minutes)." >&2
  exit 1
fi

echo "Ollama ready — ${MODEL}"
wait "${SERVER_PID}"
