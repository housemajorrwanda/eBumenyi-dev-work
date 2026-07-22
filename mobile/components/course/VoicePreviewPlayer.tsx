import { useEffect, useRef } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";

type Props = {
  uri: string;
  onFinished?: () => void;
  onError?: () => void;
};

/**
 * Plays a remote voice-preview clip once loaded. Mount only while previewing.
 */
export function VoicePreviewPlayer({ uri, onFinished, onError }: Props) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    startedRef.current = false;
    finishedRef.current = false;
  }, [uri]);

  useEffect(() => {
    if (!status.isLoaded || startedRef.current) return;

    startedRef.current = true;
    (async () => {
      try {
        if (typeof player.seekTo === "function") {
          player.seekTo(0);
        }
        await player.play();
      } catch {
        onError?.();
      }
    })();
  }, [status.isLoaded, player, onError]);

  useEffect(() => {
    if (!startedRef.current || finishedRef.current) return;
    if (status.didJustFinish) {
      finishedRef.current = true;
      onFinished?.();
    }
  }, [status.didJustFinish, onFinished]);

  return null;
}
