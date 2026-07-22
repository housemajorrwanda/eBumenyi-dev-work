import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app import ocr, tts
from app.config import TTS_ENGINE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ml-service")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if TTS_ENGINE == "flex":
        try:
            from app.flex_tts_engine import preload_model

            logger.info("Preloading FlexTTS model...")
            preload_model()
            logger.info("FlexTTS preload complete")
        except Exception:
            logger.exception(
                "FlexTTS preload failed; first request will retry loading"
            )
    yield


app = FastAPI(title="eBumenyi ML Service", version="1.0.0", lifespan=lifespan)


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
    text = body.text.strip()
    logger.info(
        "POST /tts/synthesize voice=%s chars=%s preview=%r",
        body.voice,
        len(text),
        text[:120],
    )
    try:
        audio = tts.synthesize_wav(text, body.voice)
    except ValueError as exc:
        logger.warning("TTS rejected input: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    logger.info("TTS ok bytes=%s", len(audio))
    return Response(content=audio, media_type="audio/wav")
