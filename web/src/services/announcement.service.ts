import { IResponse } from "@/types";
import api from "./api";

export interface IAnnouncement {
  id: string;
  title: string;
  body: string;
  segment: string;
  category?: string;
  publishAt: string;
  validUntil?: string | null;
  createdById: string;
  status?: 'draft' | 'published';
  priority?: 'high' | 'medium' | 'low';
  createdAt?: string;
  updatedAt?: string;
}

export const getAllAnnouncements = async (): Promise<IResponse<IAnnouncement[]>> => {
  return (await api.get("/announcements")).data;
};

export const getAnnouncementById = async (id: string): Promise<IResponse<IAnnouncement>> => {
  return (await api.get(`/announcements/${id}`)).data;
};

export const createAnnouncement = async (
  data: Partial<IAnnouncement>
): Promise<IResponse<IAnnouncement>> => {
  return (await api.post("/announcements", data)).data;
};

export const updateAnnouncement = async (
  id: string,
  data: Partial<IAnnouncement>
): Promise<IResponse<IAnnouncement>> => {
  return (await api.put(`/announcements/${id}`, data)).data;
};

export const deleteAnnouncement = async (id: string): Promise<IResponse<null>> => {
  return (await api.delete(`/announcements/${id}`)).data;
};

export const publishAnnouncement = async (id: string): Promise<IResponse<IAnnouncement>> => {
  return (await api.put(`/announcements/${id}`, { status: 'published' })).data;
};

export const unpublishAnnouncement = async (id: string): Promise<IResponse<IAnnouncement>> => {
  return (await api.put(`/announcements/${id}`, { status: 'draft' })).data;
};
