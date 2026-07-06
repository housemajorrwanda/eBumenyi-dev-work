import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
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
  Edit2,
  Trash2,
  X,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { EventType, ICalendarEvent } from '@/types';
import { deleteCalendarEvent } from '@/services/calender';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

interface EventViewModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string | null;
  onEdit: (event: ICalendarEvent) => void;
}

const eventTypeColors: Record<string, string> = {
  TRAINING: '#22c55e',
  REMINDER: '#f97316',
  DEADLINE: '#ef4444',
};

const EventViewModal: React.FC<EventViewModalProps> = ({
  visible,
  onClose,
  eventId,
  onEdit,
}) => {
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ─── Read from TanStack cache (list already fetched in CalendarScreen) ───
  const event = React.useMemo(() => {
    if (!eventId) return null;
    const list = queryClient.getQueryData<ICalendarEvent[]>(['CALENDAR_EVENTS']);
    return list?.find(e => e.id === eventId) ?? null;
  }, [eventId, queryClient]);

  // Fallback: only fetch if the event isn't in the cache
  const { isLoading, error, refetch } = useQuery<ICalendarEvent, Error>({
    queryKey: ['CALENDAR_EVENTS', eventId],
    queryFn: async () => {
      const { getCalendarEventById } = await import('@/services/calender');
      return getCalendarEventById(eventId!);
    },
    enabled: visible && !!eventId && !event,
    staleTime: 1000 * 60 * 5,
  });

  // Merged: prefer cache, fall back to individual fetch
  const resolvedEvent: ICalendarEvent | null =
    event ??
    queryClient.getQueryData<ICalendarEvent>(['CALENDAR_EVENTS', eventId]) ??
    null;

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
      Toast.show({
        type: 'success',
        text1: t('calendar.success.deleteTitle') || 'Deleted',
        text2: t('calendar.success.deleteMessage') || 'Event removed from your schedule',
      });
      onClose();
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: t('calendar.error.deleteTitle') || 'Error',
        text2: t('calendar.error.deleteMessage') || 'Failed to delete event',
      });
    },
  });

  const handleDelete = () => {
    if (!resolvedEvent) return;
    Alert.alert(
      t('calendar.confirmDeleteTitle') || 'Delete Event',
      t('calendar.confirmDeleteMessage') ||
        `Are you sure you want to delete "${resolvedEvent.title}"?`,
      [
        { text: t('calendar.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('calendar.delete') || 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(resolvedEvent.id),
        },
      ]
    );
  };

  const handleEdit = () => {
    if (resolvedEvent) {
      onClose(); // Close view modal FIRST to prevent double-modal stack
      // Small delay so modal animates out before the form modal opens
      setTimeout(() => onEdit(resolvedEvent), 180);
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

  const typeColor = resolvedEvent ? (eventTypeColors[resolvedEvent.type] ?? themeColors.primary) : themeColors.primary;

  const styles = createStyles(isDark, themeColors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* ─── Loading ─── */}
          {isLoading && !resolvedEvent && (
            <LoadingSpinner message={t('calendar.loading') || 'Loading event details…'} />
          )}

          {/* ─── Error ─── */}
          {error && !resolvedEvent && (
            <View style={styles.centeredState}>
              <Text style={styles.errorText}>
                {t('calendar.error.loadMessage') || 'Failed to load event details'}
              </Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => refetch()}>
                <RefreshCw size={14} color="#fff" />
                <Text style={styles.retryText}>{t('calendar.retry') || 'Retry'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Content ─── */}
          {resolvedEvent && (
            <>
              {/* Handle */}
              <View style={styles.modalHandle} />

              {/* Close button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>

              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} scrollEnabled={false} nestedScrollEnabled={true}>

                {/* ─── HERO SECTION ─── */}
                <View style={styles.heroSection}>
                  <View style={styles.heroTypeRow}>
                    <View style={[styles.heroIconContainer, { backgroundColor: typeColor }]}>
                      <Calendar size={16} color="#ffffff" />
                    </View>
                    <View style={[styles.heroTypeBadge, { backgroundColor: `${typeColor}22` }]}>
                      <Text style={[styles.heroTypeText, { color: typeColor }]}>
                        {getEventTypeLabel(resolvedEvent.type).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.heroTitle}>{resolvedEvent.title}</Text>
                </View>

                {/* ─── PRIMARY INFO CARD (Date & Time) ─── */}
                <View style={[styles.primaryCard, { 
                  backgroundColor: isDark ? '#1e3a8a' : '#eff6ff',
                  borderColor: `${themeColors.primary}40`
                }]}>
                  <View style={styles.primaryRow}>
                    <Calendar size={16} color={themeColors.primary} />
                    <Text style={styles.primaryText}>
                      {formatDate(resolvedEvent.startAt)}
                    </Text>
                  </View>
                  <View style={[styles.primaryDivider, { backgroundColor: isDark ? '#3b82f6' : '#bfdbfe' }]} />
                  <View style={styles.primaryRow}>
                    <Clock size={16} color={themeColors.primary} />
                    <Text style={styles.primaryText}>
                      {resolvedEvent.allDay
                        ? t('calendar.allDay') || 'All day'
                        : resolvedEvent.endAt
                          ? `${formatTime(resolvedEvent.startAt)} → ${formatTime(resolvedEvent.endAt)}`
                          : formatTime(resolvedEvent.startAt)}
                    </Text>
                  </View>
                </View>

                {/* ─── SECONDARY DETAILS (Inline) ─── */}
                <View style={styles.secondarySection}>
                  {/* Frequency */}
                  {resolvedEvent.frequency !== 'NONE' && (
                    <View style={styles.inlineDetail}>
                      <Repeat size={16} color={themeColors.primary} />
                      <Text style={styles.inlineText}>
                        {getFrequencyLabel(resolvedEvent.frequency)}
                        {resolvedEvent.daysOfWeek && resolvedEvent.daysOfWeek.length > 0 && 
                          ` • ${t('calendar.form.daysOfWeek') || 'Custom days'}`}
                      </Text>
                    </View>
                  )}

                  {/* Reminder */}
                  {getReminderLabel(resolvedEvent.reminderMinutesBefore) && (
                    <View style={styles.inlineDetail}>
                      <Bell size={16} color={themeColors.primary} />
                      <Text style={styles.inlineText}>
                        {getReminderLabel(resolvedEvent.reminderMinutesBefore)}
                      </Text>
                    </View>
                  )}

                  {/* Location */}
                  {resolvedEvent.location && (
                    <View style={styles.inlineDetail}>
                      <MapPin size={16} color={themeColors.primary} />
                      <Text style={styles.inlineText} numberOfLines={1}>
                        {resolvedEvent.location}
                      </Text>
                    </View>
                  )}
                </View>

                {/* ─── DESCRIPTION CARD (Enhanced) ─── */}
                {resolvedEvent.description && (
                  <View style={[styles.descriptionCard, {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderLeftWidth: 3,
                    borderLeftColor: typeColor,
                  }]}>
                    <View style={styles.descriptionHeader}>
                      <FileText size={16} color={themeColors.primary} />
                      <Text style={styles.descriptionLabel}>
                        {t('calendar.description') || 'Notes'}
                      </Text>
                    </View>
                    <Text style={styles.descriptionText}>{resolvedEvent.description}</Text>
                  </View>
                )}

                {/* Participants count */}
                {resolvedEvent.participants && resolvedEvent.participants.length > 0 && (
                  <View style={styles.participantsRow}>
                    <View style={styles.participantsDetail}>
                      <Users size={16} color={themeColors.primary} />
                      <Text style={styles.participantsLabel}>
                        {resolvedEvent.participants.length} {t('calendar.participants') || 'participant(s)'}
                      </Text>
                    </View>
                  </View>
                )}

              </ScrollView>

              {/* ─── ACTIONS (Inline buttons) ─── */}
              {user && resolvedEvent?.createdById && user.id === resolvedEvent.createdById && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton, { 
                      borderColor: themeColors.primary,
                      backgroundColor: `${themeColors.primary}12`
                    }]}
                    onPress={handleEdit}
                    disabled={deleteMutation.isPending}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={18} color={themeColors.primary} />
                    <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>
                      {t('calendar.edit') || 'Edit'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={handleDelete}
                    disabled={deleteMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {deleteMutation.isPending ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Trash2 size={18} color="#ef4444" />
                        <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
                          {t('calendar.delete') || 'Delete'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (isDark: boolean, themeColors: any) =>
  StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalCard: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 28,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      minHeight: 420,
      maxHeight: '92%',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    modalHandle: {
      width: 44, height: 4,
      backgroundColor: isDark ? '#6b7280' : '#cbd5e1',
      borderRadius: 2, alignSelf: 'center', marginBottom: 16,
    },
    closeButton: {
      position: 'absolute', top: 20, right: 20, zIndex: 10,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      alignItems: 'center', justifyContent: 'center',
    },
    scrollView: { flexGrow: 1, marginBottom: 20 },

    centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 240, gap: 12 },
    centeredStateText: { fontSize: 15, fontFamily: 'Inter-Regular', color: isDark ? '#d1d5db' : '#374151' },
    errorText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#ef4444', textAlign: 'center' },
    retryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    retryText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#ffffff' },

    // ─── HERO SECTION ───
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
      width: 36,
      height: 36,
      borderRadius: 14,
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
      fontSize: 12,
      fontFamily: 'Inter-Bold',
      letterSpacing: 0.8,
    },
    heroTitle: {
      fontSize: 16,
      fontFamily: 'Inter-Bold',
      color: isDark ? '#f9fafb' : '#111827',
      lineHeight: 20,
    },

    // ─── PRIMARY CARD ───
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
      fontSize: 12,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#f9fafb' : '#111827',
      flex: 1,
      lineHeight: 8,
    },
    primaryDivider: {
      height: 1,
      marginVertical: 14,
      opacity: 0.3,
    },

    // ─── SECONDARY SECTION (Inline details) ───
    secondarySection: {
      gap: 14,
      marginBottom: 24,
    },
    inlineDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inlineText: {
      fontSize: 12,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#d1d5db' : '#374151',
      flex: 1,
      lineHeight: 10,
    },

    // ─── DESCRIPTION CARD ───
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
      fontSize: 12,
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#9ca3af' : '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    descriptionText: {
      fontSize: 12,
      fontFamily: 'Inter-Regular',
      color: isDark ? '#cbd5e1' : '#475569',
      lineHeight: 16,
    },

    // ─── PARTICIPANTS ───
    participantsRow: {
      marginBottom: 16,
    },
    participantsDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    participantsLabel: {
      fontSize: 14,
      fontFamily: 'Inter-Medium',
      color: isDark ? '#9ca3af' : '#6b7280',
    },

    // ─── ACTION BUTTONS (Inline) ───
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
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
    editButton: {
      // Colors applied inline
    },
    deleteButton: {
      borderColor: '#ef4444',
      backgroundColor: '#ef444412',
    },
    actionButtonText: {
      fontSize: 15,
      fontFamily: 'Inter-SemiBold',
    },
  });

export default EventViewModal;