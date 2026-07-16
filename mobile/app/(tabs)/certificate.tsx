import { CertificateCard } from '@/components/CertificateCard';
import Header from '@/components/Header';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PostCourseRecommendationsModal from '@/components/PostCourseRecommendationsModal';
import { getMyCertificates } from '@/services/certificate.api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

function CertificateScreenContent() {
  const queryClient = useQueryClient();
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);
  const scrollViewRef = useRef<FlatList>(null);
  const { width: screenWidth } = Dimensions.get('window');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
  const advanceRecommendations = useTourStepAdvance('certificate-recommendations');
  const advancePdf = useTourStepAdvance('certificate-pdf');
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

  const [recModalVisible, setRecModalVisible] = useState(false);
  const [recModalCourseId, setRecModalCourseId] = useState<string | null>(null);

  const openRecommendations = (courseId: string) => {
    if (!courseId || courseId === 'undefined') {
      setRecModalCourseId('');
      setRecModalVisible(true);
      return;
    }
    setRecModalCourseId(courseId);
    setRecModalVisible(true);
  };

  const closeRecModal = () => {
    setRecModalVisible(false);
    setRecModalCourseId(null);
  };

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(scrollPosition / (screenWidth + 10));
    setActiveCourseIndex(currentIndex);
  };

  const scrollToCourse = (index: number) => {
    scrollViewRef.current?.scrollToOffset({
      offset: index * (screenWidth - 20 + 10),
      animated: true,
    });
    setActiveCourseIndex(index);
  };

  const { data: certificatesData, isLoading, error, refetch} = useQuery({
    queryKey: ['MY_CERTIFICATES'],
    queryFn: getMyCertificates,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['MY_CERTIFICATES'] });
      await refetch();
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const certificates = certificatesData?.data || [];

  // Auto-start the tour once per session, only when certificate data is loaded
  // and at least one certificate exists (empty-list targets have zero height and
  // can't be measured reliably by react-native-copilot).
  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;

    if (!isLoading && certificates.length > 0 && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.CERTIFICATE);
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
  }, [isLoading, certificates.length, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.CERTIFICATE).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title='Impamyabumenyi'/>
        <LoadingSpinner message="Gufungura impamyabumenyi..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title='Impamyabumenyi'/>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Habaye ikosa mu gufungura impamyabumenyi</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title='Impamyabumenyi'/>
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
        <View style={styles.content}>
          {/* Step 1: Certificate carousel */}
          <CopilotStep
            text="Nyuza urutoki hano kugira ngo ujye ku mpamyabumenyi y'isomo rikurikira. Ibyerekeye amanota yawe bigaragara hepfo."
            order={1}
            name="certificate-carousel"
          >
            <WalkthroughableView style={styles.section}>
              <View style={{paddingHorizontal: 8}}>
                <Text style={styles.sectionTitle}>Isomo</Text>
              </View>
              <FlatList
                ref={scrollViewRef}
                data={certificates}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={[styles.courseCard, { width: screenWidth - 24, marginRight: 10 }]}>
                    <View style={styles.courseTopRow}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.courseImage}
                      />
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseTitle}>{item.title}</Text>
                      </View>
                    </View>
                    <View style={styles.courseFooter}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>Ubutumwa</Text>
                      </View>
                      {/* Step 2: Recommendations link on the active card only */}
                      {index === activeCourseIndex ? (
                        <CopilotStep
                          text="Kanda hano kugira ngo ubone inama zihariye z'isomo warangije."
                          order={2}
                          name="certificate-recommendations"
                        >
                          <WalkthroughableTouchable
                            style={styles.viewButton}
                            onPress={advanceRecommendations(() => openRecommendations(item.courseId))}
                          >
                            <Text style={styles.viewButtonText}>Reba</Text>
                          </WalkthroughableTouchable>
                        </CopilotStep>
                      ) : (
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => openRecommendations(item.courseId)}
                        >
                          <Text style={styles.viewButtonText}>Reba</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                snapToInterval={screenWidth - 20 + 10}
                decelerationRate="fast"
                style={styles.courseScrollView}
              />

              <View style={{paddingHorizontal: 8}}>
                <View style={styles.dotsContainer}>
                  {certificates.map((course, index) => {
                    const dotSize = Math.max(4, 16 - certificates.length * 0.1);
                    return (
                      <TouchableOpacity
                        key={course.id}
                        onPress={() => scrollToCourse(index)}
                        style={styles.dotTouchable}
                      >
                        <View
                          style={[
                            styles.dot,
                            { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                            index === activeCourseIndex ? styles.dotActive : styles.dotInactive
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.sectionTitle}>Imyitwarire</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>20</Text>
                    <Text style={styles.statLabel}>Inshuro wize</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{certificates[activeCourseIndex]?.test || 0}</Text>
                    <Text style={styles.statLabel}>Igeragezwa</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{certificates[activeCourseIndex]?.attempt || 0}</Text>
                    <Text style={styles.statLabel}>Gusubiramo</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{certificates[activeCourseIndex]?.finalExamMarks || 0}</Text>
                    <Text style={styles.statLabel}>Amanota</Text>
                  </View>
                </View>
              </View>
            </WalkthroughableView>
          </CopilotStep>

          <Text style={styles.sectionTitle}>Impamyabumenyi</Text>

          {/* Step 3: Certificate PDF cards */}
          <CopilotStep
            text="Kanda ku karita kugira ngo urebe cyangwa ukurure impamyabumenyi yawe (PDF). Ushobora no kuyisaba igihe cyose."
            order={3}
            name="certificate-pdf"
          >
            <WalkthroughableView style={styles.section}>
              <View style={{paddingHorizontal: 8}}>
                {certificates.map((cert) => (
                  <CertificateCard
                    key={cert.id}
                    id={cert.id}
                    courseId={cert.courseId}
                    title={cert.title}
                    image={cert.image}
                    certificateUrl={cert.pdf}
                    enrollmentDate={cert.enrollmentDate}
                    completedAt={cert.completedAt}
                    progress={cert.progress}
                    slides={cert.slides}
                    onRegenerate={async () => {
                      await queryClient.invalidateQueries({ queryKey: ['MY_CERTIFICATES'] });
                      await refetch();
                    }}
                    tourAdvance={advancePdf}
                  />
                ))}
              </View>
            </WalkthroughableView>
          </CopilotStep>
        </View>
      </ScrollView>

      <PostCourseRecommendationsModal
        visible={recModalVisible}
        courseId={recModalCourseId}
        onClose={closeRecModal}
      />
    </View>
  );
}

export default function CertificateScreen() {
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
      <CertificateScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 4,
    gap: 10,
  },
  section: {
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4D81D2',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#EFF1F8',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4D81D2',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  courseCard: {
    backgroundColor: '#EFF1F8',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'column',
  },
  courseTopRow: {
    flexDirection: 'row',
  },
  courseImage: {
    width: 100,
    height: 84,
    margin: 4,
    borderRadius: 16,
  },
  courseInfo: {
    flex: 1,
    padding: 15,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4D81D2',
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'rgba(51, 99, 173, 0.25)',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#4D81D2',
    fontWeight: '500',
  },
  viewButton: {
    backgroundColor: '#FFFF',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#4D81D2',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4D81D2',
  },
  courseScrollView: {
    marginHorizontal: 2,
  },
  dotTouchable: {
    padding: 4,
  },
  dotInactive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D4D4D8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
