import React from "react";
import { Users } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { IConversation } from "@/types";
import { conversationAvatarColor, realPhoto, formatRelativeTime } from "./avatarStyles";

interface ConversationListItemProps {
  conversation: IConversation;
  isActive: boolean;
  isTyping?: boolean;
  isOnline?: boolean;
  unreadCount?: number;
  onClick: () => void;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isActive,
  isTyping,
  isOnline,
  unreadCount = 0,
  onClick,
}) => {
  const isDirect = conversation.type === "direct";
  const isGroup = conversation.type === "group";
  const isCommunity = conversation.type === "community";

  const displayName = isDirect
    ? conversation.participants[0]?.user?.fullNames || "User"
    : conversation.name || "Unnamed";

  const displayPhoto = isDirect ? conversation.participants[0]?.user?.photo : conversation.photo;

  const mediaPreviewLabel: Record<string, string> = {
    image: "📷 Photo",
    video: "🎥 Video",
    audio: "🎵 Audio",
    file: "📄 Document",
  };
  const lastMessagePreview = conversation.lastMessage
    ? conversation.lastMessage.content?.trim()
      ? conversation.lastMessage.content
      : mediaPreviewLabel[conversation.lastMessage.type] || "Message"
    : "";

  return (
    <div
      onClick={onClick}
      className={`mx-2 my-0.5 p-3 rounded-xl cursor-pointer transition-all duration-150 group ${
        isActive
          ? "bg-primary/10"
          : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with type indicator */}
        <div className="relative flex-shrink-0">
          <div className={`transition-transform duration-200 ${isActive ? "scale-105" : "group-hover:scale-105"}`}>
            <ProfileAvatar
              name={displayName}
              photo={realPhoto(displayPhoto)}
              size="w-12 h-12"
              color={conversationAvatarColor[conversation.type]}
            />
          </div>

          {/* Online/typing dot for direct */}
          {isDirect && (isOnline || isTyping) && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
              isTyping ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
            }`} />
          )}

          {/* Group badge */}
          {isGroup && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
              <Users size={8} className="text-white" />
            </div>
          )}

          {/* Community badge */}
          {isCommunity && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
              <FontAwesomeIcon icon={faUsers} style={{ fontSize: "8px" }} className="text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate transition-colors ${
              unreadCount > 0
                ? "font-bold text-gray-900"
                : isActive
                ? "font-semibold text-primary"
                : "font-semibold text-gray-800"
            }`}>
              {displayName}
            </p>
            {/* Timestamp */}
            {conversation.lastMessage && (
              <span className={`text-[11px] whitespace-nowrap flex-shrink-0 ${
                unreadCount > 0 ? "text-primary font-semibold" : "text-gray-400"
              }`}>
                {formatRelativeTime(conversation.lastMessage.timestamp)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Last message / typing indicator */}
            <div className="flex-1 min-w-0">
              {isTyping ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-primary font-medium italic">typing</span>
                  <div className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              ) : conversation.lastMessage ? (
                <p className={`text-xs truncate ${unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                  {isDirect
                    ? lastMessagePreview
                    : `${conversation.lastMessage.sender?.fullNames?.split(" ")[0] || "User"}: ${lastMessagePreview}`}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic">No messages yet</p>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {conversation.muted && (
                <span className="text-[10px] text-gray-400" title="Muted">🔕</span>
              )}
              {unreadCount > 0 && (
                <div className="min-w-[20px] h-5 px-1.5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-[10px] leading-none font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
