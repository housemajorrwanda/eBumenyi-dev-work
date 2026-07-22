import api from "./api";

// ==================== TYPES (raw backend shapes) ====================

export interface IDirectChatRaw {
  id: string;
  userId1: string;
  userId2: string;
  lastMessageId?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  user1: { id: string; fullNames: string; photo?: string | null };
  user2: { id: string; fullNames: string; photo?: string | null };
  lastMessage?: IDirectMessageRaw | null;
  displayName?: string;
  displayPhoto?: string | null;
  otherUserId?: string;
  unreadCount?: number;
  lastMessageSender?: "me" | "other" | null;
  isDelivered?: boolean;
  isRead?: boolean;
}

export interface IDirectChatDetailRaw extends Omit<IDirectChatRaw, "user1" | "user2"> {
  user1: IDirectChatRaw["user1"] & { email?: string | null; phoneNumber?: string | null; bio?: string | null };
  user2: IDirectChatRaw["user1"] & { email?: string | null; phoneNumber?: string | null; bio?: string | null };
  otherUserId: string;
}

export interface IDirectMessageRaw {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: string | null;
  isDeleted: boolean;
  editedAt?: string | null;
  readCount: number;
  likeCount: number;
  timestamp: string;
  sender?: { id: string; fullNames: string; photo?: string | null };
  likes?: Array<{ id: string }>;
  offsetInConversation?: number;
}

// ==================== CONVERSATIONS ====================

export const getOrCreateDirectChat = async (
  otherUserId: string,
): Promise<IDirectChatRaw> => {
  return (await api.post("/direct-chats", { otherUserId })).data;
};

export const getUserDirectChats = async (): Promise<IDirectChatRaw[]> => {
  return (await api.get("/direct-chats")).data;
};

export const getDirectChatWithMessages = async (
  chatId: string,
): Promise<{ chat: IDirectChatDetailRaw; messages: IDirectMessageRaw[] }> => {
  return (await api.get(`/direct-chats/${chatId}`)).data;
};

export const updateDirectChat = async (
  chatId: string,
  data: { isArchived?: boolean },
): Promise<IDirectChatRaw> => {
  return (await api.put(`/direct-chats/${chatId}`, data)).data;
};

export const muteDirectChat = async (
  chatId: string,
  muted: boolean,
): Promise<{ id: string; conversationId: string; mutedAt?: string }> => {
  return (await api.put(`/direct-chats/${chatId}/mute`, { muted })).data;
};

export const getDirectChatUnreadCounts = async (): Promise<{
  total: number;
  byChat: Array<{ chatId: string; unreadCount: number }>;
}> => {
  return (await api.get("/direct-chats/unread/counts")).data;
};

export const getUnreadMessagesInDirectChat = async (
  chatId: string,
): Promise<IDirectMessageRaw[]> => {
  return (await api.get(`/direct-chats/${chatId}/unread`)).data;
};

// ==================== MESSAGES ====================

export const getDirectChatMessages = async (
  chatId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ data: IDirectMessageRaw[]; total: number }> => {
  return (
    await api.get(
      `/direct-chats/${chatId}/messages?limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const searchDirectChatMessages = async (
  chatId: string,
  q: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ data: IDirectMessageRaw[]; total: number }> => {
  return (
    await api.get(
      `/direct-chats/${chatId}/messages/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const sendDirectMessage = async (
  chatId: string,
  data: { content: string; type?: string; attachments?: string },
): Promise<IDirectMessageRaw> => {
  return (await api.post(`/direct-chats/${chatId}/messages`, data)).data;
};

export const editDirectMessage = async (
  chatId: string,
  messageId: string,
  content: string,
): Promise<IDirectMessageRaw> => {
  return (
    await api.put(`/direct-chats/${chatId}/messages/${messageId}`, {
      content,
    })
  ).data;
};

export const deleteDirectMessage = async (
  chatId: string,
  messageId: string,
): Promise<void> => {
  await api.delete(`/direct-chats/${chatId}/messages/${messageId}`);
};

export const markDirectMessageRead = async (
  chatId: string,
  messageId: string,
): Promise<{ messageId: string; userId: string; readAt: string }> => {
  return (
    await api.post(`/direct-chats/${chatId}/messages/${messageId}/read`, {})
  ).data;
};

export const toggleDirectMessageLike = async (
  chatId: string,
  messageId: string,
): Promise<{ messageId: string; liked: boolean; likeCount: number }> => {
  return (
    await api.post(`/direct-chats/${chatId}/messages/${messageId}/like`, {})
  ).data;
};
