import { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getPostCourseRecommendations } from '@/services/course.api';
import {
  buildRecommendedMapFromChapters,
  mergeRecommendedMaps,
  parseRecommendedParam,
} from '@/utils/recommendedChapters';

export function useCourseRecommendations(
  courseId: string | undefined,
  urlRecommendedParam?: string | string[],
) {
  const query = useQuery({
    queryKey: ['postCourseRecommendations', courseId],
    queryFn: async () => {
      try {
        const res = await getPostCourseRecommendations(courseId!);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(courseId),
    retry: false,
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (courseId) void query.refetch();
    }, [courseId, query.refetch]),
  );

  const recommendedChaptersMap = useMemo(() => {
    const fromApi = buildRecommendedMapFromChapters(query.data?.chapters ?? []);
    const fromUrl = parseRecommendedParam(urlRecommendedParam);
    return mergeRecommendedMaps(fromApi, fromUrl);
  }, [query.data?.chapters, urlRecommendedParam]);

  return { recommendedChaptersMap };
}
