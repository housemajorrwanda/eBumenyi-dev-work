import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NARRATION_API_BASE_URL } from "@/config/constants";
import { NarrationVoice } from "@/services/narrationVoice";

export interface SlideNarrationResult {
  audioUrl: string;
  text: string;
  page: number;
  voice?: NarrationVoice;
  cached: boolean;
}

export interface VoicePreviewResult {
  audioUrl: string;
  text: string;
  voice: NarrationVoice;
  cached: boolean;
}

export interface SlideNarrationContext {
  file?: string | null;
  note?: string | null;
  description?: string | null;
}

const narrationClient = axios.create({
  baseURL: NARRATION_API_BASE_URL,
});

narrationClient.interceptors.request.use((request) => {
  request.headers = request.headers ?? {};
  return AsyncStorage.getItem("accessToken").then((accessToken) => {
    if (accessToken) {
      request.headers!.Authorization = accessToken;
    }
    request.headers!["Content-Type"] = "application/json";
    return request;
  }) as any;
});

export async function requestSlideNarration(
  slideId: string,
  page = 1,
  context?: SlideNarrationContext,
  voice?: NarrationVoice,
): Promise<SlideNarrationResult> {
  const response = await narrationClient.post<{ data: SlideNarrationResult }>(
    `/slides/${slideId}/narrate?page=${page}`,
    { ...(context ?? {}), voice },
  );
  return response.data.data;
}

export async function requestVoicePreview(
  voice: NarrationVoice,
): Promise<VoicePreviewResult> {
  const response = await narrationClient.post<{ data: VoicePreviewResult }>(
    `/slides/voice-preview`,
    { voice },
  );
  return response.data.data;
}
