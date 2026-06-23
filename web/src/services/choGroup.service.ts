import api from "./api";
import {
  ICHOGroup,
  ICHOGroupMember,
  ICHOGroupMonitoring,
  IStudentSearchResult,
} from "@/types";

export interface ICHOGroupDetail extends ICHOGroup {
  members: ICHOGroupMember[];
}

// ─── CHO: own group ──────────────────────────────────────────────────────────

export const getMyGroup = async (): Promise<ICHOGroup> => {
  const res = await api.get("/cho-groups/mine");
  return res.data.data;
};

export const getMyGroupMembers = async (): Promise<ICHOGroupMember[]> => {
  const res = await api.get("/cho-groups/mine/members");
  return res.data.data;
};

export const getGroupMonitoring = async (): Promise<ICHOGroupMonitoring> => {
  const res = await api.get("/cho-groups/mine/monitoring");
  return res.data.data;
};

// ─── CHO: add / remove members (no invitation needed) ────────────────────────

export const choDirectlyAddMember = async (targetStudentId: string): Promise<ICHOGroupMember> => {
  const res = await api.post("/cho-groups/mine/members", { targetStudentId });
  return res.data.data;
};

export const choRemoveMyMember = async (studentId: string): Promise<void> => {
  await api.delete(`/cho-groups/mine/members/${studentId}`);
};

// ─── CHO: search CHW candidates in same area (max 10) ────────────────────────

export const searchCHWCandidates = async (search?: string): Promise<IStudentSearchResult[]> => {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await api.get(`/cho-groups/mine/chw-candidates${params}`);
  return res.data.data ?? [];
};

// ─── Admin: groups CRUD ───────────────────────────────────────────────────────

export const adminGetAllGroups = async (
  limit = 20,
  offset = 0,
): Promise<{ groups: ICHOGroup[]; total: number }> => {
  const res = await api.get(`/cho-groups/?limit=${limit}&offset=${offset}`);
  return res.data.data;
};

export const adminCreateGroup = async (data: {
  name: string;
  choStudentId: string;
  sectors?: string[];
  cells?: string[];
  villages?: string[];
  description?: string;
}): Promise<ICHOGroup> => {
  const res = await api.post("/cho-groups/", data);
  return res.data.data;
};

export const adminGetGroupById = async (groupId: string): Promise<ICHOGroupDetail> => {
  const res = await api.get(`/cho-groups/${groupId}`);
  return res.data.data;
};

export const adminAddMember = async (
  groupId: string,
  studentId: string,
): Promise<ICHOGroupMember> => {
  const res = await api.post(`/cho-groups/${groupId}/members`, { studentId });
  return res.data.data;
};

export const adminRemoveMember = async (groupId: string, studentId: string): Promise<void> => {
  await api.delete(`/cho-groups/${groupId}/members/${studentId}`);
};

export const adminUpdateGroup = async (
  groupId: string,
  data: { name?: string; sectors?: string[]; cells?: string[]; villages?: string[]; description?: string },
): Promise<ICHOGroup> => {
  const res = await api.patch(`/cho-groups/${groupId}`, data);
  return res.data.data;
};

export const adminDeleteGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/cho-groups/${groupId}`);
};

export const choUpdateMyGroup = async (data: {
  name?: string;
  district?: string;
  sectors?: string[];
  cells?: string[];
  villages?: string[];
  cell?: string;
  village?: string;
  description?: string;
}): Promise<ICHOGroup> => {
  const res = await api.patch("/cho-groups/mine", data);
  return res.data.data;
};

// ─── Admin: promote / demote ──────────────────────────────────────────────────

export const adminPromoteToCHO = async (
  userId: string,
  groupName?: string,
): Promise<{ user: { id: string; fullNames: string }; group: ICHOGroup }> => {
  const res = await api.patch(`/cho-groups/promote/${userId}`, { groupName });
  return res.data.data;
};

export const adminDemoteToCHW = async (
  userId: string,
  newChoStudentId: string,
): Promise<{ demotedUser: { id: string; fullNames: string }; newCHO: { id: string; fullNames: string }; group: ICHOGroup }> => {
  const res = await api.patch(`/cho-groups/demote/${userId}`, { newChoStudentId });
  return res.data.data;
};
