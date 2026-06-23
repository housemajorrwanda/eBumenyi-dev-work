import { IHospital, IPaged, IResponse } from "@/types";
import api from "./api";

export const getAllHospitals = async (params?: string): Promise<IPaged<IHospital[]>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/hospitals${queryParams}`)).data;
};

export const getPublicHospitals = async (params?: {
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
}): Promise<IHospital[]> => {
  const res = await api.get("/hospitals/public", { params });
  const body = res.data;
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
};

export const getHospitalById = async (id: string): Promise<IResponse<IHospital>> => {
  return (await api.get(`/hospitals/${id}`)).data;
};

export const createHospital = async (
  data: Partial<IHospital>
): Promise<IResponse<IHospital>> => {
  return (await api.post("/hospitals", data)).data;
};

export const updateHospital = async (
  id: string,
  data: Partial<IHospital>
): Promise<IResponse<IHospital>> => {
  return (await api.put(`/hospitals/${id}`, data)).data;
};

export const deleteHospital = async (id: string): Promise<IResponse<null>> => {
  return (await api.delete(`/hospitals/${id}`)).data;
};

export const importHospitals = async (
  file: File,
): Promise<{
  statusCode: number;
  message: string;
  data: { total: number; created: number; skipped: number; errors: string[] };
}> => {
  const formData = new FormData();
  formData.append("file", file);
  return (
    await api.post("/hospitals/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
};