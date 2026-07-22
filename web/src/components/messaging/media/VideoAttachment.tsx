import React, { useState } from "react";
import { Play, X, AlertCircle, RotateCcw } from "lucide-react";
import { IAttachment } from "@/types";

interface VideoAttachmentProps {
  attachment: IAttachment;
  variant: "bubble" | "card";
}

const formatDuration = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const VideoAttachment: React.FC<VideoAttachmentProps> = ({ attachment, variant }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const boxClass =
    variant === "bubble"
      ? "w-full h-52 relative bg-black flex items-center justify-center overflow-hidden"
      : "w-full h-56 relative bg-black flex items-center justify-center overflow-hidden rounded-lg";

  const retry = () => {
    setError(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (error) {
    return (
      <div className={`${boxClass} bg-gray-100`}>
        <button
          onClick={retry}
          className="flex flex-col items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <AlertCircle size={28} />
          <span className="text-xs text-center px-4">Video can't be opened</span>
          <span className="text-xs flex items-center gap-1 text-primary">
            <RotateCcw size={12} />
            Tap to retry
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={boxClass}>
        <video
          key={reloadKey}
          src={attachment.url}
          preload="metadata"
          muted
          className="w-full h-full object-cover"
          onLoadedData={() => setLoading(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {!loading && (
          <>
            <button
              onClick={() => setFullscreen(true)}
              className="absolute inset-0 flex items-center justify-center"
              title="Play video"
            >
              <span className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                <Play size={22} className="text-white fill-white ml-0.5" />
              </span>
            </button>
            {duration !== null && formatDuration(duration) && (
              <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">
                {formatDuration(duration)}
              </span>
            )}
          </>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 bg-black z-[100] flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            title="Close"
          >
            <X size={20} />
          </button>
          <video
            src={attachment.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
