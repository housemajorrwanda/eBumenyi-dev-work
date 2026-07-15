import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Calendar,
  Clock,
  MapPin,
  Bell,
  RefreshCw,
  Repeat,
  FileText,
  Users,
  ChevronLeft,
  Video,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { EventType, ICalendarEvent } from '@/types';
import { getCalendarEventById } from '@/services/calender';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { isValidMeetingUrl, extractMeetingId, normalizeMeetingUrl } from '@/utils/deepLinking';

const eventTypeColors: Record<string, string> = {
  TRAINING: '#22c55e',
  REMINDER: '#f97316',
  DEADLINE: '#ef4444',
};

export default function CalendarEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch event details
  const { data: event, isLoading, error, refetch } = useQuery<ICalendarEvent, Error>({
    queryKey: ['CALENDAR_EVENT', id],
    queryFn: () => getCalendarEventById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const handleJoinMeeting = () => {
    if (!event?.location) {
      Toast.show({
        type: 'error',
        text1: t('calendar.error.joinTitle') || 'No Meeting Link',
        text2: t('calendar.error.joinMessage') || 'This event does not have a meeting link',
      });
      return;
    }

    // Check if meeting time is valid (current time is between start and end)
    const now = new Date();
    const startTime = new Date(event.startAt);
    const endTime = event.endAt ? new Date(event.endAt) : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time

    if (now < startTime) {
      Toast.show({
        type: 'warning',
        text1: t('calendar.warning.earlyTitle') || 'Meeting Not Started',
        text2: t('calendar.warning.earlyMessage') || `Meeting starts at ${startTime.toLocaleTimeString()}`,
      });
      return;
    }

    if (now > endTime) {
      Toast.show({
        type: 'warning',
        text1: t('calendar.warning.lateTitle') || 'Meeting Ended',
        text2: t('calendar.warning.lateMessage') || 'This meeting has already ended',
      });
      return;
    }

    // Extract meeting ID from stored URL (may be localhost, IP, or production domain)
    // and rebuild with the current env's MEETING_BASE_URL so the WebView can reach it.
    const meetingId = extractMeetingId(event.location);
    if (meetingId) {
      router.push(`/meeting/${meetingId}`);
    } else {
      Toast.show({
        type: 'error',
        text1: t('calendar.error.invalidTitle') || 'Invalid Meeting',
        text2: t('calendar.error.invalidMessage') || 'Could not parse meeting link',
      });
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (date: Date) => {
    const weekdayKeys = [
      'calendar.weekdays.sun', 'calendar.weekdays.mon', 'calendar.weekdays.tue',
      'calendar.weekdays.wed', 'calendar.weekdays.thu', 'calendar.weekdays.fri',
      'calendar.weekdays.sat',
    ];
    const weekdayFallbacks = [
      'Ku cyumweru', 'Kuwa mbere', 'Kuwa kabiri', 'Kuwa gatatu',
      'Kuwa kane', 'Kuwa gatanu', 'Kuwa gatandatu',
    ];
    const monthKeys = [
      'calendar.month.jan', 'calendar.month.feb', 'calendar.month.mar',
      'calendar.month.apr', 'calendar.month.may', 'calendar.month.jun',
      'calendar.month.jul', 'calendar.month.aug', 'calendar.month.sep',
      'calendar.month.oct', 'calendar.month.nov', 'calendar.month.dec',
    ];
    const monthFallbacks = [
      'Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena',
      'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza',
    ];
    const wd = t(weekdayKeys[date.getDay()]) || weekdayFallbacks[date.getDay()];
    const mo = t(monthKeys[date.getMonth()]) || monthFallbacks[date.getMonth()];
    return `${wd}, ${mo} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getEventTypeLabel = (type: EventType) => {
    switch (type) {
      case 'TRAINING':  return t('calendar.types.training') || 'Training';
      case 'REMINDER':  return t('calendar.types.reminder') || 'Reminder';
      case 'DEADLINE':  return t('calendar.types.deadline') || 'Deadline';
      default:          return t('calendar.types.training') || 'Training';
    }
  };

  const getFrequencyLabel = (freq: string) => {
    if (freq === 'DAILY')  return t('calendar.form.frequency.daily') || 'Daily';
    if (freq === 'WEEKLY') return t('calendar.form.frequency.weekly') || 'Weekly';
    return t('calendar.form.frequency.none') || 'One-time';
  };

  const getReminderLabel = (minutes: number | number[] | undefined) => {
    const m = Array.isArray(minutes) ? minutes[0] : minutes;
    if (!m || m <= 0) return null;
    if (m >= 2880) return t('calendar.reminder.twoDays') || '2 days before';
    if (m >= 1440) return t('calendar.reminder.oneDay') || '1 day before';
    if (m >= 60) return `${Math.round(m / 60)}h ${t('calendar.reminder.before') || 'before'}`;
    return `${m} min ${t('calendar.reminder.before') || 'before'}`;
  };

  const typeColor = event ? (eventTypeColors[event.type] ?? themeColors.primary) : themeColors.primary;

  const styles = createStyles(isDark, themeColors, typeColor, insets);

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
          <Text style={styles.headerTitle}>Amakuru y&apos;igikorwa</Text>
        </LinearGradient>
        <LoadingSpinner message={t('calendar.loading') || 'Loading event details…'} />
      </View>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Amakuru y&apos;igikorwa</Text>
        </LinearGradient>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>
            {t('calendar.error.loadMessage') || 'Failed to load event details'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <RefreshCw size={14} color="#fff" />
            <Text style={styles.retryText}>{t('calendar.retry') || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success state - show event details
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
        <Text style={styles.headerTitle}>Amakuru y&apos;igikorwa</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroTypeRow}>
            <View style={[styles.heroIconContainer, { backgroundColor: typeColor }]}>
              <Calendar size={14} color="#ffffff" />
            </View>
            <View style={[styles.heroTypeBadge, { backgroundColor: `${typeColor}22` }]}>
              <Text style={[styles.heroTypeText, { color: typeColor }]}>
                {getEventTypeLabel(event.type).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{event.title}</Text>
        </View>

        {/* Primary Info Card (Date & Time) */}
        <View style={[styles.primaryCard, { 
          backgroundColor: isDark ? '#1e3a8a' : '#eff6ff',
          borderColor: `${themeColors.primary}40`
        }]}>
          <View style={styles.primaryRow}>
            <Calendar size={12} color={themeColors.primary} />
            <Text style={styles.primaryText}>
              {formatDate(new Date(event.startAt))}
            </Text>
          </View>
          <View style={[styles.primaryDivider, { backgroundColor: isDark ? '#3b82f6' : '#bfdbfe' }]} />
          <View style={styles.primaryRow}>
            <Clock size={12} color={themeColors.primary} />
            <Text style={styles.primaryText}>
              {event.allDay
                ? t('calendar.allDay') || 'All day'
                : event.endAt
                  ? `${formatTime(new Date(event.startAt))} → ${formatTime(new Date(event.endAt))}`
                  : formatTime(new Date(event.startAt))}
            </Text>
          </View>
        </View>

        {/* Secondary Details (Inline) */}
        <View style={styles.secondarySection}>
          {/* Frequency */}
          {event.frequency !== 'NONE' && (
            <View style={styles.inlineDetail}>
              <Repeat size={16} color={themeColors.primary} />
              <Text style={styles.inlineText}>
                {getFrequencyLabel(event.frequency)}
                {event.daysOfWeek && event.daysOfWeek.length > 0 && 
                  ` • ${t('calendar.form.daysOfWeek') || 'Custom days'}`}
              </Text>
            </View>
          )}

          {/* Reminder */}
          {getReminderLabel(event.reminderMinutesBefore) && (
            <View style={styles.inlineDetail}>
              <Bell size={12} color={themeColors.primary} />
              <Text style={styles.inlineText}>
                {getReminderLabel(event.reminderMinutesBefore)}
              </Text>
            </View>
          )}

          {/* Location */}
          {event.location && (
            <View style={styles.inlineDetail}>
              <MapPin size={12} color={themeColors.primary} />
              <Text style={styles.inlineText} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          )}
        </View>

        {/* Description Card */}
        {event.description && (
          <View style={[styles.descriptionCard, {
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            borderLeftWidth: 3,
            borderLeftColor: typeColor,
          }]}>
            <View style={styles.descriptionHeader}>
              <FileText size={12} color={themeColors.primary} />
              <Text style={styles.descriptionLabel}>
                {t('calendar.description') || 'Notes'}
              </Text>
            </View>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        )}

        {/* Participants count */}
        {event.participants && event.participants.length > 0 && (
          <View style={styles.participantsRow}>
            <View style={styles.participantsDetail}>
              <Users size={16} color={themeColors.primary} />
              <Text style={styles.participantsLabel}>
                {event.participants.length} {t('calendar.participants') || 'participant(s)'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Join Meeting Button - visible if event has location and is in progress */}
        {event?.location && new Date() >= new Date(event.startAt) && new Date() <= new Date(event.endAt || new Date(new Date(event.startAt).getTime() + 60 * 60 * 1000)) && (
          <TouchableOpacity
            style={[styles.actionButton, styles.joinButton, { 
              backgroundColor: themeColors.primary,
              borderColor: themeColors.primary,
            }]}
            onPress={handleJoinMeeting}
            activeOpacity={0.7}
          >
            <Video size={18} color="#ffffff" />
            <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
              {t('calendar.joinMeeting') || 'Join Meeting'}
            </Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
}

const createStyles = (isDark: boolean, themeColors: any, typeColor: string, insets: any) =>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    heroTypeBadge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
    },
    heroTypeText: {
      fontSize: 10,
      fontFamily: 'Inter-Bold',
      letterSpacing: 0.8,
    },
    heroTitle: {
      fontSize: 14,
      fontFamily: 'Inter-Bold',
      color: isDark ? '#f9fafb' : '#111827',
      lineHeight: 18,
    },

    // Primary Card
    primaryCard: {
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
    primaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    primaryText: {
      fontSize: 10,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#f9fafb' : '#111827',
      flex: 1,
      lineHeight: 16,
    },
    primaryDivider: {
      height: 1,
      marginVertical: 10,
      opacity: 0.3,
    },

    // Secondary Section
    secondarySection: {
      gap: 14,
      marginBottom: 18,
    },
    inlineDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inlineText: {
      fontSize: 10,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#d1d5db' : '#374151',
      flex: 1,
      lineHeight: 16,
    },

    // Description Card
    descriptionCard: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
    descriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    descriptionLabel: {
      fontSize: 10,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#9ca3af' : '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    descriptionText: {
      fontSize: 10,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#cbd5e1' : '#475569',
      lineHeight: 16,
    },

    // Participants
    participantsRow: {
      marginBottom: 16,
    },
    participantsDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    participantsLabel: {
      fontSize: 10,
      fontFamily: 'Inter-Medium',
      color: isDark ? '#9ca3af' : '#6b7280',
    },

    // Action Buttons
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: insets.bottom + 16,
      paddingTop: 16,
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    joinButton: {
      // Colors applied inline
    },
    actionButtonText: {
      fontSize: 15,
      fontFamily: 'Inter-SemiBold',
    },
  });
