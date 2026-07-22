import api from "./api";

// ==================== TYPES (raw backend shapes) ====================

export interface ICommunityMemberRaw {
  id: string;
  communityId: string;
  userId: string;
  role: string;
  joinedAt: string;
  lastVisitedAt?: string | null;
  user?: { id: string; fullNames: string; photo?: string | null };
}

export interface ICommunityPostRaw {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  content: string;
  photo?: string | null;
  attachments?: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  reshareCount: number;
  resharedFromId?: string | null;
  timestamp: string;
  // getCommunityPosts renames the joined `author` relation to `sender`; createPost/lastPost
  // keep it as `author` — accept either so posts render correctly regardless of source.
  author?: { id: string; fullNames: string; photo?: string | null } | null;
  sender?: { id: string; fullNames: string; photo?: string | null } | null;
  likes?: Array<{ id: string }>;
  offsetInConversation?: number;
  comments?: ICommunityCommentRaw[];
}

export interface ICommunityRaw {
  id: string;
  name: string;
  description?: string | null;
  photo?: string | null;
  lastPostId?: string | null;
  createdById: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; fullNames: string; photo?: string | null };
  members: ICommunityMemberRaw[];
  lastPost?: ICommunityPostRaw | null;
}

export interface ICommunityCommentRaw {
  id: string;
  postId: string;
  userId: string;
  text: string;
  parentId?: string | null;
  timestamp: string;
  user?: { id: string; fullNames: string; photo?: string | null };
  replies?: ICommunityCommentRaw[];
}

// ==================== COMMUNITIES ====================

export const createCommunity = async (data: {
  name: string;
  description?: string;
  photo?: string;
  isPublic?: boolean;
  participantIds?: string[];
}): Promise<ICommunityRaw> => {
  return (await api.post("/communities", data)).data;
};

export const getUserCommunities = async (): Promise<ICommunityRaw[]> => {
  return (await api.get("/communities")).data;
};

export const getPublicCommunities = async (
  limit: number = 20,
  offset: number = 0,
): Promise<ICommunityRaw[]> => {
  return (
    await api.get(`/communities/public?limit=${limit}&offset=${offset}`)
  ).data;
};

export const getCommunityWithPosts = async (
  communityId: string,
): Promise<{ community: ICommunityRaw; posts: ICommunityPostRaw[] }> => {
  return (await api.get(`/communities/${communityId}`)).data;
};

export const updateCommunity = async (
  communityId: string,
  data: { name?: string; description?: string; photo?: string; isPublic?: boolean },
): Promise<ICommunityRaw> => {
  return (await api.put(`/communities/${communityId}`, data)).data;
};

export const deleteCommunity = async (communityId: string): Promise<void> => {
  await api.delete(`/communities/${communityId}`);
};

export const muteCommunity = async (
  communityId: string,
  muted: boolean,
): Promise<{ id: string; conversationId: string; mutedAt?: string }> => {
  return (await api.put(`/communities/${communityId}/mute`, { muted })).data;
};

export const getCommunityUnreadCounts = async (): Promise<{
  total: number;
  byCommunity: Array<{ communityId: string; unreadCommentCount: number }>;
}> => {
  return (await api.get("/communities/unread/counts")).data;
};

export const markCommunityAsVisited = async (
  communityId: string,
): Promise<void> => {
  await api.post(`/communities/${communityId}/visit`, {});
};

// ==================== MEMBERS ====================

export const addCommunityMember = async (
  communityId: string,
  userId: string,
): Promise<ICommunityMemberRaw> => {
  return (await api.post(`/communities/${communityId}/members`, { userId }))
    .data;
};

export const removeCommunityMember = async (
  communityId: string,
  userId: string,
): Promise<void> => {
  await api.delete(`/communities/${communityId}/members/${userId}`);
};

// ==================== POSTS ====================

export const getCommunityPosts = async (
  communityId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ data: ICommunityPostRaw[]; total: number }> => {
  return (
    await api.get(
      `/communities/${communityId}/posts?limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const searchCommunityPosts = async (
  communityId: string,
  q: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ data: ICommunityPostRaw[]; total: number }> => {
  return (
    await api.get(
      `/communities/${communityId}/posts/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    )
  ).data;
};

export const createCommunityPost = async (
  communityId: string,
  data: { title: string; content: string; photo?: string; attachments?: string },
): Promise<ICommunityPostRaw> => {
  return (await api.post(`/communities/${communityId}/posts`, data)).data;
};

export const editCommunityPost = async (
  communityId: string,
  postId: string,
  data: { title: string; content: string },
): Promise<ICommunityPostRaw> => {
  return (
    await api.put(`/communities/${communityId}/posts/${postId}`, data)
  ).data;
};

export const deleteCommunityPost = async (
  communityId: string,
  postId: string,
): Promise<void> => {
  await api.delete(`/communities/${communityId}/posts/${postId}`);
};

export const togglePostLike = async (
  communityId: string,
  postId: string,
): Promise<{ postId: string; liked: boolean; likeCount: number }> => {
  return (
    await api.post(`/communities/${communityId}/posts/${postId}/like`, {})
  ).data;
};

export const markPostAsVisited = async (
  communityId: string,
  postId: string,
): Promise<void> => {
  await api.post(`/communities/${communityId}/posts/${postId}/visit`, {});
};

export const toggleSavePost = async (
  communityId: string,
  postId: string,
): Promise<{ postId: string; saved: boolean }> => {
  return (
    await api.post(`/communities/${communityId}/posts/${postId}/save`, {})
  ).data;
};

export const resharePost = async (
  communityId: string,
  postId: string,
): Promise<ICommunityPostRaw> => {
  return (
    await api.post(`/communities/${communityId}/posts/${postId}/reshare`, {})
  ).data;
};

export const getSavedPosts = async (): Promise<ICommunityPostRaw[]> => {
  return (await api.get("/communities/saved")).data;
};

// ==================== COMMENTS ====================

export const getPostComments = async (
  postId: string,
): Promise<ICommunityCommentRaw[]> => {
  return (await api.get(`/communities/posts/${postId}/comments`)).data;
};

export const addPostComment = async (
  postId: string,
  data: { text: string; parentId?: string },
): Promise<ICommunityCommentRaw> => {
  return (await api.post(`/communities/posts/${postId}/comments`, data)).data;
};

export const editCommunityComment = async (
  commentId: string,
  text: string,
): Promise<ICommunityCommentRaw> => {
  return (await api.put(`/communities/comments/${commentId}`, { text })).data;
};

export const deleteCommunityComment = async (
  commentId: string,
): Promise<void> => {
  await api.delete(`/communities/comments/${commentId}`);
};
