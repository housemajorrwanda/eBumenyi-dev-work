import api from "./api";
import {
  ICEHOGroup,
  ICEHOGroupMember,
  ICEHOGroupMonitoring,
  IStudentSearchResult,
} from "@/types";

export interface ICEHOGroupDetail extends ICEHOGroup {
  members: ICEHOGroupMember[];
}

// ─── CEHO: own group ──────────────────────────────────────────────────────────

export const getMyGroup = async (): Promise<ICEHOGroup> => {
  const res = await api.get("/ceho-groups/mine");
  return res.data.data;
};

export const getMyGroupMembers = async (): Promise<ICEHOGroupMember[]> => {
  const res = await api.get("/ceho-groups/mine/members");
  return res.data.data;
};

export const getGroupMonitoring = async (): Promise<ICEHOGroupMonitoring> => {
  const res = await api.get("/ceho-groups/mine/monitoring");
  return res.data.data;
};

// ─── CEHO: add / remove members (no invitation needed) ────────────────────────

export const cehoDirectlyAddMember = async (targetStudentId: string): Promise<ICEHOGroupMember> => {
  const res = await api.post("/ceho-groups/mine/members", { targetStudentId });
  return res.data.data;
};

export const cehoRemoveMyMember = async (studentId: string): Promise<void> => {
  await api.delete(`/ceho-groups/mine/members/${studentId}`);
};

// ─── CEHO: search CHW candidates in same area (max 10) ────────────────────────

export const searchCHWCandidates = async (search?: string): Promise<IStudentSearchResult[]> => {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await api.get(`/ceho-groups/mine/chw-candidates${params}`);
  return res.data.data ?? [];
};

// ─── Admin: groups CRUD ───────────────────────────────────────────────────────

export const adminGetAllGroups = async (
  limit = 20,
  offset = 0,
): Promise<{ groups: ICEHOGroup[]; total: number }> => {
  const res = await api.get(`/ceho-groups/?limit=${limit}&offset=${offset}`);
  return res.data.data;
};

export const adminCreateGroup = async (data: {
  cehoStudentId: string;
  sectors?: string[];
  cells?: string[];
  villages?: string[];
  description?: string;
}): Promise<ICEHOGroup> => {
  const res = await api.post("/ceho-groups/", data);
  return res.data.data;
};

export const adminGetGroupById = async (groupId: string): Promise<ICEHOGroupDetail> => {
  const res = await api.get(`/ceho-groups/${groupId}`);
  return res.data.data;
};

export const adminAddMember = async (
  groupId: string,
  studentId: string,
): Promise<ICEHOGroupMember> => {
  const res = await api.post(`/ceho-groups/${groupId}/members`, { studentId });
  return res.data.data;
};

export const adminRemoveMember = async (groupId: string, studentId: string): Promise<void> => {
  await api.delete(`/ceho-groups/${groupId}/members/${studentId}`);
};

export const adminUpdateGroup = async (
  groupId: string,
  data: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string },
): Promise<ICEHOGroup> => {
  const res = await api.patch(`/ceho-groups/${groupId}`, data);
  return res.data.data;
};

export const adminDeleteGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/ceho-groups/${groupId}`);
};

export const cehoUpdateMyGroup = async (data: {
  name?: string;
  district?: string;
  sectors?: string[];
  cells?: string[];
  villages?: string[];
  cell?: string;
  village?: string;
  description?: string;
}): Promise<ICEHOGroup> => {
  const res = await api.patch("/ceho-groups/mine", data);
  return res.data.data;
};

// ─── Admin: promote / demote ──────────────────────────────────────────────────

export type PromoteToCEHOResult =
  | { conflict: true; existingCeho: { id: string; fullNames: string } }
  | { conflict?: undefined; user: { id: string; fullNames: string }; group: ICEHOGroup };

export const adminCheckHospitalConflict = async (
  userId: string,
): Promise<{ existingCeho: { id: string; fullNames: string } | null }> => {
  const res = await api.get(`/ceho-groups/promote/${userId}/conflict`);
  return res.data.data;
};

export const adminPromoteToCEHO = async (
  userId: string,
  confirmReplace = false,
): Promise<PromoteToCEHOResult> => {
  const res = await api.patch(`/ceho-groups/promote/${userId}`, { confirmReplace });
  return res.data.data;
};

export const adminDemoteToCHW = async (
  userId: string,
  newCehoStudentId: string,
): Promise<{ demotedUser: { id: string; fullNames: string }; newCEHO: { id: string; fullNames: string }; group: ICEHOGroup }> => {
  const res = await api.patch(`/ceho-groups/demote/${userId}`, { newCehoStudentId });
  return res.data.data;
};
