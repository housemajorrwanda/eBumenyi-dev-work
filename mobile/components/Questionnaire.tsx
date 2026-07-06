import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Bot, Menu, CheckCircle, Circle, CheckSquare, Square } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { attemptTest } from '@/services/course.api';
import {
  fetchCourseWorkspace,
  normalizeCourseId,
  syncWorkspaceAfterPreTest,
  COURSE_WORKSPACE_QUERY_KEY,
} from '@/hooks/useCourseWorkspace';
import { findNextIncompleteSectionId } from '@/utils/courseWorkspace';
import { useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import BackButtonContext from '@/contexts/BackButtonContext';
import { ICourse, ITest, IQuestionnaire as ServerQuestionnaire, IOption as ServerOption, CreateAttempTestDto, IQuestionnaire } from '@/types';
import { CourseDrawer } from './CourseDrawer';
import CoursePerformanceFeedback from './CoursePerformanceFeedback';
import PostCourseRecommendationsModal from './PostCourseRecommendationsModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TestComponentProps {
  test: ITest[];
  currentPage: string;
  firstHeaderSubtitle: string;
  lastHeaderSubtitle: string;
  resultsTitle: string;
  resultsSubtitle: string;
  cheerText: string;
  /** Optional; pre-test navigation uses Komeza on the results screen instead of Alert. */
  onComplete?: (answers: Record<string, string[]>) => void;
  handleTestComplete?: () => void;
  showResultsExternally?: boolean;
}

// Local Question / Option types
interface LocalOption {
  id: number;
  label: string;
  image?: string | null;
}

interface LocalQuestion {
  id: number;
  question: string;
  questionImage?: string | null;
  feedbackStatement?: string | null;
  allowMultiple: boolean;
  options: LocalOption[];
}

