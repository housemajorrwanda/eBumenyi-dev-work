import AsyncStorage from "@react-native-async-storage/async-storage";

export type NarrationVoice = "female1" | "female2" | "male";

export const DEFAULT_NARRATION_VOICE: NarrationVoice = "female1";

const STORAGE_KEY = "narrationVoice";

export const NARRATION_VOICE_OPTIONS: {
  id: NarrationVoice;
  label: string;
}[] = [
  { id: "female1", label: "Ijwi ry'umugore 1" },
  { id: "female2", label: "Ijwi ry'umugore 2" },
  { id: "male", label: "Ijwi ry'umugabo" },
];

export function getNarrationVoiceLabel(voice: NarrationVoice): string {
  return (
    NARRATION_VOICE_OPTIONS.find((option) => option.id === voice)?.label ??
    NARRATION_VOICE_OPTIONS[0].label
  );
}

export async function loadNarrationVoice(): Promise<NarrationVoice> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "female1" || stored === "female2" || stored === "male") {
      return stored;
    }
  } catch {
    // Ignore storage errors and fall back to default voice.
  }
  return DEFAULT_NARRATION_VOICE;
}

export async function saveNarrationVoice(voice: NarrationVoice): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, voice);
}
