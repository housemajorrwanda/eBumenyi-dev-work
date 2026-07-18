import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Animated, Easing, RefreshControl, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import Header from '@/components/Header';
import { getAllCourse, getStudentCourseStats } from '@/services/course.api';
import { ICourse, ICourseResponse } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { validateUserToken } from '@/utils/tokenValidation';
import CourseCard from '@/components/CourseCard';
import { getLastViewedSlidePath } from '@/services/location';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

// Simple debounce function
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Animated no courses icon component
const AnimatedNoCoursesIcon = ({ isDark }: { isDark: boolean }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleAnim, floatAnim]);

  return (
    <Animated.View
      style={{
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: isDark ? '#fff' : '#4D81D2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
        backgroundColor: isDark ? 'rgba(77,129,210,0.12)' : 'rgba(77,129,210,0.08)',
        borderRadius: 80,
        width: 100,
        height: 100,
        alignSelf: 'center',
        transform: [
          { scale: scaleAnim },
          { translateY: floatAnim },
        ],
      }}
    >
      <Text style={{ fontSize: 54, textAlign: 'center', textShadowColor: isDark ? '#fff' : '#4D81D2', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>
        📚
      </Text>
    </Animated.View>
  );
};

const SkeletonCourseGrid = ({ isDark }: { isDark: boolean }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40) / 2; // matches grid padding

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const bg = isDark ? '#1f2937' : '#E8EDF8';
  const shimmer = isDark ? '#374151' : '#D0D9EE';

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            width: cardWidth,
            borderRadius: 12,
            marginBottom: 16,
            overflow: 'hidden',
            backgroundColor: bg,
            opacity,
            elevation: 2,
          }}
        >
          {/* image area */}
          <View style={{ height: 88, backgroundColor: shimmer }} />
          {/* title lines */}
          <View style={{ padding: 10, gap: 6 }}>
            <View style={{ height: 9, borderRadius: 5, backgroundColor: shimmer, width: '85%' }} />
            <View style={{ height: 9, borderRadius: 5, backgroundColor: shimmer, width: '60%' }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

function TrainingScreenContent() {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { notifications } = useNotificationsContext();
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceCourses = useTourStepAdvance('training-courses');
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete, triggerSync } = useOnboarding();
  const isFocused = useIsFocused();
  // If the user navigates away (tapping the real highlighted element can
  // itself trigger navigation, but this also covers back/tab-switch/etc.)
  // while a tour is visible, its CopilotProvider can stay mounted (stack
  // navigators often keep the previous screen alive) — without this, the
  // tour's Modal renders in RN's top-level layer and keeps floating over
  // whatever screen is now active. Close it on the focus transition.
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    if (wasFocusedRef.current && !isFocused && visible) {
      stop().catch(() => {});
    }
    wasFocusedRef.current = isFocused;
  }, [isFocused, visible, stop]);
  // Guards the auto-trigger effect below so it only ever attempts to start the
  // tour ONCE per screen session — see the matching guard in app/(tabs)/index.tsx
  // for why: without it, any re-run (e.g. isFocused blipping while the tour's
  // own tooltip Modal opens, or `start` changing identity on step registration)
  // would re-check "is the tour done?" (still false mid-tour) and call start()
  // again, silently resetting the user back to the first step.
  const autoStartAttemptedRef = useRef(false);
  const [searchData, setSearchData] = useState<ICourseResponse | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Token validation on component mount
  useEffect(() => {
    const checkTokenValidity = async () => {
      try {
        const validationResult = await validateUserToken();
        
        if (!validationResult.isValid && validationResult.shouldRedirect) {
          // Token is invalid, redirect to login
          router.replace(validationResult.redirectTo);
          return;
        }
        
        // Token is valid, continue with normal flow
        setIsValidatingToken(false);
        triggerSync();
      } catch (error) {
        console.log('Token validation error:', error);
        // On error, redirect to login for safety
        router.replace('/auth/login');
      }
    };

    checkTokenValidity();
  }, [router, triggerSync]);

  // Listen for course notifications and refresh
  useEffect(() => {
    const latest = notifications[0];
    if (latest && (latest as any).entityType === 'course' && !latest.isRead) {
      console.log('[TrainingScreen] Course notification — refreshing');
      queryClient.invalidateQueries({ queryKey: ['ALL_COURSES'] });
    }
  }, [notifications, queryClient]);

  // Fetch all courses with useQuery
  const { data: coursesResponse, isLoading: isCoursesLoading, refetch } = useQuery({
    queryKey: ['ALL_COURSES'],
    queryFn: () => getAllCourse(''),
    enabled: !isValidatingToken,
  });

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['ALL_COURSES'] });
      await refetch();
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mutation for search functionality
  const coursesMutation = useMutation({
    mutationFn: getAllCourse,
  });

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((searchq: string) => {
      if (searchq.trim()) {
        coursesMutation.mutate(`?searchq=${searchq}&page=1`, {
          onSuccess(result) {
            setSearchData(result);
          },
        });
      } else {
        setSearchData(null);
      }
    }, 100),
    [coursesMutation]
  );

  // Use search data if available, otherwise use regular courses
  const courses = useMemo(() => {
    if (searchData?.data) {
      return searchData.data;
    }
    return coursesResponse?.data || [];
  }, [coursesResponse?.data, searchData?.data]);

  const { data: courseStatsData } = useQuery({
    queryKey: ['STUDENT_STATS'],
    queryFn: getStudentCourseStats,
    enabled: !isValidatingToken,
  });

  // Refresh student stats whenever the tab comes into focus (e.g. returning from a course)
  useFocusEffect(
    useCallback(() => {
      if (!isValidatingToken) {
        queryClient.invalidateQueries({ queryKey: ['STUDENT_STATS'] });
        queryClient.invalidateQueries({ queryKey: ['ALL_COURSES'] });
      }
    }, [isValidatingToken, queryClient])
  );

  const handleCoursePress = (course: ICourse, courseIndex: number) => {
    const lastViewedPath = getLastViewedSlidePath(courseStatsData, course.id);
    if (lastViewedPath) {
      router.push(lastViewedPath);
    } else {
      router.push(`/courses/${course.id}/chapters`);
    }
  };

  // Start training tour once after data loads (guards against skeleton being spotlit).
  // Reads completion state straight from local storage (same pattern as the home
  // and course tours) instead of gating on OnboardingContext's `syncReady` — that
  // gate depends on a chain of async steps and if any link stalls, the tour
  // silently never fires. Also gated on `isFocused` since this tab can mount (and
  // its effects fire) before the user has actually navigated into it.
  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;

    if (
      !isValidatingToken &&
      !isCoursesLoading &&
      isFocused &&
      !autoStartAttemptedRef.current
    ) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.TRAINING);
        if (cancelled) return;
        if (!done) {
          cancelSchedule = scheduleTourStart(() => startRef.current());
        }
      })();
    }

    return () => {
      cancelled = true;
      cancelSchedule?.();
    };
  }, [isValidatingToken, isCoursesLoading, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.TRAINING).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents]);

  if (isValidatingToken) return <LoadingSpinner isDark={isDark} />;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
      <Header title={'Amasomo'} />
  

      <View 
        style={[styles.featureCard, { 
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
        }]}
      >
        <Text style={[styles.cardTitle, { 
          fontFamily: 'Inter-SemiBold',
          color: isDark ? '#ffffff' : '#63758C'
        }]}>
          Amasomo yahariwe umujyanama
        </Text>
      </View>
      {/* Search Input */}
      <CopilotStep
        text="Andika hano izina ry'isomo ushaka. Gushakisha biroroshye kandi birihuse!"
        order={1}
        name="training-search"
      >
        <WalkthroughableView style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, {
              backgroundColor: isDark ? '#1f2937' : '#f3f4f6',
              color: isDark ? '#ffffff' : '#111827'
            }]}
            placeholder="🔍 Andika izina ry' isomo hano..."
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            onChangeText={debouncedSearch}
          />
        </WalkthroughableView>
      </CopilotStep>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3363AD"
            title="Gufungura amakuru..."
            titleColor="#3363AD"
          />
        }
      >

        <CopilotStep
          text="Hano ubona amasomo yose ahariwe. Umubare ugaragara ku ifoto y'isomo wagaragaza intera wagezeho. Kanda ku isomo kugira ngo utangire kwiga!"
          order={2}
          name="training-courses"
        >
          <WalkthroughableView style={styles.coursesGrid}>
            {isCoursesLoading ? (
              <SkeletonCourseGrid isDark={isDark} />
            ) : courses.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <AnimatedNoCoursesIcon isDark={isDark} />
                <Text style={{ color: isDark ? '#fff' : '#4D81D2', fontSize: 16, fontWeight: '600', marginTop: 8 }}>Ntamasomo abonetse</Text>
              </View>
            ) : (
              courses.map((course, index) => (
                <CourseCard
                  key={course.id || index}
                  course={{
                    courseId: course.id,
                    coverIcon: course.coverIcon,
                    title: course.title,
                  }}
                  onPress={advanceCourses(() => handleCoursePress(course, index))}
                  showCapIcon
                  progress={course?.progresses[0]?.progress}
                  width={'48%'}
                />
              ))
            )}
          </WalkthroughableView>
        </CopilotStep>
      </ScrollView>
    </View>
  );
}

export default function TrainingScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      androidStatusBarVisible
      labels={{
        finish: 'Rangiza',
        next: 'Ibikurikiraho',
        previous: 'Inyuma',
        skip: 'Simbuka',
      }}
    >
      <TrainingScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    justifyContent: 'flex-end',
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 16,
    color: 'white',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIcon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  section: {
    marginTop: 10,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  sectionLabel: {
    fontSize: 12,
    marginHorizontal: 12,
    textAlign: 'center',
  },
  featureCard: {
    padding: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    gap: 0,
  },

});
