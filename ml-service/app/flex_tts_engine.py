import io
import logging
import os
import re
import threading
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
import torch

from app.config import DEVICE, FLEX_TTS_MODEL_PATH, TTS_CHUNK_CHARS

logger = logging.getLogger(__name__)

_model = None
_load_lock = threading.Lock()
# FlexTTS infer is not safe under concurrent CPU calls (Railway single replica).
_infer_lock = threading.Lock()

SAMPLE_RATE = 24_000
# ~0.35s — reject near-empty / corrupted waveforms before caching upstream.
MIN_AUDIO_SAMPLES = int(SAMPLE_RATE * 0.35)

VOICE_TO_SPEAKER: dict[str, int] = {
    "female1": 0,
    "female2": 1,
    "male": 2,
}


def resolve_speaker_id(voice: Optional[str]) -> int:
    if not voice:
        return 0
    key = voice.strip().lower()
    if key in VOICE_TO_SPEAKER:
        return VOICE_TO_SPEAKER[key]
    try:
        speaker_id = int(key)
        if speaker_id in (0, 1, 2):
            return speaker_id
    except ValueError:
        pass
    return 0


def _load_model():
    global _model
    if _model is not None:
        return _model

    with _load_lock:
        if _model is not None:
            return _model

        from deepkin.models.flex_tts import FlexKinyaTTS

        device = torch.device(
            "cuda" if DEVICE == "cuda" and torch.cuda.is_available() else "cpu"
        )
        model_path = FLEX_TTS_MODEL_PATH
        if not os.path.isfile(model_path):
            from huggingface_hub import hf_hub_download

            logger.info("Downloading FlexTTS weights to %s", Path(model_path).parent)
            model_path = hf_hub_download(
                "C4IR-RW/kinya-flex-tts",
                "kinya_flex_tts_base_trained.pt",
                local_dir=str(Path(model_path).parent),
            )

        logger.info("Loading FlexTTS from %s on %s", model_path, device)
        loaded = FlexKinyaTTS.from_pretrained(device, model_path)
        loaded.eval()
        _model = loaded
        logger.info("FlexTTS ready")
        return _model


def preload_model() -> None:
    """Load weights at process start so the first user request is not raced."""
    _load_model()


def _split_text(text: str, max_len: int) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return []
    if len(cleaned) <= max_len:
        return [cleaned]

    chunks: list[str] = []
    current = ""
    for sentence in re.split(r"(?<=[.!?])\s+", cleaned):
        if not sentence:
            continue
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= max_len:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(sentence) <= max_len:
            current = sentence
        else:
            for i in range(0, len(sentence), max_len):
                chunks.append(sentence[i : i + max_len])
            current = ""
    if current:
        chunks.append(current)
    return chunks


def _synthesize_chunk(text: str, speaker_id: int) -> np.ndarray:
    from deepkin.data.kinya_norm import text_to_sequence
    from deepkin.modules.tts_commons import intersperse

    model = _load_model()
    sequence = intersperse(text_to_sequence(text, norm=True), 0)
    if not sequence or len(sequence) < 3:
        raise ValueError(f"Text produced empty phoneme sequence: {text[:80]!r}")

    # Match official HF example (speed default 1.0). Concurrent infer locked for CPU.
    with _infer_lock:
        with torch.no_grad():
            waveform = model(sequence, speaker_id, speed=1.0)

    samples = waveform.detach().float().cpu().numpy()
    samples = np.asarray(samples, dtype=np.float32).reshape(-1)
    if samples.size < MIN_AUDIO_SAMPLES:
        raise ValueError(
            f"TTS produced too-short audio ({samples.size} samples) for text: {text[:80]!r}"
        )
    return samples


def synthesize_wav(text: str, voice: Optional[str] = None) -> bytes:
    chunks = _split_text(text, TTS_CHUNK_CHARS)
    if not chunks:
        raise ValueError("No text to synthesize")

    speaker_id = resolve_speaker_id(voice)
    logger.info(
        "FlexTTS synthesize voice=%s speaker=%s chars=%s chunks=%s preview=%r",
        voice,
        speaker_id,
        len(text),
        len(chunks),
        text[:120],
    )

    waveforms = [_synthesize_chunk(chunk, speaker_id) for chunk in chunks]
    merged = np.concatenate(waveforms)
    duration_s = merged.size / SAMPLE_RATE
    logger.info("FlexTTS done samples=%s duration=%.2fs", merged.size, duration_s)

    if merged.size < MIN_AUDIO_SAMPLES:
        raise ValueError(f"TTS output too short ({duration_s:.2f}s)")

    buffer = io.BytesIO()
    sf.write(buffer, merged, SAMPLE_RATE, format="WAV")
    return buffer.getvalue()
