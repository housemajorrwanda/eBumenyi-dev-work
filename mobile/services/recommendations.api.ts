import httpClient from "@/services/httpClient";
import type { IPostCourseRecommendationsResponse } from "@/types";

export async function getPostCourseRecommendations(
  courseId: string,
): Promise<IPostCourseRecommendationsResponse> {
  const response = await httpClient.get(
    `/progress/student/course/${courseId}/recommendations`,
    { timeout: 15_000 },
  );
  return (response as { data: IPostCourseRecommendationsResponse }).data;
}
