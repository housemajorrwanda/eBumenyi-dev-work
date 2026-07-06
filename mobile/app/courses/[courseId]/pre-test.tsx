import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Questionnaire from '@/components/Questionnaire';
import { getPretestById } from '@/services/course.api';
import { ITest } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCourseWorkspace, normalizeCourseId } from '@/hooks/useCourseWorkspace';

export default function PreTestScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const courseIdStr = normalizeCourseId(courseId);
  const { data: workspace, isLoading: workspaceLoading } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;
  const [preTest, setPreTest] = useState<ITest | null>(null);
  const [testLoading, setTestLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const loadPreTest = async () => {
      if (!course?.preTests?.[0]?.id) {
        if (!cancelled) setTestLoading(false);
        return;
      }

      try {
        const preTestResponse = await getPretestById(course.preTests[0].id);
        if (!cancelled) setPreTest(preTestResponse.data);
      } catch (error) {
        console.log('Error loading pretest:', error);
      } finally {
        if (!cancelled) setTestLoading(false);
      }
    };

    if (!workspaceLoading && course) {
      setTestLoading(true);
      void loadPreTest();
    }

    return () => {
      cancelled = true;
    };
  }, [workspaceLoading, course]);

  const navigateToFirstSection = () => {
    const firstSectionId = course?.sections?.[0]?.id;
    router.replace({
      pathname: `/courses/${courseIdStr}/chapters`,
      params: firstSectionId ? { sectionId: firstSectionId } : {},
    });
  };

  const handleTestComplete = async () => {
    try {
      Alert.alert('Isuzuma ribanziriza isomo ryakozwe neza', 'Komeza isomo', [
        {
          text: 'Komeza',
          onPress: navigateToFirstSection,
        },
      ]);
    } catch (error) {
      console.log('error:', error);
      navigateToFirstSection();
    }
  };

  const loading = workspaceLoading || testLoading;
  if (loading) return <LoadingSpinner />;
  if (!course || !preTest) return null;

  return (
    <Questionnaire
      test={[preTest]}
      onComplete={handleTestComplete}
      currentPage="pre-test"
      firstHeaderSubtitle="Isuzumabumenyi"
      lastHeaderSubtitle="Isuzumabumenyi"
      resultsTitle="Ikizamini Kirarangiye!"
      resultsSubtitle="Turagushimiye — Ibisubizo byawe byakiriwe"
      cheerText="Wakoze! Urakoze cyane ku kwitabira — komereza aho 🎉"
    />
  );
}
