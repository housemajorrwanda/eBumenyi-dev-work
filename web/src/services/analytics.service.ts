/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IAnalytics,
  IResponse,
  IDashboardStatsResponse,
  ICourseAnalyticsResponse,
  IStudentAnalyticsResponse,
  ITestScoreAnalytics,
  ICommunicationsAnalytics,
  IDemographicsAnalytics,
  ICHWStats,
  ICourseDurationStats,
  IRecentActivityFeed,
  IRecommendationInsightsResponse,
} from "@/types";
import api from "./api";

const withQuery = (path: string, qs: string = "") => {
  if (!qs) return path;
  const query = qs.startsWith("?") ? qs.slice(1) : qs;
  return `${path}?${query}`;
};

export const getDashboardStats = async (): Promise<IDashboardStatsResponse> => {
  return (await api.get("/courses/dashboard/statistics")).data;
};

export const getRecommendationInsights = async (): Promise<IRecommendationInsightsResponse> => {
  return (await api.get("/courses/dashboard/recommendations-insights")).data;
};

export const getAnalytics = async (
  params?: string,
): Promise<IResponse<IAnalytics>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/analytics${queryParams}`)).data;
};

export const getCourseAnalytics = async (qs: string = ""): Promise<ICourseAnalyticsResponse> => {
  return (await api.get(withQuery("export/dashboard/course/analytics", qs))).data;
};

export const getStudentAnalytics = async (qs: string = ""): Promise<IStudentAnalyticsResponse> => {
  return (await api.get(withQuery("/export/dashboard/student/analytics", qs))).data;
};

export const getTrainerAnalytics = async (
  trainerId: string,
): Promise<IResponse<any>> => {
  return (await api.get(`/analytics/trainers/${trainerId}`)).data;
};

export const getTestScoreAnalytics = async (qs: string = ""): Promise<
  IResponse<ITestScoreAnalytics>
> => {
  return (await api.get(withQuery("/export/dashboard/test-score/analytics", qs))).data;
};

export const getCommunicationsAnalytics = async (qs: string = ""): Promise<
  IResponse<ICommunicationsAnalytics>
> => {
  return (await api.get(withQuery("/export/dashboard/communications/analytics", qs))).data;
};

export const getDemographicsAnalytics = async (qs: string = ""): Promise<
  IResponse<IDemographicsAnalytics>
> => {
  return (await api.get(withQuery("/export/dashboard/demographics/analytics", qs))).data;
};

export const getCHWDashboardStats = async (qs: string = ""): Promise<IResponse<ICHWStats>> => {
  return (await api.get(withQuery("/export/dashboard/chw-stats", qs))).data;
};

export const getCourseDurationStats = async (qs: string = ""): Promise<
  IResponse<ICourseDurationStats>
> => {
  return (await api.get(withQuery("/export/dashboard/course-duration", qs))).data;
};

export const getRecentActivityFeed = async (qs: string = ""): Promise<
  IResponse<IRecentActivityFeed>
> => {
  return (await api.get(withQuery("/export/dashboard/recent-activity", qs))).data;
};
