import api from "./api";

export interface IBlockedUserRaw {
  id: string;
  createdAt: string;
  user: {
    id: string;
    fullNames: string;
    photo?: string | null;
    phoneNumber?: string | null;
  };
}

export const blockUser = async (userId: string): Promise<void> => {
  await api.post(`/users/block/${userId}`);
};

export const unblockUser = async (userId: string): Promise<void> => {
  await api.delete(`/users/block/${userId}`);
};

export const getBlockedUsers = async (): Promise<IBlockedUserRaw[]> => {
  return (await api.get("/users/blocked")).data;
};
