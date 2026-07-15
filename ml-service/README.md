# eBumenyi ML Service

Python service for slide OCR (PaddleOCR PP-StructureV3) and Kinyarwanda TTS.

Default TTS engine: **C4IR-RW/kinya-flex-tts** (multi-speaker via DeepKIN-AgAI).

## Endpoints

- `GET /health`
- `POST /ocr/extract` — `{ "file_url": "https://..." }`
- `POST /tts/synthesize` — `{ "text": "...", "voice": "female1" }` → `audio/wav`

### Voices (`voice`)

| Value | Speaker ID | Description |
|-------|------------|-------------|
| `female1` | 0 | Female voice 1 (default) |
| `female2` | 1 | Female voice 2 |
| `male` | 2 | Male voice |

## Run locally

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./start.sh
```

On first TTS request, weights are downloaded from Hugging Face into `models/` if missing.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_PORT` | `8100` | HTTP port |
| `ML_DEVICE` | `cpu` | TTS device (`cpu` or `cuda`) |
| `TTS_ENGINE` | `flex` | `flex` (kinya-flex-tts) or `mms` (facebook/mms-tts-kin) |
| `FLEX_TTS_MODEL_PATH` | `models/kinya_flex_tts_base_trained.pt` | Local path to flex-tts weights |
| `OCR_USE_GPU` | `false` | PaddleOCR GPU toggle |
| `TTS_MODEL` | `facebook/mms-tts-kin` | MMS model (only when `TTS_ENGINE=mms`) |
| `TTS_CHUNK_CHARS` | `450` | Max chars per TTS chunk |

Set `ML_SERVICE_URL=http://localhost:8100` in the API `.env`.

## Railway (self-hosted)

See [docs/railway-self-hosted-ai.md](../docs/railway-self-hosted-ai.md) for full deployment steps.

| Setting | Value |
|---------|-------|
| Root directory | `ml-service` |
| Health check | `GET /health` |
| Volume (recommended) | `/service/models` |
| Min RAM | 4 GB |
