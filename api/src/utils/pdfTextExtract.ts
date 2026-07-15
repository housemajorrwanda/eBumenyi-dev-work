import axios from "axios";

type PdfParseFn = (
  buffer: Buffer,
) => Promise<{ text?: string; numpages?: number }>;

let pdfParse: PdfParseFn | null = null;

async function getPdfParser(): Promise<(buffer: Buffer) => Promise<{ text?: string; numpages?: number }>> {
  if (pdfParse) return pdfParse;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdf-parse") as {
    default?: (buffer: Buffer) => Promise<{ text?: string; numpages?: number }>;
  };
  pdfParse = (mod.default ?? mod) as PdfParseFn;
  return pdfParse;
}

function splitEvenly(text: string, pageCount: number): Record<string, string> {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return {};

  if (pageCount <= 1) {
    return { "1": normalized };
  }

  const chunkSize = Math.ceil(normalized.length / pageCount);
  const pages: Record<string, string> = {};
  for (let i = 0; i < pageCount; i += 1) {
    const slice = normalized.slice(i * chunkSize, (i + 1) * chunkSize).trim();
    if (slice) {
      pages[String(i + 1)] = slice;
    }
  }
  return pages;
}

export async function extractPdfTextFromUrl(
  fileUrl: string,
): Promise<Record<string, string>> {
  const response = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });

  const parser = await getPdfParser();
  const parsed = await parser(Buffer.from(response.data));
  const text = parsed.text?.trim() ?? "";
  if (!text) return {};

  const pageCount = parsed.numpages && parsed.numpages > 0 ? parsed.numpages : 1;
  return splitEvenly(text, pageCount);
}

export function isPdfUrl(fileUrl: string): boolean {
  return fileUrl.split("?")[0].toLowerCase().endsWith(".pdf");
}
