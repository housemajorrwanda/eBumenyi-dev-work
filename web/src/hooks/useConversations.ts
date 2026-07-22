import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IConversation, IMessage, ConversationType } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserDirectChats,
  getOrCreateDirectChat,
  updateDirectChat,
  muteDirectChat,
  getDirectChatMessages,
} from "@/services/directChat.service";
import {
  getUserGroups,
  createGroup,
  updateGroup,
  muteGroupChat,
  getGroupMessages,
} from "@/services/groupChat.service";
import {
  getUserCommunities,
  createCommunity,
  updateCommunity,
  muteCommunity,
  getCommunityPosts,
} from "@/services/community.service";
import {
  normalizeDirectChat,
  normalizeGroupChat,
  normalizeCommunity,
  normalizeMessage,
  normalizeCommunityPost,
} from "@/services/messaging.adapter";

/**
 * Hook to fetch all conversations (direct, group, community) for the current user
 */
export const useGetConversations = () => {
  const { user } = useAuth();

  const queryFn = async (): Promise<IConversation[]> => {
    const [directChats, groups, communities] = await Promise.all([
      getUserDirectChats(),
      getUserGroups(),
      getUserCommunities(),
    ]);

    return [
      ...directChats.map((c) => normalizeDirectChat(c, user?.id || "")),
      ...groups.map(normalizeGroupChat),
      ...communities.map(normalizeCommunity),
    ];
  };

  return useQuery(["conversations"], queryFn, {
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook to fetch messages for a conversation (dispatches by conversation type)
 */
export const useGetMessages = (
  conversationId: string | null,
  type: ConversationType | undefined,
  limit = 50,
  offset = 0,
) => {
  const queryFn = async (): Promise<IMessage[]> => {
    if (!conversationId || !type) return [];

    if (type === "direct") {
      const { data } = await getDirectChatMessages(conversationId, limit, offset);
      return data.map((m) => normalizeMessage(m, conversationId));
    }
    if (type === "group") {
      const { data } = await getGroupMessages(conversationId, limit, offset);
      return data.map((m) => normalizeMessage(m, conversationId));
    }
    const { data: posts } = await getCommunityPosts(conversationId, limit, offset);
    return posts.map((p) => normalizeCommunityPost(p, conversationId));
  };

  return useQuery(["messages", conversationId, type], queryFn, {
    enabled: !!conversationId && !!type,
    staleTime: 1000 * 30, // 30 seconds
    cacheTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to create a new conversation (direct, group, or community)
 */
export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutationFn = async (data: {
    type: ConversationType;
    name?: string;
    isPublic?: boolean;
    photo?: string;
    participantIds: string[];
  }): Promise<IConversation> => {
    if (data.type === "direct") {
      const otherUserId = data.participantIds[0];
      const chat = await getOrCreateDirectChat(otherUserId);
      return normalizeDirectChat(chat, user?.id || "");
    }
    if (data.type === "group") {
      const group = await createGroup({
        name: data.name || "Group",
        participantIds: data.participantIds,
        photo: data.photo,
      });
      return normalizeGroupChat(group);
    }
    const community = await createCommunity({
      name: data.name || "Community",
      isPublic: data.isPublic,
      participantIds: data.participantIds,
      photo: data.photo,
    });
    return normalizeCommunity(community);
  };

  return useMutation(mutationFn, {
    onSuccess: (newConversation) => {
      queryClient.setQueryData(["conversations"], (oldData: IConversation[] | undefined) => {
        return oldData ? [newConversation, ...oldData] : [newConversation];
      });
    },
  });
};

/**
 * Hook to update a conversation (dispatches by type)
 */
export const useUpdateConversation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutationFn = async (data: {
    conversationId: string;
    type: ConversationType;
    name?: string;
    isPublic?: boolean;
    photo?: string;
  }): Promise<IConversation> => {
    if (data.type === "direct") {
      const chat = await updateDirectChat(data.conversationId, {});
      return normalizeDirectChat(chat, user?.id || "");
    }
    if (data.type === "group") {
      const group = await updateGroup(data.conversationId, { name: data.name, photo: data.photo });
      return normalizeGroupChat(group);
    }
    const community = await updateCommunity(data.conversationId, {
      name: data.name,
      isPublic: data.isPublic,
      photo: data.photo,
    });
    return normalizeCommunity(community);
  };

  return useMutation(mutationFn, {
    onSuccess: (updatedConversation) => {
      queryClient.setQueryData(["conversations"], (oldData: IConversation[] | undefined) => {
        return oldData
          ? oldData.map((conv) => (conv.id === updatedConversation.id ? updatedConversation : conv))
          : [updatedConversation];
      });
    },
  });
};

/**
 * Hook to mute/unmute a conversation (dispatches by type)
 */
export const useMuteConversation = () => {
  const queryClient = useQueryClient();

  const mutationFn = async (data: {
    conversationId: string;
    type: ConversationType;
    muted: boolean;
  }): Promise<void> => {
    if (data.type === "direct") {
      await muteDirectChat(data.conversationId, data.muted);
    } else if (data.type === "group") {
      await muteGroupChat(data.conversationId, data.muted);
    } else {
      await muteCommunity(data.conversationId, data.muted);
    }
  };

  return useMutation(mutationFn, {
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["conversations"], (oldData: IConversation[] | undefined) =>
        oldData?.map((conv) =>
          conv.id === variables.conversationId ? { ...conv, muted: variables.muted } : conv,
        ),
      );
    },
  });
};

/**
 * Hook to invalidate conversations cache
 */
export const useInvalidateConversations = () => {
  const queryClient = useQueryClient();

  return {
    invalidateConversations: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    },
    invalidateMessages: (conversationId: string) =>
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    },
  };
};
