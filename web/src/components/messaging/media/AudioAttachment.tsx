import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";
import { IAttachment } from "@/types";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

interface AudioAttachmentProps {
  attachment: IAttachment;
  messageId: string;
  variant: "bubble" | "card";
  isOwn?: boolean;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const AudioAttachment: React.FC<AudioAttachmentProps> = ({ attachment, messageId, variant, isOwn }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const { activeAudioId, setActiveAudio } = useAudioPlayer();

  useEffect(() => {
    if (!containerRef.current) return;
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isOwn ? "rgba(255,255,255,0.4)" : "#CBD5E1",
      progressColor: isOwn ? "#ffffff" : "#3363AD",
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      height: 32,
      url: attachment.url,
    });
    wavesurferRef.current = wavesurfer;

    wavesurfer.on("ready", () => {
      setIsReady(true);
      setDuration(wavesurfer.getDuration());
    });
    wavesurfer.on("audioprocess", () => setCurrentTime(wavesurfer.getCurrentTime()));
    wavesurfer.on("play", () => setIsPlaying(true));
    wavesurfer.on("pause", () => setIsPlaying(false));
    wavesurfer.on("finish", () => setIsPlaying(false));

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.url]);

  useEffect(() => {
    if (activeAudioId !== messageId && wavesurferRef.current?.isPlaying()) {
      wavesurferRef.current.pause();
    }
  }, [activeAudioId, messageId]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    if (!wavesurferRef.current.isPlaying()) {
      setActiveAudio(messageId);
    }
    wavesurferRef.current.playPause();
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-2.5 ${isOwn ? "bg-white/15" : "bg-gray-50"} ${
        variant === "card" ? "w-full" : "min-w-[190px] max-w-[240px]"
      }`}
    >
      <button
        onClick={togglePlay}
        disabled={!isReady}
        className={`w-9 h-9 flex-shrink-0 rounded-full disabled:opacity-50 flex items-center justify-center ${
          isOwn ? "bg-white/25 hover:bg-white/35 text-white" : "bg-primary hover:bg-primary/90 text-white"
        }`}
      >
        {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
        <span className={`text-xs ${isOwn ? "text-white/70" : "text-gray-500"}`}>
          {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
};
