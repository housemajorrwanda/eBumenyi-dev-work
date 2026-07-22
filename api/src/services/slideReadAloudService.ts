import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../utils/client";
import AppError from "../utils/error";
import {
  extractTextFromFileUrl,
  isMlServiceConfigured,
  synthesizeSpeech,
} from "../utils/mlClient";
import { extractPdfTextFromUrl, isPdfUrl } from "../utils/pdfTextExtract";

type PageMap = Record<string, string>;

export type NarrationVoice = "female1" | "female2" | "male";

export const DEFAULT_NARRATION_VOICE: NarrationVoice = "female1";

/** Short Kinyarwanda sample so learners can hear each voice before choosing. */
export const VOICE_PREVIEW_TEXT =
  "Muraho. Uyu ni urugero rw'ijwi ryo gusoma amasomo.";

const voicePreviewUrlCache = new Map<NarrationVoice, string>();

function narrationCacheKey(page: number, voice: NarrationVoice): string {
  return `${page}_${voice}`;
}

function pickCachedAudio(
  narrationPages: PageMap,
  page: number,
  voice: NarrationVoice,
): string | undefined {
  const voiceKey = narrationCacheKey(page, voice);
  if (narrationPages[voiceKey]) {
    return narrationPages[voiceKey];
  }

  // Legacy cache entries keyed only by page (pre flex-tts).
  if (voice === DEFAULT_NARRATION_VOICE) {
    return narrationPages[String(page)];
  }

  return undefined;
}

function parsePageMap(raw: string | null | undefined): PageMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: PageMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        map[key] = value.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}

function serializePageMap(map: PageMap): string | null {
  const keys = Object.keys(map);
  if (keys.length === 0) return null;
  return JSON.stringify(map);
}

function metadataFallback(note?: string | null, description?: string | null): string {
  return [note, description].filter(Boolean).join(". ").trim();
}

function pickPageText(pageTexts: PageMap, page: number, fallback: string): string {
  const direct = pageTexts[String(page)];
  if (direct) return direct;

  const values = Object.values(pageTexts);
  if (values.length === 1) return values[0];
  if (values.length > 0 && page === 1) return values[0];

  return fallback;
}

async function uploadWav(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "chw/narration",
        public_id: publicId,
        format: "wav",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result?.secure_url ?? result?.url ?? "");
      },
    );
    stream.end(buffer);
  });
}

export class SlideReadAloudService {
  static queueTextExtraction(slideId: string): void {
    setImmediate(() => {
      SlideReadAloudService.extractSlideText(slideId).catch((error) => {
        console.error(`[read-aloud] OCR failed for slide ${slideId}:`, error);
      });
    });
  }

  static async extractSlideText(slideId: string): Promise<void> {
    const slide = await prisma.slide.findUnique({ where: { id: slideId } });
    if (!slide?.file) {
      await prisma.slide.update({
        where: { id: slideId },
        data: { ocrStatus: "skipped" },
      });
      return;
    }

    await prisma.slide.update({
      where: { id: slideId },
      data: {
        ocrStatus: "processing",
        narrationPages: null,
      },
    });

    try {
      let pageTexts: PageMap = {};

      if (isPdfUrl(slide.file)) {
        try {
          pageTexts = await extractPdfTextFromUrl(slide.file);
        } catch (error) {
          console.warn(`[read-aloud] PDF parse failed for ${slideId}`, error);
        }
      }

      if (Object.keys(pageTexts).length === 0 && isMlServiceConfigured()) {
        const ocrResult = await extractTextFromFileUrl(slide.file);
        pageTexts = ocrResult.pageTexts;
      }

      const fallback = metadataFallback(slide.note, slide.description);
      if (Object.keys(pageTexts).length === 0 && fallback) {
        pageTexts = { "1": fallback };
      }

      await prisma.slide.update({
        where: { id: slideId },
        data: {
          pageTexts: serializePageMap(pageTexts),
          ocrStatus: Object.keys(pageTexts).length > 0 ? "done" : "failed",
        },
      });
    } catch (error) {
      await prisma.slide.update({
        where: { id: slideId },
        data: { ocrStatus: "failed" },
      });
      throw error;
    }
  }

