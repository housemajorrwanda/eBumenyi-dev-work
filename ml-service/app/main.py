from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app import ocr, tts

app = FastAPI(title="eBumenyi ML Service", version="1.0.0")


class OcrRequest(BaseModel):
    file_url: str = Field(min_length=8)


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    voice: Optional[str] = Field(
        default=None,
        description="female1 | female2 | male (C4IR kinya-flex-tts speaker ids 0, 1, 2)",
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract")
async def extract_text(body: OcrRequest):
    try:
        pages = await ocr.extract_text_from_url(body.file_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    full_text = " ".join(pages.values()).strip()
    return {"pageTexts": pages, "fullText": full_text}


@app.post("/tts/synthesize")
def synthesize(body: TtsRequest):
    try:
        audio = tts.synthesize_wav(body.text.strip(), body.voice)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(content=audio, media_type="audio/wav")
