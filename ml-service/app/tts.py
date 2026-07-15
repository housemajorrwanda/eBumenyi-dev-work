import io
import re

import numpy as np
import soundfile as sf
import torch

from typing import Optional

from app.config import DEVICE, TTS_CHUNK_CHARS, TTS_ENGINE, TTS_MODEL

_tokenizer = None
_model = None


def _load_model():
    global _tokenizer, _model
    if _model is not None:
        return _tokenizer, _model

    from transformers import AutoTokenizer, VitsModel

    _tokenizer = AutoTokenizer.from_pretrained(TTS_MODEL)
    _model = VitsModel.from_pretrained(TTS_MODEL)
    _model.eval()
    if DEVICE == "cuda" and torch.cuda.is_available():
        _model.to("cuda")
    return _tokenizer, _model


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


def _synthesize_chunk(text: str) -> tuple[np.ndarray, int]:
    tokenizer, model = _load_model()
    inputs = tokenizer(text, return_tensors="pt")
    if DEVICE == "cuda" and torch.cuda.is_available():
        inputs = {key: value.to("cuda") for key, value in inputs.items()}

    with torch.no_grad():
        waveform = model(**inputs).waveform

    samples = waveform.squeeze().cpu().numpy()
    rate = model.config.sampling_rate
    return samples, rate


def synthesize_wav(text: str, voice: Optional[str] = None) -> bytes:
    if TTS_ENGINE == "flex":
        from app.flex_tts_engine import synthesize_wav as flex_synthesize_wav

        return flex_synthesize_wav(text, voice)

    chunks = _split_text(text, TTS_CHUNK_CHARS)
    if not chunks:
        raise ValueError("No text to synthesize")

    waveforms: list[np.ndarray] = []
    sample_rate = None

    for chunk in chunks:
        samples, rate = _synthesize_chunk(chunk)
        waveforms.append(samples)
        sample_rate = rate

    merged = np.concatenate(waveforms)
    buffer = io.BytesIO()
    sf.write(buffer, merged, sample_rate, format="WAV")
    return buffer.getvalue()
