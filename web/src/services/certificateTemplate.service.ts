import api from "./api";

export interface CertificateTemplateSummary {
  id: string;
  name: string;
  thumbnail?: string | null;
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
