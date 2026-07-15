import React, { useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Questionnaire from '@/components/Questionnaire';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import StorageService from '@/services/storage.service';
import {
  COURSE_WORKSPACE_QUERY_KEY,
  fetchCourseWorkspace,
  normalizeCourseId,
  useCourseWorkspace,
} from '@/hooks/useCourseWorkspace';
import { findChapterInCourse, midTestAsITest } from '@/utils/courseWorkspace';

export default function MidTestScreen() {
  const { courseId, chapterId, nextPage } = useLocalSearchParams<{
    courseId: string;
    chapterId: string;
    nextPage?: string;
  }>();
  const courseIdStr = normalizeCourseId(courseId);
  const chapterIdStr = normalizeCourseId(chapterId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: workspace, isLoading } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;
  const chapter = useMemo(
    () => (course && chapterIdStr ? findChapterInCourse(course, chapterIdStr) : null),
    [course, chapterIdStr],
  );
  const midTest = useMemo(
    () => (chapter?.midTest && course ? midTestAsITest(chapter.midTest, course) : null),
    [chapter, course],
  );

  const handleTestComplete = async () => {
    try {
      if (courseIdStr) {
        try {
          const latest = await fetchCourseWorkspace(queryClient, courseIdStr, { force: true });
          const completed = (latest.progress?.chapterProgress ?? [])
            .filter((ch) => ch.isCompleted)
            .map((ch) => ch.chapterId);
          for (const id of completed) {
            await StorageService.markChapterCompleted(id);
          }
          queryClient.setQueryData([COURSE_WORKSPACE_QUERY_KEY, courseIdStr], latest);
        } catch (syncErr) {
          console.log('Mid-test progress sync error:', syncErr);
        }
      }

      const np = nextPage ? Number(nextPage) : undefined;
      if (np && !Number.isNaN(np) && chapterIdStr) {
        router.push(`/courses/${courseIdStr}/${chapterIdStr}/course-content?page=${np}`);
      } else {
        router.push(`/courses/${courseIdStr}/chapters`);
      }
    } catch (error) {
      console.log('Error updating progress', error);
      router.push(`/courses/${courseIdStr}/chapters`);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!course || !chapter || !midTest) return null;

  return (
    <Questionnaire
      test={[midTest]}
      currentPage="midtest"
      firstHeaderSubtitle="Igeragezwa cyo hagati"
      lastHeaderSubtitle="Ikizamini cyo hagati"
      resultsTitle="Ikizamini Kirarangiye!"
      resultsSubtitle="Turagushimiye — Ibisubizo byawe byakiriwe"
      cheerText="Wakoze! Urakoze cyane ku kwitabira — komereza aho 🎉"
      onComplete={handleTestComplete}
    />
  );
}
