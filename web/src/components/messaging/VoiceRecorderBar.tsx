import React, { useEffect, useState } from "react";
import { Trash2, Pause, Play, Send } from "lucide-react";

interface VoiceRecorderBarProps {
  stream: MediaStream;
  elapsedSeconds: number;
  isPaused: boolean;
  onCancel: () => void;
  onTogglePause: () => void;
  onSend: () => void;
}

const BAR_COUNT = 28;

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  stream,
  elapsedSeconds,
  isPaused,
  onCancel,
  onTogglePause,
  onSend,
}) => {
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.08));

  useEffect(() => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    let frameCount = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      // Throttle re-renders — sampling every frame is unnecessary for a bar visualizer.
      frameCount += 1;
      if (frameCount % 4 !== 0) return;

      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const amplitude = Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
      setLevels((prev) => [...prev.slice(1), Math.max(0.08, amplitude)]);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className="flex-1 flex items-center gap-1 bg-gray-100 border border-gray-300 rounded-full pl-2 pr-1 py-1 min-w-0">
      <button
        onClick={onCancel}
        className="p-1.5 text-red-500 hover:text-red-600 flex-shrink-0"
        title="Discard recording"
      >
        <Trash2 size={18} />
      </button>

      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        <span className={`w-2 h-2 rounded-full bg-red-500 ${isPaused ? "opacity-30" : "animate-pulse"}`} />
        <span className="text-sm text-gray-700 tabular-nums">{formatTime(elapsedSeconds)}</span>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-[2px] h-8 px-2">
        {levels.map((level, i) => (
          <span
            key={i}
            className="flex-1 min-w-[2px] rounded-full bg-primary"
            style={{ height: `${Math.round(level * 28)}px` }}
          />
        ))}
      </div>

      <button
        onClick={onTogglePause}
        className="p-1.5 text-gray-500 hover:text-gray-700 flex-shrink-0"
        title={isPaused ? "Resume recording" : "Pause recording"}
      >
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button
        onClick={onSend}
        className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 flex-shrink-0"
        title="Send voice message"
      >
        <Send size={16} />
      </button>
    </div>
  );
};
