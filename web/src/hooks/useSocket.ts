import io, { Socket } from "socket.io-client";
import { getSocketBaseURL } from "@/config/api.config";
import { ConversationType, ICommentThread, IConversationParticipant } from "@/types";
import { IDirectMessageRaw } from "@/services/directChat.service";
import { ICommunityPostRaw } from "@/services/community.service";

export type IRawMessagePayload = IDirectMessageRaw | ICommunityPostRaw;

let directSocket: Socket | null = null;
let groupSocket: Socket | null = null;
let communitySocket: Socket | null = null;

const NAMESPACE_OPTIONS = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ["websocket", "polling"] as ("websocket" | "polling")[],
};

const getToken = (): string => {
  const rawToken = localStorage.getItem("accessToken");
  return rawToken?.replace(/^Bearer\s+/i, "") || "";
};

/**
 * Initialize the three namespaced Socket.IO connections used by direct/group/community chat.
 * Each namespace requires its own JWT auth (the default namespace's io.use() does not cover named namespaces).
 */
export const initializeNamespaceSockets = (): void => {
  const base = getSocketBaseURL();
  const auth = { token: getToken() };

  if (!directSocket || !directSocket.connected) {
    directSocket = io(`${base}/direct`, { auth, ...NAMESPACE_OPTIONS });
  }
  if (!groupSocket || !groupSocket.connected) {
    groupSocket = io(`${base}/group`, { auth, ...NAMESPACE_OPTIONS });
  }
  if (!communitySocket || !communitySocket.connected) {
    communitySocket = io(`${base}/community`, { auth, ...NAMESPACE_OPTIONS });
  }
};

export const getSocketForType = (type: ConversationType): Socket | null => {
  if (type === "direct") return directSocket;
  if (type === "group") return groupSocket;
  return communitySocket;
};

export const disconnectNamespaceSockets = (): void => {
  directSocket?.disconnect();
  groupSocket?.disconnect();
  communitySocket?.disconnect();
  directSocket = null;
  groupSocket = null;
  communitySocket = null;
};

// ==================== ROOM MANAGEMENT ====================

/**
 * Join a conversation room. The server prefixes the room name itself
 * (direct:{id} / group:{id} / community:{id}) — emit the bare id only.
 */
export const joinConversationRoom = (type: ConversationType, id: string): void => {
  getSocketForType(type)?.emit("join", id);
};

export const leaveConversationRoom = (type: ConversationType, id: string): void => {
  getSocketForType(type)?.emit("leave", id);
};

const typingIdField: Record<ConversationType, string> = {
  direct: "chatId",
  group: "groupId",
  community: "communityId",
};

export const emitTyping = (
  type: ConversationType,
  id: string,
  isTyping: boolean,
  userName?: string,
): void => {
  getSocketForType(type)?.emit("typing", {
    [typingIdField[type]]: id,
    isTyping,
    userName,
  });
};

// ==================== LISTENERS ====================
// Sending/editing/deleting/liking messages happens over REST (see *.service.ts) — the
// REST handlers broadcast these same events server-side, so we only ever subscribe here.

type Unsubscribe = () => void;

const on = <T,>(
  type: ConversationType,
  event: string,
  callback: (data: T) => void,
): Unsubscribe => {
  const socket = getSocketForType(type);
  if (!socket) return () => {};
  socket.on(event, callback);
  return () => socket.off(event, callback);
};

export const onNewMessage = (type: ConversationType, callback: (message: IRawMessagePayload) => void): Unsubscribe => {
  const unsubMessage = on<IRawMessagePayload>(type, "message:created", callback);
  if (type !== "community") return unsubMessage;
  const unsubPost = on<IRawMessagePayload>(type, "post:created", callback);
  return () => {
    unsubMessage();
    unsubPost();
  };
};

export const onMessageEdited = (type: ConversationType, callback: (message: IRawMessagePayload) => void): Unsubscribe => {
  const unsubMessage = on<IRawMessagePayload>(type, "message:edited", callback);
  if (type !== "community") return unsubMessage;
  const unsubPost = on<IRawMessagePayload>(type, "post:edited", callback);
  return () => {
    unsubMessage();
    unsubPost();
  };
};

export const onMessageDeleted = (type: ConversationType, callback: (messageId: string) => void): Unsubscribe => {
  const unsubMessage = on<{ id?: string; messageId?: string }>(type, "message:deleted", (data) =>
    callback(data.messageId || data.id || ""),
  );
  if (type !== "community") return unsubMessage;
  const unsubPost = on<{ id?: string; postId?: string }>(type, "post:deleted", (data) =>
    callback(data.postId || data.id || ""),
  );
  return () => {
    unsubMessage();
    unsubPost();
  };
};

export const onMessageLiked = (
  type: ConversationType,
  callback: (data: { messageId: string; liked: boolean; likeCount: number; userId: string }) => void,
): Unsubscribe => {
  const unsubMessage = on(type, "message:liked", callback);
  if (type !== "community") return unsubMessage;
  const unsubPost = on(type, "post:liked", callback);
  return () => {
    unsubMessage();
    unsubPost();
  };
};

export const onMessageRead = (
  type: ConversationType,
  callback: (data: { messageId: string; userId: string; readAt: string }) => void,
): Unsubscribe => on(type, "message:read", callback);

export const onUserTyping = (
  type: ConversationType,
  callback: (data: { userId: string; isTyping: boolean; userName: string }) => void,
): Unsubscribe => on(type, "user:typing", callback);

export const onCommentAdded = (
  type: ConversationType,
  callback: (comment: ICommentThread) => void,
): Unsubscribe => on(type, "comment:created", callback);

export const onParticipantJoined = (
  type: ConversationType,
  callback: (participant: IConversationParticipant) => void,
): Unsubscribe => on(type, "participant:added", callback);

export const onParticipantLeft = (
  type: ConversationType,
  callback: (data: { userId: string }) => void,
): Unsubscribe => on(type, "participant:removed", callback);
