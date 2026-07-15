import axios from "axios";
import api from "./api";
import { getApiBaseURL } from "@/config/api.config";
import {
  ITraineeCertificate,
  IWorkshopCertificate,
  CertificateFilters,
  CertificateResponse,
} from "@/types/certificates.d";

// Plain axios instance for public (no-auth) endpoints
const publicApi = axios.create({ baseURL: getApiBaseURL() });

export interface ICertificateVerification {
  id: string;
  recipientName: string;
  courseName: string;
  issuedAt: string;
}

export const verifyCertificate = async (code: string): Promise<ICertificateVerification> => {
  const res = await publicApi.get(`/certificates/verify/${code}`);
  return res.data?.data as ICertificateVerification;
};

// ============================================
// REAL BACKEND ENDPOINTS
// ============================================

export interface IMyCertificate {
  id: string;
  courseId: string;
  title: string;
  image: string;
  progress: number;
  enrollmentDate: string;
  completedAt: string;
  completedAtRaw?: string;
  slides: number;
  attempt: number;
  test: number;
  finalExamMarks: number | null;
  pdf: string;
}

export const getMyCertificates = async (): Promise<IMyCertificate[]> => {
  const res = await api.get("/certificates/my-certificates");
  return (res.data?.data as IMyCertificate[]) ?? [];
};

export const generateCertificate = async (courseId: string): Promise<IMyCertificate> => {
  const res = await api.post("/certificates/generate", { courseId });
  return res.data?.data as IMyCertificate;
};

export interface ICertificatePrepareData {
  certId: string;
  tokenValues: Record<string, string>;
  canvasJson: string | null;
}

export const prepareCertificate = async (courseId: string): Promise<ICertificatePrepareData> => {
  const res = await api.post("/certificates/prepare", { courseId });
  return res.data?.data as ICertificatePrepareData;
};

export const storeCertificatePdf = async (
  certId: string,
  courseId: string,
  base64Pdf: string,
): Promise<IMyCertificate> => {
  const res = await api.post("/certificates/store-pdf", { certId, courseId, base64Pdf });
  return res.data?.data as IMyCertificate;
};

export const regenerateCertificate = async (certificateId: string): Promise<IMyCertificate> => {
  const res = await api.post(`/certificates/regenerate/${certificateId}`);
  return res.data?.data as IMyCertificate;
};

export interface IIssuedCertificate {
  id: string;
  createdAt: string;
  pdf: string | null;
  student: {
    user: {
      id: string;
      fullNames: string;
      phoneNumber: string;
      district: string | null;
      sector: string | null;
    };
  };
  course: {
    id: string;
    title: string;
    coverIcon: string | null;
    certificateTemplate: { id: string; name: string } | null;
  };
}

