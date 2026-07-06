import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getCourseWorkspace } from '@/services/course.api';
import type { ICourseProgressSnapshot, ICourseWorkspaceData, IStudentStatisticsData } from '@/types';

export const COURSE_WORKSPACE_QUERY_KEY = 'COURSE_WORKSPACE';

export function normalizeCourseId(courseId?: string | string[]) {
  return Array.isArray(courseId) ? courseId[0] : courseId;
}

export function selectCourseProgressPercent(
  workspace: ICourseWorkspaceData | undefined,
  statsCourse?: { progress?: number },
): number {
  const fromWorkspace = workspace?.progress?.courseProgress?.progress;
  if (typeof fromWorkspace === 'number') return fromWorkspace;
  return statsCourse?.progress ?? 0;
}

export function patchCourseProgressInCache(
  queryClient: QueryClient,
  courseId: string,
  snapshot: ICourseProgressSnapshot,
) {
  queryClient.setQueryData<IStudentStatisticsData>(['COURSE'], (old) => {
    if (!old?.courses) return old;
    return {
      ...old,
      courses: old.courses.map((course) =>
        course.courseId === courseId
          ? { ...course, progress: snapshot.progress, isCompleted: snapshot.isCompleted }
          : course,
      ),
    };
  });

  queryClient.setQueryData<ICourseWorkspaceData>([COURSE_WORKSPACE_QUERY_KEY, courseId], (old) => {
    if (!old) return old;
    return {
      ...old,
      progress: {
        ...old.progress,
        courseProgress: snapshot,
      },
    };
  });
}

export function patchPreTestAttemptedInCache(queryClient: QueryClient, courseId: string) {
  queryClient.setQueryData<ICourseWorkspaceData>([COURSE_WORKSPACE_QUERY_KEY, courseId], (old) => {
    if (!old?.progress) return old;
    const existing = old.progress.preTestStatus;
    return {
      ...old,
      progress: {
        ...old.progress,
        preTestStatus: {
          attempted: true,
          passed: existing?.passed ?? true,
          bestMarks: existing?.bestMarks ?? 0,
          marksToPass: existing?.marksToPass ?? 0,
          preTestId: existing?.preTestId ?? '',
        },
      },
    };
  });
}

export async function syncWorkspaceAfterPreTest(
  queryClient: QueryClient,
  courseId: string,
): Promise<ICourseWorkspaceData> {
  patchPreTestAttemptedInCache(queryClient, courseId);
  invalidateCourseProgressQueries(queryClient, courseId);
  return fetchCourseWorkspace(queryClient, courseId, { force: true });
}

export function invalidateCourseProgressQueries(queryClient: QueryClient, courseId?: string) {
  if (courseId) {
    void queryClient.invalidateQueries({ queryKey: [COURSE_WORKSPACE_QUERY_KEY, courseId] });
  } else {
    void queryClient.invalidateQueries({ queryKey: [COURSE_WORKSPACE_QUERY_KEY] });
  }
  void queryClient.invalidateQueries({ queryKey: ['COURSE'] });
}

export async function fetchCourseWorkspace(
  queryClient: QueryClient,
  courseId: string,
  options?: { chapterId?: string; force?: boolean },
): Promise<ICourseWorkspaceData> {
  if (!options?.force) {
    const cached = queryClient.getQueryData<ICourseWorkspaceData>([
      COURSE_WORKSPACE_QUERY_KEY,
      courseId,
    ]);
    if (cached) return cached;
  }

  const response = await getCourseWorkspace(courseId, options?.chapterId);
  queryClient.setQueryData([COURSE_WORKSPACE_QUERY_KEY, courseId], response.data);
  return response.data;
}

export function useCourseWorkspace(courseId?: string | string[]) {
  const normalizedId = normalizeCourseId(courseId);

  return useQuery<ICourseWorkspaceData>({
    queryKey: [COURSE_WORKSPACE_QUERY_KEY, normalizedId],
    queryFn: async () => {
      const response = await getCourseWorkspace(normalizedId!);
      return response.data;
    },
    enabled: !!normalizedId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useInvalidateCourseWorkspace() {
  const queryClient = useQueryClient();
  return (courseId?: string) => {
    invalidateCourseProgressQueries(queryClient, courseId);
  };
}
