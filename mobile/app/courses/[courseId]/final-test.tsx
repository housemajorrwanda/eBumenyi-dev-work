import React, { useEffect, useState, useRef } from 'react';
import { Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Questionnaire from '@/components/Questionnaire';
import { getFinalTestById, addCoursereview } from '@/services/course.api';
import { ITest } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import CourseReviewCard from '@/components/CourseReviewCard';
import StorageService from '@/services/storage.service';
import {
  fetchCourseWorkspace,
  normalizeCourseId,
  useCourseWorkspace,
} from '@/hooks/useCourseWorkspace';
import { findNextIncompleteSectionId } from '@/utils/courseWorkspace';

export default function FinalTestScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const courseIdStr = normalizeCourseId(courseId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: workspace, isLoading: workspaceLoading } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;
  const [finalTest, setFinalTest] = useState<ITest | null>(null);
  const [testLoading, setTestLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string[]> | null>(null);
  const questionnaireRef = useRef<any>(null);

  const storeCourseReviewStatus = async (id: string, isReviewed: boolean) => {
    await StorageService.storeCourseReviewStatus(id, isReviewed);
  };

  useEffect(() => {
    let cancelled = false;

    const loadFinalTest = async () => {
      if (!course?.finalTest?.[0]?.id) {
        if (!cancelled) setTestLoading(false);
        return;
      }

      try {
        const finalTestResponse = await getFinalTestById(course.finalTest[0].id);
        if (!cancelled) setFinalTest(finalTestResponse.data);
      } catch (error) {
        console.log('Error loading final test:', error);
      } finally {
        if (!cancelled) setTestLoading(false);
      }
    };

    if (!workspaceLoading && course) {
      setTestLoading(true);
      void loadFinalTest();
    }

    return () => {
      cancelled = true;
    };
  }, [workspaceLoading, course]);

  const handleTestComplete = async (testAnswers: Record<string, string[]>) => {
    setPendingAnswers(testAnswers);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (reviewData: any) => {
    try {
      await addCoursereview({
        courseId: reviewData.courseId,
        comment: reviewData.comment,
        categoryRatings: reviewData.reviewCriteria,
        rating: reviewData.rating,
      });

      if (courseIdStr) {
        await storeCourseReviewStatus(courseIdStr, true);
      }

      setShowReviewModal(false);
    } catch (error) {
      console.log('Error submitting review:', error);
      setShowReviewModal(false);
      if (courseIdStr) {
        await storeCourseReviewStatus(courseIdStr, true);
      }
    }

    if (questionnaireRef.current?.showResults) {
      questionnaireRef.current.showResults();
    }

    setTimeout(async () => {
      if (!courseIdStr) return;

      try {
        const latestWorkspace = await fetchCourseWorkspace(queryClient, courseIdStr, { force: true });
        const latestCourse = latestWorkspace.course;
        const progress = latestWorkspace.progress;

        if (latestCourse.finalExam?.length > 0) {
          router.push(`/courses/${courseIdStr}/final-exam`);
          return;
        }

        const nextSectionId = progress?.chapterProgress
          ? findNextIncompleteSectionId(latestCourse, progress.chapterProgress)
          : latestCourse.sections[0]?.id;

        router.push({
          pathname: `/courses/${courseIdStr}/chapters`,
          params: { sectionId: nextSectionId },
        });
      } catch (e) {
        console.log('Failed to navigate after review submission', e);
      }
    }, 2000);
  };

  const loading = workspaceLoading || testLoading;
  if (loading) return <LoadingSpinner />;
  if (!course || !finalTest) return null;

  return (
    <>
      <Questionnaire
        ref={questionnaireRef}
        test={finalTest ? [finalTest] : []}
        onComplete={handleTestComplete}
        currentPage="final-test"
        firstHeaderSubtitle="Ikizamini gisoza isomo"
        lastHeaderSubtitle="Ikizamini gisoza isomo"
        resultsTitle="Ikizamini Kirarangiye!"
        resultsSubtitle="Turagushimiye — Ibisubizo byawe byakiriwe"
        cheerText="Wakoze! Urakoze cyane ku kwitabira — komereza aho 🎉"
        showResultsExternally={!!pendingAnswers && !showReviewModal}
      />
      <Modal visible={showReviewModal} animationType="slide" transparent={false}>
        <CourseReviewCard
          courseId={courseIdStr as string}
          courseCoverIcon={course.coverIcon}
          courseTitle={course.title}
          submitButtonText="Ohereza"
          onSubmit={handleReviewSubmit}
          onClose={() => setShowReviewModal(false)}
        />
      </Modal>
    </>
  );
}
