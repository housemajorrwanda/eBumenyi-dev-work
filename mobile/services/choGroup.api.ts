import httpClient from './httpClient';
import {
  ICHOGroup,
  ICHOGroupMember,
  ICHOGroupMonitoring,
  IStudentSearchResult,
} from '@/types';

// ─── CHO: own group ───────────────────────────────────────────────────────────

export const getMyGroup = async (): Promise<ICHOGroup> => {
  const response = await httpClient.get('/cho-groups/mine');
  return (response as any).data.data;
};

export const getMyGroupMembers = async (): Promise<ICHOGroupMember[]> => {
  const response = await httpClient.get('/cho-groups/mine/members');
  return (response as any).data.data;
};

export const getGroupMonitoring = async (): Promise<ICHOGroupMonitoring> => {
  const response = await httpClient.get('/cho-groups/mine/monitoring');
  return (response as any).data.data;
};

// ─── CHO: direct add / remove members ────────────────────────────────────────

export const choDirectlyAddMember = async (
  targetStudentId: string,
): Promise<ICHOGroupMember> => {
  const response = await httpClient.post('/cho-groups/mine/members', { targetStudentId });
  return (response as any).data.data;
};

export const choRemoveMyMember = async (studentId: string): Promise<void> => {
  await httpClient.delete(`/cho-groups/mine/members/${studentId}`);
};

// ─── CHO: update own group ────────────────────────────────────────────────────

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
  const response = await httpClient.patch('/cho-groups/mine', data);
  return (response as any).data.data;
};

// ─── CHO: search CHW candidates (area-filtered, unlimited with search) ────────

export const searchCHWCandidates = async (
  search?: string,
): Promise<IStudentSearchResult[]> => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await httpClient.get(`/cho-groups/mine/chw-candidates${params}`);
  return (response as any).data.data ?? [];
};

// ─── legacy alias kept for backward compat ───────────────────────────────────

export const inviteMember = choDirectlyAddMember;
export const searchStudentsForInvite = searchCHWCandidates;
