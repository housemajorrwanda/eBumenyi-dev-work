import React, { useRef, useState } from "react";
import { Paperclip, Send, Mic, X, FileText, Smile } from "lucide-react";
import toast from "react-hot-toast";
import { uploadFileByType, uploadAudio } from "@/services/uploader.api";
import { IAttachment } from "@/types";
import { VoiceRecorderBar } from "./VoiceRecorderBar";

interface StagedFile {
  file: File;
  previewUrl?: string;
  status: "pending" | "uploading" | "done" | "error";
}

interface MessageComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: (attachments: IAttachment[]) => void;
  placeholder?: string;
}

const attachmentTypeFor = (mime: string): IAttachment["type"] => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "Write your message...",
}) => {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: StagedFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl:
        file.type.startsWith("image/") || file.type.startsWith("video/")
          ? URL.createObjectURL(file)
          : undefined,
      status: "pending",
    }));
    setStaged((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeStaged = (index: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAndBuildAttachment = async (file: File): Promise<IAttachment> => {
    const res = file.type.startsWith("audio/")
      ? await uploadAudio(file, file.name)
      : await uploadFileByType(file);
    if (!res.data) throw new Error("Upload failed");
    return { url: res.data.url, type: attachmentTypeFor(file.type), name: file.name };
  };

  const clearTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        clearTimer();
        setIsRecording(false);
        setIsPaused(false);

        if (discardRef.current) {
          setElapsedSeconds(0);
          recordedChunksRef.current = [];
          return;
        }

        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
        setElapsedSeconds(0);
        try {
          const attachment = await uploadAndBuildAttachment(file);
          onSend([attachment]);
        } catch (error) {
          console.error("Voice note upload failed:", error);
          toast.error("Failed to send voice message");
        }
      };
      mediaRecorderRef.current = recorder;
      discardRef.current = false;
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      clearTimer();
      timerIntervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const handleCancelRecording = () => {
    discardRef.current = true;
    mediaRecorderRef.current?.stop();
  };

  const handleTogglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
      clearTimer();
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
  };

  const handleSendRecording = () => {
    discardRef.current = false;
    mediaRecorderRef.current?.stop();
  };

  const handleSend = async () => {
    if (!value.trim() && staged.length === 0) return;
    if (isUploading) return;

    let attachments: IAttachment[] = [];
    if (staged.length > 0) {
      setIsUploading(true);
      try {
        attachments = await Promise.all(staged.map((s) => uploadAndBuildAttachment(s.file)));
      } catch (error) {
        console.error("Attachment upload failed:", error);
        toast.error("Failed to upload attachment");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    setStaged([]);
    onSend(attachments);
  };

  const canSend = (value.trim().length > 0 || staged.length > 0) && !isUploading;

  return (
    <div className="bg-white border-t border-gray-100 flex-shrink-0 px-4 py-3">
      {/* Staged file previews */}
      {!isRecording && staged.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3 p-2 bg-gray-50 rounded-2xl border border-gray-100">
          {staged.map((s, i) => (
            <div key={i} className="relative group/staged">
              {s.previewUrl && s.file.type.startsWith("video/") ? (
                <video src={s.previewUrl} muted className="w-16 h-16 object-cover rounded-xl border border-gray-200 shadow-sm" />
              ) : s.previewUrl ? (
                <img src={s.previewUrl} alt={s.file.name} className="w-16 h-16 object-cover rounded-xl border border-gray-200 shadow-sm" />
              ) : (
                <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 px-1 shadow-sm">
                  <FileText size={18} className="text-primary/70" />
                  <span className="text-[9px] truncate max-w-full text-center">{s.file.name}</span>
                </div>
              )}
              <button
                onClick={() => removeStaged(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {isRecording && streamRef.current ? (
          <VoiceRecorderBar
            stream={streamRef.current}
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onCancel={handleCancelRecording}
            onTogglePause={handleTogglePause}
            onSend={handleSendRecording}
          />
        ) : (
          <>
            {/* Attach file button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-200 flex-shrink-0"
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            {/* Text input area */}
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 min-w-0 focus-within:border-primary/40 focus-within:bg-white focus-within:shadow-sm transition-all duration-200">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent border-none focus:outline-none text-sm text-gray-800 placeholder:text-gray-400"
              />
              {/* Emoji button (visual placeholder) */}
              <button
                className="p-0.5 text-gray-300 hover:text-amber-400 transition-colors flex-shrink-0"
                title="Emoji (coming soon)"
                type="button"
              >
                <Smile size={18} />
              </button>
            </div>

            {/* Mic or Send button */}
            {canSend ? (
              <button
                onClick={handleSend}
                disabled={isUploading}
                className="w-11 h-11 bg-gradient-to-br from-primary to-[#2952a3] text-white rounded-2xl hover:from-primary/90 hover:to-[#2952a3]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 flex-shrink-0"
                title="Send"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-11 h-11 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
                title="Record voice message"
              >
                <Mic size={20} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
