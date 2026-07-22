import {
  IConversation,
  IConversationParticipant,
  IMessage,
  IAttachment,
  ICommentThread,
  ConversationType,
} from "@/types";
import { IDirectChatRaw, IDirectMessageRaw } from "./directChat.service";
import { IGroupChatRaw, IGroupCommentRaw } from "./groupChat.service";
import { ICommunityRaw, ICommunityPostRaw, ICommunityCommentRaw } from "./community.service";
import { getBackendURL } from "@/config/api.config";

// ==================== ATTACHMENTS ====================

// Locally-stored uploads (video/audio saved to disk rather than Cloudinary) come back from the
// API as a root-relative path like "/uploads/videos/xxx.mp4". Left as-is, the browser resolves
// that against the frontend's own origin instead of the backend, so it must be made absolute here.
const resolveAttachmentUrl = (url: string): string =>
  url.startsWith("/") ? `${getBackendURL()}${url}` : url;

export const parseAttachments = (
  attachments?: string | null,
): IAttachment[] | null => {
  if (!attachments) return null;
  try {
    const parsed = JSON.parse(attachments);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((a: IAttachment) => ({ ...a, url: resolveAttachmentUrl(a.url) }));
  } catch {
    return null;
  }
};

export const stringifyAttachments = (
  attachments?: IAttachment[] | null,
): string | undefined => {
  if (!attachments || attachments.length === 0) return undefined;
  return JSON.stringify(attachments);
};

// ==================== MESSAGES ====================

export const normalizeMessage = (
  raw: IDirectMessageRaw,
  conversationId: string,
): IMessage => ({
  id: raw.id,
  conversationId,
  senderId: raw.senderId,
  sender: raw.sender
    ? { id: raw.sender.id, fullNames: raw.sender.fullNames, photo: raw.sender.photo || undefined }
    : undefined,
  type: (raw.type as IMessage["type"]) || "text",
  content: raw.isDeleted ? "[Deleted]" : raw.content,
  attachments: parseAttachments(raw.attachments),
  timestamp: raw.timestamp,
  editedAt: raw.editedAt,
  isEdited: !!raw.editedAt,
  likes: raw.likeCount,
  isLikedByMe: (raw.likes?.length || 0) > 0,
  readBy: raw.readCount ? [{ userId: "", readAt: raw.timestamp }] : [],
  offsetInConversation: raw.offsetInConversation,
});

export const normalizeCommunityPost = (
  raw: ICommunityPostRaw,
  communityId: string,
): IMessage => ({
  id: raw.id,
  conversationId: communityId,
  senderId: raw.authorId,
  sender: (() => {
    const authorInfo = raw.author || raw.sender;
    return authorInfo
      ? { id: authorInfo.id, fullNames: authorInfo.fullNames, photo: authorInfo.photo || undefined }
      : undefined;
  })(),
  type: "blog",
  title: raw.title,
  content: raw.content,
  attachments:
    parseAttachments(raw.attachments) ||
    (raw.photo ? [{ url: resolveAttachmentUrl(raw.photo), type: "image" as const }] : null),
  timestamp: raw.timestamp,
  likes: raw.likeCount,
  comments: raw.comments?.map((c) => normalizeCommentThread(c, raw.id)) || [],
  offsetInConversation: raw.offsetInConversation,
});

const normalizeCommentThread = (
  raw: IGroupCommentRaw | ICommunityCommentRaw,
  messageId: string,
): ICommentThread => ({
  id: raw.id,
  messageId,
  userId: raw.userId,
  text: raw.text,
  timestamp: raw.timestamp,
  parentId: raw.parentId,
  user: raw.user
    ? { id: raw.user.id, fullNames: raw.user.fullNames, photo: raw.user.photo || undefined }
    : undefined,
  replies: raw.replies?.map((r) => normalizeCommentThread(r, messageId)),
});

export const normalizeComment = normalizeCommentThread;

// ==================== CONVERSATIONS ====================

export const normalizeDirectChat = (
  raw: IDirectChatRaw,
  currentUserId: string,
): IConversation => {
  const otherUser = raw.userId1 === currentUserId ? raw.user2 : raw.user1;
  const otherUserId = raw.userId1 === currentUserId ? raw.userId2 : raw.userId1;

  const participant: IConversationParticipant = {
    conversationId: raw.id,
    userId: otherUserId,
    joinedAt: raw.createdAt,
    user: otherUser as IConversationParticipant["user"],
  };

  return {
    id: raw.id,
    type: "direct",
    name: raw.displayName || otherUser?.fullNames || "User",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastMessageId: raw.lastMessageId,
    participants: [participant],
    lastMessage: raw.lastMessage ? normalizeMessage(raw.lastMessage, raw.id) : null,
  };
};

export const normalizeGroupChat = (raw: IGroupChatRaw): IConversation => ({
  id: raw.id,
  type: "group",
  name: raw.name,
  photo: raw.photo,
  createdById: raw.createdById,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
  lastMessageId: raw.lastMessageId,
  participants: raw.participants.map((p) => ({
    conversationId: raw.id,
    userId: p.userId,
    joinedAt: p.joinedAt,
    user: p.user as IConversationParticipant["user"],
  })),
  lastMessage: raw.lastMessage ? normalizeMessage(raw.lastMessage, raw.id) : null,
});

export const normalizeCommunity = (raw: ICommunityRaw): IConversation => ({
  id: raw.id,
  type: "community",
  name: raw.name,
  photo: raw.photo,
  isPublic: raw.isPublic,
  createdById: raw.createdById,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
  lastMessageId: raw.lastPostId,
  participants: raw.members.map((m) => ({
    conversationId: raw.id,
    userId: m.userId,
    joinedAt: m.joinedAt,
    user: m.user as IConversationParticipant["user"],
  })),
  lastMessage: raw.lastPost ? normalizeCommunityPost(raw.lastPost, raw.id) : null,
});

export const normalizeConversation = (
  type: ConversationType,
  raw: IDirectChatRaw | IGroupChatRaw | ICommunityRaw,
  currentUserId: string,
): IConversation => {
  if (type === "direct") return normalizeDirectChat(raw as IDirectChatRaw, currentUserId);
  if (type === "group") return normalizeGroupChat(raw as IGroupChatRaw);
  return normalizeCommunity(raw as ICommunityRaw);
};
