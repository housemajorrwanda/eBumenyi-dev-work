import os
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent

PORT = int(os.getenv("PORT", os.getenv("ML_PORT", "8100")))
DEVICE = os.getenv("ML_DEVICE", "cpu")
TTS_ENGINE = os.getenv("TTS_ENGINE", "flex").lower()
TTS_MODEL = os.getenv("TTS_MODEL", "facebook/mms-tts-kin")
FLEX_TTS_MODEL_PATH = os.getenv(
    "FLEX_TTS_MODEL_PATH",
    str(_ROOT / "models" / "kinya_flex_tts_base_trained.pt"),
)
OCR_USE_GPU = os.getenv("OCR_USE_GPU", "false").lower() == "true"
TTS_CHUNK_CHARS = int(os.getenv("TTS_CHUNK_CHARS", "450"))
