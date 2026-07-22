import React, { useState } from "react";
import { FileText, FileSpreadsheet, Presentation, File, Paperclip } from "lucide-react";
import toast from "react-hot-toast";
import { IAttachment } from "@/types";
import { getProxyUrl } from "@/services/uploader.api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FileAttachmentProps {
  attachment: IAttachment;
  variant: "bubble" | "card";
  isOwn?: boolean;
}

const fileMeta = (extension: string): { icon: React.ElementType; color: string; label: string } => {
  switch (extension) {
    case "pdf":
      return { icon: FileText, color: "#ef4444", label: "PDF" };
    case "doc":
    case "docx":
      return { icon: FileText, color: "#2563eb", label: extension.toUpperCase() };
    case "xls":
    case "xlsx":
      return { icon: FileSpreadsheet, color: "#16a34a", label: extension.toUpperCase() };
    case "ppt":
    case "pptx":
      return { icon: Presentation, color: "#ea580c", label: extension.toUpperCase() };
    case "txt":
    case "csv":
      return { icon: File, color: "#6b7280", label: extension.toUpperCase() };
    default:
      return { icon: Paperclip, color: "#6b7280", label: extension ? extension.toUpperCase() : "FILE" };
  }
};

const filenameFromUrl = (url: string): string => {
  try {
    const last = decodeURIComponent(url.split("/").pop() || "file");
    return last.split("?")[0];
  } catch {
    return "file";
  }
};

export const FileAttachment: React.FC<FileAttachmentProps> = ({ attachment, variant, isOwn }) => {
  const filename = attachment.name || filenameFromUrl(attachment.url);
  const extension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const { icon: Icon, color, label } = fileMeta(extension);

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      // Some files (e.g. Cloudinary "raw" delivery like PDFs) 401 on direct fetch — retry
      // through the backend proxy (which streams the asset through with server-side auth)
      // before giving up.
      let response = await fetch(attachment.url).catch(() => null);
      if (!response || !response.ok) {
        const token = localStorage.getItem("accessToken") || "";
        response = await fetch(getProxyUrl(attachment.url), {
          headers: token ? { Authorization: token } : undefined,
        });
      }
      if (!response.ok) {
        const friendly =
          response.status === 404
            ? "This file couldn't be found — it may have been deleted or moved."
            : response.status === 401 || response.status === 403
            ? "You don't have permission to download this file."
            : response.status >= 500
            ? "The server had a problem processing this file. Please try again."
            : "This file couldn't be downloaded.";
        throw new Error(friendly);
      }
      if (!response.body) throw new Error("This file can't be downloaded in this browser.");
      const total = Number(response.headers.get("Content-Length")) || 0;
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setProgress(total ? Math.round((received / total) * 100) : null);
      }
      // Hold at a visible 100% before the file actually appears, so the user sees the
      // download finish rather than jumping straight from a partial percentage to done.
      setProgress(100);
      await wait(400);

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // TypeError from fetch itself (not an HTTP error status) means the request never
      // reached the server — a connectivity issue rather than a file problem.
      const reason =
        error instanceof TypeError
          ? "Couldn't connect. Check your internet connection and try again."
          : error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast.error(`Couldn't download "${filename}" — ${reason}`);
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  const ringSize = 36;
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={`flex items-center gap-3 rounded-2xl p-2.5 transition-colors text-left ${
        isOwn ? "bg-white/15" : "bg-gray-50 hover:bg-gray-100"
      } ${variant === "card" ? "w-full" : "min-w-[180px] max-w-[240px]"}`}
    >
      <span
        className="relative w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : `${color}1A` }}
      >
        {downloading ? (
          <>
            <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} className="absolute inset-0 -rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={isOwn ? "rgba(255,255,255,0.3)" : "#e5e7eb"}
                strokeWidth={2}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={isOwn ? "#ffffff" : "#3363AD"}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={
                  progress === null ? ringCircumference * 0.75 : ringCircumference * (1 - progress / 100)
                }
                className={progress === null ? "animate-spin" : ""}
                style={{ transformOrigin: "center" }}
              />
            </svg>
            {progress !== null && (
              <span className={`text-[9px] font-semibold ${isOwn ? "text-white" : "text-gray-700"}`}>
                {progress}
              </span>
            )}
          </>
        ) : (
          <Icon size={18} style={{ color: isOwn ? "#ffffff" : color }} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${isOwn ? "text-white" : "text-gray-900"}`}>{filename}</p>
        <p className={`text-xs ${isOwn ? "text-white/70" : "text-gray-500"}`}>{label} Document</p>
      </div>
    </button>
  );
};
