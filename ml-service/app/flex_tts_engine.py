import io
import os
import re
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
import torch

from app.config import DEVICE, FLEX_TTS_MODEL_PATH, TTS_CHUNK_CHARS

_model = None
SAMPLE_RATE = 24_000

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

    from deepkin.models.flex_tts import FlexKinyaTTS

    device = torch.device(
        "cuda" if DEVICE == "cuda" and torch.cuda.is_available() else "cpu"
    )
    model_path = FLEX_TTS_MODEL_PATH
    if not os.path.isfile(model_path):
        from huggingface_hub import hf_hub_download

        model_path = hf_hub_download(
            "C4IR-RW/kinya-flex-tts",
            "kinya_flex_tts_base_trained.pt",
            local_dir=str(Path(model_path).parent),
        )

    _model = FlexKinyaTTS.from_pretrained(device, model_path)
    _model.eval()
    return _model


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
    with torch.no_grad():
        waveform = model(sequence, speaker_id, speed=0.8)
    samples = waveform.squeeze().cpu().numpy()
    return np.asarray(samples, dtype=np.float32)


def synthesize_wav(text: str, voice: Optional[str] = None) -> bytes:
    chunks = _split_text(text, TTS_CHUNK_CHARS)
    if not chunks:
        raise ValueError("No text to synthesize")

    speaker_id = resolve_speaker_id(voice)
    waveforms = [_synthesize_chunk(chunk, speaker_id) for chunk in chunks]
    merged = np.concatenate(waveforms)

    buffer = io.BytesIO()
    sf.write(buffer, merged, SAMPLE_RATE, format="WAV")
    return buffer.getvalue()
