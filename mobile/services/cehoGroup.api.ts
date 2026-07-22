import httpClient from './httpClient';
import {
  ICEHOGroup,
  ICEHOGroupMember,
  ICEHOGroupMonitoring,
  IStudentSearchResult,
} from '@/types';

// ─── CEHO: own group ───────────────────────────────────────────────────────────

export const getMyGroup = async (): Promise<ICEHOGroup> => {
  const response = await httpClient.get('/ceho-groups/mine');
  return (response as any).data.data;
};

export const getMyGroupMembers = async (): Promise<ICEHOGroupMember[]> => {
  const response = await httpClient.get('/ceho-groups/mine/members');
  return (response as any).data.data;
};

export const getGroupMonitoring = async (): Promise<ICEHOGroupMonitoring> => {
  const response = await httpClient.get('/ceho-groups/mine/monitoring');
  return (response as any).data.data;
};

// ─── CEHO: direct add / remove members ────────────────────────────────────────

export const cehoDirectlyAddMember = async (
  targetStudentId: string,
): Promise<ICEHOGroupMember> => {
  const response = await httpClient.post('/ceho-groups/mine/members', { targetStudentId });
  return (response as any).data.data;
};

export const cehoRemoveMyMember = async (studentId: string): Promise<void> => {
  await httpClient.delete(`/ceho-groups/mine/members/${studentId}`);
};

// ─── CEHO: update own group ────────────────────────────────────────────────────

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
  const response = await httpClient.patch('/ceho-groups/mine', data);
  return (response as any).data.data;
};

// ─── CEHO: search CHW candidates (area-filtered, unlimited with search) ────────

export const searchCHWCandidates = async (
  search?: string,
): Promise<IStudentSearchResult[]> => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await httpClient.get(`/ceho-groups/mine/chw-candidates${params}`);
  return (response as any).data.data ?? [];
};

// ─── legacy alias kept for backward compat ───────────────────────────────────

export const inviteMember = cehoDirectlyAddMember;
export const searchStudentsForInvite = searchCHWCandidates;
