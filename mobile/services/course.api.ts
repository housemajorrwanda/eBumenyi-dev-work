import { ICourseResponse, IOneCourseResponse, IStudentStatisticsResponse, ITestResponse, TAttempTestResponse, CreateAttempTestDto, IChapterResponse, IAttemptsResponse, IProgressResponse, ICourseWorkspaceResponse, CreateCourseReviewDto, TCourseReviewResponse, CreateSectionReviewDto, TSectionReviewResponse, CreateChapterReviewDto, TChapterReviewResponse, IDocumentsByCourseResponse, IStudentsByCourseResponse, IMySectionReviewItem, IMyChapterReviewItem } from "@/types";
import httpClient from "./httpClient";
export { getPostCourseRecommendations } from "./recommendations.api";


export const getStudentCourseStats = async (): Promise<IStudentStatisticsResponse> => {
    const response = await httpClient.get("/progress/student/statistics/");
    return (response as any).data.data as IStudentStatisticsResponse;
};

export const getAllCourse = async (params?: string): Promise<ICourseResponse> => {
    const queryParams = params ? params : "";
    const response = await httpClient.get(`/courses/myall${queryParams}`);
    
    return (response as any).data as ICourseResponse;
};


export const getCourseById = async (id: string): Promise<IOneCourseResponse> => {
    const response = await httpClient.get(`/courses/${id}`);
    return (response as any).data as IOneCourseResponse;
};


export const getPretestById = async (id: string): Promise<ITestResponse> => {
    const response = await httpClient.get(`/pre-tests/${id}`);
    return (response as any).data as ITestResponse;
};

export const getMidTestById = async (id: string): Promise<ITestResponse> => {
    const response = await httpClient.get(`/mid-tests/${id}`);
    return (response as any).data as ITestResponse;
};

export const getFinalTestById = async (id: string): Promise<ITestResponse> => {
    const response = await httpClient.get(`/final-tests/${id}`);
    return (response as any).data as ITestResponse;
};

export const getFinalExamById = async (id: string): Promise<ITestResponse> => {
    const response = await httpClient.get(`/final-exams/${id}`);
    return (response as any).data as ITestResponse;
};

export const attemptTest = async (data: CreateAttempTestDto): Promise<TAttempTestResponse> => {
  const response = await httpClient.post("/attempts", data);
  return (response as any).data.data;
};

export const getChapterById = async (id: string): Promise<IChapterResponse> => {
    const response = await httpClient.get(`/chapters/${id}`);
    return (response as any).data as IChapterResponse;
};

export const createSlideProgressById = async (data: { slideId: string; isCompleted: boolean }): Promise<any> => {
    const response = await httpClient.post("/progress/slide/complete", { slideId: data.slideId, isCompleted: data.isCompleted });
    return (response as any).data;
};

export const getAttempTestById = async (id: string): Promise<IAttemptsResponse> => {
    const response = await httpClient.get(`/attempts/by-test/${id}`);
    return (response as any).data as IAttemptsResponse;
};

export const getStudentCourseProgressByCourseId = async (courseId: string): Promise<IProgressResponse> => {
    const response = await httpClient.get(`/progress/student/course/${courseId}`);
    return (response as any).data as IProgressResponse;
};

export const getCourseWorkspace = async (
  courseId: string,
  chapterId?: string,
): Promise<ICourseWorkspaceResponse> => {
  const query = chapterId ? `?chapterId=${encodeURIComponent(chapterId)}` : '';
  const response = await httpClient.get(`/progress/student/course/${courseId}/workspace${query}`);
  return (response as any).data as ICourseWorkspaceResponse;
};

export const addCoursereview = async (data: CreateCourseReviewDto): Promise<TCourseReviewResponse> => {
  const response = await httpClient.post("/course-reviews", data);
  return (response as any).data.data;
};

export const addSectionreview = async (data: CreateSectionReviewDto): Promise<TSectionReviewResponse> => {
  const response = await httpClient.post("/section-reviews", data);
  return (response as any).data.data;
};

export const addChapterreview = async (data: CreateChapterReviewDto): Promise<TChapterReviewResponse> => {
  const response = await httpClient.post("/chapter-reviews", data);
  return (response as any).data.data as TChapterReviewResponse;
};

export const getMySectionReviews = async (): Promise<IMySectionReviewItem[]> => {
  const response = await httpClient.get(`/section-reviews/my-reviews`);
  const payload = (response as any).data?.data ?? (response as any).data;
  return payload as IMySectionReviewItem[];
};

export const getMyChapterReviews = async (): Promise<IMyChapterReviewItem[]> => {
  const response = await httpClient.get(`/chapter-reviews/my-reviews`);
  const payload = (response as any).data?.data ?? (response as any).data;
  return payload as IMyChapterReviewItem[];
};

export const getDocumentsByCourse = async (courseId: string): Promise<IDocumentsByCourseResponse> => {
  const response = await httpClient.get(`/documents/by-course/${courseId}`);
  return (response as any).data as IDocumentsByCourseResponse;
};

export const getStudentsByCourse = async (courseId: string): Promise<IStudentsByCourseResponse> => {
  const response = await httpClient.get(`/students/by-course/${courseId}`);
  return (response as any).data as IStudentsByCourseResponse;
};