import React, { useState } from "react";
import { CheckCheck, Heart, Copy, Pencil, Trash2, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { IMessage } from "@/types";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { realPhoto } from "./avatarStyles";
import { MessageMedia } from "./media/MessageMedia";

interface MessageBubbleProps {
  message: IMessage;
  isOwn: boolean;
  isGroup: boolean;
  isDirect: boolean;
  senderName: string;
  ownPhotoUrl?: string | null;
  isEditing: boolean;
  editingContent: string;
  onEditingContentChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  /** Briefly rings the bubble — used to draw attention after jumping here from a search result. */
  highlighted?: boolean;
  /** When set, wraps matching text in a yellow highlight inside the bubble. */
  highlightText?: string;
  /** True when this bubble is the currently focused search match (stronger ring). */
  isCurrentMatch?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isGroup,
  isDirect,
  senderName,
  ownPhotoUrl,
  isEditing,
  editingContent,
  onEditingContentChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleLike,
  highlighted,
  highlightText,
  isCurrentMatch,
}) => {
  const [hovered, setHovered] = useState(false);

  // Highlights matching substring inside message text
  const renderHighlighted = (text: string): React.ReactNode => {
    if (!highlightText?.trim()) return text;
    const idx = text.toLowerCase().indexOf(highlightText.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-300 text-gray-900 rounded px-0.5">{text.slice(idx, idx + highlightText.length)}</mark>
        {text.slice(idx + highlightText.length)}
      </>
    );
  };

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const showEditDelete = isOwn;
  const isRead = (message.readBy?.length || 0) > 0;
  const attachment = message.attachments?.[0];
  const isEdgeToEdgeMedia = !isEditing && !!attachment && (message.type === "image" || message.type === "video");
  const isCompactMedia = !isEditing && !!attachment && (message.type === "audio" || message.type === "file");

  const timeLabel = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const likesBadge = (message.likes || 0) > 0 && (
    <span className="flex items-center gap-0.5">
      <Heart size={11} className="fill-current text-red-400" />
      {message.likes}
    </span>
  );

  return (
    <div
      id={`message-${message.id}`}
      className={`flex items-end gap-2 group ${isOwn ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Sender avatar (group / non-own) */}
      {!isOwn && !isDirect && (
        <ProfileAvatar
          name={senderName}
          photo={realPhoto(message.sender?.photo)}
          size="w-8 h-8"
          className="text-xs flex-shrink-0 mb-1 ring-2 ring-white shadow-sm"
          color="bg-gradient-to-br from-gray-400 to-gray-600 text-white"
        />
      )}

      <div className={`flex items-center gap-1.5 max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        {/* Bubble */}
        <div className="flex flex-col">
          {!isOwn && isGroup && (
            <span className="text-[11px] font-semibold text-primary/80 mb-1 ml-3">
              {message.sender?.fullNames || "User"}
            </span>
          )}
          <div
            className={`
              relative rounded-2xl shadow-sm overflow-hidden transition-all duration-300
              ${isEdgeToEdgeMedia ? "w-64" : "max-w-xs lg:max-w-md xl:max-w-lg"}
              ${isOwn
                ? "bg-gradient-to-br from-[#3363AD] to-[#2952a3] text-white rounded-br-sm"
                : "bg-white text-gray-900 border border-gray-100 rounded-bl-sm"
              }
              ${isEditing || (!isEdgeToEdgeMedia && !isCompactMedia) ? "px-4 py-2.5" : ""}
              ${isCompactMedia ? "p-2.5" : ""}
              ${isCurrentMatch ? "ring-2 ring-amber-400 ring-offset-1" : highlighted ? "ring-4 ring-yellow-300 ring-offset-1" : highlightText && message.content?.toLowerCase().includes(highlightText.toLowerCase()) ? "ring-2 ring-yellow-200" : ""}
            `}
          >
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => onEditingContentChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={onCancelEdit}
                    className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={onSaveEdit}
                    className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                    title="Save"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : message.type === "text" ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderHighlighted(message.content || "")}
              </p>
            ) : isEdgeToEdgeMedia && attachment ? (
              <div className="relative">
                <MessageMedia attachment={attachment} variant="bubble" messageId={message.id} isOwn={isOwn} />
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-0.5">
                  {likesBadge && <span className="text-[10px] text-white">{likesBadge}</span>}
                  <span className="text-[10px] text-white flex items-center gap-1">
                    {timeLabel}
                    {isOwn && (
                      <CheckCheck size={11} className={isRead ? "text-[#34B7F1]" : "text-white/70"} />
                    )}
                  </span>
                </div>
                {message.content && (
                  <p className="text-sm px-3 pt-2 pb-1">{message.content}</p>
                )}
              </div>
            ) : (
              attachment && <MessageMedia attachment={attachment} variant="bubble" messageId={message.id} isOwn={isOwn} />
            )}
          </div>

          {/* Timestamp + read receipt outside bubble */}
          {!isEditing && !isEdgeToEdgeMedia && (
            <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {likesBadge && <span className="text-xs text-gray-400 flex items-center gap-0.5">{likesBadge}</span>}
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                {message.isEdited && (
                  <span className="italic">Edited ·</span>
                )}
                {timeLabel}
                {isOwn && (
                  <CheckCheck size={12} className={isRead ? "text-[#34B7F1]" : "text-gray-300"} />
                )}
              </span>
            </div>
          )}
        </div>

        {/* Hover action toolbar */}
        {!isEditing && hovered && (
          <div
            className={`flex items-center gap-0.5 bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-lg px-1.5 py-1 flex-shrink-0 animate-fade-in`}
          >
            <button
              onClick={onToggleLike}
              className={`p-1.5 rounded-xl transition-all duration-200 ${
                message.isLikedByMe
                  ? "text-red-500 bg-red-50"
                  : "text-gray-400 hover:text-red-500 hover:bg-red-50"
              }`}
              title={message.isLikedByMe ? "Unlike" : "Like"}
            >
              <Heart size={14} className={message.isLikedByMe ? "fill-current" : ""} />
            </button>
            {message.type === "text" && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-200"
                title="Copy"
              >
                <Copy size={14} />
              </button>
            )}
            {showEditDelete && message.type === "text" && (
              <button
                onClick={onStartEdit}
                className="p-1.5 rounded-xl text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all duration-200"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            )}
            {showEditDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Own avatar for group messages */}
      {isOwn && !isDirect && (
        <ProfileAvatar
          name={senderName}
          photo={realPhoto(ownPhotoUrl)}
          size="w-8 h-8"
          className="text-xs flex-shrink-0 mb-1 ring-2 ring-white shadow-sm"
          color="bg-primary text-white"
        />
      )}
    </div>
  );
};
