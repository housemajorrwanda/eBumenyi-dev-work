/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { CircleCheck as CheckCircle, Video, ClipboardCheck, RotateCcw } from 'lucide-react-native';
import { assets } from '@/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { ICourse, IChapter, ISection, IMySectionReviewItem, ICertificate } from '@/types';
import { getStudentCourseStats, addCoursereview, 
  // addSectionreview,
   getMySectionReviews } from '@/services/course.api';
import { useCourseWorkspace, normalizeCourseId, selectCourseProgressPercent, invalidateCourseProgressQueries } from '@/hooks/useCourseWorkspace';
import { getCertificate, generateCertificate, regenerateMyCertificate } from '@/services/certificate.api';
import { getCalendarEvents } from '@/services/calender';
import { getMe } from '@/services/auth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Footer from '@/components/Footer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DocumentViewer from '@/components/DocumentViewer';
// Use legacy FileSystem API to keep downloadAsync working until migration to new File/Directory API
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
// TODO: migrate to new File/Directory API as recommended by Expo

import StorageService from '@/services/storage.service';
import CourseReviewCard from '@/components/CourseReviewCard';
import { onboardingService, TOUR_KEYS } from '@/services/onboarding.service';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
// import SectionReviewCard from '@/components/SectionReviewCard';
import calculateTimeSpent from '@/utils/format';
import { extractMeetingId, isValidMeetingUrl } from '@/utils/deepLinking';
import { useMeetingRouter } from '@/hooks/useMeetingRouter';
import { useCourseRecommendations } from '@/hooks/useCourseRecommendations';
import { SEVERITY_BADGE } from '@/constants/recommendations';
import SocketService from '@/services/socket.service';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
// import AsyncStorage from '@react-native-async-storage/async-storage';


const EmojiBurst = ({ active }: { active: boolean }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let timeout: NodeJS.Timeout | null = null;
    if (active) {
      setShow(true);
      anim.setValue(0);
      loop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      );
      loop.start();
      // Hide after 1.5s
      timeout = setTimeout(() => {
        if (loop) (loop as Animated.CompositeAnimation).stop();
        setShow(false);
      }, 1500);
    } else {
      setShow(false);
      if (loop) (loop as Animated.CompositeAnimation).stop();
    }
    return () => {
      if (loop) (loop as Animated.CompositeAnimation).stop();
      if (timeout) clearTimeout(timeout);
    };
  }, [active, anim]);

  if (!show) return null;

  const up = anim.interpolate({ inputRange: [0, 1], outputRange: [6, -18] });
  const leftShift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const rightShift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });
  const fade = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <View style={styles.emojiContainer} pointerEvents="none">
      <Animated.Text style={[styles.emoji, { transform: [{ translateY: up }, { translateX: leftShift }], opacity: fade }]}>🎉</Animated.Text>
      <Animated.Text style={[styles.emojiMiddle, { transform: [{ translateY: up }], opacity: fade }]}>🌸</Animated.Text>
      <Animated.Text style={[styles.emojiRight, { transform: [{ translateY: up }, { translateX: rightShift }], opacity: fade }]}>🎊</Animated.Text>
    </View>
  );
};

// Animated circle around video icon for active meetings
const PulsingVideoCircle = ({ active }: { active: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      // Pulsing animation - useNativeDriver: false
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );

      // Rotating animation - useNativeDriver: false (because it's used with color)
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        })
      );

      pulseLoop.start();
      rotateLoop.start();
      loopRef.current = pulseLoop;

      return () => {
        pulseLoop.stop();
        rotateLoop.stop();
      };
    }
  }, [active, pulseAnim, rotateAnim]);

  if (!active) return null;

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scaleValue = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1.3],
  });

  const color1 = pulseAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#FF6B6B'],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={[
        styles.pulsingCircle,
        {
          transform: [{ rotate }, { scale: scaleValue }],
          borderColor: color1,
          opacity,
        },
      ]}
    />
  );
};

const AnimatedFingerPointer = ({ direction = 'left' }: { direction?: 'left' | 'up' }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 420, useNativeDriver: true }),
      ])
    ).start();
    return () => bounceAnim.stopAnimation();
  }, [bounceAnim]);

  const translateX = bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const translateY = bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [2, -6] });

  return (
    <Animated.Text
      style={{
        fontSize: direction === 'left' ? 20 : 14,
        transform: direction === 'left' ? [{ translateX }] : [{ translateY }],
      }}
    >
      {direction === 'left' ? '👈' : '👆'}
    </Animated.Text>
  );
};


