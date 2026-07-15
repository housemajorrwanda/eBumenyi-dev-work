import axios from "axios";

const baseUrl = process.env.ML_SERVICE_URL?.replace(/\/$/, "");

export function isMlServiceConfigured(): boolean {
  return Boolean(baseUrl);
}

export async function extractTextFromFileUrl(
  fileUrl: string,
): Promise<{ pageTexts: Record<string, string>; fullText: string }> {
  if (!baseUrl) {
    throw new Error("ML service is not configured");
  }

  const response = await axios.post(
    `${baseUrl}/ocr/extract`,
    { file_url: fileUrl },
    { timeout: 300_000 },
  );

  return {
    pageTexts: response.data.pageTexts ?? {},
    fullText: response.data.fullText ?? "",
  };
}

export async function synthesizeSpeech(
  text: string,
  options?: { voice?: string },
): Promise<Buffer> {
  if (!baseUrl) {
    throw new Error("ML service is not configured");
  }

  const response = await axios.post(
    `${baseUrl}/tts/synthesize`,
    { text, voice: options?.voice },
    {
      timeout: 300_000,
      responseType: "arraybuffer",
    },
  );

  return Buffer.from(response.data);
}

export async function checkMlServiceHealth(): Promise<boolean> {
  if (!baseUrl) return false;
  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: 5_000 });
    return response.data?.status === "ok";
  } catch {
    return false;
  }
}
