import api from "./api";
import { IDirectMessageRaw } from "./directChat.service";

// ==================== TYPES (raw backend shapes) ====================

export interface IGroupParticipantRaw {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user?: { id: string; fullNames: string; photo?: string | null };
}

export interface IGroupChatRaw {
  id: string;
  name: string;
  photo?: string | null;
  description?: string | null;
  lastMessageId?: string | null;
  createdById: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; fullNames: string; photo?: string | null };
  participants: IGroupParticipantRaw[];
  lastMessage?: IDirectMessageRaw | null;
}

export interface IGroupCommentRaw {
  id: string;
  messageId: string;
  userId: string;
  text: string;
  parentId?: string | null;
  timestamp: string;
  user?: { id: string; fullNames: string; photo?: string | null };
  replies?: IGroupCommentRaw[];
}

// ==================== CONVERSATIONS ====================

export const createGroup = async (data: {
  name: string;
  participantIds: string[];
  description?: string;
  photo?: string;
}): Promise<IGroupChatRaw> => {
  return (await api.post("/group-chats", data)).data;
};

export const getUserGroups = async (): Promise<IGroupChatRaw[]> => {
  return (await api.get("/group-chats")).data;
};

export const getGroupWithMessages = async (
  groupId: string,
): Promise<{ group: IGroupChatRaw; messages: IDirectMessageRaw[] }> => {
  return (await api.get(`/group-chats/${groupId}`)).data;
};

export const updateGroup = async (
  groupId: string,
  data: { name?: string; description?: string; photo?: string },
): Promise<IGroupChatRaw> => {
  return (await api.put(`/group-chats/${groupId}`, data)).data;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/group-chats/${groupId}`);
};

export const muteGroupChat = async (
  groupId: string,
  muted: boolean,
): Promise<{ id: string; conversationId: string; mutedAt?: string }> => {
  return (await api.put(`/group-chats/${groupId}/mute`, { muted })).data;
};

export const getGroupUnreadCounts = async (): Promise<{
  total: number;
  byGroup: Array<{ groupId: string; unreadCount: number }>;
}> => {
  return (await api.get("/group-chats/unread/counts")).data;
};

// ==================== PARTICIPANTS ====================

export const addGroupParticipant = async (
  groupId: string,
  userId: string,
): Promise<IGroupParticipantRaw> => {
  return (await api.post(`/group-chats/${groupId}/participants`, { userId }))
    .data;
};

export const removeGroupParticipant = async (
  groupId: string,
  userId: string,
): Promise<void> => {
  await api.delete(`/group-chats/${groupId}/participants/${userId}`);
};

// ==================== MESSAGES ====================

export const getGroupMessages = async (
  groupId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ data: IDirectMessageRaw[]; total: number }> => {
  return (
    await api.get(
      `/group-chats/${groupId}/messages?limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const searchGroupMessages = async (
  groupId: string,
  q: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ data: IDirectMessageRaw[]; total: number }> => {
  return (
    await api.get(
      `/group-chats/${groupId}/messages/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const sendGroupMessage = async (
  groupId: string,
  data: { content: string; type?: string; attachments?: string },
): Promise<IDirectMessageRaw> => {
  return (await api.post(`/group-chats/${groupId}/messages`, data)).data;
};

export const editGroupMessage = async (
  groupId: string,
  messageId: string,
  content: string,
): Promise<IDirectMessageRaw> => {
  return (
    await api.put(`/group-chats/${groupId}/messages/${messageId}`, {
      content,
    })
  ).data;
};

export const deleteGroupMessage = async (
  groupId: string,
  messageId: string,
): Promise<void> => {
  await api.delete(`/group-chats/${groupId}/messages/${messageId}`);
};

export const markGroupMessageRead = async (
  groupId: string,
  messageId: string,
): Promise<{ messageId: string; userId: string; readAt: string }> => {
  return (
    await api.post(`/group-chats/${groupId}/messages/${messageId}/read`, {})
  ).data;
};

export const toggleGroupMessageLike = async (
  groupId: string,
  messageId: string,
): Promise<{ messageId: string; liked: boolean; likeCount: number }> => {
  return (
    await api.post(`/group-chats/${groupId}/messages/${messageId}/like`, {})
  ).data;
};

// ==================== COMMENTS ====================

export const getGroupMessageComments = async (
  messageId: string,
): Promise<IGroupCommentRaw[]> => {
  return (await api.get(`/group-chats/messages/${messageId}/comments`)).data;
};

export const addGroupMessageComment = async (
  messageId: string,
  data: { text: string; parentId?: string },
): Promise<IGroupCommentRaw> => {
  return (
    await api.post(`/group-chats/messages/${messageId}/comments`, data)
  ).data;
};

export const editGroupComment = async (
  commentId: string,
  text: string,
): Promise<IGroupCommentRaw> => {
  return (await api.put(`/group-chats/comments/${commentId}`, { text }))
    .data;
};

export const deleteGroupComment = async (commentId: string): Promise<void> => {
  await api.delete(`/group-chats/comments/${commentId}`);
};
