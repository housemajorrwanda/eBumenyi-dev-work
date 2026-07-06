import type {
  IPostCourseRecommendationChapter,
  PostCourseRecommendationSeverity,
} from '@/types';

export function parseRecommendedParam(
  raw: string | string[] | undefined,
): Map<string, PostCourseRecommendationSeverity> {
  const map = new Map<string, PostCourseRecommendationSeverity>();
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return map;

  for (const entry of value.split(',')) {
    const [id, sev] = entry.split(':');
    if (!id) continue;
    if (sev === 'high' || sev === 'moderate' || sev === 'low') {
      map.set(id, sev);
    } else {
      map.set(id, 'moderate');
    }
  }
  return map;
}

export function buildRecommendedMapFromChapters(
  chapters: IPostCourseRecommendationChapter[],
): Map<string, PostCourseRecommendationSeverity> {
  const map = new Map<string, PostCourseRecommendationSeverity>();
  for (const ch of chapters) {
    map.set(ch.chapterId, ch.severity);
  }
  return map;
}

export function mergeRecommendedMaps(
  fromApi: Map<string, PostCourseRecommendationSeverity>,
  fromUrl: Map<string, PostCourseRecommendationSeverity>,
): Map<string, PostCourseRecommendationSeverity> {
  const merged = new Map(fromUrl);
  for (const [id, severity] of fromApi) {
    merged.set(id, severity);
  }
  return merged;
}
