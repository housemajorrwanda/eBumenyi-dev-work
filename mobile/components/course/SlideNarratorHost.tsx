import { useEffect, useRef } from "react";
import { useSlideNarrator } from "@/hooks/useSlideNarrator";
import { NarrationVoice } from "@/services/narrationVoice";

export type SlideNarratorUiState = {
  loading: boolean;
  playing: boolean;
  error: string | null;
};

type Props = {
  slideId: string;
  page: number;
  voice: NarrationVoice;
  playRequestId: number;
  file?: string | null;
  note?: string | null;
  description?: string | null;
  onStateChange: (state: SlideNarratorUiState) => void;
  onFinished?: () => void;
};

/**
 * Mount only when the learner taps "Soma" so course content does not crash
 * if the dev client's native expo-audio module is out of date.
 */
export function SlideNarratorHost({
  slideId,
  page,
  voice,
  playRequestId,
  file,
  note,
  description,
  onStateChange,
  onFinished,
}: Props) {
  const { narrate, stop, isLoading, isPlaying, errorMessage, didJustFinish } =
    useSlideNarrator();
  const lastPlayRequestId = useRef(0);
  const stopRef = useRef(stop);

  stopRef.current = stop;

  useEffect(() => {
    onStateChange({ loading: isLoading, playing: isPlaying, error: errorMessage });
  }, [isLoading, isPlaying, errorMessage, onStateChange]);

  useEffect(() => {
    if (!didJustFinish) return;
    onFinished?.();
  }, [didJustFinish, onFinished]);

  useEffect(() => {
    if (playRequestId <= 0 || playRequestId === lastPlayRequestId.current) {
      return;
    }

    lastPlayRequestId.current = playRequestId;
    narrate(slideId, page, { file, note, description }, voice, playRequestId);
  }, [
    slideId,
    page,
    voice,
    playRequestId,
    file,
    note,
    description,
    narrate,
  ]);

  useEffect(() => {
    return () => {
      stopRef.current();
    };
  }, []);

  return null;
}
