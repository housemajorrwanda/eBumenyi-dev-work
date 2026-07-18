import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Phone,
  MapPin,
  BookOpen,
  TrendingUp,
  Award,
  Activity,
  FileText,
  MessageSquare,
  CheckCircle,
  XCircle,
  User,
  Star,
  Clock,
  Calendar,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getStudentById } from '@/services/students.api';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

type Tab = 'overview' | 'courses' | 'tests' | 'reviews';

function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  const [failed, setFailed] = React.useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? '??';
  if (photo && !failed) {
    return (
      <Image
        source={{ uri: photo }}
        style={styles.avatar}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          color={i <= Math.floor(rating) ? '#f59e0b' : '#d1d5db'}
          fill={i <= Math.floor(rating) ? '#f59e0b' : 'transparent'}
        />
      ))}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const TEST_TYPE_LABELS: Record<string, string> = {
  pretest: 'Isuzumabumenyi',
  pretests: 'Isuzumabumenyi',
  midtest: 'Igeragezwa cyo hagati',
  midtests: 'Igeragezwa cyo hagati',
  finaltest: 'Ikizamini gisoza isomo',
  finaltests: 'Ikizamini gisoza isomo',
  finalexam: 'Ikizamini gisoza isomo (Certificate)',
  finalexams: 'Ikizamini gisoza isomo (Certificate)',
};

function translateTestType(type: string): string {
  if (!type) return type;
  const key = type.replace(/[-_\s]/g, '').toLowerCase();
  return TEST_TYPE_LABELS[key] ?? type;
}

function translateStatus(status: string): string {
  if (status === 'ACTIVE') return 'Akora';
  if (status === 'INACTIVE') return 'Ntakora';
  return status;
}

function translateGender(gender: string): string {
  const key = gender?.toLowerCase();
  if (key === 'male') return 'Gabo';
  if (key === 'female') return 'Gore';
  return gender;
}

function translateRole(role: string): string {
  if (role === 'CHO') return 'Umuyobozi(CHO)';
  if (role === 'CHW' || role === 'TRAINEE' || role === 'TESTER') return 'Umujyanama(CHW)';
  return role;
}

function StudentDetailScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [reviewFilter, setReviewFilter] = useState<string | null>('slide');
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceTabs = useTourStepAdvance('student-tabs');
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
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
  const autoStartAttemptedRef = useRef(false);

  const bg = isDark ? '#111827' : '#f8fafc';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudentById(id!),
    enabled: !!id,
  });

  const info = data?.studentInfo;
  const courses: any[] = data?.courseProgress?.enrolledCourses ?? [];
  const attempts: any[] = data?.testAttempts?.detailedAttempts ?? [];
  const completedCount = courses.filter((c: any) => c.isCompleted).length;
  const overallPct = parseInt(data?.courseProgress?.overallProgress ?? '0', 10);

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && !isError && data && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.STUDENT_DETAIL);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, isError, data, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.STUDENT_DETAIL).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Incamake', icon: <Activity size={15} color={activeTab === 'overview' ? '#fff' : textMuted} /> },
    { id: 'courses', label: 'Amasomo', icon: <BookOpen size={15} color={activeTab === 'courses' ? '#fff' : textMuted} /> },
    { id: 'tests', label: 'Ibizamini', icon: <FileText size={15} color={activeTab === 'tests' ? '#fff' : textMuted} /> },
    { id: 'reviews', label: 'Ibitekerezo', icon: <MessageSquare size={15} color={activeTab === 'reviews' ? '#fff' : textMuted} /> },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.primary }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Amakuru y'umunyamuryango</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <LoadingSpinner />
        ) : isError || !data ? (
          <View style={styles.centered}>
            <Text style={[styles.errorText, { color: textMuted }]}>Amakuru ntaboneka</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.retryBtnText}>Subira inyuma</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile card — always visible */}
            <CopilotStep
              text="Hano ubona amakuru y'umunyamuryango: izina, telefoni, ahantu atuye n'akamaro ke."
              order={1}
              name="student-profile"
            >
            <WalkthroughableView style={[styles.profileCard, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
              <View style={styles.profileRow}>
                <Avatar name={info?.fullName ?? ''} photo={info?.photo} />
                <View style={styles.profileInfo}>
                  <Text style={[styles.fullName, { color: textPrimary }]}>{info?.fullName}</Text>
                  <View style={styles.infoRow}>
                    <User size={12} color={textMuted} />
                    <Text style={[styles.infoText, { color: textMuted }]}>
                      {[info?.gender && translateGender(info.gender), info?.role && translateRole(info.role)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {info?.phoneNumber ? (
                    <View style={styles.infoRow}>
                      <Phone size={12} color={textMuted} />
                      <Text style={[styles.infoText, { color: textMuted }]}>{info.phoneNumber}</Text>
                    </View>
                  ) : null}
                  {(info?.district || info?.sector) ? (
                    <View style={styles.infoRow}>
                      <MapPin size={12} color={textMuted} />
                      <Text style={[styles.infoText, { color: textMuted }]} numberOfLines={1}>
                        {[info?.district, info?.sector, info?.cell].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {info?.status ? (
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: info.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2' },
                  ]}>
                    <Text style={[styles.statusText, { color: info.status === 'ACTIVE' ? '#16a34a' : '#dc2626' }]}>
                      {translateStatus(info.status)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </WalkthroughableView>
            </CopilotStep>

            {/* Tab bar */}
            <CopilotStep
              text="Kanda kuri ibibyiciro  kureba amasomo, ibizamini, ibitekerezo n'incamake y'aho ageze."
              order={2}
              name="student-tabs"
            >
            <WalkthroughableView style={[styles.tabBar, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabItem,
                    activeTab === tab.id && { backgroundColor: themeColors.primary },
                  ]}
                  onPress={advanceTabs(() => setActiveTab(tab.id))}
                  activeOpacity={0.8}
                >
                  {tab.icon}
                  <Text style={[
                    styles.tabLabel,
                    { color: activeTab === tab.id ? '#fff' : textMuted },
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </WalkthroughableView>
            </CopilotStep>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

              {/* ── OVERVIEW ── */}
              {activeTab === 'overview' && (
                <>
                  {/* Stats chips */}
                  <CopilotStep
                    text="Aha hagaragara imibare y'amasomo yagizemo, ibizamini byakorezwe n'uruhare yagize muri rusange."
                    order={3}
                    name="student-overview"
                  >
                  <WalkthroughableView style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                    <Text style={[styles.sectionTitle, { color: textPrimary }]}>Incamake rusange</Text>
                    <View style={styles.reviewCountRow}>
                      {[
                        {
                          Icon: BookOpen,
                          value: data?.courseProgress?.totalCoursesEnrolled ?? 0,
                          label: 'Amasomo',
                          sub: `${overallPct}% arangiye`,
                          color: themeColors.primary,
                          showBar: true,
                          pct: overallPct,
                        },
                        {
                          Icon: Award,
                          value: data?.testAttempts?.totalAttempts ?? 0,
                          label: 'Ibizamini',
                          sub: `${data?.testAttempts?.passedAttempts ?? 0} ✓  ${data?.testAttempts?.failedAttempts ?? 0} ✗`,
                          color: '#16a34a',
                          showBar: false,
                          pct: 0,
                        },
                        {
                          Icon: TrendingUp,
                          value: `${(data?.testAttempts?.averageScore ?? 0).toFixed(1)}%`,
                          label: 'Amanota',
                          sub: `${data?.testAttempts?.successRate ?? 0}% yatsinze`,
                          color: '#7c3aed',
                          showBar: false,
                          pct: 0,
                        },
                        {
                          Icon: Star,
                          value: `${data?.feedbacksAndReviews?.feedbackAnalytics?.engagementLevel ?? 0}%`,
                          label: 'Uruhare',
                          sub: `${data?.feedbacksAndReviews?.feedbackAnalytics?.totalFeedbacksGiven ?? 0} ibitekerezo`,
                          color: '#d97706',
                          showBar: false,
                          pct: 0,
                        },
                      ].map((s) => (
                        <View key={s.label} style={[styles.overviewChip, { backgroundColor: s.color + '18' }]}>
                          {/* Row 1: icon box + colored label */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.overviewChipIconBox, { backgroundColor: s.color + '35' }]}>
                              <s.Icon size={15} color={s.color} />
                            </View>
                            <Text style={[styles.overviewChipLabel, { color: s.color }]} numberOfLines={1}>{s.label}</Text>
                          </View>
                          {/* Row 2: value + sub */}
                          <Text style={[styles.overviewChipValue, { color: textPrimary }]}>{s.value}</Text>
                          <Text style={[styles.overviewChipSub, { color: textMuted }]}>{s.sub}</Text>
                          {s.showBar && (
                            <View style={[styles.miniBar, { backgroundColor: s.color + '30' }]}>
                              <View style={[styles.miniBarFill, { width: `${s.pct}%`, backgroundColor: s.color }]} />
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </WalkthroughableView>
                  </CopilotStep>

                  {/* Recent test attempts */}
                  {attempts.length > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibizamini byanyuma</Text>
                        <Calendar size={15} color={textMuted} />
                      </View>
                      {attempts.slice(0, 4).map((a: any) => (
                        <View key={a.attemptId} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[styles.reviewMeta, { color: textPrimary }]}>{translateTestType(a.testType)}</Text>
                              <Text style={[styles.reviewCourse, { color: textMuted }]} numberOfLines={1}>{a.testInfo?.course}</Text>
                              <Text style={[styles.reviewDate, { color: textMuted }]}>#{a.tryCount} · {formatDate(a.attemptDate)}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={[styles.attemptScore, { color: a.isPassed ? '#22c55e' : '#ef4444' }]}>{a.totalMarks}%</Text>
                              <View style={[styles.passBadge, { backgroundColor: a.isPassed ? '#dcfce7' : '#fee2e2' }]}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: a.isPassed ? '#16a34a' : '#dc2626' }}>
                                  {a.isPassed ? 'YATSINZE' : 'NTIYATSINZE'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Test type distribution */}
                  {data?.testAttempts?.totalAttempts > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ubwoko bw'ibizamini</Text>
                      {Object.entries(data.testAttempts.attemptsByType ?? {}).map(([type, count]: [string, any]) => {
                        const pct = data.testAttempts.totalAttempts > 0
                          ? Math.round((count / data.testAttempts.totalAttempts) * 100)
                          : 0;
                        const colors: Record<string, string> = {
                          preTests: themeColors.primary,
                          midTests: '#f59e0b',
                          finalTests: '#22c55e',
                          finalExams: '#8b5cf6',
                        };
                        const labels: Record<string, string> = {
                          preTests: 'Isuzumabumenyi',
                          midTests: 'Igeragezwa cyo hagati',
                          finalTests: 'Ikizamini gisoza isomo',
                          finalExams: 'Ikizamini gisoza isomo (Certificate)',
                        };
                        const color = colors[type] ?? textMuted;
                        return (
                          <View key={type} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[styles.distDot, { backgroundColor: color }]} />
                              <Text style={[styles.reviewMeta, { color: textPrimary, flex: 1 }]}>{labels[type] ?? type}</Text>
                              <Text style={[styles.distCount, { color }]}>{count}</Text>
                            </View>
                            <View style={[styles.distBar, { backgroundColor: borderColor }]}>
                              <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* ── COURSES ── */}
              {activeTab === 'courses' && (
                <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                    {data?.courseProgress?.totalCoursesEnrolled ?? 0} amasomo yiyandikishijeho
                  </Text>
                  {courses.map((course: any) => {
                    const pct = parseInt(course.progress ?? '0', 10);
                    return (
                      <View key={course.courseId} style={[styles.courseItem, { borderTopColor: borderColor }]}>
                        <View style={styles.courseTitleRow}>
                          <Text style={[styles.courseTitle, { color: textPrimary }]} numberOfLines={2}>
                            {course.courseTitle}
                          </Text>
                          <View style={[
                            styles.courseBadge,
                            { backgroundColor: course.isCompleted ? '#dcfce7' : '#fef9c3' },
                          ]}>
                            {course.isCompleted
                              ? <CheckCircle size={11} color="#16a34a" />
                              : <Clock size={11} color="#d97706" />
                            }
                            <Text style={[styles.courseBadgeText, { color: course.isCompleted ? '#16a34a' : '#d97706' }]}>
                              {course.isCompleted ? 'Yarangiye' : 'Irakomeje'}
                            </Text>
                          </View>
                        </View>
                        {course.courseDescription ? (
                          <Text style={[styles.courseDesc, { color: textMuted }]} numberOfLines={2}>
                            {course.courseDescription}
                          </Text>
                        ) : null}
                        <View style={styles.courseMetaRow}>
                          {course.courseRating > 0 && <StarRow rating={course.courseRating} />}
                          {course.enrollmentDate ? (
                            <View style={styles.infoRow}>
                              <Calendar size={11} color={textMuted} />
                              <Text style={[styles.infoText, { color: textMuted }]}>{formatDate(course.enrollmentDate)}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.progressRow}>
                          <View style={[styles.progressBg, { backgroundColor: borderColor }]}>
                            <View style={[
                              styles.progressFill,
                              { width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : themeColors.primary },
                            ]} />
                          </View>
                          <Text style={[styles.pctText, { color: pct >= 100 ? '#22c55e' : themeColors.primary }]}>
                            {pct}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {courses.length === 0 && (
                    <Text style={[styles.emptyText, { color: textMuted }]}>Nta masomo yiyandikishijeho</Text>
                  )}
                </View>
              )}

              {/* ── TESTS ── */}
              {activeTab === 'tests' && (
                <>
                  {/* Summary */}
                  <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                    <Text style={[styles.sectionTitle, { color: textPrimary }]}>Incamake y'ibizamini</Text>
                    <View style={styles.testSummaryGrid}>
                      {[
                        { label: 'Byose', value: data?.testAttempts?.totalAttempts ?? 0, color: themeColors.primary, bg: '#eff6ff' },
                        { label: 'Yatsinze', value: data?.testAttempts?.passedAttempts ?? 0, color: '#16a34a', bg: '#dcfce7' },
                        { label: 'Yaretse', value: data?.testAttempts?.failedAttempts ?? 0, color: '#dc2626', bg: '#fee2e2' },
                        { label: 'Amanota', value: `${(data?.testAttempts?.averageScore ?? 0).toFixed(1)}%`, color: '#7c3aed', bg: '#faf5ff' },
                      ].map((s) => (
                        <View key={s.label} style={[styles.testSummaryItem, { backgroundColor: s.bg }]}>
                          <Text style={[styles.testSummaryValue, { color: s.color }]}>{s.value}</Text>
                          <Text style={[styles.testSummaryLabel, { color: s.color }]}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Attempt list */}
                  {attempts.length > 0 ? (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibisubizo birambuye</Text>
                      {attempts.map((a: any) => (
                        <View key={a.attemptId} style={[styles.attemptCard, { borderColor, backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
                          <View style={styles.attemptCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.attemptType, { color: textPrimary }]}>
                                {translateTestType(a.testType)}
                              </Text>
                              <Text style={[styles.attemptCourse, { color: textMuted }]} numberOfLines={1}>
                                {a.testInfo?.course}
                              </Text>
                              <Text style={[styles.attemptDate, { color: textMuted }]}>
                                #{a.tryCount} · {formatDate(a.attemptDate)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={[styles.attemptScore, { color: a.isPassed ? '#22c55e' : '#ef4444' }]}>
                                {a.totalMarks}%
                              </Text>
                              <Text style={[styles.attemptCorrect, { color: textMuted }]}>
                                {a.correctAnswers}/{a.questionsAnswered} biyobowe
                              </Text>
                              <View style={[
                                styles.passBadge,
                                { backgroundColor: a.isPassed ? '#dcfce7' : '#fee2e2' },
                              ]}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: a.isPassed ? '#16a34a' : '#dc2626' }}>
                                  {a.isPassed ? 'YATSINZE' : 'NTIYATSINZE'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.emptyText, { color: textMuted }]}>Nta bizamini yafashe</Text>
                    </View>
                  )}
                </>
              )}

              {/* ── REVIEWS ── */}
              {activeTab === 'reviews' && (
                <>
                  {/* Counts overview */}
                  <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                    <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibitekerezo</Text>
                    <View style={styles.reviewCountRow}>
                      {[
                        { key: 'slide', label: 'Slide', value: data?.feedbacksAndReviews?.slideFeedbacks?.totalFeedbacks ?? 0, color: themeColors.primary },
                        { key: 'chapter', label: 'Icyigwa', value: data?.feedbacksAndReviews?.chapterReviews?.totalReviews ?? 0, color: '#16a34a' },
                        { key: 'section', label: 'Igice', value: data?.feedbacksAndReviews?.sectionReviews?.totalReviews ?? 0, color: '#7c3aed' },
                        { key: 'course', label: 'Amasomo', value: data?.feedbacksAndReviews?.courseReviews?.totalReviews ?? 0, color: '#f59e0b' },
                        { key: 'system', label: 'Sisitemu', value: data?.feedbacksAndReviews?.systemReviews?.totalReviews ?? 0, color: '#ef4444' },
                      ].map((r) => {
                        const isActive = reviewFilter === r.key;
                        return (
                          <TouchableOpacity
                            key={r.key}
                            style={[styles.reviewCountItem, { borderColor: r.color }, isActive && { backgroundColor: r.color }]}
                            onPress={() => setReviewFilter(isActive ? null : r.key)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.reviewCountValue, { color: isActive ? '#fff' : r.color }]}>{r.value}</Text>
                            <Text style={[styles.reviewCountLabel, { color: isActive ? 'rgba(255,255,255,0.85)' : textMuted }]}>{r.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Slide feedbacks */}
                  {(!reviewFilter || reviewFilter === 'slide') && (data?.feedbacksAndReviews?.slideFeedbacks?.feedbackDetails ?? []).length > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibitekerezo bya slide</Text>
                      {data.feedbacksAndReviews.slideFeedbacks.feedbackDetails.map((f: any) => (
                        <View key={f.feedbackId} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                          <Text style={[styles.reviewMeta, { color: textMuted }]}>
                            Slide #{f.slideInfo?.slideNumber} · {f.slideInfo?.chapterTitle}
                          </Text>
                          <Text style={[styles.reviewCourse, { color: textMuted }]} numberOfLines={1}>
                            {f.slideInfo?.courseTitle}
                          </Text>
                          <Text style={[styles.reviewComment, { color: textPrimary }]}>{f.message}</Text>
                          {f.feedbackDate && (
                            <Text style={[styles.reviewDate, { color: textMuted }]}>{formatDate(f.feedbackDate)}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Chapter reviews */}
                  {(!reviewFilter || reviewFilter === 'chapter') && (data?.feedbacksAndReviews?.chapterReviews?.reviewDetails ?? []).length > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibitekerezo by'icyigwa</Text>
                      {data.feedbacksAndReviews.chapterReviews.reviewDetails.map((r: any) => (
                        <View key={r.reviewId} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                          <StarRow rating={r.rating} />
                          <Text style={[styles.reviewMeta, { color: textMuted }]}>
                            {r.chapterInfo?.chapterTitle} · {r.chapterInfo?.courseTitle}
                          </Text>
                          <Text style={[styles.reviewComment, { color: textPrimary }]}>{r.comment}</Text>
                          <Text style={[styles.reviewDate, { color: textMuted }]}>{formatDate(r.reviewDate)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Course reviews */}
                  {(!reviewFilter || reviewFilter === 'course') && (data?.feedbacksAndReviews?.courseReviews?.reviewDetails ?? []).length > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibitekerezo by'amasomo</Text>
                      {data.feedbacksAndReviews.courseReviews.reviewDetails.map((r: any) => (
                        <View key={r.reviewId} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                          <StarRow rating={r.rating} />
                          <Text style={[styles.reviewMeta, { color: textMuted }]}>{r.courseInfo?.courseTitle}</Text>
                          <Text style={[styles.reviewComment, { color: textPrimary }]}>{r.comment}</Text>
                          <Text style={[styles.reviewDate, { color: textMuted }]}>{formatDate(r.reviewDate)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* System reviews */}
                  {(!reviewFilter || reviewFilter === 'system') && (data?.feedbacksAndReviews?.systemReviews?.reviewDetails ?? []).length > 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ibitekerezo bya sisitemu</Text>
                      {data.feedbacksAndReviews.systemReviews.reviewDetails.map((r: any) => (
                        <View key={r.reviewId} style={[styles.reviewItem, { borderTopColor: borderColor }]}>
                          <StarRow rating={r.overallRating ?? r.rating ?? 0} />
                          <Text style={[styles.reviewComment, { color: textPrimary }]}>
                            {r.feedback ?? r.comment}
                          </Text>
                          {r.recommendation ? (
                            <Text style={[styles.reviewMeta, { color: textMuted }]}>
                              Inama: {r.recommendation}
                            </Text>
                          ) : null}
                          <Text style={[styles.reviewDate, { color: textMuted }]}>
                            {formatDate(r.reviewDate ?? r.createdAt ?? new Date().toISOString())}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* No reviews */}
                  {(data?.feedbacksAndReviews?.slideFeedbacks?.totalFeedbacks ?? 0) === 0 &&
                    (data?.feedbacksAndReviews?.chapterReviews?.totalReviews ?? 0) === 0 &&
                    (data?.feedbacksAndReviews?.courseReviews?.totalReviews ?? 0) === 0 &&
                    (data?.feedbacksAndReviews?.systemReviews?.totalReviews ?? 0) === 0 && (
                    <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
                      <View style={styles.centered}>
                        <MessageSquare size={36} color={textMuted} />
                        <Text style={[styles.emptyText, { color: textMuted }]}>Nta bitekerezo biri</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function StudentDetailScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      androidStatusBarVisible
      labels={{ finish: 'Rangiza', next: 'Ibikurikiraho', previous: 'Inyuma', skip: 'Simbuka' }}
    >
      <StudentDetailScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },

  // Profile
  profileCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EBF0F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: '#3363AD' },
  profileInfo: { flex: 1, gap: 3 },
  fullName: { fontSize: 15, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  scroll: { padding: 12, gap: 12, paddingBottom: 32 },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  miniBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4, alignSelf: 'stretch' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  miniPct: { fontSize: 11, fontWeight: '600' },
  passFailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  passText: { fontSize: 11, fontWeight: '600' },

  // Section
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 13, fontWeight: '700' },

  // Attempt row (overview)
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  attemptType: { fontSize: 13, fontWeight: '600' },
  attemptCourse: { fontSize: 11 },
  attemptDate: { fontSize: 10 },
  attemptScore: { fontSize: 15, fontWeight: '800' },
  attemptCorrect: { fontSize: 10 },

  // Overview chips
  overviewChip: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  overviewChipIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewChipValue: { fontSize: 24, fontWeight: '800' },
  overviewChipLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  overviewChipSub: { fontSize: 10 },

  // Distribution
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distRow: { gap: 4 },
  distLabel: { fontSize: 11 },
  distBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 4 },
  distCount: { fontSize: 11, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  // Courses
  courseItem: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  courseTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  courseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  courseBadgeText: { fontSize: 10, fontWeight: '600' },
  courseDesc: { fontSize: 11 },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  pctText: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },

  // Tests
  testSummaryGrid: { flexDirection: 'row', gap: 8 },
  testSummaryItem: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  testSummaryValue: { fontSize: 18, fontWeight: '800' },
  testSummaryLabel: { fontSize: 10, fontWeight: '600' },
  attemptCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  attemptCardHeader: { flexDirection: 'row', gap: 10 },
  passBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },

  // Reviews
  reviewCountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewCountItem: {
    flex: 1,
    minWidth: '18%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  reviewCountValue: { fontSize: 18, fontWeight: '800' },
  reviewCountLabel: { fontSize: 9, fontWeight: '600' },
  reviewItem: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  reviewMeta: { fontSize: 11, fontWeight: '600' },
  reviewCourse: { fontSize: 11 },
  reviewComment: { fontSize: 13 },
  reviewDate: { fontSize: 10 },

  emptyText: { fontSize: 13, textAlign: 'center', padding: 16 },
});
