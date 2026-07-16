import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  Trophy,
  BookOpen,
  Book,
  Clock,
  MessageCircle,
} from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStudentCourseStats } from '@/services/course.api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IStudentCourse, CreateSystemReviewDto } from '@/types';
import { formatDate } from '@/utils/format';
import { validateUserToken } from '@/utils/tokenValidation';
import { getLastViewedSlidePath } from '@/services/location';
import RevisedCourseCard from '@/components/RevisedCourseCard';
import SystemReviewCard from '@/components/SystemReviewCard';
import StorageService from '@/services/storage.service';
import { systemReviewAPI } from '@/services/systemReview.api';
import WelcomeVideo from '@/components/WelcomeVideo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

function HomeScreenContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete: markTourComplete, triggerSync } = useOnboarding();
  const advanceActivityBanner = useTourStepAdvance('activity-banner');
  const advanceCarousel = useTourStepAdvance('course-carousel');
  const advanceFilters = useTourStepAdvance('filters');
  const advanceEnrolledCourses = useTourStepAdvance('enrolled-courses-list');
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
  // Guards the auto-trigger effect below so it only ever attempts to show the
  // welcome video / start the tour ONCE per screen session — not every time
  // `isFocused`/`start` change identity (e.g. the tour's own tooltip Modal can
  // cause brief navigation-focus blips, and react-native-copilot's `start`
  // changes identity whenever any step re-registers). Without this guard, each
  // re-run re-evaluates "is the tour done?" (still false mid-tour) and calls
  // start() again, silently resetting the user back to the first step.
  const autoStartAttemptedRef = useRef(false);
  const [activeQuickAction, setActiveQuickAction] = useState<number>(1);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [showSystemReview, setShowSystemReview] = useState(false);
  const [isSystemReviewed, setIsSystemReviewed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);

  const hasWelcomeBeenSeen = useCallback(async (): Promise<boolean> => {
    return onboardingService.hasCompleted(TOUR_KEYS.WELCOME_VIDEO);
  }, []);

  /** Returns true if the welcome modal was opened. */
  const showWelcomeVideoIfNeeded = useCallback(async (): Promise<boolean> => {
    const seen = await hasWelcomeBeenSeen();
    if (!seen) {
      setWelcomeModalVisible(true);
      return true;
    }
    return false;
  }, [hasWelcomeBeenSeen]);

  const startAppTourIfNeeded = useCallback(async () => {
    const done = await onboardingService.hasCompleted(TOUR_KEYS.APP);
    console.log(
      '[onboarding] startAppTourIfNeeded — app tour already done?',
      done
    );
    if (!done) {
      scheduleTourStart(() => {
        console.log(
          '[onboarding] startAppTourIfNeeded — calling start() now, fn:',
          typeof startRef.current
        );
        startRef.current();
      });
    }
  }, []);

  const handleWelcomeVideoDone = useCallback(() => {
    console.log('[onboarding] handleWelcomeVideoDone fired');
    setWelcomeModalVisible(false);
    // Uses the context's markComplete (not onboardingService's directly) so
    // completedTours updates reactively — the tab-bar tour in _layout.tsx
    // reads TOUR_KEYS.WELCOME_VIDEO through this same context to know when
    // it's safe to start, and it has no other way to observe this screen's
    // local modal-dismissal state.
    markTourComplete(TOUR_KEYS.WELCOME_VIDEO).catch(() => {});
    startAppTourIfNeeded();
  }, [startAppTourIfNeeded]);

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

        // Token is valid — trigger onboarding sync now that we have a valid JWT
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

  // fetch student-course-stats (declared here so isLoading is in scope for the tour useEffect below)
  const {
    data: courseStatsData,
    isLoading,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ['COURSE'],
    queryFn: getStudentCourseStats,
    gcTime: 0,
    enabled: !isValidatingToken,
  });

  // Welcome video first, then app tour (first-time users only).
  // Reads completion state straight from local storage (same pattern as the course
  // tour in chapters.tsx) instead of gating on OnboardingContext's `syncReady` —
  // that gate depends on a chain of async steps (token validation -> triggerSync ->
  // backend GET /onboarding) and if any link stalls, the tour silently never fires.
  //
  // Also gated on `isFocused`: this screen can be mounted (and its effects fire)
  // before the user has actually navigated into the home tab — e.g. while still
  // on the post-login module-selection screen, since the tabs navigator mounts
  // its screens eagerly. The welcome video is a real RN <Modal>, which renders in
  // a top-level native layer regardless of which JS screen is "visually active",
  // so without this gate it can pop up over an unrelated screen.
  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;

    console.log(
      '[onboarding] auto-effect run — isValidatingToken:',
      isValidatingToken,
      'isLoading:',
      isLoading,
      'isFocused:',
      isFocused,
      'alreadyAttempted:',
      autoStartAttemptedRef.current
    );

    if (
      !isValidatingToken &&
      !isLoading &&
      isFocused &&
      !autoStartAttemptedRef.current
    ) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const openedWelcome = await showWelcomeVideoIfNeeded();
        console.log(
          '[onboarding] auto-effect — openedWelcome:',
          openedWelcome,
          'cancelled:',
          cancelled
        );
        if (cancelled || openedWelcome) return;
        const done = await onboardingService.hasCompleted(TOUR_KEYS.APP);
        console.log('[onboarding] auto-effect — app tour already done?', done);
        if (cancelled) return;
        if (!done) {
          cancelSchedule = scheduleTourStart(() => {
            console.log(
              '[onboarding] auto-effect — calling start() now, fn:',
              typeof startRef.current
            );
            startRef.current();
          });
        }
      })();
    }

    return () => {
      cancelled = true;
      cancelSchedule?.();
    };
  }, [
    isValidatingToken,
    isLoading,
    isFocused,
    showWelcomeVideoIfNeeded,
  ]);

  // Diagnostic: trace the copilot lifecycle so we can see whether start() actually
  // finds a registered step (vs. silently retrying forever / never visually showing).
  useEffect(() => {
    const onStart = () =>
      console.log(
        '[onboarding][copilot] "start" event fired — a step was found'
      );
    const onStepChange = (step: any) =>
      console.log('[onboarding][copilot] "stepChange" ->', step?.name);
    const onStop = () =>
      console.log('[onboarding][copilot] "stop" event fired');
    copilotEvents.on('start', onStart);
    copilotEvents.on('stepChange', onStepChange);
    copilotEvents.on('stop', onStop);
    return () => {
      copilotEvents.off('start', onStart);
      copilotEvents.off('stepChange', onStepChange);
      copilotEvents.off('stop', onStop);
    };
  }, [copilotEvents]);

  // Mark app tour complete when copilot stops
  useEffect(() => {
    const handleStop = () => {
      console.log('[onboarding] copilot stopped — marking app tour complete');
      markTourComplete(TOUR_KEYS.APP).catch(() => {});
    };
    copilotEvents.on('stop', handleStop);
    return () => {
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, markTourComplete]);

  // Check system review status on component mount
  useEffect(() => {
    const checkSystemReviewStatus = async () => {
      try {
        const reviewStatus = await StorageService.getSystemReviewStatus();
        setIsSystemReviewed(reviewStatus);
      } catch (error) {
        console.log('Error checking system review status:', error);
      }
    };

    if (!isValidatingToken) {
      checkSystemReviewStatus();
    }
  }, [isValidatingToken]);

  // Handle system review submission
  const handleSystemReviewSubmit = async (
    reviewData: CreateSystemReviewDto
  ) => {
    try {
      // Submit to backend
      await systemReviewAPI.submitSystemReview(reviewData);

      // Store review status locally
      await StorageService.storeSystemReviewStatus(true);
      setIsSystemReviewed(true);

      Alert.alert('Murakoze!', 'Igitekerezo cyawe cyakiriwe neza.');
      setShowSystemReview(false);
    } catch (error) {
      console.log('Error submitting system review:', error);
      Alert.alert('Ikosa', 'Habaye ikosa mu kohereza igitekerezo.');
    }
  };

  // Static quick actions
  const quickActions = [
    { id: 1, title: 'Yose', icon: '📋', color: '#EFF1F8' },
    { id: 2, title: 'Watangiye', icon: '✓', color: '#EFF1F8' },
    { id: 3, title: 'Utaratangira', icon: '⏸', color: '#EFF1F8' },
  ];

  // Refresh course stats whenever the tab comes into focus (e.g. returning from a course)
  useFocusEffect(
    useCallback(() => {
      if (!isValidatingToken) {
        queryClient.invalidateQueries({ queryKey: ['COURSE'] });
      }
    }, [isValidatingToken, queryClient])
  );

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['COURSE'] });
      await refetch();
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle token validation loading state
  if (isValidatingToken) {
    return <LoadingSpinner message={'Gusuzuma uburenganzira...'} />;
  }

  // Handle loading and error states
  if (isLoading) {
    return <LoadingSpinner message={'Gufungura amakuru...'} />;
  }

  // Only show the error screen when we have nothing to display. A background
  // refetch (e.g. from useFocusEffect's invalidateQueries on every tab focus —
  // which fires right as the tour starts) can fail transiently while
  // courseStatsData still holds good cached data; replacing the whole screen
  // in that case unmounts every CopilotStep (including the ones in Header),
  // which resets the in-progress tour back to its first step.
  if (error && !courseStatsData) {
    return (
      <View style={styles.container}>
        <Header title={t('home')} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Habaye ikosa mu gufungura amakuru
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('home')} tourEnabled />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
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
        {/* Innovative Stats Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incamake y&apos; amasomo</Text>

          {/* Course Stats Row */}
          <CopilotStep
            text="Hano ubona incamake y'amasomo yawe: Amasomo yose ufite, ayo Watangiye kwiga, n'ayo Utaratangira."
            order={5}
            name="stats"
          >
            <WalkthroughableView style={styles.statsSecondaryRow}>
              <StatsCard
                Icon={Book}
                number={courseStatsData?.summary?.totalCourses || 0}
                title="Amasomo yose"
                backgroundColor="#4D81D2"
              />
              <StatsCard
                Icon={BookOpen}
                number={courseStatsData?.summary?.enrolledCourses || 0}
                title="Watangiye kwiga"
                backgroundColor="#649af1ff"
              />
              <StatsCard
                Icon={Clock}
                number={courseStatsData?.summary?.unenrolledCourses || 0}
                title="Ayo utaratangira"
                backgroundColor="#4788f1ff"
              />
            </WalkthroughableView>
          </CopilotStep>

          {/* Current Activity Banner - only show if there's last viewed location */}
          {courseStatsData?.lastViewedLocation?.courseId && (
            <View style={styles.activityBanner}>
              <View style={styles.activityLeft}>
                <View style={styles.activityIconWrapper}>
                  {courseStatsData?.lastViewedLocation?.coverIcon ? (
                    <Image
                      source={{
                        uri: courseStatsData.lastViewedLocation.coverIcon,
                      }}
                      style={styles.activityIconImage}
                      // resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.activityIcon}>📚</Text>
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {courseStatsData?.lastViewedLocation?.courseTitle}
                  </Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>
                    icyigwa {courseStatsData?.lastViewedLocation?.chapterNumber}
                    : {courseStatsData?.lastViewedLocation?.chapterTitle}
                  </Text>
                </View>
              </View>
              {/* The tooltip text instructs tapping 'Komeza' specifically —
                  target that button directly instead of the whole banner
                  (a wide target, containing icon/title/subtitle text too,
                  anchors the library's pointer away from the button and can
                  make the button un-tappable if the banner's measured hole
                  doesn't line up with the button's real position). */}
              <CopilotStep
                text="Iyi mirongo igaragaza isomo uheruka kwiga. Kanda 'Komeza' kugira ngo ukomereze aho wagarukiye."
                order={6}
                name="activity-banner"
              >
                <WalkthroughableTouchable
                  style={styles.activityRight}
                  onPress={advanceActivityBanner(() => {
                    const loc = courseStatsData?.lastViewedLocation;
                    if (loc?.courseId && loc?.sectionId && loc?.chapterId) {
                      if (loc.slideId) {
                        router.push(
                          `/courses/${loc.courseId}/${loc.chapterId}/course-content?slideId=${loc.slideId}`
                        );
                      } else {
                        router.push(
                          `/courses/${loc.courseId}/${loc.chapterId}/course-content?page=1`
                        );
                      }
                    }
                  })}
                  activeOpacity={0.8}
                >
                  <View style={styles.continueButton}>
                    <Text style={styles.continueButtonText}>Komeza</Text>
                  </View>
                </WalkthroughableTouchable>
              </CopilotStep>
            </View>
          )}
        </View>

        {/* Upcoming Courses */}

        <CopilotStep
          text="Aya ni amasomo ugiye gukurikira. Nyuza urutoki hano kugira ngo ubone andi menshi!"
          order={7}
          name="course-carousel"
        >
          <WalkthroughableView style={styles.section}>
            {courseStatsData?.courses
              ?.slice(0, 8)
              .filter((course: IStudentCourse) => !course.isEnrolled).length >
            0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  Amasomo agiye gukurikira
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.upcomingScrollContainer}
                >
                  {courseStatsData.courses
                    .filter((course: IStudentCourse) => !course.isEnrolled)
                    .slice(0, 12)
                    .map((course: IStudentCourse) => (
                      <RevisedCourseCard
                        key={course.courseId}
                        course={course}
                        onPress={advanceCarousel(() =>
                          router.push(
                            getLastViewedSlidePath(
                              courseStatsData,
                              course.courseId
                            )
                          )
                        )}
                      />
                    ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Amasomo aheruka</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.upcomingScrollContainer}
                >
                  {courseStatsData?.courses
                    ?.slice(0, 8)
                    .map((course: IStudentCourse) => (
                      <RevisedCourseCard
                        key={`recent-${course.courseId}`}
                        course={course}
                        onPress={advanceCarousel(() =>
                          router.push(
                            getLastViewedSlidePath(
                              courseStatsData,
                              course.courseId
                            )
                          )
                        )}
                      />
                    ))}
                </ScrollView>
              </>
            )}
          </WalkthroughableView>
        </CopilotStep>
        {/* Recent Courses */}
        {/* Quick Actions */}
        <CopilotStep
          text='Kanda kuri "Yose", "Watangiye" cyangwa "Utaratangira" kugira ngo uhite ubona amasomo ahuye n&apos;icyiciro ushaka kureba.'
          order={8}
          name="filters"
        >
          <WalkthroughableView style={styles.quickActions}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickAction,
                  {
                    backgroundColor:
                      activeQuickAction === action.id
                        ? '#4D81D2'
                        : action.color,
                  },
                ]}
                activeOpacity={0.85}
                onPress={advanceFilters(() => setActiveQuickAction(action.id))}
              >
                <View style={styles.quickActionRow}>
                  <Text style={styles.quickActionIcon}>{action.icon}</Text>
                  <Text
                    style={[
                      styles.quickActionTitle,
                      {
                        color:
                          activeQuickAction === action.id
                            ? action.color
                            : '#4D81D2',
                      },
                    ]}
                  >
                    {action.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </WalkthroughableView>
        </CopilotStep>
        {/* Tab Content - switch by activeQuickAction */}
        <View style={styles.section}>
          {/* All Courses tab */}
          {activeQuickAction === 1 && (
            <View>
              {courseStatsData?.courses?.length > 0 ? (
                courseStatsData.courses.map((course: IStudentCourse, index: number) => {
                const card = (
                  <TouchableOpacity
                    style={styles.compactCard}
                    activeOpacity={0.9}
                    onPress={advanceEnrolledCourses(() =>
                      router.push(
                        getLastViewedSlidePath(courseStatsData, course.courseId)
                      )
                    )}
                  >
                    <View style={styles.compactLeftWithPercent}>
                      <View style={styles.compactLeftRow}>
                        <View style={styles.compactAvatar}>
                          {course.coverIcon ? (
                            <Image
                              source={{ uri: course.coverIcon }}
                              style={styles.compactAvatarImage}
                            />
                          ) : (
                            <Text>📘</Text>
                          )}
                        </View>
                        <View style={styles.compactContent}>
                          <Text style={styles.compactTitle} numberOfLines={2}>
                            {course.title}
                          </Text>
                          <View style={styles.chipsRow}>
                            <View style={styles.chip}>
                              <Text
                                style={styles.chipText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                ibyigwa: {course.totalChapters}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text
                                style={styles.chipText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                Amasaha: {course.courseDuration}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text
                                style={styles.chipText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                Ibizamini: {course.totalTests}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      {course.progress > 0 && (
                        <View style={styles.percentWrapperInside}>
                          <View style={styles.percentCircleSmall}>
                            <Text style={styles.percentSmallText}>
                              {Math.round(course.progress)}%
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
                // Only the first course card is a tour target — spotlighting
                // the whole list left too little room for the tooltip to
                // fit without being clipped.
                if (index === 0) {
                  return (
                    <CopilotStep
                      key={course.courseId}
                      text="Hano hagaragara amasomo yawe, ukurikije icyiciro wahisemo haruguru. Kanda ku isomo kugira ngo utangire cyangwa ukomeze kwiga."
                      order={9}
                      name="enrolled-courses-list"
                    >
                      <WalkthroughableView>{card}</WalkthroughableView>
                    </CopilotStep>
                  );
                }
                return <React.Fragment key={course.courseId}>{card}</React.Fragment>;
                })
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>Nta masomo ahari</Text>
                </View>
              )}
            </View>
          )}

          {/* Enrolled Courses tab */}
          {activeQuickAction === 2 && (
            <View>
              {courseStatsData?.courses?.filter(
                (course: IStudentCourse) => course.isEnrolled
              ).length > 0 ? (
                courseStatsData.courses
                  .filter((course: IStudentCourse) => course.isEnrolled)
                  .map((course: IStudentCourse, index: number) => {
                  const card = (
                    <TouchableOpacity
                      style={styles.compactCard}
                      activeOpacity={0.9}
                      onPress={advanceEnrolledCourses(() =>
                        router.push(
                          getLastViewedSlidePath(
                            courseStatsData,
                            course.courseId
                          )
                        )
                      )}
                    >
                      <View style={styles.compactLeftWithPercent}>
                        <View style={styles.compactLeftRow}>
                          <View style={styles.compactAvatar}>
                            {course.coverIcon ? (
                              <Image
                                source={{ uri: course.coverIcon }}
                                style={styles.compactAvatarImage}
                              />
                            ) : (
                              <Text>📘</Text>
                            )}
                          </View>
                          <View style={styles.compactContent}>
                            <Text style={styles.compactTitle} numberOfLines={2}>
                              {course.title}
                            </Text>
                            <View style={styles.chipsRow}>
                              {!course.isCompleted && (
                                <View style={styles.chip}>
                                  <Text
                                    style={styles.chipText}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    Yatangiye:{' '}
                                    {formatDate(course?.enrollmentDate)}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.chip}>
                                <Text
                                  style={styles.chipText}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  ibyigwa: {course.totalChapters}
                                </Text>
                              </View>
                              <View style={styles.chip}>
                                <Text
                                  style={styles.chipText}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  Ibizamini: {course.completedTests}/
                                  {course.totalTests}
                                </Text>
                              </View>
                              {course.isCompleted && (
                                <View
                                  style={[
                                    styles.chip,
                                    {
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      flexShrink: 1,
                                      minWidth: 0,
                                      maxWidth: 70,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      {
                                        flexShrink: 1,
                                        minWidth: 0,
                                        marginRight: 4,
                                      },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    Bihubuje
                                  </Text>
                                  <Trophy size={10} color="#F59E0B" />
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        {course.progress > 0 && (
                          <View style={styles.percentWrapperInside}>
                            <View style={styles.percentCircleSmall}>
                              <Text style={styles.percentSmallText}>
                                {Math.round(course.progress)}%
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                  if (index === 0) {
                    return (
                      <CopilotStep
                        key={course.courseId}
                        text="Hano hagaragara amasomo yawe, ukurikije icyiciro wahisemo haruguru. Kanda ku isomo kugira ngo utangire cyangwa ukomeze kwiga."
                        order={9}
                        name="enrolled-courses-list"
                      >
                        <WalkthroughableView>{card}</WalkthroughableView>
                      </CopilotStep>
                    );
                  }
                  return <React.Fragment key={course.courseId}>{card}</React.Fragment>;
                  })
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>
                    Nta masomo ahari watangiye
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Unenrolled Courses tab */}
          {activeQuickAction === 3 && (
            <View>
              {courseStatsData?.courses?.filter(
                (course: any) => !course.isEnrolled
              ).length > 0 ? (
                courseStatsData.courses
                  .filter((course: any) => !course.isEnrolled)
                  .map((course: any, index: number) => {
                  const card = (
                    <TouchableOpacity
                      style={styles.compactCard}
                      activeOpacity={0.9}
                      onPress={advanceEnrolledCourses(() =>
                        router.push(
                          getLastViewedSlidePath(
                            courseStatsData,
                            course.courseId
                          )
                        )
                      )}
                    >
                      <View style={styles.compactLeftWithPercent}>
                        <View style={styles.compactLeftRow}>
                          <View style={styles.compactAvatar}>
                            {course.coverIcon ? (
                              <Image
                                source={{ uri: course.coverIcon }}
                                style={styles.compactAvatarImage}
                              />
                            ) : (
                              <Text>📘</Text>
                            )}
                          </View>
                          <View style={styles.compactContent}>
                            <Text style={styles.compactTitle} numberOfLines={2}>
                              {course.title}
                            </Text>
                            <View style={styles.chipsRow}>
                              <View style={styles.chip}>
                                <Text
                                  style={styles.chipText}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  ibyigwa: {course.totalChapters}
                                </Text>
                              </View>
                              <View style={styles.chip}>
                                <Text
                                  style={styles.chipText}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  Amasaha: {course.courseDuration}
                                </Text>
                              </View>
                              <View style={styles.chip}>
                                <Text
                                  style={styles.chipText}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  Ibizamini: {course.totalTests}
                                </Text>
                              </View>
                              {course.progress < 0 && (
                                <View
                                  style={[
                                    styles.chip,
                                    {
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      flexShrink: 1,
                                      minWidth: 0,
                                      maxWidth: 80,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      { flexShrink: 1, minWidth: 0 },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {course.isEnrolled
                                      ? course.isStarted
                                        ? 'Watangiye'
                                        : 'Wiyandikishije'
                                      : 'Ntaratangira'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                  if (index === 0) {
                    return (
                      <CopilotStep
                        key={course.courseId}
                        text="Hano hagaragara amasomo yawe, ukurikije icyiciro wahisemo haruguru. Kanda ku isomo kugira ngo utangire cyangwa ukomeze kwiga."
                        order={9}
                        name="enrolled-courses-list"
                      >
                        <WalkthroughableView>{card}</WalkthroughableView>
                      </CopilotStep>
                    );
                  }
                  return <React.Fragment key={course.courseId}>{card}</React.Fragment>;
                  })
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>
                    Nta masomo ahari utaratangira
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Welcome video modal (shown only if user hasn't seen it) */}
      {!isValidatingToken && welcomeModalVisible && (
        <Modal
          visible={welcomeModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={handleWelcomeVideoDone}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <WelcomeVideo forceVisible onDone={handleWelcomeVideoDone} />
          </View>
        </Modal>
      )}

      {/* Floating Chat Button - Only show when user has completed at least one course and hasn't reviewed the system yet */}
      {courseStatsData?.summary?.completedCourses > 0 && !isSystemReviewed && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => {
            setShowSystemReview(true);
          }}
          activeOpacity={0.8}
        >
          <MessageCircle size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* System Review Modal */}
      <Modal
        visible={showSystemReview}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSystemReview(false)}
      >
        <SystemReviewCard
          systemName="eBumenyi Platform"
          onSubmit={handleSystemReviewSubmit}
          onClose={() => setShowSystemReview(false)}
          submitButtonText="Ohereza Igitekerezo"
        />
      </Modal>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      // On Android, the library's default (false) subtracts StatusBar height
      // from every measured element's y-position, assuming the modal's own
      // coordinate space already includes the status bar. That doesn't hold
      // for this app's layout, so every highlight box was shifted upward by
      // roughly the status bar's height — most visible on elements already
      // near the top of the screen (the header icons).
      androidStatusBarVisible
      labels={{
        finish: 'Rangiza',
        next: 'Ibikurikiraho',
        previous: 'Inyuma',
        skip: 'Simbuka',
      }}
    >
      <HomeScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileEmoji: {
    fontSize: 24,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileRole: {
    color: '#e0e7ff',
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  scheduleButton: {
    alignItems: 'center',
  },
  updatesButton: {
    alignItems: 'center',
  },
  scheduleIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  updatesIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  scheduleText: {
    color: '#ffffff',
    fontSize: 10,
  },
  updatesText: {
    color: '#ffffff',
    fontSize: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  section: {
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4D81D2',
    marginBottom: 12,
  },
  programCardsContainer: {
    paddingRight: 4,
  },
  programCards: {
    flexDirection: 'row',
    gap: 12,
  },
  programCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  smallCard: {
    flex: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  programContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  programIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  programInfo: {
    flex: 1,
  },
  programTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  programStarted: {
    color: '#e0e7ff',
    fontSize: 12,
    marginBottom: 2,
  },
  programChapter: {
    color: '#e0e7ff',
    fontSize: 12,
    marginBottom: 2,
  },
  programLanguage: {
    color: '#e0e7ff',
    fontSize: 12,
  },
  upcomingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  upcomingScrollContainer: {
    paddingLeft: 4,
    paddingRight: 4,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  upcomingCardHorizontal: {
    width: 140,
    backgroundColor: '#EFF1F8',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    elevation: 2,
  },
  upcomingImageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  upcomingImage: {
    width: 138,
    height: 78,
    borderRadius: 18,
    resizeMode: 'contain',
  },
  upcomingTitleHorizontal: {
    fontSize: 12,
    textAlign: 'center',
    color: '#4D81D2',
  },
  upcomingIcon: {
    fontSize: 28,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 2,
  },
  quickAction: {
    flex: 1,
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 10,
    justifyContent: 'center',
  },
  quickActionIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
    resizeMode: 'contain',
    marginRight: 4,
  },
  quickActionTitle: {
    color: '#4D81D2',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  progressCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  progressTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendUp: {
    color: '#22c55e',
    fontSize: 16,
  },
  trendDown: {
    color: '#ef4444',
    fontSize: 16,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  progressBars: {
    gap: 8,
  },
  progressCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryLabel: {
    width: 30,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  progressBarContainer: {
    flex: 1,
    gap: 4,
  },
  categoryName: {
    fontSize: 11,
    color: '#6b7280',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  completionBar: {
    backgroundColor: '#22c55e',
  },
  beginnerBar: {
    backgroundColor: '#f59e0b',
    width: '30%',
  },
  intermediateBar: {
    backgroundColor: '#06b6d4',
    width: '10%',
  },
  expertBar: {
    backgroundColor: '#8b5cf6',
    width: '40%',
  },
  // New styles for Messages tab
  messageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    elevation: 1,
    width: '100%',
    minWidth: 0,
  },
  messageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  messageName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
    minWidth: 0,
    marginBottom: 4,
  },
  messageAffiliation: {
    fontSize: 10,
    color: '#6b7280',
    flexShrink: 1,
    minWidth: 0,
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageTime: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  messageBadge: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
  },
  // New styles for compact course stats view
  compactCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 0.4,
    borderColor: '#4D81D2',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    width: '100%', // ensure full width
    minWidth: 0,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLeftWithPercent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
  compactLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap', // allow wrapping
  },
  compactContent: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    flexShrink: 1,
    minWidth: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  chip: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 4,
    maxWidth: 150,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    flexDirection: 'row',
  },
  chipText: {
    color: '#63758C',
    fontSize: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  compactRight: {
    alignItems: 'flex-end',
  },
  percentWrapperInside: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.4,
    borderColor: '#4D81D2',
  },
  compactAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  percentCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3363AD',
  },
  percentSmallText: {
    color: '#4A4F60',
    fontSize: 10,
    fontWeight: '600',
  },
  // New styles for large program cards view
  largeCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentCircleLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentLargeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Innovative Stats Cards Styles
  statsMainRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  progressStatsCard: {
    backgroundColor: '#667eea',
  },
  achievementCard: {
    backgroundColor: '#f093fb',
  },
  statsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 20,
  },
  progressRing: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  progressRingInner: {
    transform: [{ rotate: '90deg' }],
  },
  progressPercentText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginBottom: 8,
  },
  progressBarFull: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trophyWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  achievementBadgeText: {
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniTrophies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniTrophy: {
    fontSize: 16,
  },
  moreTrophies: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  statsSecondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  activityBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#4D81D2',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  activityIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF1F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIcon: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  activitySubtitle: {
    color: '#6b7280',
    fontSize: 12,
  },
  activityRight: {},
  continueButton: {
    backgroundColor: '#4D81D2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#4D81D2',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  activityIconImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  chatButton: {
    position: 'absolute',
    bottom: 60,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4D81D2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
