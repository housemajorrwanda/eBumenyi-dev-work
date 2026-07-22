import React from "react";
import { Search, Info, ArrowLeft, Phone, Video } from "lucide-react";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { IConversation } from "@/types";
import { conversationAvatarColor, conversationBadgeColor, realPhoto } from "./avatarStyles";

interface ChatHeaderProps {
  conversation: IConversation;
  isOnline?: boolean;
  onBack?: () => void;
  onToggleSearch: () => void;
  searchOpen?: boolean;
  onToggleInfo: () => void;
  infoOpen: boolean;
}

const typeLabel: Record<IConversation["type"], string> = {
  direct: "Direct message",
  group: "Group",
  community: "Community",
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  isOnline,
  onBack,
  onToggleSearch,
  searchOpen,
  onToggleInfo,
  infoOpen,
}) => {
  const isDirect = conversation.type === "direct";
  const displayName = isDirect
    ? conversation.participants[0]?.user?.fullNames || "User"
    : conversation.name || "Unnamed";
  const displayPhoto = isDirect ? conversation.participants[0]?.user?.photo : conversation.photo;

  return (
    <div className="relative flex items-center justify-between flex-shrink-0 min-h-[72px] px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
      {/* Left: back + avatar + name */}
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-1 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-200"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="ring-2 ring-white shadow-md rounded-full">
            <ProfileAvatar
              name={displayName}
              photo={realPhoto(displayPhoto)}
              size="w-11 h-11"
              color={conversationAvatarColor[conversation.type]}
            />
          </div>
          {isDirect && isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
          )}
        </div>

        {/* Name & status */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate text-[15px] leading-tight">{displayName}</p>
            {!isDirect && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${conversationBadgeColor[conversation.type]}`}>
                {typeLabel[conversation.type]}
              </span>
            )}
          </div>
          <p className={`text-xs truncate font-medium leading-tight mt-0.5 ${
            isDirect && isOnline ? "text-emerald-500" : "text-gray-400"
          }`}>
            {isDirect
              ? isOnline === undefined
                ? "Direct message"
                : isOnline
                ? "● Online"
                : "● Offline"
              : `${conversation.participants.length} members`}
          </p>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Search button */}
        <button
          onClick={onToggleSearch}
          title="Search in conversation"
          className={`p-2 rounded-xl transition-all duration-200 ${
            searchOpen
              ? "bg-primary/15 text-primary"
              : "text-gray-400 hover:text-primary hover:bg-primary/10"
          }`}
        >
          <Search size={18} />
        </button>

        {/* Call button — placeholder, no calling infra yet */}
        <button
          title="Voice call (coming soon)"
          className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all duration-200 cursor-not-allowed opacity-60"
          disabled
        >
          <Phone size={18} />
        </button>

        {/* Video button — placeholder */}
        <button
          title="Video call (coming soon)"
          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all duration-200 cursor-not-allowed opacity-60"
          disabled
        >
          <Video size={18} />
        </button>

        {/* Info / participant panel */}
        <button
          onClick={onToggleInfo}
          title="Conversation info"
          className={`p-2 rounded-xl transition-all duration-200 ${
            infoOpen
              ? "bg-primary/15 text-primary"
              : "text-gray-400 hover:text-primary hover:bg-primary/10"
          }`}
        >
          <Info size={18} />
        </button>
      </div>
    </div>
  );
};
