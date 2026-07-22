import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBlockedUsers, blockUser, unblockUser } from "@/services/userRelation.service";

export const useBlockedUsers = () => {
  return useQuery(["blocked-users"], getBlockedUsers, {
    staleTime: 1000 * 60,
  });
};

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  return useMutation((userId: string) => blockUser(userId), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  return useMutation((userId: string) => unblockUser(userId), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
  });
};
