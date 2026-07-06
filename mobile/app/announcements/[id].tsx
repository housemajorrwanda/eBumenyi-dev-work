import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Megaphone, Calendar, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import httpClient from '@/services/httpClient';

interface Announcement {
  id: string;
  title: string;
  body: string;
  segment: string;
  priority: string;
  status: string;
  publishAt: string;
  validUntil: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullNames: string;
    photo: string | null;
  };
}

interface AnnouncementResponse {
  message: string;
  statusCode: number;
  data: Announcement;
}

const getAnnouncementById = async (id: string): Promise<Announcement> => {
  const response = await httpClient.get<AnnouncementResponse>(`/announcements/${id}`);
  return response.data.data;
};

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, themeColors } = useTheme();

  const { data: announcement, isLoading, error } = useQuery<Announcement, Error>({
    queryKey: ['ANNOUNCEMENT', id],
    queryFn: () => getAnnouncementById(id!),
    enabled: !!id,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return '#ef4444';
      case 'medium':
        return '#f97316';
      case 'low':
        return '#22c55e';
      default:
        return themeColors.primary;
    }
  };

  const styles = createStyles(isDark, themeColors, insets);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Itangazo</Text>
        </LinearGradient>
        <LoadingSpinner message="Gufungura itangazo..." />
      </View>
    );
  }

  // Error state
  if (error || !announcement) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Itangazo</Text>
        </LinearGradient>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>Ntibyakunze gufungura itangazo</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryText}>Subira inyuma</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const priorityColor = getPriorityColor(announcement.priority);

  // Success state
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Itangazo</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroTypeRow}>
            <View style={[styles.heroIconContainer, { backgroundColor: priorityColor }]}>
              <Megaphone size={20} color="#ffffff" />
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}22` }]}>
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {announcement.priority?.toUpperCase() || 'MEDIUM'}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{announcement.title}</Text>
        </View>

        {/* Metadata Card */}
        <View style={[styles.metadataCard, {
          backgroundColor: isDark ? '#1e3a8a' : '#eff6ff',
          borderColor: `${themeColors.primary}40`
        }]}>
          <View style={styles.metadataRow}>
            <Calendar size={16} color={themeColors.primary} />
            <Text style={styles.metadataText}>
              {formatDate(announcement.publishAt)}
            </Text>
          </View>
          {announcement.createdBy && (
            <>
              <View style={[styles.metadataDivider, { backgroundColor: isDark ? '#3b82f6' : '#bfdbfe' }]} />
              <View style={styles.metadataRow}>
                <User size={16} color={themeColors.primary} />
                <Text style={styles.metadataText}>
                  {announcement.createdBy.fullNames}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Body Content */}
        <View style={[styles.bodyCard, {
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          borderLeftWidth: 3,
          borderLeftColor: priorityColor,
        }]}>
          <Text style={styles.bodyText}>{announcement.body}</Text>
        </View>

        {/* Expiration Notice */}
        {announcement.validUntil && (
          <View style={[styles.expirationCard, {
            backgroundColor: isDark ? '#422006' : '#fef3c7',
            borderColor: isDark ? '#78350f' : '#fbbf24',
          }]}>
            <Text style={[styles.expirationText, { color: isDark ? '#fbbf24' : '#78350f' }]}>
              Itangazo rizarangira: {formatDate(announcement.validUntil)}
            </Text>
          </View>
        )}

        {/* Segment Info */}
        <View style={styles.segmentCard}>
          <Text style={styles.segmentLabel}>Ryoherejwe:</Text>
          <Text style={styles.segmentValue}>
            {announcement.segment === 'all' ? 'Abantu bose' : announcement.segment}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (isDark: boolean, themeColors: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    },
    header: {
      paddingTop: insets.top + 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: 'Inter-Bold',
      color: '#ffffff',
      flex: 1,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    centeredState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
    },
    centeredStateText: {
      fontSize: 15,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#d1d5db' : '#374151',
    },
    errorText: {
      fontSize: 15,
      fontFamily: 'Inter-Regular',
      color: '#ef4444',
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: themeColors.primary,
    },
    retryText: {
      fontSize: 14,
      fontFamily: 'Inter-SemiBold',
      color: '#ffffff',
    },

    // Hero Section
    heroSection: {
      marginBottom: 24,
    },
    heroTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    heroIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    priorityBadge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
    },
    priorityText: {
      fontSize: 12,
      fontFamily: 'Inter-Bold',
      letterSpacing: 0.8,
    },
    heroTitle: {
      fontSize: 24,
      fontFamily: 'Inter-Bold',
      color: isDark ? '#f9fafb' : '#111827',
      lineHeight: 32,
    },

    // Metadata Card
    metadataCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 18,
      marginBottom: 24,
      shadowColor: themeColors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    metadataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    metadataText: {
      fontSize: 14,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#f9fafb' : '#111827',
      flex: 1,
      lineHeight: 20,
    },
    metadataDivider: {
      height: 1,
      marginVertical: 14,
      opacity: 0.3,
    },

    // Body Card
    bodyCard: {
      borderRadius: 14,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
    bodyText: {
      fontSize: 16,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#cbd5e1' : '#475569',
      lineHeight: 26,
    },

    // Expiration Card
    expirationCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
    },
    expirationText: {
      fontSize: 14,
      fontFamily: 'Inter-SemiBold',
      textAlign: 'center',
    },

    // Segment Card
    segmentCard: {
      marginBottom: 24,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
    segmentLabel: {
      fontSize: 12,
      fontFamily: 'Inter-Medium',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 4,
    },
    segmentValue: {
      fontSize: 15,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#f9fafb' : '#111827',
    },
  });
