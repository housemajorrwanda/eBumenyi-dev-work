import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Alert, RefreshControl } from 'react-native';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { Trophy, BookOpen, Book, Clock, MessageCircle, Bell } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStudentCourseStats } from '@/services/course.api';
import { getMyInvitations } from '@/services/choGroup.api';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function HomeScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeQuickAction, setActiveQuickAction] = useState<number>(1);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [showSystemReview, setShowSystemReview] = useState(false);
  const [isSystemReviewed, setIsSystemReviewed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const WELCOME_STORAGE_KEY = 'welcome_video_shown';
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);

  // Load user roles from storage
  useEffect(() => {
    AsyncStorage.getItem('userData').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setUserRoles(parsed.roles ?? []);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const isCHW = userRoles.some((r) => ['TRAINEE', 'TESTER'].includes(r));

  // CHW: fetch pending invitations count
  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['cho-invitations-mine'],
    queryFn: getMyInvitations,
    enabled: isCHW && !isValidatingToken,
    retry: false,
  });

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
      } catch (error) {
        console.log('Token validation error:', error);
        // On error, redirect to login for safety
        router.replace('/auth/login');
      }
    };

    checkTokenValidity();
  }, [router]);

  // Check whether to show welcome modal once token validation finishes
  useEffect(() => {
    if (!isValidatingToken) {
      (async () => {
        try {
          const val = await AsyncStorage.getItem(WELCOME_STORAGE_KEY);
          if (!val) {
            setWelcomeModalVisible(true);
          }
        } catch (err) {
          console.log('Error reading welcome flag:', err);
          setWelcomeModalVisible(true);
        }
      })();
    }
  }, [isValidatingToken]);

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
  const handleSystemReviewSubmit = async (reviewData: CreateSystemReviewDto) => {    
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

  // fetch student-course-stats
  const { data: courseStatsData, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['COURSE'],
    queryFn: getStudentCourseStats,
    gcTime: 0,
    enabled: !isValidatingToken,
  });

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

  if (error) {
    return (
      <View style={styles.container}>
        <Header title={t('home')}/>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Habaye ikosa mu gufungura amakuru</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('home')}/>
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
          <View style={styles.statsSecondaryRow}>
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
          </View>

          {/* Current Activity Banner - only show if there's last viewed location */}
          {courseStatsData?.lastViewedLocation?.courseId && (
            <View style={styles.activityBanner}>
              <View style={styles.activityLeft}>
                <View style={styles.activityIconWrapper}>
                  {courseStatsData?.lastViewedLocation?.coverIcon ? (
                    <Image
                      source={{ uri: courseStatsData.lastViewedLocation.coverIcon }}
                      style={styles.activityIconImage}
                      // resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.activityIcon}>📚</Text>
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{courseStatsData?.lastViewedLocation?.courseTitle}</Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>icyigwa {courseStatsData?.lastViewedLocation?.chapterNumber}: {courseStatsData?.lastViewedLocation?.chapterTitle}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.activityRight}
                onPress={() => {
                  const loc = courseStatsData?.lastViewedLocation;
                  if (loc?.courseId && loc?.sectionId && loc?.chapterId) {
                    if (loc.slideId) {
                      router.push(`/courses/${loc.courseId}/${loc.chapterId}/course-content?slideId=${loc.slideId}`);
                    } else {
                      router.push(`/courses/${loc.courseId}/${loc.chapterId}/course-content?page=1`);
                    }
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.continueButton}>
                  <Text style={styles.continueButtonText}>Komeza</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Upcoming Courses */}

        
          {courseStatsData?.courses?.slice(0, 8).filter((course: IStudentCourse) => !course.isEnrolled).length > 0 ? (
                    <View style={styles.section}>
             <Text style={styles.sectionTitle}>Amasomo agiye gukurikira</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingScrollContainer}>
              {courseStatsData.courses.filter((course: IStudentCourse) => !course.isEnrolled).slice(0, 12).map((course: IStudentCourse) => (
                <RevisedCourseCard
                  key={course.courseId}
                  course={course}
                  onPress={() => router.push(getLastViewedSlidePath(courseStatsData, course.courseId))}
                />
              ))}
            </ScrollView>

        </View>
          ) : (
            
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amasomo aheruka</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingScrollContainer}>
            {courseStatsData?.courses?.slice(0, 8).map((course: IStudentCourse) => (
              <RevisedCourseCard
                key={`recent-${course.courseId}`}
                course={course}
                onPress={() => router.push(getLastViewedSlidePath(courseStatsData, course.courseId))}
              />
            ))}
          </ScrollView>
        </View>
          )}
        {/* Recent Courses */}
        {/* CHW: Pending Invitations Banner */}
        {isCHW && pendingInvitations.length > 0 && (
          <TouchableOpacity
            style={styles.invitationBanner}
            onPress={() => router.push('/cho-group/invitations')}
            activeOpacity={0.85}
          >
            <View style={styles.invitationBannerLeft}>
              <Bell size={18} color="#D97706" />
              <View>
                <Text style={styles.invitationBannerTitle}>
                  Ubutumire bw'itsinda ({pendingInvitations.length})
                </Text>
                <Text style={styles.invitationBannerSub}>
                  Kanda hano kugira ngo urebe no gusubiza
                </Text>
              </View>
            </View>
            <Text style={styles.invitationBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickAction, { backgroundColor: activeQuickAction === action.id ? '#4D81D2' : action.color }]}
              activeOpacity={0.85}
              onPress={() => setActiveQuickAction(action.id)}
            >
              <View style={styles.quickActionRow}>
                <Text style={styles.quickActionIcon}>{action.icon}</Text>
                <Text style={[styles.quickActionTitle, { color: activeQuickAction === action.id ? action.color : '#4D81D2' }]}>{action.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {/* Tab Content - switch by activeQuickAction */}
        <View style={styles.section}>
          {/* All Courses tab */}
          {activeQuickAction === 1 && (
            <View>
              {courseStatsData?.courses?.length > 0 ? (
                courseStatsData.courses.map((course: IStudentCourse) => (
                  <TouchableOpacity key={course.courseId} style={styles.compactCard} activeOpacity={0.9} onPress={() => router.push(getLastViewedSlidePath(courseStatsData, course.courseId))}>
                    <View style={styles.compactLeftWithPercent}>
                      <View style={styles.compactLeftRow}>
                        <View style={styles.compactAvatar}>
                          {course.coverIcon ? (
                            <Image source={{ uri: course.coverIcon }} style={styles.compactAvatarImage} />
                          ) : (
                            <Text>📘</Text>
                          )}
                        </View>
                        <View style={styles.compactContent}>
                          <Text style={styles.compactTitle} numberOfLines={2}>{course.title}</Text>
                          <View style={styles.chipsRow}>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                ibyigwa: {course.totalChapters}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Amasaha: {course.courseDuration}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Ibizamini: {course.totalTests}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      {course.progress > 0 && (
                        <View style={styles.percentWrapperInside}>
                          <View style={styles.percentCircleSmall}>
                            <Text style={styles.percentSmallText}>{Math.round(course.progress)}%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
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
              {courseStatsData?.courses?.filter((course: IStudentCourse) => course.isEnrolled).length > 0 ? (
                courseStatsData.courses.filter((course: IStudentCourse) => course.isEnrolled).map((course: IStudentCourse) => (
                  <TouchableOpacity key={course.courseId} style={styles.compactCard} activeOpacity={0.9} onPress={() => router.push(getLastViewedSlidePath(courseStatsData, course.courseId))}>
                    <View style={styles.compactLeftWithPercent}>
                      <View style={styles.compactLeftRow}>
                        <View style={styles.compactAvatar}>
                          {course.coverIcon ? (
                            <Image source={{ uri: course.coverIcon }} style={styles.compactAvatarImage} />
                          ) : (
                            <Text>📘</Text>
                          )}
                        </View>
                        <View style={styles.compactContent}>
                          <Text style={styles.compactTitle} numberOfLines={2}>{course.title}</Text>
                          <View style={styles.chipsRow}>
                         {!course.isCompleted && (
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Yatangiye: {formatDate(course?.enrollmentDate)}
                              </Text>
                            </View>
                            )}
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                ibyigwa: {course.totalChapters}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Ibizamini: {course.completedTests}/{course.totalTests}
                              </Text>
                            </View>
                            {course.isCompleted && (
                              <View style={[styles.chip, {flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, maxWidth: 70}]}> 
                                <Text style={[styles.chipText, {flexShrink: 1, minWidth: 0, marginRight: 4}]} numberOfLines={1} ellipsizeMode="tail">Bihubuje</Text>
                                <Trophy size={10} color="#F59E0B" />
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      {course.progress > 0 && (
                        <View style={styles.percentWrapperInside}>
                          <View style={styles.percentCircleSmall}>
                            <Text style={styles.percentSmallText}>{Math.round(course.progress)}%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>Nta masomo ahari watangiye</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Unenrolled Courses tab */}
          {activeQuickAction === 3 && (
            <View>
              {courseStatsData?.courses?.filter((course: any) => !course.isEnrolled).length > 0 ? (
                courseStatsData.courses.filter((course: any) => !course.isEnrolled).map((course: any) => (
                  <TouchableOpacity key={course.courseId} style={styles.compactCard} activeOpacity={0.9} onPress={() => router.push(getLastViewedSlidePath(courseStatsData, course.courseId))}>
                    <View style={styles.compactLeftWithPercent}>
                      <View style={styles.compactLeftRow}>
                        <View style={styles.compactAvatar}>
                          {course.coverIcon ? (
                            <Image source={{ uri: course.coverIcon }} style={styles.compactAvatarImage} />
                          ) : (
                            <Text>📘</Text>
                          )}
                        </View>
                         <View style={styles.compactContent}>
                          <Text style={styles.compactTitle} numberOfLines={2}>{course.title}</Text>
                          <View style={styles.chipsRow}>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                ibyigwa: {course.totalChapters}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Amasaha: {course.courseDuration}
                              </Text>
                            </View>
                            <View style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
                                Ibizamini: {course.totalTests}
                              </Text>
                            </View>
                             {course.progress < 0 && (
                            <View style={[styles.chip, {flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, maxWidth: 80}]}> 
                              <Text style={[styles.chipText, {flexShrink: 1, minWidth: 0}]} numberOfLines={1} ellipsizeMode="tail">
                                {course.isEnrolled ? (course.isStarted ? 'Watangiye' : 'Wiyandikishije') : 'Ntaratangira'}
                              </Text>
                            </View>
                             )}
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>Nta masomo ahari utaratangira</Text>
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
          onRequestClose={() => setWelcomeModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <WelcomeVideo onDone={() => { console.log('Welcome video finished'); setWelcomeModalVisible(false); }} />
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
    marginBottom: 4
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
    marginBottom: 4
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
    borderColor: '#4D81D2'
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
    borderColor: '#3363AD'
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
  // CHW invitation banner
  invitationBanner: {
    marginHorizontal: 8,
    marginVertical: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  invitationBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  invitationBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  invitationBannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  invitationBannerArrow: {
    fontSize: 22,
    color: '#D97706',
    fontWeight: '600',
  },
});