const Questionnaire = forwardRef(function Questionnaire({ 
  test, 
  currentPage, 
  firstHeaderSubtitle, 
  lastHeaderSubtitle, 
  resultsTitle, 
  resultsSubtitle, 
  cheerText, 
  onComplete,
  handleTestComplete,
  showResultsExternally
}: TestComponentProps, ref) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { courseId } = useLocalSearchParams();
  const courseIdStr = normalizeCourseId(courseId as string | string[] | undefined);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({});
  const [fetchedQuestions, setFetchedQuestions] = useState<LocalQuestion[]>([]);
  const [courseDetails, setCourseDetails] = useState<ICourse | null>(null);
  const [questionnaireMapping, setQuestionnaireMapping] = useState<Record<number, { questionnaireId: string; originalOptionIds: string[] }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<any>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [recModalVisible, setRecModalVisible] = useState(false);

  // Animation refs
  const congratsScale = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const flowerAnim = useRef(
    Array.from({ length: 7 }).map(() => ({
      translateY: new Animated.Value(30),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  const confettiAnim = useRef(
    Array.from({ length: 18 }).map(() => ({
      translateY: new Animated.Value(20 + Math.random() * 20),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  // AsyncStorage helpers
  const storeTestCompletion = async (courseId: string, chapterId: string | null, testType: string) => {
    try {
      const key = `test_completion_${courseId}`;
      const existingData = await AsyncStorage.getItem(key);
      const completions = existingData ? JSON.parse(existingData) : {};
      
      if (chapterId) {
        if (!completions[chapterId]) completions[chapterId] = {};
        completions[chapterId][testType] = { completed: true, timestamp: new Date().toISOString() };
      } else {
        completions[testType] = { completed: true, timestamp: new Date().toISOString() };
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(completions));
    } catch (error) {
      console.log('Error storing test completion:', error);
    }
  };


  const getCourseReviewStatus = async (courseId: string): Promise<boolean> => {
    try {
      const key = `course_review_${courseId}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const reviewData = JSON.parse(data);
        return reviewData.isReviewed || false;
      }
      return false;
    } catch (error) {
      console.log('Error getting course review status:', error);
      return false;
    }
  };

  const storeChapterCompletion = async (courseId: string, chapterId: string) => {
    try {
      const key = `chapter_completion_${courseId}`;
      const existingData = await AsyncStorage.getItem(key);
      const completions = existingData ? JSON.parse(existingData) : {};
      completions[chapterId] = { completed: true, timestamp: new Date().toISOString() };
      await AsyncStorage.setItem(key, JSON.stringify(completions));
    } catch (error) {
      console.log('Error storing chapter completion:', error);
    }
  };


  // Map tests to local questions
  const mapTestsToLocal = React.useCallback((tests: ITest[]): { 
    questions: LocalQuestion[]; 
    correctMap: Record<number, number[]>;
    questionnaireMapping: Record<number, { questionnaireId: string; originalOptionIds: string[] }>;
  } => {
    const questions: LocalQuestion[] = [];
    const correctMap: Record<number, number[]> = {};
    const questionnaireMapping: Record<number, { questionnaireId: string; originalOptionIds: string[] }> = {};
    let qIndex = 0;
    
    tests.forEach((t: ITest) => {
      (t.course.questionnaires || []).forEach((q: ServerQuestionnaire) => {
        const originalOptions = (q.options || []).map((opt: ServerOption, oi: number) => ({ 
          originalIndex: oi,
          originalId: opt.id, 
          id: oi, 
          label: opt.label, 
          image: opt.image 
        }));
        // NO SHUFFLE: keep original order
        const opts: LocalOption[] = originalOptions.map((opt, newIndex) => ({ 
          id: newIndex, 
          label: opt.label, 
          image: opt.image 
        }));
        questionnaireMapping[qIndex] = {
          questionnaireId: q.id,
          originalOptionIds: originalOptions.map(opt => opt.originalId)
        };
        questions.push({ 
          id: qIndex, 
          question: q.question, 
          questionImage: q.questionImage || null, 
          feedbackStatement: q.feedbackStatement || null,
          allowMultiple: !!q.allowMultiple, 
          options: opts 
        });
        correctMap[qIndex] = [];
        qIndex += 1;
      });
    });
    // NO SHUFFLE: keep original order
    return { questions, correctMap, questionnaireMapping };
  }, []);

  // Memoized mapping from props
  const mappedFromProp = React.useMemo(() => {
    if (Array.isArray(test) && test.length > 0) return mapTestsToLocal(test);
    return null;
  }, [test, mapTestsToLocal]);

  const questions: LocalQuestion[] = mappedFromProp ? mappedFromProp.questions : fetchedQuestions;

  // Initialize from mapped props
  useEffect(() => {
    if (mappedFromProp) {
      setFetchedQuestions(mappedFromProp.questions);
      setQuestionnaireMapping(mappedFromProp.questionnaireMapping);
    }
  }, [mappedFromProp, test]);

  // Results animation
  useEffect(() => {
    if (showResults) {
      Animated.spring(congratsScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();

      const flowerAnimations = flowerAnim.map((f, i) =>
        Animated.sequence([
          Animated.parallel([
            Animated.timing(f.translateY, {
              toValue: -120 - Math.random() * 40,
              duration: 900 + Math.random() * 400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(f.opacity, {
              toValue: 1,
              duration: 400,
              delay: i * 80,
              useNativeDriver: true,
            }),
            Animated.timing(f.rotate, {
              toValue: Math.random() * 360,
              duration: 1000 + Math.random() * 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(400), // hold visible for a bit
          Animated.parallel([
            Animated.timing(f.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(f.translateY, {
              toValue: -180,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      Animated.stagger(90, flowerAnimations).start();

      const confettiAnims = confettiAnim.map((c, i) =>
        Animated.parallel([
          Animated.timing(c.translateY, {
            toValue: -180 - Math.random() * 80,
            duration: 900 + Math.random() * 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(c.translateX, {
            toValue: (Math.random() - 0.5) * 250,
            duration: 900 + Math.random() * 700,
            useNativeDriver: true,
          }),
          Animated.timing(c.opacity, {
            toValue: 1,
            duration: 300,
            delay: Math.random() * 400,
            useNativeDriver: true,
          }),
          Animated.timing(c.rotate, {
            toValue: Math.random() * 360,
            duration: 1200 + Math.random() * 600,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.stagger(30, confettiAnims).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
          Animated.timing(buttonPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [buttonPulse, confettiAnim, congratsScale, flowerAnim, showResults]);

  // Back button handling
  const backCtx = React.useContext(BackButtonContext);
  useEffect(() => {
    const handler = () => {
      if (!showResults && currentQuestionIndex > 0) {
        setCurrentQuestionIndex((p) => p - 1);
        return true;
      }
      return false;
    };
    backCtx.registerHandler(handler);
    return () => backCtx.unregisterHandler(handler);
  }, [backCtx, currentQuestionIndex, showResults]);

  // Question navigation and selection
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex] || ({} as LocalQuestion);

  const isSelected = (questionId: number, optionId: number) => {
    const answer = answers[questionId];
    if (answer == null) return false;
    if (Array.isArray(answer)) return answer.includes(optionId);
    return answer === optionId;
  };

  const handleAnswerSelect = (optionIndex: number) => {
    const q = currentQuestion;
    const qid = q.id;

    setAnswers((prev) => {
      const prevAnswer = prev[qid];

      if (q.allowMultiple) {
        const list = Array.isArray(prevAnswer) ? [...prevAnswer] : [];
        const exists = list.includes(optionIndex);
        if (exists) {
          return { ...prev, [qid]: list.filter((i) => i !== optionIndex) };
        }
        list.push(optionIndex);
        return { ...prev, [qid]: list };
      }

      return { ...prev, [qid]: optionIndex };
    });
  };

  const hasAnsweredCurrent = () => {
    if (!currentQuestion) return false;
    const ans = answers[currentQuestion.id];
    if (currentQuestion.allowMultiple) {
      return Array.isArray(ans) && ans.length > 0;
    }
    return typeof ans === 'number';
  };

  // Test completion handler
  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const questionAnswers: { questionnaireId: string; selectedAnswerIds: string[] }[] = [];
      Object.entries(answers).forEach(([qid, val]) => {
        const questionIndex = parseInt(qid);
        const mapping = questionnaireMapping[questionIndex];
        if (mapping) {
          // Find the original questionnaire to get option IDs
          let questionnaire: IQuestionnaire | undefined;
          if (Array.isArray(test) && test.length > 0) {
            questionnaire = test[0].course.questionnaires?.find(q => q.id === mapping.questionnaireId);
          } else if (courseDetails) {
            questionnaire = courseDetails.questionnaires?.find(q => q.id === mapping.questionnaireId);
          }
          if (!questionnaire) return;
          const selectedIndices = Array.isArray(val) ? val : [val];
          // Map indices to option IDs
          const selectedAnswerIds = selectedIndices
            .map(index => questionnaire && questionnaire.options[index]?.id)
            .filter(Boolean) as string[];
          questionAnswers.push({
            questionnaireId: mapping.questionnaireId,
            selectedAnswerIds
          });
        }
      });

      let testId: string | null = null;
      let testType: 'preTestId' | 'finalTestId' | 'finalExamId' | 'midTestId' = 'preTestId';
      if (Array.isArray(test) && test.length > 0) {
        testId = test[0].id;
        const firstQuestionnaire = test[0].course.questionnaires?.[0];
        if (firstQuestionnaire) {
          if (currentPage.includes('final-test')) {
            testType = 'finalTestId';
            testId = test[0].id;
          } else if (currentPage.includes('pre-test')) {
            testType = 'preTestId';
            testId = test[0].id;
          } else if (currentPage.includes('final-exam')) {
            testType = 'finalExamId';
            testId = test[0].id;
          } else if (currentPage.includes('midtest') || currentPage.includes('mid-test')) {
            testType = 'midTestId';
            testId = test[0].id;
          }
        } else if (currentPage.includes('midtest') || currentPage.includes('mid-test')) {
          testType = 'midTestId';
          testId = test[0].id;
        }
      } else {
        if (currentPage.includes('final-test')) {
          testType = 'finalTestId';
          testId = courseDetails?.finalTest?.[0]?.id || null;
        } else if (currentPage.includes('pre-test')) {
          testType = 'preTestId';
          testId = courseDetails?.preTests?.[0]?.id || null;
        }
        else if (currentPage.includes('final-exam')) {
          testType = 'finalExamId';
          testId = courseDetails?.finalExam?.[0]?.id || null;
        }
        // No midTest at course level
      }
      if (!testId) throw new Error('Test ID not found');
      // Build testData with only the correct testId field
      const testData: CreateAttempTestDto = {
        tryCount: 1,
        questionAnswers,
        [testType]: testId
      };
      console.log("testData:", JSON.stringify(testData, null, 2));
      const result = await attemptTest(testData);
      console.log("result:", JSON.stringify(result, null, 2))
      setAttemptResult(result); // Save full backend result

      const chapterId = currentPage.includes('chapters') ? currentPage.split('/')[1] : null;
      await storeTestCompletion(courseId as string, chapterId, testType);

      if (testType === 'finalTestId' && chapterId) {
        await storeChapterCompletion(courseId as string, chapterId);
        router.back();
        return;
      }

      // For pre-test, refresh workspace then notify parent (unlocks chapters immediately)
      if (currentPage && currentPage.includes('pre-test')) {
        if (courseIdStr) {
          try {
            await syncWorkspaceAfterPreTest(queryClient, courseIdStr);
          } catch (syncErr) {
            console.log('Pre-test workspace sync failed:', syncErr);
          }
        }
        if (onComplete) {
          onComplete(answers as unknown as Record<string, string[]>);
        }
        return;
      }

      setShowResults(true);
      
    } catch (error: any) {
      // Enhanced error logging
      console.log('Test submission failed:', error);
      if (error?.response?.data) {
        console.log('Error response data:', error.response.data);
      }
      console.log('User submitted answers/options:', answers);
      
      // For pre-test, still navigate even on error
      if (currentPage && currentPage.includes('pre-test')) {
        if (onComplete) {
          onComplete(answers as unknown as Record<string, string[]>);
        }
        return;
      }
      
      setShowResults(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (Array.isArray(test) && test.length > 0) {
      const { questions: newQuestions, questionnaireMapping: newMapping } = mapTestsToLocal(test);
      setFetchedQuestions(newQuestions);
      setQuestionnaireMapping(newMapping);
    }
    
    setAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setShowInstructions(true);
  };

  const handleContinue = async () => {
    // Pre-test: unlock + progress use "attempted" (chapters screen); go back to course outline
    if (currentPage?.includes('pre-test') && courseIdStr) {
      try {
        await syncWorkspaceAfterPreTest(queryClient, courseIdStr);
        const workspace = queryClient.getQueryData<Awaited<ReturnType<typeof fetchCourseWorkspace>>>([
          COURSE_WORKSPACE_QUERY_KEY,
          courseIdStr,
        ]);
        const firstSectionId = workspace?.course?.sections?.[0]?.id;
        router.replace({
          pathname: `/courses/${courseIdStr}/chapters`,
          params: firstSectionId ? { sectionId: firstSectionId } : {},
        });
      } catch {
        router.replace(`/courses/${courseIdStr}/chapters` as never);
      }
      return;
    }

    // --- Final Test Completion Sync ---
    if (currentPage === 'final-test' && courseIdStr) {
      // Check if course has been reviewed
      const isReviewed = await getCourseReviewStatus(courseIdStr as string);
      console.log('Course review status:', isReviewed);
      
      if (!isReviewed) {
        // Course not reviewed yet - trigger review modal
        console.log('Course not reviewed, triggering review modal');
        if (onComplete) {
          // Convert answers to the format expected by onComplete
          const testAnswers: Record<string, string[]> = {};
          Object.entries(answers).forEach(([qid, val]) => {
            const questionIndex = parseInt(qid);
            const mapping = questionnaireMapping[questionIndex];
            if (mapping) {
              const selectedIndices = Array.isArray(val) ? val : [val];
              testAnswers[mapping.questionnaireId] = selectedIndices.map(String);
            }
          });
          console.log('Calling onComplete with testAnswers:', testAnswers);
          onComplete(testAnswers);
          return;
        }
      } else {
        console.log('Course already reviewed, navigating directly');
      }
      
      // Course already reviewed or no onComplete handler - direct navigation
      try {
        const workspace = await fetchCourseWorkspace(queryClient, courseIdStr, { force: true });
        const nextSectionId = workspace.progress?.chapterProgress
          ? findNextIncompleteSectionId(workspace.course, workspace.progress.chapterProgress)
          : workspace.course.sections[0]?.id;
        router.push({ pathname: `/courses/${courseIdStr}/chapters`, params: { sectionId: nextSectionId } });
        return;
      } catch (e) {
        console.log('Failed to sync final test completion', e);
      }
    } else {
       router.push({ pathname: `/courses/${courseIdStr}/chapters` });
    }
  };

  // Load course data (retry: API restarts / brief offline cause Axios "Network Error" and empty courseDetails)
  useEffect(() => {
    let mounted = true;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function load() {
      const maxAttempts = 3;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (!courseIdStr) return;
          const workspace = await fetchCourseWorkspace(queryClient, courseIdStr);
          if (!mounted) return;
          setCourseDetails(workspace.course);

          if (!Array.isArray(test) || test.length === 0) {
            const serverTests: ITest[] = [];
            workspace.course.sections?.forEach((s: any) => {
              if (s.preTests && s.preTests.length > 0) serverTests.push(...s.preTests);
              s.chapters?.forEach((ch: any) => {
                if (ch.finalTest) serverTests.push(ch.finalTest);
              });
            });

            if (serverTests.length > 0) {
              const { questions: mapped, questionnaireMapping: qMapping } = mapTestsToLocal(serverTests);
              if (mounted) {
                setFetchedQuestions(mapped);
                setQuestionnaireMapping(qMapping);
              }
            }
          }
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < maxAttempts && mounted) {
            await delay(400 * attempt);
          }
        }
      }
      if (mounted) {
        console.log('Failed to load test questions', lastErr);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [courseIdStr, mapTestsToLocal, queryClient, test]);

  useImperativeHandle(ref, () => ({
    showResults: () => setShowResults(true),
  }));

  useEffect(() => {
    if (showResultsExternally) setShowResults(true);
  }, [showResultsExternally]);

  const insets = useSafeAreaInsets();
  // hide numeric score for pre-tests
  const isPreTest = !!(currentPage && currentPage.includes('pre-test'));
  const isFinalExamPage = !!(currentPage && currentPage.includes('final-exam'));

  // Instructions Page
  if (showInstructions) {
    return (
      <View style={styles.container}>
        <Header />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setDrawerVisible(true)} activeOpacity={0.7}>
            <Menu size={24} color="#3363AD" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerSubtitle}>{isPreTest ? 'Amabwiriza y\'isuzumabumenyi ribanziriza isomo' : 'Amabwiriza y\'isuzuma'}</Text>
          </View>
          <View style={styles.profileContainer}>
            <Bot color="#3363AD" size={36} />
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.instructionsContainer}>
        
         <View style={styles.instructionsCard}>
         {isPreTest ? (
              <>
                <Text style={styles.instructionsTitle}>Amabwiriza y&apos;isuzumabumenyi ribanziriza isomo</Text>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>1.</Text>
              <Text style={styles.instructionText}>Kanda ahanditse &quot;Tangira isuzuma&quot; ujye ku isuzumabumenyi ribanziriza isomo.</Text>
            </View>
  <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>2.</Text>
              <Text style={styles.instructionText}>Soma buri kibazo witonze, maze uhitemo igisubizo kimwe cyangwa byinshi, bitewe n&apos;uko ikibazo cyabajijwe.</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>3.</Text>
              <Text style={styles.instructionText}>Nta manota agena gutsinda cyangwa gutsindwa - intego ni ukumenya urwego rw&apos;ubumenyi bwawe mbere yo gutangira isomo.</Text>
            </View>

                <Text style={[styles.instructionText, { marginBottom: 12 }]}>Ibibazo bigomba gusubizwa:{test[0].questionToBeAnswered}.</Text>

                <Text style={styles.instructionsNote}>• Nta gihe ntarengwa cyagenywe cyo gusubiza.</Text>
              </>
            ) : (
              <>
            <Text style={styles.instructionsTitle}>Amabwiriza y&rsquo;isuzuma</Text>
            
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>1.</Text>
              <Text style={styles.instructionText}>Kanda ahanditse &quot;Tangira isuzuma&quot; ujye ku isuzumabumenyi ribanziriza isomo.</Text>
            </View>
  <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>2.</Text>
              <Text style={styles.instructionText}>Soma buri kibazo witonze, maze uhitemo igisubizo kimwe cyangwa byinshi, bitewe n&apos;uko ikibazo cyabajijwe.</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>3.</Text>
              <Text style={styles.instructionText}>Nta manota agena gutsinda cyangwa gutsindwa - intego ni ukumenya urwego rw&apos;ubumenyi bwawe mbere yo gutangira isomo.</Text>
            </View>
            
            <Text style={styles.instructionsNote}>• Ibibazo bigomba gusubizwa: {test[0].questionToBeAnswered}</Text>
  {!isPreTest && (
              <Text style={styles.instructionsNote}>• Amanota yo kwemererwa: {test && test.length > 0 ? test[0].marksToPass : 75}%</Text>
            )}
            <Text style={styles.instructionsNote}>• Nta gihe ntarengwa cyagenywe cyo gusubiza.</Text>
          </> 
            )}
           </View>
        </ScrollView>
        {/* Fixed instructions buttons at the bottom */}
        <View style={[styles.instructionsButtonsFixed, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Hagarika</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startButton} onPress={() => setShowInstructions(false)}>
            <Text style={styles.startButtonText}>Tangira isuzuma</Text>
          </TouchableOpacity>
        </View>

        {courseDetails && (
          <CourseDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} course={courseDetails} currentPage={currentPage} />
        )}
      </View>
    );
  }

  // Results Page
  if (showResults && attemptResult) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <Header />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setDrawerVisible(true)} activeOpacity={0.7}>
            <Menu size={24} color="#3363AD" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerSubtitle}>{lastHeaderSubtitle}</Text>
          </View>
          <View style={styles.profileContainer}>
            <Bot color="#3363AD" size={36} />
          </View>
        </View>

        {/* Animations */}
        <View style={styles.resultsBackground} pointerEvents="none">
          {flowerAnim.map((f, i) => {
            const rotate = f.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.flower,
                  {
                    left: `${10 + i * 12}%`,
                    opacity: f.opacity,
                    transform: [
                      { translateY: f.translateY },
                      { rotate },
                      { scale: f.opacity.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
                    ],
                  },
                ]}
              >
                {['🌸', '🌺', '💐', '🌼', '🌻', '✨', '🎉'][i % 7]}
              </Animated.Text>
            );
          })}
        </View>
        <ScrollView style={styles.resultsScroll} contentContainerStyle={[styles.resultsScrollContent, { paddingBottom: 32 }]}> 
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <CoursePerformanceFeedback
              courseId={courseId as string}
              performanceType={attemptResult.marks >= attemptResult.testInfo?.marksToPass ? 'pass' : 'fail'}
              marks={attemptResult.marks}
              totalMarks={100}
              showAnswers={showAnswers}
              onToggleAnswers={() => setShowAnswers((v) => !v)}
            />
            {isPreTest ? (
              <Text style={[styles.resultsSubtitle, { marginTop: 8, textAlign: 'center', paddingHorizontal: 12 }]}>
                Amanota yawe yabitswe. Ushobora gukomeza isomo nubwo utaratsinze — isuzuma ni ukwerekana uko umenye mbere.
              </Text>
            ) : null}
          </View>
          {showAnswers && (
            <View style={{ width: '100%' }}>
              {attemptResult.attemptAnswers?.map((ans: any, idx: number) => {
                // Find the full questionnaire (with options) from test data
                let fullQuestionnaire = null;
                if (Array.isArray(test) && test.length > 0) {
                  for (const t of test) {
                    if (t.course && Array.isArray(t.course.questionnaires)) {
                      const found = t.course.questionnaires.find((q: any) => q.id === ans.questionnaireId);
                      if (found) { fullQuestionnaire = found; break; }
                    }
                  }
                }
                // fallback: try courseDetails
                if (!fullQuestionnaire && courseDetails && Array.isArray(courseDetails.questionnaires)) {
                  fullQuestionnaire = courseDetails.questionnaires.find((q: any) => q.id === ans.questionnaireId);
                }
                const options = fullQuestionnaire?.options || [];
                const allowMultiple = fullQuestionnaire?.allowMultiple;
                return (
                  <View key={ans.id} style={styles.resultAnswerCard}>
                    <Text style={styles.resultQuestionText}>
                      {idx + 1}. {ans.questionnaire?.question || fullQuestionnaire?.question || ''}
                    </Text>
                    {options.length > 0 ? options.map((opt: any) => {
                      const backendOptionId = opt.id;
                      const isSelected = ans.selectedAnswerIds?.includes(backendOptionId);
                      const isCorrect = ans.correctAnswerIds
                        ? ans.correctAnswerIds.includes(backendOptionId)
                        : ans.correctAnswerLabels?.includes(opt.label);
                      let color = '#1E293B';
                      let bg = 'transparent';
                      let icon = null;
                      if (allowMultiple) {
                        if (isSelected && isCorrect) { color = '#059669'; bg = '#D1FAE5'; icon = '✔️'; }
                        else if (isSelected && !isCorrect) { color = '#DC2626'; bg = '#FEE2E2'; icon = '❌'; }
                        else if (!isSelected && isCorrect) { color = '#059669'; bg = '#F0FDF4'; icon = '🟢'; }
                      } else {
                        if (isSelected && isCorrect) { color = '#059669'; bg = '#D1FAE5'; icon = '✔️'; }
                        else if (isSelected && !isCorrect) { color = '#DC2626'; bg = '#FEE2E2'; icon = '❌'; }
                        else if (!isSelected && isCorrect) { color = '#059669'; bg = '#F0FDF4'; icon = '🟢'; }
                      }
                      return (
                        <View key={backendOptionId} style={[styles.resultOptionRow, { backgroundColor: bg }]}>
                          <View style={[styles.resultOptionDot, { backgroundColor: isSelected ? color : '#D1D5DB' }]} />
                          <Text style={[styles.resultOptionText, { color }]}>
                            {opt.label} {icon}
                          </Text>
                        </View>
                      );
                    }) : (
                      <Text style={{ color: '#64748B', fontStyle: 'italic' }}>Nta bisubizo bibonetse kuri iki kibazo</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            {isPreTest ? (
              <>
                {attemptResult.marks < (attemptResult.testInfo?.marksToPass ?? 0) ? (
                  <TouchableOpacity
                    style={[styles.retryButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4, marginBottom: 12 }]}
                    onPress={handleRetry}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', marginRight: 8 }}>Ongera</Text>
                    <Text style={{ fontSize: 22 }}>🔄</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.continueButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 }]}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', marginRight: 8 }}>Komeza ku isomo</Text>
                  <Text style={{ fontSize: 22 }}>➡️</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {attemptResult.marks >= attemptResult.testInfo?.marksToPass ? (
                  <TouchableOpacity style={[styles.continueButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 }]} onPress={handleContinue} activeOpacity={0.85}>
                    <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', marginRight: 8 }}>Komeza</Text>
                    <Text style={{ fontSize: 22 }}>➡️</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.retryButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 }]} onPress={handleRetry} activeOpacity={0.85}>
                    <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', marginRight: 8 }}>Ongera</Text>
                    <Text style={{ fontSize: 22 }}>🔄</Text>
                  </TouchableOpacity>
                )}
                {isFinalExamPage && (
                  <TouchableOpacity
                    style={styles.recInamaButton}
                    onPress={() => setRecModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 20, marginRight: 8 }}>💡</Text>
                    <Text style={styles.recInamaButtonText}>Reba inama</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
        <PostCourseRecommendationsModal
          visible={recModalVisible}
          courseId={typeof courseId === 'string' ? courseId : undefined}
          onClose={() => setRecModalVisible(false)}
        />
      </View>
    );
  }

  // Main Questionnaire
  return (
    <View style={styles.container}>
      <Header />

      <View style={styles.testTopBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => setDrawerVisible(true)} activeOpacity={0.7}>
          <Menu size={24} color="#3363AD" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSubtitle} numberOfLines={2}>
            {firstHeaderSubtitle}
          </Text>
        </View>
        <View style={styles.profileContainer}>
          <Bot color="#3363AD" size={36} />
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.questionCounter}>
          Ikibazo {currentQuestionIndex + 1} / {totalQuestions}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.questionScrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.questionCard}>
          <View style={styles.questionRow}>
            <View style={styles.questionNumberBadge}>
              <Text style={styles.questionNumberText}>{currentQuestionIndex + 1}</Text>
            </View>
            <View style={styles.questionBody}>
              <Text style={styles.questionTextReadable}>{currentQuestion?.question}</Text>
              {currentQuestion?.allowMultiple ? (
                <Text style={styles.multiSelectHint}>Hitamo kimwe cg byinshi</Text>
              ) : null}
            </View>
          </View>

          {currentQuestion?.questionImage ? (
            <Image
              source={{ uri: currentQuestion.questionImage }}
              style={styles.questionImageReadable}
              resizeMode="contain"
            />
          ) : null}
        </View>

        <View style={styles.optionsContainer}>
          {currentQuestion?.options.map((option, index) => {
            const selected = isSelected(currentQuestion.id, option.id);
            const optionLetter = String.fromCharCode(65 + index);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.optionButtonReadable, selected && styles.selectedOptionReadable]}
                onPress={() => handleAnswerSelect(index)}
                activeOpacity={0.85}
              >
                <View style={[styles.optionLetterBadge, selected && styles.optionLetterBadgeSelected]}>
                  <Text style={[styles.optionLetterText, selected && styles.optionLetterTextSelected]}>
                    {optionLetter}
                  </Text>
                </View>

                <View style={styles.optionContent}>
                  <Text style={[styles.optionTextReadable, selected && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                  {option.image ? (
                    <Image
                      source={{ uri: option.image }}
                      style={styles.optionImage}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>

                <View style={[styles.optionCheckIcon, selected && styles.optionCheckIconSelected]}>
                  {currentQuestion.allowMultiple ? (
                    selected ? <CheckSquare size={18} color="#3363AD" /> : <Square size={18} color="#94A3B8" />
                  ) : (
                    selected ? <CheckCircle size={18} color="#3363AD" /> : <Circle size={18} color="#94A3B8" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.navigationContainerFixed, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {currentQuestionIndex > 0 ? (
          <TouchableOpacity
            style={styles.previousButton}
            onPress={() => setCurrentQuestionIndex((p) => p - 1)}
          >
            <Text style={styles.previousButtonText}>Subira inyuma</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navButtonSpacer} />
        )}

        <TouchableOpacity
          style={[styles.nextButton, !hasAnsweredCurrent() && styles.disabledButton]}
          onPress={async () => {
            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex((p) => p + 1);
            } else if (currentPage && currentPage.includes('pre-test')) {
              try {
                await handleFinish();
              } catch (err) {
                console.log('handleFinish error:', err);
              }
            } else {
              await handleFinish();
            }
          }}
          disabled={!hasAnsweredCurrent() || isSubmitting}
        >
          <Text style={styles.nextButtonText}>
            {isSubmitting ? 'Gusoza...' : (currentQuestionIndex === questions.length - 1 ? 'Soza' : 'Komeza')}
          </Text>
        </TouchableOpacity>
      </View>

      {courseDetails && (
        <CourseDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          course={courseDetails}
          currentPage={currentPage}
        />
      )}
    </View>
  );
});

// Keep all your existing styles - they are comprehensive and well-structured
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { 
    backgroundColor: '#FFFF', 
    paddingTop: 10, 
    paddingBottom: 2, 
    paddingHorizontal: 10, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  backButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerContent: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerSubtitle: { 
    color: '#3363AD', 
    fontSize: 14, 
    fontWeight: '700', 
    opacity: 0.8, 
    marginBottom: 4, 
    marginRight: 8, 
    marginLeft: 8 
  },
  profileContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    overflow: 'hidden' 
  },
  content: { flex: 1 },
  testTopBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 2,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  questionNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(51, 99, 173, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  questionNumberText: {
    color: '#3363AD',
    fontSize: 14,
    fontWeight: '500',
  },
  questionBody: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  questionTextReadable: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  multiSelectHint: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '500',
    color: '#3363AD',
    backgroundColor: 'rgba(51, 99, 173, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  questionImageReadable: {
    width: '100%',
    minHeight: 160,
    maxHeight: 260,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressHeader: { 
    padding: 8, 
    paddingTop: 0, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  questionCounter: { 
    fontSize: 14, 
    color: '#64748B', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  progressBar: { 
    height: 4, 
    backgroundColor: '#E2E8F0', 
    borderRadius: 2 
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3363AD',
    borderRadius: 2,
  },
  questionContainer: {
    backgroundColor: '#3363AD',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#3363AD',
    borderRadius: 20,
    width: '90%',
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 4,
  },
  questionImageWrap: {
    width: '90%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#3363AD',
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  questionImage: {
    width: '100%',
    height: 220,
  },
  questionTextImage: {
    width: '90%',
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#3363AD',
    textAlign: 'center',
    marginBottom: 8,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'left',
  },
  optionsContainer: {
    gap: 10,
  },
  optionButtonReadable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  selectedOptionReadable: {
    backgroundColor: 'rgba(51, 99, 173, 0.06)',
    borderColor: '#3363AD',
  },
  optionLetterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  optionLetterBadgeSelected: {
    borderColor: '#3363AD',
    backgroundColor: '#3363AD',
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  optionLetterTextSelected: {
    color: '#FFFFFF',
  },
  optionContent: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  optionTextReadable: {
    flexShrink: 1,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  optionImage: {
    width: '100%',
    maxWidth: 220,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  optionCheckIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  optionCheckIconSelected: {},
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 16,
  },
  selectedOption: {
    backgroundColor: '#E6EEF9',
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checkSelected: {
    borderColor: '#3363AD',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#3363AD',
    lineHeight: 14,
  },
  selectedOptionText: {
    color: '#3363AD',
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navigationContainerFixed: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  navButtonSpacer: {
    flex: 1,
  },
  previousButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  previousButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#63758C',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3363AD',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Results styles
  resultsBackground: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 1,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 14,
    borderRadius: 3,
    zIndex: 15,
    opacity: 0.95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  flower: {
    position: 'absolute',
    bottom: 40,
    fontSize: 28,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  resultsScroll: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  resultsScrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  resultAnswerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    width: '100%',
  },
  resultQuestionText: {
    fontWeight: '700',
    color: '#3363AD',
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  resultOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  resultOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    flexShrink: 0,
  },
  resultOptionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D97706',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  marksContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  marksText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  passedText: {
    color: '#059669',
  },
  failedText: {
    color: '#DC2626',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexDirection: 'column',
  },
  continueButton: {
    backgroundColor: '#3363AD',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    width: '80%',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    width: '80%',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recInamaButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3363AD',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    width: '80%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3363AD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  recInamaButtonText: {
    color: '#3363AD',
    fontSize: 18,
    fontWeight: '700',
  },
  cheerText: {
    marginTop: 14,
    fontSize: 14,
    color: '#63758C',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Instructions styles
  instructionsContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3363AD',
    textAlign: 'center',
    marginBottom: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3363AD',
    width: 24,
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 20,
  },
  instructionsNote: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'left',
    marginTop: 4,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  instructionsButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  instructionsButtonsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  startButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3363AD',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default Questionnaire;