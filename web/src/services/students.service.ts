import { IPaged, IResponse, StudentData, IPostCourseRecommendationsResponse } from "@/types";
import api from "./api";

// Student interface
export interface IStudent {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  courses: string[];
  progress: string;
  createdAt: string;
  updatedAt: string;
}

export const getAllStudents = async (params?: string): Promise<IPaged<IStudent[]>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/students${queryParams}`)).data;
};

export const getAllStudentsNoPagination = async (params?: string): Promise<IResponse<IStudent[]>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/students/all${queryParams}`)).data;
};

export const getStudentById = async (id: string): Promise<IResponse<StudentData>> => {
  return (await api.get(`/students/${id}`)).data;
};

export const getStudentPostCourseRecommendations = async (
  studentId: string,
  courseId: string,
): Promise<IPostCourseRecommendationsResponse> => {
  return (
    await api.get(`/students/${studentId}/course/${courseId}/recommendations`)
  ).data;
};

export const createStudent = async (
  data: Record<string, unknown>
): Promise<unknown> => {
  return (await api.post("/students", data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })).data;
};

export const updateStudent = async (
  id: string,
  data: Record<string, unknown>,
): Promise<unknown> => {
  return (await api.put(`/students/${id}`, data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })).data;
};

export const deleteStudent = async (id: string): Promise<number> => {
  return (await api.delete(`/students/${id}`)).data;
};