export interface IIssuedCertificatesResponse {
  data: IIssuedCertificate[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
}

export const getAllCertificates = async (params?: {
  searchq?: string;
  limit?: number;
  page?: number;
  templateId?: string;
  courseId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<IIssuedCertificatesResponse> => {
  const query = new URLSearchParams();
  if (params?.searchq) query.set("searchq", params.searchq);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  if (params?.templateId) query.set("templateId", params.templateId);
  if (params?.courseId) query.set("courseId", params.courseId);
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  const res = await api.get(`/certificates/all?${query.toString()}`);
  return res.data as IIssuedCertificatesResponse;
};

export const regenerateMyCertificate = async (courseId: string): Promise<IMyCertificate> => {
  const res = await api.post(`/certificates/my-certificate/regenerate/${courseId}`);
  return res.data?.data as IMyCertificate;
};

// ============================================
// TRAINEE CERTIFICATES (My Certificates)
// ============================================

/**
 * Get all trainee certificates for the current user
 */
export const getMyTraineeCertificates = async (filters?: CertificateFilters) => {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.append("dateTo", filters.dateTo);
  if (filters?.limit) params.append("limit", filters.limit.toString());
  if (filters?.page) params.append("page", filters.page.toString());

  const response = await api.get<{ data: ITraineeCertificate[], total: number, page: number, pageSize: number }>(
    `/certificates/trainee?${params.toString()}`
  );
  return response.data;
};

/**
 * Get a single trainee certificate by ID
 */
export const getTraineeCertificateById = async (
  id: string
): Promise<ITraineeCertificate> => {
  const response = await api.get<CertificateResponse>(`/certificates/trainee/${id}`);
  return response.data.data as ITraineeCertificate;
};

/**
 * Download trainee certificate as PDF
 */
export const downloadTraineeCertificate = async (id: string) => {
  const response = await api.get(`/certificates/trainee/${id}/download`, {
    responseType: "blob",
  });
  return response.data;
};

/**
 * Verify trainee certificate authenticity
 */
export const verifyTraineeCertificate = async (id: string) => {
  const response = await api.post<CertificateResponse>(
    `/certificates/trainee/${id}/verify`,
    {}
  );
  return response.data;
};

/**
 * Share trainee certificate (generate share link)
 */
export const shareTraineeCertificate = async (id: string) => {
  const response = await api.post<{ shareUrl: string }>(
    `/certificates/trainee/${id}/share`,
    {}
  );
  return response.data;
};

// ============================================
// WORKSHOP CERTIFICATES (Management)
// ============================================

/**
 * Get all workshop certificates (admin/trainer view)
 */
export const getWorkshopCertificates = async (filters?: CertificateFilters) => {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.limit) params.append("limit", filters.limit.toString());
  if (filters?.page) params.append("page", filters.page.toString());

  const response = await api.get<{ data: IWorkshopCertificate[], total: number, page: number, pageSize: number }>(
    `/certificates/workshop?${params.toString()}`
  );
  return response.data;
};

/**
 * Get a single workshop certificate by ID
 */
export const getWorkshopCertificateById = async (
  id: string
): Promise<IWorkshopCertificate> => {
  const response = await api.get<CertificateResponse>(`/certificates/workshop/${id}`);
  return response.data.data as IWorkshopCertificate;
};

/**
 * Create a new workshop certificate
 */
export const createWorkshopCertificate = async (
  data: Partial<IWorkshopCertificate>
): Promise<IWorkshopCertificate> => {
  const response = await api.post<CertificateResponse>(
    "/certificates/workshop",
    data
  );
  return response.data.data as IWorkshopCertificate;
};

/**
 * Update an existing workshop certificate
 */
export const updateWorkshopCertificate = async (
  id: string,
  data: Partial<IWorkshopCertificate>
): Promise<IWorkshopCertificate> => {
  const response = await api.put<CertificateResponse>(
    `/certificates/workshop/${id}`,
    data
  );
  return response.data.data as IWorkshopCertificate;
};

/**
 * Delete a workshop certificate
 */
export const deleteWorkshopCertificate = async (id: string) => {
  const response = await api.delete<CertificateResponse>(`/certificates/workshop/${id}`);
  return response.data;
};

/**
 * Issue certificates to participants
 */
export const issueCertificatesToParticipants = async (
  workshopId: string,
  participantIds: string[]
) => {
  const response = await api.post<CertificateResponse>(
    `/certificates/workshop/${workshopId}/issue`,
    { participantIds }
  );
  return response.data;
};

/**
 * Revoke a certificate from a participant
 */
export const revokeCertificateFromParticipant = async (
  workshopId: string,
  participantId: string
) => {
  const response = await api.post<CertificateResponse>(
    `/certificates/workshop/${workshopId}/revoke/${participantId}`,
    {}
  );
  return response.data;
};

/**
 * Download workshop certificate as PDF
 */
export const downloadWorkshopCertificate = async (
  id: string,
  participantId?: string
) => {
  const url = participantId
    ? `/certificates/workshop/${id}/download?participantId=${participantId}`
    : `/certificates/workshop/${id}/download`;

  const response = await api.get(url, {
    responseType: "blob",
  });
  return response.data;
};

/**
 * Archive a workshop certificate
 */
export const archiveWorkshopCertificate = async (id: string) => {
  const response = await api.put<CertificateResponse>(
    `/certificates/workshop/${id}`,
    { status: "archived" }
  );
  return response.data;
};
