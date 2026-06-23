import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Questionnaire from '@/components/Questionnaire';
import { getCourseById, getMidTestById, getStudentCourseProgressByCourseId } from '@/services/course.api';
import { ICourse, IChapter, ITest } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import StorageService from '@/services/storage.service';

export default function MidTestScreen() {
  const { courseId, chapterId, nextPage } = useLocalSearchParams<{ courseId: string; chapterId: string; nextPage?: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<ICourse | null>(null);
  const [chapter, setChapter] = useState<IChapter | null>(null);
  const [midTest, setMidTest] = useState<ITest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCourse = async () => {
    try {
      if (courseId) {
        const response = await getCourseById(courseId as string);
        const fetchedCourse = response.data;
        setCourse(fetchedCourse);
        
        const foundChapter = fetchedCourse.sections.flatMap((s: any) => s.chapters).find((c: any) => c.id === (chapterId ?? '')) ?? null;
        setChapter(foundChapter);
        
        // If chapter has midTest, fetch it using getMidTestById
        if (foundChapter && foundChapter.midTest && foundChapter.midTest.id) {
          const midTestResponse = await getMidTestById(foundChapter.midTest.id);
          setMidTest(midTestResponse.data);
        }
      }
    } catch (error) {
      console.log('Error loading course or midtest:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestComplete = async (testAnswers: Record<string, string[]>) => {
    try {
      // Sync latest chapter progress from server to local cache so chapters.tsx reflects
      // mid-test completion immediately when the screen regains focus
      if (courseId) {
        try {
          const response = await getStudentCourseProgressByCourseId(courseId);
          const completed = (response.data?.chapterProgress ?? [])
            .filter((ch: any) => ch.isCompleted)
            .map((ch: any) => ch.chapterId);
          for (const id of completed) {
            await StorageService.markChapterCompleted(id);
          }
        } catch (syncErr) {
          console.log('Mid-test progress sync error:', syncErr);
        }
      }

      const np = nextPage ? Number(nextPage) : undefined;
      if (np && !Number.isNaN(np) && chapterId) {
        router.push(`/courses/${courseId}/${chapterId}/course-content?page=${np}`);
      } else {
        router.push(`/courses/${courseId}/chapters`);
      }
    } catch (error) {
      console.log('Error updating progress', error);
      router.push(`/courses/${courseId}/chapters`);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!course || !chapter || !midTest) return null;

  return (
    <Questionnaire
      test={midTest ? [midTest] : []}
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
