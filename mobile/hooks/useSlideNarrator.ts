import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { requestSlideNarration, SlideNarrationContext } from "@/services/narration.api";
import { NarrationVoice } from "@/services/narrationVoice";

type NarratorState = "idle" | "loading" | "playing" | "error";

function withPlaybackToken(url: string, token: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_play=${token}`;
}

export function useSlideNarrator() {
  const [state, setState] = useState<NarratorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [didJustFinish, setDidJustFinish] = useState(false);
  const activeRequest = useRef(0);

  const player = useAudioPlayer(playbackUri);
  const status = useAudioPlayerStatus(player);
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!shouldAutoPlay || !playbackUri || !status.isLoaded) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const currentPlayer = playerRef.current;
        if (typeof currentPlayer.seekTo === "function") {
          currentPlayer.seekTo(0);
        }
        await currentPlayer.play();
        if (!cancelled) {
          setState("playing");
          setShouldAutoPlay(false);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Ntibyashoboka gutangiza amajwi.");
          setState("error");
          setShouldAutoPlay(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldAutoPlay, playbackUri, status.isLoaded]);

  useEffect(() => {
    if (state === "playing" && status.didJustFinish) {
      setState("idle");
      setPlaybackUri(null);
      setShouldAutoPlay(false);
      setDidJustFinish(true);
    }
  }, [state, status.didJustFinish]);

  const stop = useCallback(() => {
    activeRequest.current += 1;
    setDidJustFinish(false);
    setShouldAutoPlay(false);
    try {
      playerRef.current.pause();
    } catch {
      // Native player may not be ready yet.
    }
    setPlaybackUri(null);
    setState("idle");
    setErrorMessage(null);
  }, []);

  const narrate = useCallback(
    async (
      slideId: string,
      page = 1,
      context?: SlideNarrationContext,
      voice?: NarrationVoice,
      playToken = 0,
    ) => {
      if (!slideId) return;

      const requestId = activeRequest.current + 1;
      activeRequest.current = requestId;
      setState("loading");
      setErrorMessage(null);
      setDidJustFinish(false);
      setShouldAutoPlay(false);

      try {
        const result = await requestSlideNarration(slideId, page, context, voice);
        if (activeRequest.current !== requestId) return;

        const playbackUrl = withPlaybackToken(
          result.audioUrl,
          playToken || requestId,
        );
        setPlaybackUri(playbackUrl);
        setShouldAutoPlay(true);
      } catch (error: any) {
        if (activeRequest.current !== requestId) return;
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Ntibyashoboka gusoma iri somo.";
        setErrorMessage(message);
        setState("error");
      }
    },
    [],
  );

  return {
    narrate,
    stop,
    state,
    isLoading:
      state === "loading" ||
      (state === "playing" && !status.playing && shouldAutoPlay),
    isPlaying: state === "playing" && status.playing,
    errorMessage,
    didJustFinish,
  };
}
