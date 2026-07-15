import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Questionnaire from '@/components/Questionnaire';
import { getFinalExamById } from '@/services/course.api';
import { ITest } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { normalizeCourseId, useCourseWorkspace } from '@/hooks/useCourseWorkspace';

export default function FinalExamScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const courseIdStr = normalizeCourseId(courseId);
  const router = useRouter();
  const { data: workspace, isLoading: workspaceLoading } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;
  const [finalTest, setFinalTest] = useState<ITest | null>(null);
  const [testLoading, setTestLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFinalExam = async () => {
      setLoadError(null);

      const examMeta = course?.finalExam?.[0];
      if (!examMeta?.id) {
        if (!cancelled) {
          setLoadError(
            'Iri somo ntabwo rifite ikizamini gisoza cyashyizweho. Subira inyuma cyangwa uvugane n’ubuyobozi.',
          );
          setTestLoading(false);
        }
        return;
      }

      try {
        const finalTestResponse = await getFinalExamById(examMeta.id);
        if (!cancelled) setFinalTest(finalTestResponse.data);
      } catch (error) {
        console.log('Error loading final exam:', error);
        if (!cancelled) {
          setLoadError('Ntibyashobotse gufungura ikizamini gisoza. Ongera ugerageze.');
        }
      } finally {
        if (!cancelled) setTestLoading(false);
      }
    };

    if (!workspaceLoading && course) {
      setTestLoading(true);
      void loadFinalExam();
    }

    return () => {
      cancelled = true;
    };
  }, [workspaceLoading, course]);

  const loading = workspaceLoading || testLoading;
  if (loading) return <LoadingSpinner />;
  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Subira inyuma</Text>
        </Pressable>
      </View>
    );
  }
  if (!course || !finalTest) return null;

  return (
    <Questionnaire
      test={finalTest ? [finalTest] : []}
      onComplete={() => {}}
      currentPage="final-exam"
      firstHeaderSubtitle="Ikizamini gisoza isomo(Certificate)"
      lastHeaderSubtitle="Ikizamini gisoza isomo(Certificate)"
      resultsTitle="Ikizamini Kirarangiye!"
      resultsSubtitle="Turagushimiye — Ibisubizo byawe byakiriwe"
      cheerText="Wakoze! Urakoze cyane ku kwitabira — komereza aho 🎉"
      showResultsExternally={false}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
