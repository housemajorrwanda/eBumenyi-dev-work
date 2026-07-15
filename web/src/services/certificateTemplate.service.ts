import api from "./api";

export interface CertificateTemplateSummary {
  id: string;
  name: string;
  thumbnail?: string | null;
  issuedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateTemplate extends CertificateTemplateSummary {
  canvasJson: unknown;
}

const EMPTY_CANVAS = { version: "6.0.0", objects: [], background: "#ffffff" };

export const listCertificateTemplates = async (): Promise<CertificateTemplateSummary[]> => {
  const res = await api.get("/certificate-templates");
  return (res.data?.data as CertificateTemplateSummary[]) ?? [];
};

export const getCertificateTemplate = async (id: string): Promise<CertificateTemplate> => {
  const res = await api.get(`/certificate-templates/${id}`);
  return res.data?.data as CertificateTemplate;
};

export const createCertificateTemplate = async (name: string): Promise<CertificateTemplate> => {
  const res = await api.post("/certificate-templates", { name, canvasJson: EMPTY_CANVAS });
  return res.data?.data as CertificateTemplate;
};

export const updateCertificateTemplate = async (
  id: string,
  data: { name?: string; canvasJson?: unknown; thumbnail?: string },
): Promise<CertificateTemplate> => {
  const res = await api.put(`/certificate-templates/${id}`, data);
  return res.data?.data as CertificateTemplate;
};

export const deleteCertificateTemplate = async (id: string): Promise<void> => {
  await api.delete(`/certificate-templates/${id}`);
};

export interface LinkedCourse {
  id: string;
  title: string;
  coverIcon: string;
}

export const getLinkedCourses = async (templateId: string): Promise<LinkedCourse[]> => {
  const res = await api.get(`/certificate-templates/${templateId}/courses`);
  return (res.data?.data as LinkedCourse[]) ?? [];
};

export const linkTemplateToCourse = async (templateId: string, courseId: string): Promise<void> => {
  await api.post(`/certificate-templates/${templateId}/link`, { courseId });
};

export const unlinkTemplateFromCourse = async (templateId: string, courseId: string): Promise<void> => {
  await api.delete(`/certificate-templates/${templateId}/link/${courseId}`);
};

export interface MockTokenData {
  certId: string;
  tokenValues: Record<string, string>;
}

export const getMockTokenValues = async (): Promise<MockTokenData> => {
  const res = await api.get("/certificate-templates/mock-tokens");
  return res.data?.data as MockTokenData;
};

export const previewCertificateTemplate = async (
  templateId: string,
  canvasJson: Record<string, unknown>,
): Promise<string> => {
  const res = await api.post(`/certificate-templates/${templateId}/preview`, { canvasJson });
  return res.data?.data?.pdf as string; // base64-encoded PDF
};

export interface BgImage {
  id: string;
  url: string;
  createdAt: string;
}

export const listBgImages = async (): Promise<BgImage[]> => {
  const res = await api.get("/certificate-templates/backgrounds");
  return (res.data?.data as BgImage[]) ?? [];
};

export const uploadBgImage = async (dataUrl: string): Promise<BgImage> => {
  const res = await api.post("/certificate-templates/backgrounds", { dataUrl });
  return res.data?.data as BgImage;
};

export const deleteBgImage = async (id: string): Promise<void> => {
  await api.delete(`/certificate-templates/backgrounds/${id}`);
};
