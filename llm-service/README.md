# eBumenyi LLM Service (Ollama)

Self-hosted LLM for analytics chat, NL-to-SQL, and course recommendations.

Uses [Ollama](https://ollama.com) with an OpenAI-compatible API (`/v1/chat/completions`), which the API consumes via `llmAdapter.ts`.

## Default model

| Variable | Default | Notes |
|----------|---------|-------|
| `OLLAMA_MODEL` | `llama3.2` | Supports tool calling (required for staff analytics chat) |

## Endpoints

Ollama exposes the standard API:

- `GET /api/tags` — health / list models
- `POST /v1/chat/completions` — OpenAI-compatible chat (used by the API)

## Run locally

```bash
cd llm-service
docker build -t ebumenyi-llm .
docker run --rm -p 11434:11434 -e OLLAMA_MODEL=llama3.2 ebumenyi-llm
```

Or install Ollama directly and run:

```bash
ollama serve
ollama pull llama3.2
```

Set in the API `.env`:

```
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```

`LLM_API_KEY` is not required for Ollama.

## Railway deployment

See [docs/railway-self-hosted-ai.md](../docs/railway-self-hosted-ai.md).

Quick reference:

| Setting | Value |
|---------|-------|
| Root directory | `llm-service` |
| Builder | Dockerfile |
| Health check | `GET /api/tags` |
| Volume (recommended) | mount at `/root/.ollama` to persist model weights |
| Min RAM | 8 GB (llama3.2 on CPU) |

After deploy, set on the **API** service:

```
LLM_BASE_URL=https://<llm-service>.up.railway.app/v1
LLM_MODEL=llama3.2
```