  static resolveReadableText(
    slide: {
      note?: string | null;
      description?: string | null;
      pageTexts?: string | null;
    },
    page: number,
  ): string {
    const pageTexts = parsePageMap(slide.pageTexts);
    const fallback = metadataFallback(slide.note, slide.description);
    return pickPageText(pageTexts, page, fallback);
  }

  private static async resolveTextForContext(
    context: {
      file?: string | null;
      note?: string | null;
      description?: string | null;
      pageTexts?: string | null;
    },
    page: number,
  ): Promise<string> {
    let pageTexts = parsePageMap(context.pageTexts);

    if (Object.keys(pageTexts).length === 0 && context.file) {
      if (isPdfUrl(context.file)) {
        try {
          pageTexts = await extractPdfTextFromUrl(context.file);
        } catch (error) {
          console.warn("[read-aloud] PDF parse failed for remote slide", error);
        }
      }

      if (Object.keys(pageTexts).length === 0 && isMlServiceConfigured()) {
        const ocrResult = await extractTextFromFileUrl(context.file);
        pageTexts = ocrResult.pageTexts;
      }
    }

    const fallback = metadataFallback(context.note, context.description);
    if (Object.keys(pageTexts).length === 0 && fallback) {
      pageTexts = { "1": fallback };
    }

    return pickPageText(pageTexts, page, fallback);
  }

  static async previewVoice(voice: NarrationVoice = DEFAULT_NARRATION_VOICE) {
    const cachedUrl = voicePreviewUrlCache.get(voice);
    if (cachedUrl) {
      return {
        audioUrl: cachedUrl,
        text: VOICE_PREVIEW_TEXT,
        voice,
        cached: true,
      };
    }

    if (!isMlServiceConfigured()) {
      throw new AppError("Serivisi yo gusoma ntabwo iboneka", 503);
    }

    const wavBuffer = await synthesizeSpeech(VOICE_PREVIEW_TEXT, { voice });
    // v2: invalidate previews generated during FlexTTS concurrent-load races
    const audioUrl = await uploadWav(wavBuffer, `voice_preview_v2_${voice}`);
    voicePreviewUrlCache.set(voice, audioUrl);

    return {
      audioUrl,
      text: VOICE_PREVIEW_TEXT,
      voice,
      cached: false,
    };
  }

  static async narrateSlide(
    slideId: string,
    page = 1,
    remoteContext?: {
      file?: string | null;
      note?: string | null;
      description?: string | null;
    },
    voice: NarrationVoice = DEFAULT_NARRATION_VOICE,
  ) {
    const slide = await prisma.slide.findUnique({ where: { id: slideId } });
    const pageKey = String(page);
    const cacheKey = narrationCacheKey(page, voice);

    if (slide) {
      const narrationPages = parsePageMap(slide.narrationPages);
      const cachedAudio = pickCachedAudio(narrationPages, page, voice);
      const text = SlideReadAloudService.resolveReadableText(slide, page);

      if (!text) {
        throw new AppError("Nta byanditswe biboneka kuri iri somo", 404);
      }

      if (cachedAudio) {
        return { audioUrl: cachedAudio, text, page, voice, cached: true };
      }

      if (!isMlServiceConfigured()) {
        throw new AppError("Serivisi yo gusoma ntabwo iboneka", 503);
      }

      const wavBuffer = await synthesizeSpeech(text, { voice });
      const audioUrl = await uploadWav(
        wavBuffer,
        `${slideId}_p${pageKey}_${voice}`,
      );

      const updatedPages = { ...narrationPages, [cacheKey]: audioUrl };
      await prisma.slide.update({
        where: { id: slideId },
        data: { narrationPages: serializePageMap(updatedPages) },
      });

      return { audioUrl, text, page, voice, cached: false };
    }

    if (!remoteContext) {
      throw new AppError("Slide not found", 404);
    }

    const text = await SlideReadAloudService.resolveTextForContext(
      remoteContext,
      page,
    );

    if (!text) {
      throw new AppError("Nta byanditswe biboneka kuri iri somo", 404);
    }

    if (!isMlServiceConfigured()) {
      throw new AppError("Serivisi yo gusoma ntabwo iboneka", 503);
    }

    const wavBuffer = await synthesizeSpeech(text, { voice });
    const audioUrl = await uploadWav(
      wavBuffer,
      `${slideId}_p${pageKey}_${voice}`,
    );

    return { audioUrl, text, page, voice, cached: false };
  }
}
