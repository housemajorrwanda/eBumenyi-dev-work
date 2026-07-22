import { ConversationType } from "@/types";

// The backend defaults User.photo to a generic placeholder silhouette — treat that as
// "no photo" so avatars fall back to colored initials instead of showing the same
// generic icon for every user without a real profile picture.
const DEFAULT_PLACEHOLDER_MARKER = "premium-vector/user-profile-icon";

export const realPhoto = (photo?: string | null): string | undefined =>
  photo && !photo.includes(DEFAULT_PLACEHOLDER_MARKER) ? photo : undefined;

export const conversationAvatarColor: Record<ConversationType, string> = {
  direct: "bg-primary text-white",
  group: "bg-green-500 text-white",
  community: "bg-purple-500 text-white",
};

export const conversationBadgeColor: Record<ConversationType, string> = {
  direct: "bg-blue-100 text-blue-800",
  group: "bg-green-100 text-green-800",
  community: "bg-purple-100 text-purple-800",
};

// Minutes are unprefixed ("3 minutes ago"), hours are prefixed with "about"
// ("about 2 hours ago") — matches the reference design's exact wording per scale.
export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
