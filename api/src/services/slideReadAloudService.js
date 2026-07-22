"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlideReadAloudService = exports.VOICE_PREVIEW_TEXT = exports.DEFAULT_NARRATION_VOICE = void 0;
const cloudinary_1 = require("cloudinary");
const client_1 = require("../utils/client");
const error_1 = __importDefault(require("../utils/error"));
const mlClient_1 = require("../utils/mlClient");
const pdfTextExtract_1 = require("../utils/pdfTextExtract");
exports.DEFAULT_NARRATION_VOICE = "female1";
/** Short Kinyarwanda sample so learners can hear each voice before choosing. */
exports.VOICE_PREVIEW_TEXT = "Muraho. Uyu ni urugero rw'ijwi ryo gusoma amasomo.";
const voicePreviewUrlCache = new Map();
function narrationCacheKey(page, voice) {
    return `${page}_${voice}`;
}
function pickCachedAudio(narrationPages, page, voice) {
    const voiceKey = narrationCacheKey(page, voice);
    if (narrationPages[voiceKey]) {
        return narrationPages[voiceKey];
    }
    // Legacy cache entries keyed only by page (pre flex-tts).
    if (voice === exports.DEFAULT_NARRATION_VOICE) {
        return narrationPages[String(page)];
    }
    return undefined;
}
function parsePageMap(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const map = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string" && value.trim()) {
                map[key] = value.trim();
            }
        }
        return map;
    }
    catch {
        return {};
    }
}
function serializePageMap(map) {
    const keys = Object.keys(map);
    if (keys.length === 0)
        return null;
    return JSON.stringify(map);
}
function metadataFallback(note, description) {
    return [note, description].filter(Boolean).join(". ").trim();
}
function pickPageText(pageTexts, page, fallback) {
    const direct = pageTexts[String(page)];
    if (direct)
        return direct;
    const values = Object.values(pageTexts);
    if (values.length === 1)
        return values[0];
    if (values.length > 0 && page === 1)
        return values[0];
    return fallback;
}
async function uploadWav(buffer, publicId) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({
            resource_type: "video",
            folder: "chw/narration",
            public_id: publicId,
            format: "wav",
        }, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result?.secure_url ?? result?.url ?? "");
        });
        stream.end(buffer);
    });
}
class SlideReadAloudService {
    static queueTextExtraction(slideId) {
        setImmediate(() => {
            SlideReadAloudService.extractSlideText(slideId).catch((error) => {
                console.error(`[read-aloud] OCR failed for slide ${slideId}:`, error);
            });
        });
    }
    static async extractSlideText(slideId) {
        const slide = await client_1.prisma.slide.findUnique({ where: { id: slideId } });
        if (!slide?.file) {
            await client_1.prisma.slide.update({
                where: { id: slideId },
                data: { ocrStatus: "skipped" },
            });
            return;
        }
        await client_1.prisma.slide.update({
            where: { id: slideId },
            data: {
                ocrStatus: "processing",
                narrationPages: null,
            },
        });
        try {
            let pageTexts = {};
            if ((0, pdfTextExtract_1.isPdfUrl)(slide.file)) {
                try {
                    pageTexts = await (0, pdfTextExtract_1.extractPdfTextFromUrl)(slide.file);
                }
                catch (error) {
                    console.warn(`[read-aloud] PDF parse failed for ${slideId}`, error);
                }
            }
            if (Object.keys(pageTexts).length === 0 && (0, mlClient_1.isMlServiceConfigured)()) {
                const ocrResult = await (0, mlClient_1.extractTextFromFileUrl)(slide.file);
                pageTexts = ocrResult.pageTexts;
            }
            const fallback = metadataFallback(slide.note, slide.description);
            if (Object.keys(pageTexts).length === 0 && fallback) {
                pageTexts = { "1": fallback };
            }
            await client_1.prisma.slide.update({
                where: { id: slideId },
                data: {
                    pageTexts: serializePageMap(pageTexts),
                    ocrStatus: Object.keys(pageTexts).length > 0 ? "done" : "failed",
                },
            });
        }
        catch (error) {
            await client_1.prisma.slide.update({
                where: { id: slideId },
                data: { ocrStatus: "failed" },
            });
            throw error;
        }
    }
    static resolveReadableText(slide, page) {
        const pageTexts = parsePageMap(slide.pageTexts);
        const fallback = metadataFallback(slide.note, slide.description);
        return pickPageText(pageTexts, page, fallback);
    }
    static async resolveTextForContext(context, page) {
        let pageTexts = parsePageMap(context.pageTexts);
        if (Object.keys(pageTexts).length === 0 && context.file) {
            if ((0, pdfTextExtract_1.isPdfUrl)(context.file)) {
                try {
                    pageTexts = await (0, pdfTextExtract_1.extractPdfTextFromUrl)(context.file);
                }
                catch (error) {
                    console.warn("[read-aloud] PDF parse failed for remote slide", error);
                }
            }
            if (Object.keys(pageTexts).length === 0 && (0, mlClient_1.isMlServiceConfigured)()) {
                const ocrResult = await (0, mlClient_1.extractTextFromFileUrl)(context.file);
                pageTexts = ocrResult.pageTexts;
            }
        }
        const fallback = metadataFallback(context.note, context.description);
        if (Object.keys(pageTexts).length === 0 && fallback) {
            pageTexts = { "1": fallback };
        }
        return pickPageText(pageTexts, page, fallback);
    }
    static async previewVoice(voice = exports.DEFAULT_NARRATION_VOICE) {
        const cachedUrl = voicePreviewUrlCache.get(voice);
        if (cachedUrl) {
            return {
                audioUrl: cachedUrl,
                text: exports.VOICE_PREVIEW_TEXT,
                voice,
                cached: true,
            };
        }
        if (!(0, mlClient_1.isMlServiceConfigured)()) {
            throw new error_1.default("Serivisi yo gusoma ntabwo iboneka", 503);
        }
        const wavBuffer = await (0, mlClient_1.synthesizeSpeech)(exports.VOICE_PREVIEW_TEXT, { voice });
        const audioUrl = await uploadWav(wavBuffer, `voice_preview_${voice}`);
        voicePreviewUrlCache.set(voice, audioUrl);
        return {
            audioUrl,
            text: exports.VOICE_PREVIEW_TEXT,
            voice,
            cached: false,
        };
    }
    static async narrateSlide(slideId, page = 1, remoteContext, voice = exports.DEFAULT_NARRATION_VOICE) {
        const slide = await client_1.prisma.slide.findUnique({ where: { id: slideId } });
        const pageKey = String(page);
        const cacheKey = narrationCacheKey(page, voice);
        if (slide) {
            const narrationPages = parsePageMap(slide.narrationPages);
            const cachedAudio = pickCachedAudio(narrationPages, page, voice);
            const text = SlideReadAloudService.resolveReadableText(slide, page);
            if (!text) {
                throw new error_1.default("Nta byanditswe biboneka kuri iri somo", 404);
            }
            if (cachedAudio) {
                return { audioUrl: cachedAudio, text, page, voice, cached: true };
            }
            if (!(0, mlClient_1.isMlServiceConfigured)()) {
                throw new error_1.default("Serivisi yo gusoma ntabwo iboneka", 503);
            }
            const wavBuffer = await (0, mlClient_1.synthesizeSpeech)(text, { voice });
            const audioUrl = await uploadWav(wavBuffer, `${slideId}_p${pageKey}_${voice}`);
            const updatedPages = { ...narrationPages, [cacheKey]: audioUrl };
            await client_1.prisma.slide.update({
                where: { id: slideId },
                data: { narrationPages: serializePageMap(updatedPages) },
            });
            return { audioUrl, text, page, voice, cached: false };
        }
        if (!remoteContext) {
            throw new error_1.default("Slide not found", 404);
        }
        const text = await SlideReadAloudService.resolveTextForContext(remoteContext, page);
        if (!text) {
            throw new error_1.default("Nta byanditswe biboneka kuri iri somo", 404);
        }
        if (!(0, mlClient_1.isMlServiceConfigured)()) {
            throw new error_1.default("Serivisi yo gusoma ntabwo iboneka", 503);
        }
        const wavBuffer = await (0, mlClient_1.synthesizeSpeech)(text, { voice });
        const audioUrl = await uploadWav(wavBuffer, `${slideId}_p${pageKey}_${voice}`);
        return { audioUrl, text, page, voice, cached: false };
    }
}
exports.SlideReadAloudService = SlideReadAloudService;