function OneCourseScreenContent() {
  const router = useMeetingRouter();
  const { courseId, sectionId, recommended } = useLocalSearchParams();
  const courseIdStr = normalizeCourseId(courseId as string | string[] | undefined);
  const { start, copilotEvents } = useCopilot();
  const { recommendedChaptersMap } = useCourseRecommendations(
    courseId as string | undefined,
    recommended as string | string[] | undefined,
  );
  const insets = useSafeAreaInsets();
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const initializedSelectionRef = useRef(false);

  const { data: workspace, isLoading: loading, refetch: refetchWorkspace } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;

  const preTestDone = React.useMemo(() => {
    if (!course) return false;
    if (!Array.isArray(course.preTests) || course.preTests.length === 0) return true;
    return Boolean(workspace?.progress?.preTestStatus?.attempted);
  }, [course, workspace]);

  const finalTestStatus = React.useMemo(() => {
    const status = workspace?.progress?.finalTestStatus;
    if (!status || !courseIdStr) return null;
    return { ...status, associatedCourseId: courseIdStr };
  }, [workspace, courseIdStr]);

  const finalExamStatus = React.useMemo(() => {
    const status = workspace?.progress?.finalExamStatus;
    if (!status || !courseIdStr) return null;
    return { ...status, associatedCourseId: courseIdStr };
  }, [workspace, courseIdStr]);

  // Keep track of sections we've already shown the review modal for during THIS app session
  const shownSectionReviewsRef = useRef<Set<string>>(new Set());

  // Progress tracking removed
	const [progress, setProgress] = useState<any | null>(null);
  const [certificate, setCertificate] = useState<ICertificate | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Course review status helpers - using storage service
  const getCourseReviewStatus = async (courseId: string) => {
    const currentCourseStats = getCurrentCourseStats();
    return await StorageService.getCourseReviewStatus(courseId, currentCourseStats?.isStudentReviewedCourse);
  };

  const storeCourseReviewStatus = async (courseId: string, isReviewed: boolean) => {
    await StorageService.storeCourseReviewStatus(courseId, isReviewed);
  };

  // Certificate functions
  const checkCertificateAvailability = async () => {
    try {
      const certResp = await getCertificate(courseId as string);
      setCertificate(certResp.data);
    } catch {
      // Certificate not available
      setCertificate(null);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!courseId || certificateLoading) return;
    
    setCertificateLoading(true);
    try {
      const certResp = await generateCertificate(courseId as string);
      setCertificate(certResp.data);
    } catch (error) {
      console.log('Certificate generation failed:', error);
      Alert.alert('Ikosa', 'Impamyabumenyi ntishobora gukozwa. Ongera ugerageze.');
    } finally {
      setCertificateLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificate?.pdf || certificateLoading) return;
    
    setCertificateLoading(true);
    try {
      const fileName = `impamyabumenyi_${course?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'course'}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      if (certificate.pdf.startsWith('http')) {
        const downloadResult = await FileSystem.downloadAsync(certificate.pdf, fileUri);
        console.log('Certificate downloaded to', downloadResult.uri);
        
        // Use the downloaded file path for sharing
        let finalUri = downloadResult.uri;
        try {
          if (downloadResult.uri !== fileUri) {
            // Move to our intended destination if needed
            await FileSystem.moveAsync({ from: downloadResult.uri, to: fileUri });
            finalUri = fileUri;
            console.log('Moved certificate file to', finalUri);
          }
        } catch (moveErr) {
          console.log('Failed to move certificate file, using original path', moveErr);
        }
        
        try {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(finalUri, {
              mimeType: 'application/pdf',
              dialogTitle: fileName,
            });
          } else {
            console.log('Sharing is not available on this device.');
            Alert.alert('Ibikubiyemo', 'Kugabana ntikishoboka kuri iki gikoresho.');
          }
        } catch (shareErr) {
          console.log('Failed to share certificate:', shareErr);
          Alert.alert('Ikosa', 'Impamyabumenyi ntishobora gusangiwa. Ongera ugerageze.');
        }
      } else {
        Alert.alert('Ikosa', 'Impamyabumenyi ntikuboneka.');
      }
    } catch (error) {
      console.log('Certificate download failed:', error);
      Alert.alert('Ikosa', 'Impamyabumenyi ntishobora gufatwa. Ongera ugerageze.');
    } finally {
      setCertificateLoading(false);
    }
  };

  const handleRegenerateCertificate = async () => {
    if (!courseId || certificateLoading) return;

    Alert.alert(
      'Saba Impamyabumenyi nshya',
      'Urashaka gusaba impamyabumenyi nshya? Impamyabumenyi isanzwe izasimburwa.',
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego',
          onPress: async () => {
            setCertificateLoading(true);
            try {
              const certResp = await regenerateMyCertificate(courseId as string);
              setCertificate(certResp.data);
              Alert.alert('Byagenze neza', 'Impamyabumenyi nshya yakozwe.');
            } catch (error) {
              console.log('Certificate regeneration failed:', error);
              Alert.alert('Ikosa', 'Impamyabumenyi ntishobora gukozwa. Ongera ugerageze.');
            } finally {
              setCertificateLoading(false);
            }
          },
        },
      ],
    );
  };

	useEffect(() => {
		// Progress loading removed
		setProgress(null);
	}, [courseId]);


  // fetch student-course-stats
  const { data: courseStatsData } = useQuery<any>({
    queryKey: ['COURSE'],
    queryFn: getStudentCourseStats,
    gcTime: 0,
  });
  const queryClient = useQueryClient();
  const { notifications } = useNotificationsContext();

  // Tick every 30 s so time-based conditions (pulsing, join button) re-evaluate automatically
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refresh calendar data when a new event is broadcast to this user (as a participant)
  useEffect(() => {
    const latest = notifications[0];
    if (latest && (latest as any).entityType === 'calendar_event' && !latest.isRead) {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
    }
  }, [notifications, queryClient]);

  // Refresh calendar data when the creator changes an event on the web
  useEffect(() => {
    const socket = SocketService.getInstance();
    if (!socket) return;
    const handle = () => queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
    socket.on('calendar_data_changed', handle);
    return () => { socket.off('calendar_data_changed', handle); };
  }, [queryClient]);

  // Get current course data from courseStatsData
  const getCurrentCourseStats = () => {
    return courseStatsData?.courses?.find((c: any) => c.courseId === courseId);
  };

  const courseProgressPercent = React.useMemo(
    () => selectCourseProgressPercent(workspace, getCurrentCourseStats()),
    [workspace, courseStatsData, courseId],
  );

  useEffect(() => {
    if (!course) return;

    if (sectionId) {
      if (
        sectionId === 'pre-test' ||
        sectionId === 'final-test' ||
        sectionId === 'final-exam' ||
        course.sections.some((s: ISection) => s.id === sectionId)
      ) {
        setSelectedCourse(sectionId as string);
        initializedSelectionRef.current = true;
        return;
      }
    }

    if (initializedSelectionRef.current) return;

    if (Array.isArray(course.preTests) && course.preTests.length > 0 && course.preTests[0]) {
      setSelectedCourse('pre-test');
    } else if (course.sections?.length > 0) {
      setSelectedCourse(course.sections[0].id);
    }
    initializedSelectionRef.current = true;
  }, [course, sectionId]);

  useEffect(() => {
    initializedSelectionRef.current = false;
    setSelectedCourse('');
    setShowReviewModal(false);
  }, [courseIdStr]);
  const { data: calendarEvents } = useQuery({
    queryKey: ['CALENDAR_EVENTS'],
    queryFn: getCalendarEvents,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current user info for display
  const { data: userData } = useQuery<any>({
    queryKey: ['USER_INFO'],
    queryFn: getMe,
    gcTime: 0,
  });

  const upcomingEvent = React.useMemo(() => {
    if (!calendarEvents) return null;
    return calendarEvents
      .filter(event =>
        event.endAt && new Date(event.endAt) > now &&
        event.meetingType !== 'OTHER' &&
        event.location
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] || null;
  }, [calendarEvents, now]);

  // Precise timeout: fire setNow exactly at meeting start and end so the pulsing
  // animation activates/deactivates right on time without waiting for the 30 s tick
  const eventStartMs = upcomingEvent ? new Date(upcomingEvent.startAt).getTime() : 0;
  const eventEndMs = upcomingEvent?.endAt ? new Date(upcomingEvent.endAt).getTime() : 0;
  useEffect(() => {
    if (!eventStartMs || !eventEndMs) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const nowMs = Date.now();
    if (eventStartMs > nowMs) timers.push(setTimeout(() => setNow(new Date()), eventStartMs - nowMs));
    if (eventEndMs > nowMs) timers.push(setTimeout(() => setNow(new Date()), eventEndMs - nowMs));
    return () => timers.forEach(clearTimeout);
  }, [eventStartMs, eventEndMs]);

  useEffect(() => {
    async function checkReviewStatus() {
      // Only check if we have finalTestStatus, courseId, and course data loaded
      if (!finalTestStatus || !courseId || !course) return;
      
      // Additional safety: Only process if the course has a final test
      if (!course.finalTest || !course.finalTest[0]) return;
      
      // Verify this finalTestStatus belongs to the current course
      const currentCourseIdStr = Array.isArray(courseId) ? courseId[0] : courseId;
      if (finalTestStatus.associatedCourseId && finalTestStatus.associatedCourseId !== currentCourseIdStr) {
        return;
      }
      
      
      // Only show modal for THIS specific course if final test was passed
      if (!finalTestStatus.passed) {
        return;
      }
      
      try {
        const isReviewed = await getCourseReviewStatus(courseId as string);
        
        if (!isReviewed) {
          // Student passed THIS course's final test but hasn't reviewed THIS course - show modal
          setShowReviewModal(true);
        }
      } catch (error) {
        console.log(`Course ${courseId}: Error checking review status:`, error);
      }
    }

    checkReviewStatus();
  }, [finalTestStatus, courseId, course]);

  // Check certificate availability when final exam status changes
  useEffect(() => {
    if (finalExamStatus?.passed && courseId) {
      checkCertificateAvailability();
    } else {
      setCertificate(null);
    }
  }, [finalExamStatus, courseId]);  // --- MODULE UNLOCK LOGIC ---
  // Returns true if the chapter is unlocked
  const isChapterUnlocked = (sectionIndex: number, chapterIndex: number) => {
    if (!course) return false;
    // First chapter in first section: unlocked if preTestDone
    if (sectionIndex === 0 && chapterIndex === 0) return preTestDone;
    // First chapter in any section (except first): unlocked if all chapters in previous section are completed
    if (chapterIndex === 0) {
      if (sectionIndex === 0) return true;
      const prevSection = course.sections[sectionIndex - 1];
      if (!prevSection) return false;
      return prevSection.chapters.every((ch: any) => completedChapters.includes(ch.id));
    }
    // Other chapters: unlocked if previous chapter is completed
    const section = course.sections[sectionIndex];
    const prevChapter = section.chapters[chapterIndex - 1];
    return completedChapters.includes(prevChapter.id);
  };

  // Returns true if the chapter is completed
  const isChapterCompleted = (chapterId: string) => completedChapters.includes(chapterId);

  // --- SUMMARY DOTS LOGIC ---
  const [activeSummaryIdx, setActiveSummaryIdx] = useState(0);
  const summaryScrollRef = useRef<ScrollView>(null);
  const { width: deviceWidth, height: deviceHeight } = useWindowDimensions();
  const summaryCardWidth = Math.min(Math.round(deviceWidth * 0.86), 420); // 88% of device width, max 420px
  const summaryCardMaxHeight = Math.min(Math.round(deviceHeight * 0.40), 280); // 40% of height, max 260px

  // Transform summary into array of sentence chunks based on device width
  const summary = course?.intro?.summary || '';
  const sentences = summary.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [];
  const baseChars = 320;
  const charsPerCard = Math.round(baseChars * (deviceWidth / 375)); // 375 is iPhone X width
  const summaryChunks = [];
  let chunk = '';
  for (let i = 0; i < sentences.length; i++) {
    if ((chunk + sentences[i]).length > charsPerCard && chunk.length > 0) {
      summaryChunks.push(chunk.trim());
      chunk = '';
    }
    chunk += sentences[i];
  }
  if (chunk.length > 0) summaryChunks.push(chunk.trim());

  // Track completed chapters — server is source of truth, local cache as immediate fallback
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  useEffect(() => {
    const syncCompletedChapters = async () => {
      const local = await StorageService.getCompletedChapters();
      setCompletedChapters(local);

      if (!workspace?.progress) return;

      const serverCompleted = workspace.progress.chapterProgress
        .filter((ch) => ch.isCompleted)
        .map((ch) => ch.chapterId);

      for (const id of serverCompleted) {
        await StorageService.markChapterCompleted(id);
      }

      setCompletedChapters([...new Set([...serverCompleted, ...local])]);
    };

    syncCompletedChapters();
  }, [workspace]);

  // Re-sync when returning from lesson/test screens.
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      if (!courseIdStr) return;
      void refetchWorkspace();
      invalidateCourseProgressQueries(queryClient, courseIdStr);
    }, [courseIdStr, refetchWorkspace, queryClient])
  );

  // Start course tour once, after course data has loaded.
  // Timeout is returned for cleanup so React Strict Mode's double-effect doesn't fire start() twice.
  useEffect(() => {
    if (!course) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    onboardingService.hasCompleted(TOUR_KEYS.COURSE).then((done) => {
      if (!done) {
        timer = setTimeout(() => start(), 600);
      }
    }).catch(() => {});
    return () => { if (timer) clearTimeout(timer); };
  }, [course]);

  // Mark course tour complete when copilot stops
  useEffect(() => {
    const handleStop = () => {
      onboardingService.markComplete(TOUR_KEYS.COURSE).catch(() => {});
    };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents]);

  // Re-sync all progress state when the screen regains focus (returning from lesson/test screens).
  // useFocusEffect fires on every focus event; skip the very first mount because the existing
  // useEffects already handle initial load.
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      if (!courseId) return;
      const courseIdStr = Array.isArray(courseId) ? courseId[0] : courseId;

      const refreshProgress = async () => {
        try {
          const response = await getStudentCourseProgressByCourseId(courseIdStr);
          if (!response?.data) return;

          // Refresh completed chapters
          const serverCompleted = (response.data.chapterProgress ?? [])
            .filter((ch: any) => ch.isCompleted)
            .map((ch: any) => ch.chapterId);
          for (const id of serverCompleted) {
            await StorageService.markChapterCompleted(id);
          }
          const local = await StorageService.getCompletedChapters();
          setCompletedChapters([...new Set([...serverCompleted, ...local])]);

          // Refresh pre-test status
          if (response.data.preTestStatus) {
            setPreTestDone(Boolean(response.data.preTestStatus.attempted));
          } else if (!course || !Array.isArray(course.preTests) || course.preTests.length === 0) {
            setPreTestDone(true);
          }

          // Refresh final test / exam status
          if (response.data.finalTestStatus) {
            setFinalTestStatus({ ...response.data.finalTestStatus, associatedCourseId: courseIdStr });
          }
          if (response.data.finalExamStatus) {
            setFinalExamStatus({ ...response.data.finalExamStatus, associatedCourseId: courseIdStr });
          }
        } catch (error) {
          console.log('Error refreshing progress on focus:', error);
        }
        queryClient.invalidateQueries({ queryKey: ['COURSE'] });
      };

      refreshProgress();
    }, [courseId, course, queryClient])
  );

  // Handle review submission
  const handleReviewSubmit = async (reviewData: any) => {
    
    try {
      // Build categoryRatings from incoming data (categoryRatings preferred)
      const courseCategoryRatings = reviewData.categoryRatings ?? (reviewData.reviewCriteria ?? []).map((label: string, idx: number) => ({
        id: `${idx + 1}`,
        category: label,
        label,
        rating: reviewData.rating ?? 0,
      }));
      const totalCourse = (courseCategoryRatings || []).reduce((s: number, c: any) => s + (Number(c.rating) || 0), 0);
      const avgCourse = (courseCategoryRatings && courseCategoryRatings.length > 0) ? Math.round(totalCourse / courseCategoryRatings.length) : 0;

      // Submit review to backend with averaged rating
      await addCoursereview({
        courseId: reviewData.courseId,
        comment: reviewData.comment,
        categoryRatings: courseCategoryRatings,
        rating: avgCourse,
      });

      
      // Mark course as reviewed locally
      if (courseId) {
        await storeCourseReviewStatus(courseId as string, true);
      }
      
      setShowReviewModal(false);
    } catch (error) {
      console.log('Error submitting review:', error);
      // Still close modal and mark as reviewed locally even if backend fails
      setShowReviewModal(false);
      if (courseId) {
        await storeCourseReviewStatus(courseId as string, true);
      }
    }
  };

  useEffect(() => {
    const seedLocalSectionReviews = async () => {
      if (!course || !course.id) return;
      try {
        const reviews: IMySectionReviewItem[] = await getMySectionReviews();
        if (!Array.isArray(reviews)) return;

        // Filter reviews for this course's sections and store locally
        for (const r of reviews) {
          if (!r.sectionId) continue;

          // If this review belongs to a section in the current course, persist it
          const sectionBelongsToCourse = course.sections.some(s => s.id === r.sectionId);
          if (!sectionBelongsToCourse) continue;

          // Find section number from course data if available
          const foundSection = course.sections.find(s => s.id === r.sectionId);
          const sectionNumber = foundSection ? (foundSection.chapters?.[0]?.chapterNumber ?? 0) : 0;

          // Persist in AsyncStorage and mark as shown for this session
          await StorageService.storeSectionReviewStatus(course.id, r.sectionId, sectionNumber, {
            rating: r.rating ?? 0,
            reviewCriteria: r.reviewCriteria ?? [],
            comment: r.comment ?? '',
          });
          shownSectionReviewsRef.current.add(r.sectionId);
        }

        console.log('Seeded local section reviews from server for course', course.id);
      } catch (err) {
        console.log('Failed to seed local section reviews from server', err);
      }
    };

    seedLocalSectionReviews();
  }, [course]);

  if (loading) return <LoadingSpinner />;
  if (!course) return null;

  // derived flat list of chapters for rendering (changed to only chapters from selected section)
  const selectedSection = course ? course.sections.find((s: any) => s.id === selectedCourse) ?? course.sections[0] : null;
  const chaptersList: IChapter[] = selectedSection ? selectedSection.chapters : [];

  // First unlocked, not-yet-completed chapter → gets the finger pointer
  const secIdx = course.sections.findIndex((s: any) => s.id === (selectedSection?.id ?? ''));
  let nextChapterId: string | null = null;
  for (let i = 0; i < chaptersList.length; i++) {
    if (isChapterUnlocked(secIdx, i) && !isChapterCompleted(chaptersList[i].id)) {
      nextChapterId = chaptersList[i].id;
      break;
    }
  }

  // Next section tab index → finger pointer below that circle once current section is all done
  const curSecIdx = course.sections.findIndex((s: any) => s.id === selectedCourse);
  const curSecAllDone =
    curSecIdx >= 0 &&
    (course.sections[curSecIdx]?.chapters ?? []).every((ch: any) => completedChapters.includes(ch.id));
  const nextSectionIndex = curSecAllDone && curSecIdx < course.sections.length - 1 ? curSecIdx + 1 : -1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 64, 76) }} style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video Section */}
        <View style={styles.imageContainer}>
          <Image 
            source={{uri: course.intro.thumbnail}}
            style={styles.videoImage}
            resizeMode="cover"
          />

          {/* Info bubble at top over image */}
          <View style={[styles.infoBubble, { position: 'absolute', top: 12, left: 12, right: 12 }]}> 
            {/* <Image source={assets.play} style={styles.playIconSmall} /> */}
            <Text style={styles.infoBubbleText}>{course.title}</Text>
          </View>

          {/* Horizontally scrollable summary cards over image boundary */}
          <View style={[styles.progressInfo, { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: 260, backgroundColor: 'rgba(51,99,173,0.95)', overflow: 'hidden' }]}> 
            <ScrollView
              ref={summaryScrollRef}
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
              pagingEnabled
              onScroll={e => {
                const x = e.nativeEvent.contentOffset.x;
                const w = summaryCardWidth; // use dynamic width
                const idx = Math.round(x / w);
                setActiveSummaryIdx(idx);
              }}
              scrollEventThrottle={16}
            >
              {summaryChunks.map((chunk, idx) => (
                <View
                  key={idx}
                  style={{
                    width: summaryCardWidth,
                    borderRadius: 12,
                    backgroundColor: 'transparent',
                    alignSelf: 'flex-start',
                    maxHeight: summaryCardMaxHeight,
                    marginTop: 2,
                    marginBottom: 0,
                    padding: 8,
                    paddingBottom:2
                  }}
                >
                <Text className='text-white font-bold align-center mb-4'>Incamake</Text>
                  <ScrollView style={{ maxHeight: summaryCardMaxHeight }} showsVerticalScrollIndicator={false}>
                    <Text style={styles.progressText}>{chunk}</Text>
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
            {/* Dots indicator */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 0 }}>
              {summaryChunks.map((_, idx) => (
                <View
                  key={idx}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginHorizontal: 3,
                    backgroundColor: idx === activeSummaryIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
            <View style={styles.userRow}>
            <Image 
              source={{uri: course.staff.user.photo}}
              style={[styles.avatar, { resizeMode: 'contain' }]}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{course.staff.user.fullNames}</Text>
              <Text style={styles.sessionDate}>
                {upcomingEvent 
                  ? `Inama - ${new Date(upcomingEvent.startAt).toLocaleDateString('rw-RW')} | ${new Date(upcomingEvent.startAt).toLocaleTimeString('rw-RW', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Inama - ntibonetse'
                }
              </Text>
            </View>
            {upcomingEvent && upcomingEvent.location && upcomingEvent.endAt && now < new Date(upcomingEvent.endAt) && (
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.8} onPress={() => {
                // Open meeting link - keep available until endAt to allow late joiners
                if (upcomingEvent.location) {
                  if (upcomingEvent.meetingType === 'EBUMENYI_MEETING') {
                    // Check if it's a valid meeting URL
                    if (isValidMeetingUrl(upcomingEvent.location)) {
                      const meetingId = extractMeetingId(upcomingEvent.location);
                      if (meetingId) {
                        // Navigate to in-app meeting screen
                        router.push(`/meeting/${meetingId}`);
                      }
                    } else {
                      // Fallback: open URL directly if not in valid format (shouldn't happen)
                      console.warn('Invalid meeting URL format:', upcomingEvent.location);
                      const fullNames = userData?.fullNames || '';
                      const encodedNames = encodeURIComponent(fullNames);
                      const newLink = `${upcomingEvent.location}?${encodedNames}`;
                      router.push(newLink);
                    }
                  } else {
                    // For non-ebumenyi meetings, open directly
                    router.push(upcomingEvent.location);
                  }
                }
              }}>
                <View style={styles.joinButtonContent}>
                  <View style={styles.joinIconCircle}>
                    {/* Show pulsing circle only if meeting is currently ongoing (between startAt and endAt) */}
                    <PulsingVideoCircle active={new Date(upcomingEvent.startAt) <= now && now < new Date(upcomingEvent.endAt)} />
                    <Video size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.timeText}>
                    {new Date(upcomingEvent.startAt).toLocaleTimeString('rw-RW', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {upcomingEvent && !upcomingEvent.location && upcomingEvent.endAt && now < new Date(upcomingEvent.endAt) && (
              <TouchableOpacity style={[styles.joinButton, { opacity: 0.5 }]} disabled>
                <View style={styles.joinButtonContent}>
                  <View style={styles.joinIconCircle}>
                    <Video size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.timeText}>
                    {new Date(upcomingEvent.startAt).toLocaleTimeString('rw-RW', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {!upcomingEvent && (
              <TouchableOpacity style={[styles.joinButton, { opacity: 0.7 }]} disabled>
                <View style={styles.joinButtonContent}>
                  <View style={styles.joinIconCircle}>
                    <Video size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.timeText}>--:--</Text>
                </View>
              </TouchableOpacity>
            )}
            </View>
        </View>

        {/* Course Progress */}
        <View style={styles.courseProgress}>
          <View style={styles.progressHeader}>
            <Text style={styles.courseTitle}>Ibijyanye n&rsquo;isomo</Text>
            <View style={styles.ratingContainer}>
              {/* <Text style={styles.ratingText}>{getRatingText(getCurrentCourseStats()?.progress || 0)}</Text>
              <Trophy size={16} color="#F59E0B" /> */}
              <Text style={styles.weeksText}>igihe wakoresheje: {calculateTimeSpent(getCurrentCourseStats()?.enrollmentDate, getCurrentCourseStats()?.completedAt)}</Text>
              <CopilotStep
                text="Hano ubona aho ugeze mu isomo. Ukomeze kwiga kugira ngo ugere kuri 100%!"
                order={1}
                name="course-progress"
              >
                <WalkthroughableView style={styles.progressCircle}>
                  <Text style={styles.progressPercentage}>
                    {Math.round(courseProgressPercent)}%
                  </Text>
                </WalkthroughableView>
              </CopilotStep>
            </View>
          </View>

            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBarFill, { width: `${courseProgressPercent}%` }]} />
            </View>

          {/* Course Tabs */}
          <CopilotStep
            text="Izi ni ibyiciro by'isomo: isuzumabumenyi ribanziriza, ibyigwa, n'isuzuma rya nyuma. Tangira na 📋 mbere y'isomo!"
            order={2}
            name="course-tabs"
          >
            <WalkthroughableView style={styles.courseTabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }} contentContainerStyle={styles.courseTabs}>
            {/* Pre-test Section - Section 0 */}
            {course && Array.isArray(course.preTests) && course.preTests.length > 0 && course.preTests[0] && (
               <TouchableOpacity
                 key="pre-test-section"
                 style={[
                   styles.sectionNumberCircle,
                   selectedCourse === 'pre-test' && styles.sectionNumberCircleActive
                 ]}
                 onPress={() => setSelectedCourse('pre-test')}
               >
                <ClipboardCheck size={14} color={selectedCourse === 'pre-test' ? '#FFFFFF' : '#D97706'} />
               </TouchableOpacity>
             )}
             
             {/* Regular Course Sections - Sections 1, 2, 3, etc. */}
             {course.sections.map((tab: ISection, index: number) => (
               <View key={tab.id} style={{ alignItems: 'center' }}>
                 <TouchableOpacity
                   style={[
                     styles.sectionNumberCircle,
                     selectedCourse === tab.id && styles.sectionNumberCircleActive,
                   ]}
                   onPress={() => setSelectedCourse(tab.id)}
                 >
                   <Text style={[
                     styles.sectionNumber,
                     selectedCourse === tab.id && styles.sectionNumberActive,
                   ]}>
                     {index + 1}
                   </Text>
                 </TouchableOpacity>
                 {nextSectionIndex === index && <AnimatedFingerPointer direction="up" />}
               </View>
             ))}
             
             {/* Final Test Section - Section n */}
             {course && Array.isArray(course.finalTest) && course.finalTest.length > 0 && course.finalTest[0] && (
               <TouchableOpacity
                 key="final-test-section"
                 style={[
                   styles.sectionNumberCircle,
                   selectedCourse === 'final-test' && styles.sectionNumberCircleActive
                 ]}
                 onPress={() => setSelectedCourse('final-test')}
               >
                <ClipboardCheck size={14} color={selectedCourse === 'final-test' ? '#FFFFFF' : '#10B981'} />
               </TouchableOpacity>
             )}
             
             {/* Final Exam Section - Section n+1 */}
             {course && Array.isArray(course.finalTest) && course.finalTest.length > 0 && course.finalTest[0] && (
               <TouchableOpacity
                 key="final-exam-section"
                 style={[
                   styles.sectionNumberCircle,
                   selectedCourse === 'final-exam' && styles.sectionNumberCircleActive
                 ]}
                 onPress={() => setSelectedCourse('final-exam')}
               >
                <ClipboardCheck size={14} color={selectedCourse === 'final-exam' ? '#FFFFFF' : '#8B5CF6'} />
               </TouchableOpacity>
             )}
          </ScrollView>
            </WalkthroughableView>
          </CopilotStep>

          {/* Section Title */}
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>
              {(() => {
                if (selectedCourse === 'pre-test') {
                  return 'Isuzumabumenyi ribanziriza Isomo';
                } else if (selectedCourse === 'final-test') {
                  return 'Isuzuma rya nyuma';
                } else if (selectedCourse === 'final-exam') {
                  return 'Ikizamini cya nyuma (Certificate)';
                } else {
                  return course.sections.find((s: ISection) => s.id === selectedCourse)?.title || course.sections[0]?.title;
                }
              })()}
            </Text>
          </View>
        </View>

        {/* Course Modules */}
        <CopilotStep
          text="Kanda ku giciro kugira ngo utangire kwiga. Ibyigwa bifungurwa bihinnye bihinnye — urangize kimwe kugira ngo ukurikiraho gifunguke!"
          order={3}
          name="course-chapters"
        >
          <WalkthroughableView style={styles.modulesList}>
          {/* Pre-Test Card: only when pre-test section is selected */}
          {selectedCourse === 'pre-test' && course && Array.isArray(course.preTests) && course.preTests.length > 0 && course.preTests[0] && (
            <TouchableOpacity
              style={[
                styles.moduleCard,
                styles.moduleCardPreTest,
                preTestDone && { borderColor: '#DC2626', backgroundColor: '#F0FDF4' }
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (!courseId) {
                  Alert.alert('Error', 'Course id missing');
                  return;
                }
                router.push(`/courses/${courseId}/pre-test`);
              }}
            >
              <View style={styles.moduleContent}>
                <View style={styles.moduleIcon}>
                  <Image source={assets.book} style={styles.modulePlayIcon} />
                </View>
                <View style={styles.moduleInfo}>
                  <Text style={styles.moduleTitle}>Isuzumabumenyi ribanziriza Isomo</Text>
                  <Text style={styles.moduleDetails}>Ibibazo {course.preTests[0].questionToBeAnswered || 0}</Text>
                </View>
                <View style={styles.moduleRight}>
                  {preTestDone && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 4 }}>
                        <CheckCircle size={16} color="#fff" />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Final Test Card: only when final-test section is selected */}
          {selectedCourse === 'final-test' && course && Array.isArray(course.finalTest) && course.finalTest.length > 0 && course.finalTest[0] && (
            (() => {
              // Check if all chapters in all sections are completed using completedChapters
              const allChapters = course.sections.flatMap((section: any) => section.chapters || []);
              const allCompleted = allChapters.length > 0 && allChapters.every((c: any) => completedChapters.includes(c.id));
              const attempted = finalTestStatus?.attempted;
              const passed = finalTestStatus?.passed;
              const bestMarks = finalTestStatus?.bestMarks;
              return (
                <TouchableOpacity
                  style={[
                    styles.moduleCard,
                    styles.moduleCardFinalTest,
                    attempted && { borderColor: passed ? '#10B981' : '#10B981', backgroundColor: passed ? '#F0FDF4' : '#FEF2F2' }
                  ]}
                  activeOpacity={0.8}
                  disabled={!allCompleted}
                  onPress={() => {
                    if (!courseId) {
                      Alert.alert('Error', 'Course id missing');
                      return;
                    }
                    router.push(`/courses/${courseId}/final-test`);
                  }}
                >
                  <View style={styles.moduleContent}>
                    <View style={styles.moduleIcon}>
                      <Image source={assets.book} style={styles.modulePlayIcon} />
                    </View>
                    <View style={styles.moduleInfo}>
                      <Text style={styles.moduleTitle}>Isuzuma rya nyuma</Text>
                      <Text style={styles.moduleDetails}>Ibibazo {course.finalTest[0].questionToBeAnswered || 0}</Text>
                      {attempted && (
                        <Text style={{ color: passed ? '#059669' : '#DC2626', fontWeight: 'bold', marginTop: 4, fontSize: 10 }}>
                          Amanota: {bestMarks} / 100 {passed ? '✓' : '✗'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.moduleRight}>
                      {passed && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 4 }}>
                            <CheckCircle size={16} color="#fff" />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                   <EmojiBurst active={Boolean(passed)} />
                </TouchableOpacity>
              );
            })()
          )}

          {/* Certificate Card: only when final-exam section is selected and final exam is passed */}


          {/* Final Exam Card: only when final-exam section is selected */}
          {selectedCourse === 'final-exam' && course && Array.isArray(course.finalTest) && course.finalTest.length > 0 && course.finalTest[0] && (
           (() => {
           // Check if all chapters in all sections are completed using completedChapters
              const allChapters = course.sections.flatMap((section: any) => section.chapters || []);
              const allCompleted = allChapters.length > 0 && allChapters.every((c: any) => completedChapters.includes(c.id));
              const attempted = finalExamStatus?.attempted;
              const passed = finalExamStatus?.passed;
              const bestMarks = finalExamStatus?.bestMarks;
              return (
            <TouchableOpacity
              style={[
                styles.moduleCard,
                styles.moduleCardFinalExam,
              ]}
              activeOpacity={0.8}
              disabled={!allCompleted}
              onPress={() => {
                if (!courseId) {
                  Alert.alert('Error', 'Course id missing');
                  return;
                }
                router.push(`/courses/${courseId}/final-exam`);
              }}
            >
              <View style={styles.moduleContent}>
                <View style={styles.moduleIcon}>
                  <Image source={assets.book} style={styles.modulePlayIcon} />
                </View>
                <View style={styles.moduleInfo}>
                  <Text style={styles.moduleTitle}>Ikizamini cya nyuma (Certificate)</Text>
                  <Text style={styles.moduleDetails}>Ikizamini cyo kubona impamyabumenyi</Text>
                   <Text style={styles.moduleDetails}>Ibibazo {course.finalTest[0].questionToBeAnswered || 0}</Text>
                      {attempted && (
                        <Text style={{ color: passed ? '#059669' : '#DC2626', fontWeight: 'bold', marginTop: 4, fontSize: 10 }}>
                          Amanota: {bestMarks} / 100 {passed ? '✓' : '✗'}
                        </Text>
                      )}
                </View>
                <View style={styles.moduleRight}>
                  {passed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: '#8B5CF6', borderRadius: 12, padding: 6 }}>
                        <CheckCircle size={16} color="#fff" />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
             );
            })()
          )}
          {selectedCourse === 'final-exam' && finalExamStatus?.passed && (
            <>
              {/* No certificate - show generate button */}
              {!certificate && (
                <TouchableOpacity
                  style={[
                    styles.moduleCard,
                    {
                      borderWidth: 2,
                      borderColor: '#FFD700',
                      backgroundColor: '#FFFEF7',
                    }
                  ]}
                  activeOpacity={0.8}
                  onPress={handleGenerateCertificate}
                  disabled={certificateLoading}
                >
                  <View style={styles.moduleContent}>
                    <View style={styles.moduleIcon}>
                      <Text style={{ fontSize: 28 }}>🏆</Text>
                    </View>
                    <View style={styles.moduleInfo}>
                      <Text style={styles.moduleTitle}>Saba Impamyabumenyi</Text>
                      <Text style={styles.moduleDetails}>
                        {certificateLoading ? 'Tegereza...' : 'Kanda hano usabe impamyabumenyi yawe'}
                      </Text>
                    </View>
                    <View style={styles.moduleRight}>
                      <View style={{ backgroundColor: '#FFD700', borderRadius: 12, padding: 4 }}>
                        <Text style={{ fontSize: 16 }}>📜</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* Certificate available - show preview and regenerate buttons */}
              {certificate && (
                <>
                  <TouchableOpacity
                    style={[styles.moduleCard, { borderWidth: 2, borderColor: '#FFD700', backgroundColor: '#FFFEF7' }]}
                    onPress={() => setShowCertificateModal(true)}
                  >
                    <View style={styles.moduleContent}>
                      <View style={styles.moduleIcon}>
                        <Text style={{ fontSize: 28 }}>🏆</Text>
                      </View>
                      <View style={styles.moduleInfo}>
                        <Text style={styles.moduleTitle}>Impamyabumenyi yawe</Text>
                        <Text style={styles.moduleDetails}>Impamyabumenyi yawe iraboneka</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.moduleCard,
                      {
                        borderWidth: 1.5,
                        borderColor: '#3363AD',
                        backgroundColor: '#F0F4FF',
                        opacity: certificateLoading ? 0.6 : 1,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={handleRegenerateCertificate}
                    disabled={certificateLoading}
                  >
                    <View style={styles.moduleContent}>
                      <View style={[styles.moduleIcon, { backgroundColor: '#D6E4FF' }]}>
                        <Text style={{ fontSize: 22 }}>🔄</Text>
                      </View>
                      <View style={styles.moduleInfo}>
                        <Text style={styles.moduleTitle}>Saba Impamyabumenyi nshya</Text>
                        <Text style={styles.moduleDetails}>
                          {certificateLoading ? 'Tegereza...' : 'Kanda hano usabe impamyabumenyi nshya'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
          {/* Chapter Cards: only when a regular section is selected */}
          {selectedCourse !== 'pre-test' && selectedCourse !== 'final-test' && selectedCourse !== 'final-exam' && chaptersList.map((module: IChapter, index: number) => {
            const idxInSection = index;
            const secIndex = course?.sections.findIndex((s: any) => s.id === (selectedSection?.id ?? '')) ?? -1;
            const enabled = isChapterUnlocked(secIndex, idxInSection);
            const isCompleted = isChapterCompleted(module.id);
            // Get chapter number and duration
            const chapterNumber = idxInSection + 1;
            const recommendedSeverity = recommendedChaptersMap.get(module.id);
            const recStyle = recommendedSeverity ? SEVERITY_BADGE[recommendedSeverity] : null;
            return (
              <TouchableOpacity
                key={module.id}
                style={[
                  styles.moduleCard,
                  (!enabled && !isCompleted) && styles.moduleCardDisabled,
                  recStyle && { borderWidth: 1.5, borderColor: recStyle.border },
                ]}
                activeOpacity={0.8}
                disabled={!(enabled || isCompleted)}
                onPress={async () => {
                  if (!courseId) {
                    Alert.alert('Error', 'Course id missing');
                    return;
                  }
                  if (!enabled && !isCompleted) {
                    Alert.alert('Ubanza kurangiza igice kibanza', 'Nyamuneka urangize igice kibanza mbere yo gukomeza.');
                    return;
                  }
                  const firstChapterPretestRequired = idxInSection === 0 && Array.isArray(course?.preTests) && course.preTests.length > 0;
                  if (firstChapterPretestRequired && !preTestDone && secIndex === 0) {
                    router.push(`/courses/${courseId}/pre-test`);
                    return;
                  }
                  router.push(`/courses/${courseId}/${module.id}/course-content?page=1`);
                }}
              >
                <View style={styles.moduleContent}>
                  <View style={styles.moduleIcon}>
                    <Image source={assets.book} style={styles.modulePlayIcon} />
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>{chapterNumber}. {module.title}</Text>
                    <Text style={styles.moduleDetails}>icyigwa {index + 1} • {module.lessonDuration} min</Text>
                    {recStyle && (
                      <View
                        style={[
                          styles.recommendedBadge,
                          { backgroundColor: recStyle.bg, borderColor: recStyle.border },
                        ]}
                      >
                         <View
                          style={[styles.recommendedSeverityDot, { backgroundColor: recStyle.border }]}
                        />
                        <RotateCcw size={10} color={recStyle.text} />
                        <Text style={[styles.recommendedBadgeText, { color: recStyle.text }]}>
                        Subiramo
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.moduleRight}>
                    {isCompleted ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 4 }}>
                          <CheckCircle size={16} color="#fff" />
                        </View>
                      </View>
                    ) : module.id === nextChapterId ? (
                      <AnimatedFingerPointer direction="left" />
                    ) : null}
                  </View>
                </View>
                <EmojiBurst active={Boolean(isCompleted)} />
              </TouchableOpacity>
            );
          })}
          </WalkthroughableView>
        </CopilotStep>
      </ScrollView>
      <Footer
        activeTab="training"
        onTabPress={tabName => {
          if (tabName === 'index') {
            router.push('/');
          } else {
            router.push(`/${tabName}`);
          }
        }}
      />
      <Modal visible={showReviewModal} animationType="slide" transparent={false}>
        <CourseReviewCard
          courseId={courseId as string}
          courseCoverIcon={course.coverIcon}
          courseTitle={course.title}
          submitButtonText="Ohereza"
          onSubmit={handleReviewSubmit}
        />
      </Modal>
      
      {/* Section Review Modal */}
      {/*
      {currentSectionForReview && (
        <Modal visible={showSectionReviewModal} animationType="slide" transparent={false}>
          <SectionReviewCard
            courseId={courseId as string}
            sectionId={currentSectionForReview.sectionId}
            sectionTitle={currentSectionForReview.sectionTitle}
            sectionNumber={currentSectionForReview.sectionNumber}
            courseCoverIcon={course?.coverIcon || ''}
            courseTitle={course?.title || ''}
            submitButtonText="Ohereza"
            onSubmit={handleSectionReviewSubmit}
            onClose={() => {
              setShowSectionReviewModal(false);
              setCurrentSectionForReview(null);
            }}
          />
        </Modal>
      )}
      */}

      {/* Certificate Preview Modal */}
      <Modal visible={showCertificateModal} animationType="slide" transparent={false}>
        <View style={styles.certificateModalContainer}>
          {certificate && (
            <DocumentViewer 
              uri={certificate.pdf} 
              title="Impamyabumenyi yawe" 
              onDownload={handleDownloadCertificate} 
              onClose={() => setShowCertificateModal(false)} 
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function OneCourseScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="svg"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
    >
      <OneCourseScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTime: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  videoImage: {
    width: '100%',
    height: 340,
  },
  playBubble: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3363AD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  infoBubble: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#3363AD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    elevation: 4,
  },
  play: {
  margin: 4,
  width: 30,
  height: 30,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: '#FFFF'
  },
  playIconSmall: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  infoBubbleText: {
    marginLeft: 10,
    marginRight: 10,
    color: '#ffff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 14,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  progressInfo: {
    backgroundColor: '#3363AD',
    marginHorizontal: 10,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    textAlign: 'left',
    // Removed flex: 1 and marginLeft for better wrapping
  },
  userInfo: {
    backgroundColor: '#EFF1F8',
    marginHorizontal: 10,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
     shadowColor: '#EFF1F8',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 10,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#3363AD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pulsingCircle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
    timeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  courseProgress: {
    marginHorizontal: 10,
    marginBottom: 4,
    padding: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3363AD',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  weeksText: {
    fontSize: 12,
    color: '#3363AD',
  },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.8,
    borderColor: '#3363AD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressPercentage: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3363AD',
  },
  progressBarWrapper: {
    width: '100%',
    height: 4,
    borderRadius: 6,
    backgroundColor: '#E6EEF3',
    overflow: 'hidden',
    marginLeft: 8,
    alignSelf: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#63758C',
    borderRadius: 6,
  },
  courseTabsContainer: {
    marginTop: 6,
  },
  courseTabs: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingLeft: 2,
  },
  sectionNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionNumberCircleActive: {
    backgroundColor: '#3363AD',
  },
  sectionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  sectionNumberActive: {
    color: '#FFFFFF',
  },
  sectionTitleContainer: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3363AD',
    textAlign: 'left',
  },
  modulesList: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    marginTop: 6,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginBottom: 8,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
    position: 'relative',
    overflow: 'hidden',
   },
  moduleCardDisabled: {
    opacity: 0.8,
  },
  moduleCardPreTest: {
    borderWidth: 1,
    borderColor: '#3363AD',
  },
  moduleCardFinalTest: {
    borderWidth: 1,
    borderColor: '#10B981',
  },
  moduleCardFinalExam: {
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#FAF5FF',
  },
  moduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF1F8',
  },
  modulePlayIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  moduleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  moduleTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3363AD',
    lineHeight: 20,
    marginBottom: 4,
  },
  moduleDetails: {
    fontSize: 10,
    color: '#6B7280',
  },
  recommendedSeverityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recommendedBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  moduleRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  moduleProgress: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 8,
  },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  congratsContainer: {
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  congratsText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  congratsEmoji: {
    marginTop: 0,
    fontSize: 12,
    lineHeight: 14,
  },
  /* place animated emojis at top-right corner of the card */
  emojiContainer: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 56,
    height: 56,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  emoji: {
    position: 'absolute',
    top: 4,
    right: 12,
    fontSize: 18,
  },
  emojiMiddle: {
    position: 'absolute',
    top: 8,
    right: 22,
    fontSize: 16,
  },
  emojiRight: {
    position: 'absolute',
    top: 4,
    right: 2,
    fontSize: 18,
  },
  testBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  testBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  preTestBadge: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 4,
  },
  preTestBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  // Certificate styles
  certificateActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8,
  },
  certificateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    gap: 4,
  },
  certificateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  certificateModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  certificateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  certificateModalCloseButton: {
    padding: 8,
    marginRight: 12,
  },
  certificateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  certificateModalContent: {
    flex: 1,
  },
});