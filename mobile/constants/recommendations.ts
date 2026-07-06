import type {
  IPostCourseRecommendationChapter,
  PostCourseRecommendationSeverity,
} from '@/types';

export const RECOMMENDATION_STREAM_MS = 100;

export const SEVERITY_DOT: Record<PostCourseRecommendationSeverity, string> = {
  high: '#DC2626',
  moderate: '#D97706',
  low: '#059669',
};

export const SEVERITY_BADGE: Record<
  PostCourseRecommendationSeverity,
  { bg: string; border: string; text: string }
> = {
  high: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
  moderate: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
  low: { bg: '#D1FAE5', border: '#059669', text: '#065F46' },
};

export function toRecommendedQueryParam(
  chapters: IPostCourseRecommendationChapter[],
): string {
  return chapters.map((c) => `${c.chapterId}:${c.severity}`).join(',');
}
