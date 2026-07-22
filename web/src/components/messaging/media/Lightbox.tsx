import React, { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

interface LightboxProps {
  url: string;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ url, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        title="Close"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt="Attachment"
        className="max-w-full max-h-[80vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm"
      >
        <ExternalLink size={14} />
        Open in new tab
      </a>
    </div>
  );
};
