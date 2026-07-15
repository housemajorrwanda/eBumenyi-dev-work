import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { assets } from '@/theme';
import { CourseHeader } from '@/components/CourseHeader';
import { useCourseWorkspace, normalizeCourseId } from '@/hooks/useCourseWorkspace';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Footer from '@/components/Footer';
import Button from '@/components/Button';

export default function CourseIntroScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams();
  const courseIdStr = normalizeCourseId(courseId as string | string[] | undefined);
  const { data: workspace, isLoading: loading } = useCourseWorkspace(courseIdStr);
  const course = workspace?.course ?? null;
  const screenHeight = Dimensions.get('window').height;

  if (loading) return <LoadingSpinner />;
  if (!course) return null;

  const handleStart = () => {
    router.push(`/courses/${courseIdStr}/chapters`);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <CourseHeader course={course} currentPage="intro" />
          <View style={styles.titleSection}>
            <View style={styles.headerBackgroundContainer}>
              <Image source={{ uri: course.intro.bannerImage }} style={[styles.headerBackground, { opacity: 0.4 }]} />
            </View>

            <Text style={styles.courseTitle}>
              {course.intro.title}
            </Text>
          </View>

          <View style={[styles.descriptionCard, { height: screenHeight * 0.3 }]}>
            <View style={styles.descriptionHeader}>
              <View style={styles.iconContainer}>
                <Image source={assets.speaker} style={styles.speakerImage} />
              </View>
              <Text style={styles.descriptionTitle}>Incamake</Text>
            </View>

            <ScrollView
              style={styles.descriptionScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.descriptionContent}
            >
              <Text style={styles.description}>
                {course.intro.summary}
              </Text>
            </ScrollView>
          </View>

          <View style={styles.videoSection}>
            <View style={styles.videoContainer}>
              <Image
                source={{ uri: course.intro.thumbnail }}
                style={styles.videoThumbnail}
              />
            </View>
          </View>

          <View style={styles.actionSection}>
            <Button
              title="Tangira isomo"
              onPress={handleStart}
              variant="secondary"
              style={{ marginTop: 16 }}
              icon={<Image source={assets.loginIcon} style={{ width: 18, height: 18, tintColor: '#fff' }} />}
              loading={loading}
              disabled={loading}
            />
          </View>
        </View>
      </ScrollView>

      <Footer
        activeTab="training"
        onTabPress={(tabName) => {
          if (tabName === 'index') {
            router.push('/');
          } else {
            router.push(`/${tabName}`);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#3363AD',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#4D81D2',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    paddingTop: 40,
    paddingBottom: 100,
  },
  titleSection: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  decorativeElements: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 140,
    resizeMode: 'cover',
  },
  headerBackgroundContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 140,
    borderBottomWidth: 1,
    borderBottomColor: '#4D81D2',
  },
  circle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.6,
  },
  courseTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#3363AD',
    lineHeight: 36,
    textAlign: 'center',
  },
  descriptionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'flex-start',
  },
  descriptionCard: {
    marginHorizontal: 10,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3363AD',
    flex: 1,
    textAlign: 'center',
  },
  descriptionScrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionContent: {
    paddingBottom: 20,
  },
  iconContainer: {
    backgroundColor: '#3363AD',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  description: {
    fontSize: 12,
    color: '#3363AD',
    lineHeight: 18,
    paddingBottom: 4,
  },
  videoSection: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  videoPlayer: {
    width: '100%',
    height: '70%',
    backgroundColor: '#000',
  },
  videoClose: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(51, 99, 173, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3363AD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3363AD',
  },
  separator: {
    height: 1,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#4D81D2',
    borderRadius: 2,
    marginVertical: 33,
  },
});
