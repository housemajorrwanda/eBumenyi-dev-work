import re
import tempfile
from pathlib import Path
from typing import Any

import httpx

READABLE_LABELS = frozenset(
    {"text", "paragraph_title", "doc_title", "figure_title", "table"}
)

_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    from paddleocr import PPStructureV3

    from app.config import OCR_USE_GPU

    _pipeline = PPStructureV3(
        device="gpu" if OCR_USE_GPU else "cpu",
        use_formula_recognition=False,
        use_chart_recognition=False,
        use_seal_recognition=False,
        use_table_recognition=True,
        format_block_content=True,
    )
    return _pipeline


def _blocks_to_text(blocks: list[dict[str, Any]]) -> str:
    ordered = sorted(blocks, key=lambda b: b.get("block_order") or b.get("block_id") or 0)
    parts: list[str] = []
    for block in ordered:
        label = block.get("block_label") or ""
        content = (block.get("block_content") or "").strip()
        if label in READABLE_LABELS and content:
            parts.append(content)
    return " ".join(parts)


def _parse_result(result: Any, page_index: int) -> str:
    payload = result.json if hasattr(result, "json") else {}
    blocks = payload.get("parsing_res_list") or []
    if blocks:
        return _blocks_to_text(blocks)

    ocr = payload.get("overall_ocr_res") or {}
    texts = ocr.get("rec_texts") or []
    return " ".join(t.strip() for t in texts if t and t.strip())


async def _download_file(url: str) -> Path:
    suffix = Path(url.split("?")[0]).suffix or ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = Path(tmp.name)
    tmp.close()

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            with tmp_path.open("wb") as out:
                async for chunk in response.aiter_bytes():
                    out.write(chunk)
    return tmp_path


def extract_text_from_path(file_path: Path) -> dict[str, str]:
    pipeline = _get_pipeline()
    output = pipeline.predict(input=str(file_path))

    pages: dict[str, str] = {}
    for index, result in enumerate(output):
        text = _parse_result(result, index + 1)
        if text:
            pages[str(index + 1)] = text
    return pages


async def extract_text_from_url(file_url: str) -> dict[str, str]:
    local_path = await _download_file(file_url)
    try:
        return extract_text_from_path(local_path)
    finally:
        local_path.unlink(missing_ok=True)
