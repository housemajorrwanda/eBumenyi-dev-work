import { useQuery } from "@tanstack/react-query";
import { getDirectChatUnreadCounts } from "@/services/directChat.service";
import { getGroupUnreadCounts } from "@/services/groupChat.service";
import { getCommunityUnreadCounts } from "@/services/community.service";

interface UnreadCounts {
  unreadByConversationId: Record<string, number>;
  totalUnread: number;
}

/**
 * Combined unread state across direct chats, groups, and communities.
 * Community "unread" counts new comments since last visit, not new posts —
 * it's still a meaningful "you have something new here" signal for the badge.
 */
export const useUnreadCounts = () => {
  return useQuery(
    ["unread-counts"],
    async (): Promise<UnreadCounts> => {
      // Settle independently — a failure fetching one conversation type shouldn't
      // silently zero out unread badges for the other two.
      const [direct, groups, communities] = await Promise.allSettled([
        getDirectChatUnreadCounts(),
        getGroupUnreadCounts(),
        getCommunityUnreadCounts(),
      ]);

      const unreadByConversationId: Record<string, number> = {};
      let totalUnread = 0;

      if (direct.status === "fulfilled") {
        direct.value.byChat.forEach((c) => {
          unreadByConversationId[c.chatId] = c.unreadCount;
        });
        totalUnread += direct.value.total;
      }
      if (groups.status === "fulfilled") {
        groups.value.byGroup.forEach((g) => {
          unreadByConversationId[g.groupId] = g.unreadCount;
        });
        totalUnread += groups.value.total;
      }
      if (communities.status === "fulfilled") {
        communities.value.byCommunity.forEach((c) => {
          unreadByConversationId[c.communityId] = c.unreadCommentCount;
        });
        totalUnread += communities.value.total;
      }

      return { unreadByConversationId, totalUnread };
    },
    {
      staleTime: 1000 * 30,
      cacheTime: 1000 * 60 * 5,
    }
  );
};
