/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  PlayCircle,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import Toast from 'react-native-toast-message';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  EventFrequency,
  EventType,
  ICalendarEvent,
  ICreateCalendarEventRequest,
} from '@/types';
import {
  createCalendarEvent,
  ExternalNotificationService,
  getCalendarEvents,
  GlobalReminderService,
  updateCalendarEvent,
  deleteCalendarEvent,
  scheduleEventAlarm,
  cancelEventAlarm,
} from '@/services/calender';
import EventFormModal, { EventFormData } from './EventFormModal';
import EventViewModal from './EventViewModal';
import { usePersistentCountdown } from './PersistentCountdown';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import { SocketService } from '@/services/socket.service';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

type CalendarEvent = ICalendarEvent;

// Month and weekday names are resolved via t() at render time.
// These constants serve as fallback keys only.
const KINYARWANDA_MONTHS_KEYS = [
  'calendar.month.jan', 'calendar.month.feb', 'calendar.month.mar',
  'calendar.month.apr', 'calendar.month.may', 'calendar.month.jun',
  'calendar.month.jul', 'calendar.month.aug', 'calendar.month.sep',
  'calendar.month.oct', 'calendar.month.nov', 'calendar.month.dec',
];
const KINYARWANDA_MONTHS_FALLBACK = [
  'Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena',
  'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza',
];

const KINYARWANDA_WEEKDAY_KEYS = [
  'calendar.weekdays.sun', 'calendar.weekdays.mon', 'calendar.weekdays.tue',
  'calendar.weekdays.wed', 'calendar.weekdays.thu', 'calendar.weekdays.fri',
  'calendar.weekdays.sat',
];
const KINYARWANDA_WEEKDAY_FALLBACK = [
  'Ku cyumweru', 'Kuwa mbere', 'Kuwa kabiri', 'Kuwa gatatu',
  'Kuwa kane', 'Kuwa gatanu', 'Kuwa gatandatu',
];

// Monday-first weekday keys for rendering
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const EVENT_TYPE_COLORS: Record<string, string> = {
  TRAINING: '#22c55e',
  REMINDER: '#f97316',
  DEADLINE: '#ef4444',
};

const combineDateAndTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(v => parseInt(v, 10));
  const combined = new Date(date.getTime());
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getEventTypeLabel(type: EventType, t: (k: string) => string): string {
  switch (type) {
    case 'TRAINING':  return t('calendar.types.training') || 'Training';
    case 'REMINDER':  return t('calendar.types.reminder') || 'Reminder';
    case 'DEADLINE':  return t('calendar.types.deadline') || 'Deadline';
    default:          return t('calendar.types.training') || 'Training';
  }
}

/** Split Kinyarwanda weekday names into two parts for better display */
function splitWeekdayName(fullName: string): { first: string; second: string } {
  const parts = fullName.split(' ');
  if (parts.length === 1) {
    // If single word, split in middle
    const mid = Math.ceil(fullName.length / 2);
    return {
      first: fullName.substring(0, mid),
      second: fullName.substring(mid),
    };
  }
  // If multiple words, split by space
  return {
    first: parts[0],
    second: parts.slice(1).join(' '),
  };
}



function buildCalendarMatrix(reference: Date) {
  const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const endOfMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay();
  const adjustedStartDay = (startDay + 6) % 7; // Monday=0

  const matrix: { date: Date; inCurrentMonth: boolean }[] = [];

  for (let i = adjustedStartDay - 1; i >= 0; i -= 1) {
    matrix.push({
      date: new Date(reference.getFullYear(), reference.getMonth(), 1 - adjustedStartDay + i),
      inCurrentMonth: false,
    });
  }
  for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
    matrix.push({
      date: new Date(reference.getFullYear(), reference.getMonth(), day),
      inCurrentMonth: true,
    });
  }
  const remaining = 42 - matrix.length;
  for (let i = 1; i <= remaining; i += 1) {
    matrix.push({
      date: new Date(reference.getFullYear(), reference.getMonth() + 1, i),
      inCurrentMonth: false,
    });
  }
  return matrix;
}

// ─── Skeleton loader for a single day cell ───────────────────────────────────
const DaySkeleton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={{
        flex: 1, aspectRatio: 1, margin: 2, borderRadius: 16,
        backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
        opacity: anim,
      }}
    />
  );
};

// ─── Swipeable event card ─────────────────────────────────────────────────────
interface EventCardProps {
  event: CalendarEvent;
  isDark: boolean;
  themeColors: any;
  onPress: () => void;
  onDelete: () => void;
  isUpcoming?: boolean;
  countdown?: { days: number; hours: number; minutes: number; seconds: number } | null;
}

const EventCard: React.FC<EventCardProps> = ({ event, isDark, themeColors, onPress, onDelete, isUpcoming, countdown }) => {
  const { t } = useLanguage();
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? themeColors.primary;

  const renderRightAction = () => (
    <TouchableOpacity
      onPress={onDelete}
      style={{
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 16,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter-SemiBold', marginTop: 4 }}>{t('calendar.delete') || 'Delete'}</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable renderRightActions={renderRightAction} overshootRight={false} friction={2}>
      <TouchableOpacity
        style={[styles.eventCard, isDark && styles.eventCardDark]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {/* Left accent bar */}
        <View style={[styles.eventAccentBar, { backgroundColor: typeColor }]} />

        <View style={styles.eventCardBody}>
          {/* Type + time row */}
          <View style={styles.eventTypeTimeRow}>
            <View style={[styles.typePill, { backgroundColor: `${typeColor}20` }]}>
              <Text style={[styles.typePillText, { color: typeColor }]}>
                {getEventTypeLabel(event.type, t)}
              </Text>
            </View>
            <Text style={[styles.eventTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {event.allDay ? 'All day' : formatTime(event.startAt)}
              {!event.allDay && event.endAt ? ` – ${formatTime(event.endAt)}` : ''}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.eventTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>
            {event.title}
          </Text>

          {/* Countdown (upcoming event only) */}
          {isUpcoming && countdown && (
            <View style={styles.countdownRow}>
              {[
                { value: countdown.days,    label: 'd' },
                { value: countdown.hours,   label: 'h' },
                { value: countdown.minutes, label: 'm' },
                { value: countdown.seconds, label: 's' },
              ].map(({ value, label }, i, arr) => (
                <React.Fragment key={label}>
                  <View style={styles.countdownUnit}>
                    <Text style={[styles.countdownValue, { color: isDark ? '#00d4ff' : '#007aff' }]}>
                      {String(value).padStart(2, '0')}
                    </Text>
                    <Text style={[styles.countdownLabel, { color: isDark ? '#888' : '#999' }]}>{label}</Text>
                  </View>
                  {i < arr.length - 1 && (
                    <Text style={[styles.countdownColon, { color: isDark ? '#555' : '#bbb' }]}>:</Text>
                  )}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

// ─── Main CalendarScreen ───────────────────────────────────────────────────────
const CalendarScreenContent = () => {
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r: string) => r === 'ADMIN') ?? false;
  const { notifications } = useNotificationsContext();
  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
  const advanceRecordings = useTourStepAdvance('calendar-recordings');
  const advanceGrid = useTourStepAdvance('calendar-grid');
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

  // Refresh when a participant notification arrives (other users' changes)
  useEffect(() => {
    const latest = notifications[0];
    if (latest && (latest as any).entityType === 'calendar_event' && !latest.isRead) {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
    }
  }, [notifications, queryClient]);

  // Refresh when the current user's own event changes (creator is excluded from participant notifications)
  useEffect(() => {
    const socket = SocketService.getInstance();
    if (!socket) return;

    const handleCalendarChange = () => {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
    };

    socket.on('calendar_data_changed', handleCalendarChange);
    return () => {
      socket.off('calendar_data_changed', handleCalendarChange);
    };
  }, [queryClient]);

  // ─── State ───────────────────────────────────────────────────────────────────
  const router = useRouter();

  const [today, setToday] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isFormVisible, setFormVisible] = useState(false);
  const [isViewModalVisible, setViewModalVisible] = useState(false);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'update'>('create');
  const [formEventId, setFormEventId] = useState<string | undefined>(undefined);
  const [formInitialData, setFormInitialData] = useState<Partial<EventFormData>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);

  const MAX_DATE_MS = 8640000000000000;
  const countdownTarget = upcomingEvent ? new Date(upcomingEvent.startAt).getTime() : MAX_DATE_MS;
  const countdown = usePersistentCountdown({
    targetTimestamp: countdownTarget,
    storageKey: upcomingEvent ? `alarm_target_${upcomingEvent.id}` : 'alarm_target_none',
  });

  // Refresh "today" every midnight
  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const t = setTimeout(() => {
      setToday(new Date());
    }, msUntilMidnight);
    return () => clearTimeout(t);
  }, [today]);

  // ─── Data fetching ────────────────────────────────────────────────────────────
  const { data: events = [], isLoading, error, refetch, isRefetching } = useQuery<ICalendarEvent[], Error>({
    queryKey: ['CALENDAR_EVENTS'],
    queryFn: getCalendarEvents,
  });

  const lastScheduledAlarmEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      GlobalReminderService.updateEvents(events);
      ExternalNotificationService.rescheduleAllReminders(events);

      // Pick the event whose SOONEST upcoming ring (startAt − offset, across all
      // of its selected reminder offsets) is nearest to now — not the event
      // whose startAt is nearest, since a later-starting event can have an
      // earlier-firing reminder. Only that one event's alarms are kept
      // natively scheduled at a time.
      const now = Date.now();
      let nearestAlarmEvent: ICalendarEvent | null = null;
      let nearestFireAt = Infinity;

      events.forEach(e => {
        if (!e.id || String(e.id).startsWith('optimistic-')) return;
        const startMs = new Date(e.startAt).getTime();
        const offsets = Array.isArray(e.reminderMinutesBefore) ? e.reminderMinutesBefore : [];
        offsets.forEach(minutes => {
          if (!minutes || minutes <= 0) return;
          const fireAt = startMs - minutes * 60000;
          if (fireAt > now && fireAt < nearestFireAt) {
            nearestFireAt = fireAt;
            nearestAlarmEvent = e;
          }
        });
      });

      // Fall back to soonest-starting future event purely for the countdown
      // display when no event has a future reminder offset to ring.
      const futureEvents = events.filter(e => new Date(e.startAt) > new Date(now));
      const soonestStarting = futureEvents.length > 0
        ? futureEvents.reduce((prev, current) =>
            new Date(prev.startAt) < new Date(current.startAt) ? prev : current
          )
        : null;

      setUpcomingEvent(nearestAlarmEvent ?? soonestStarting);

      if (nearestAlarmEvent) {
        const nearestId = (nearestAlarmEvent as ICalendarEvent).id;
        if (lastScheduledAlarmEventIdRef.current && lastScheduledAlarmEventIdRef.current !== nearestId) {
          cancelEventAlarm(lastScheduledAlarmEventIdRef.current).catch(() => {});
        }
        scheduleEventAlarm(nearestAlarmEvent).catch(err =>
          console.warn('[CalendarScreen] Failed to schedule native alarm:', err));
        lastScheduledAlarmEventIdRef.current = nearestId;
      } else if (lastScheduledAlarmEventIdRef.current) {
        cancelEventAlarm(lastScheduledAlarmEventIdRef.current).catch(() => {});
        lastScheduledAlarmEventIdRef.current = null;
      }
    }
  }, [events]);

  useEffect(() => {
    if (error) {
      Toast.show({
        type: 'error',
        text1: t('calendar.error.fetchTitle') || 'Connection Error',
        text2: t('calendar.error.fetchMessage') || 'Using offline data. Please check your connection.',
      });
    }
  }, [error, t]);

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createEventMutation = useMutation({
    mutationFn: createCalendarEvent,
    // Optimistic update
    onMutate: async (newEventData) => {
      await queryClient.cancelQueries({ queryKey: ['CALENDAR_EVENTS'] });
      const previous = queryClient.getQueryData<ICalendarEvent[]>(['CALENDAR_EVENTS']);
      const optimistic: ICalendarEvent = {
        id: `optimistic-${Date.now()}`,
        title: newEventData.title,
        description: newEventData.description,
        type: newEventData.type,
        startAt: newEventData.startAt,
        endAt: newEventData.endAt,
        allDay: newEventData.allDay,
        frequency: newEventData.frequency,
        daysOfWeek: newEventData.daysOfWeek,
        reminderMinutesBefore: newEventData.reminderMinutesBefore,
        meetingType: 'OTHER',
        participants: [],
      };
      queryClient.setQueryData<ICalendarEvent[]>(['CALENDAR_EVENTS'], old => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['CALENDAR_EVENTS'], ctx.previous);
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
      GlobalReminderService.updateEvents([...events, newEvent]);
      const reminderMinutes = Array.isArray(newEvent.reminderMinutesBefore)
        ? newEvent.reminderMinutesBefore[0]
        : newEvent.reminderMinutesBefore;
      if (reminderMinutes && reminderMinutes > 0) {
        ExternalNotificationService.scheduleEventReminder(newEvent);
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ICreateCalendarEventRequest> }) =>
      updateCalendarEvent(id, data),
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
      const updatedList = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
      GlobalReminderService.updateEvents(updatedList);
      ExternalNotificationService.cancelEventReminder(updatedEvent.id);
      // Clear any stale native alarm(s) — the events-effect above will
      // reschedule fresh ones if this event is (still) the nearest.
      cancelEventAlarm(updatedEvent.id).catch(() => {});
      const reminderMinutes = Array.isArray(updatedEvent.reminderMinutesBefore)
        ? updatedEvent.reminderMinutesBefore[0]
        : updatedEvent.reminderMinutesBefore;
      if (reminderMinutes && reminderMinutes > 0) {
        ExternalNotificationService.scheduleEventReminder(updatedEvent);
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['CALENDAR_EVENTS'] });
      const previous = queryClient.getQueryData<ICalendarEvent[]>(['CALENDAR_EVENTS']);
      queryClient.setQueryData<ICalendarEvent[]>(['CALENDAR_EVENTS'], old => (old ?? []).filter(e => e.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['CALENDAR_EVENTS'], ctx.previous);
      Toast.show({ type: 'error', text1: t('calendar.error.deleteTitle') || 'Error', text2: 'Failed to delete event' });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });
      cancelEventAlarm(id).catch(() => {});
      Toast.show({ type: 'success', text1: t('calendar.success.deleteTitle') || 'Deleted', text2: 'Event removed from schedule' });
    },
  });

  // ─── Derived state ────────────────────────────────────────────────────────────
  const todaysKey = getDateKey(today);
  const selectedDateKey = selectedDate ? getDateKey(selectedDate) : null;
  const calendarMatrix = useMemo(() => buildCalendarMatrix(currentMonth), [currentMonth]);



  // eventsByDate: backend already handles recurring event expansion, just map by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
      const eventDateKey = getDateKey(new Date(event.startAt));
      if (!map[eventDateKey]) map[eventDateKey] = [];
      map[eventDateKey].push(event);
    });
    return map;
  }, [events]);

  const selectedDayEvents: CalendarEvent[] = selectedDateKey ? (eventsByDate[selectedDateKey] ?? []) : [];

  // ─── Labels ───────────────────────────────────────────────────────────────────
  const monthLabel = useMemo(() => {
    const mo = t(KINYARWANDA_MONTHS_KEYS[currentMonth.getMonth()]) || KINYARWANDA_MONTHS_FALLBACK[currentMonth.getMonth()];
    return `${mo} ${currentMonth.getFullYear()}`;
  }, [currentMonth, t]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const wd = t(KINYARWANDA_WEEKDAY_KEYS[selectedDate.getDay()]) || KINYARWANDA_WEEKDAY_FALLBACK[selectedDate.getDay()];
    const mo = t(KINYARWANDA_MONTHS_KEYS[selectedDate.getMonth()]) || KINYARWANDA_MONTHS_FALLBACK[selectedDate.getMonth()];
    return `${wd}, ${mo} ${selectedDate.getDate()}`;
  }, [selectedDate, t]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    const updated = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + offset,
      1
    );
    setCurrentMonth(updated);
    if (selectedDate && selectedDate.getMonth() !== updated.getMonth()) {
      setSelectedDate(new Date(updated.getFullYear(), updated.getMonth(), 1));
    }
  }, [currentMonth, selectedDate]);

  const jumpToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }, []);

  const openCreateEvent = useCallback(() => {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const rounded = Math.ceil(totalMinutes / 5) * 5;
    const hours = `${Math.floor(rounded / 60) % 24}`.padStart(2, '0');
    const minutes = `${rounded % 60}`.padStart(2, '0');
    setFormMode('create');
    setFormEventId(undefined);
    setFormInitialData({ date: selectedDate ?? new Date(), startTime: `${hours}:${minutes}` });
    setFormError(null);
    setFormVisible(true);
  }, [selectedDate]);

  const openUpdateEvent = useCallback((event: ICalendarEvent) => {
    setFormMode('update');
    setFormEventId(event.id);
    setFormInitialData({
      title: event.title,
      description: event.description || '',
      date: new Date(event.startAt),
      startTime: new Date(event.startAt).toTimeString().slice(0, 5),
      endTime: event.endAt
        ? new Date(event.endAt).toTimeString().slice(0, 5)
        : new Date(new Date(event.startAt).getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5),
      type: event.type.toLowerCase() as 'training' | 'reminder' | 'deadline',
      location: event.location || '',
      frequency: event.frequency as EventFrequency,
      reminderMinutesBefore: Array.isArray(event.reminderMinutesBefore)
        ? event.reminderMinutesBefore
        : event.reminderMinutesBefore ? [event.reminderMinutesBefore] : [],
      allDay: event.allDay,
      daysOfWeek: event.daysOfWeek || [],
      recurrenceEndsAt: event.recurrenceEndsAt ? new Date(event.recurrenceEndsAt) : null,
    });
    setFormError(null);
    setFormVisible(true);
  }, []);

  const openViewEvent = useCallback((eventId: string) => {
    setViewEventId(eventId);
    setViewModalVisible(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    setFormError(null);
  }, []);

  const closeViewModal = useCallback(() => {
    setViewModalVisible(false);
    setViewEventId(null);
  }, []);

  const handleSubmitEvent = useCallback((formData: EventFormData, mode: 'create' | 'update', eventId?: string) => {
    const startAt = combineDateAndTime(formData.date, formData.startTime);
    let endAt = formData.allDay
      ? addMinutes(startAt, 60)
      : combineDateAndTime(formData.date, formData.endTime);

    // Ensure endAt is strictly after startAt
    if (endAt <= startAt) {
      endAt = addMinutes(startAt, 30);
    }

    const eventData: ICreateCalendarEventRequest = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      type: formData.type.toUpperCase() as EventType,
      startAt,
      endAt,
      allDay: formData.allDay,
      reminderMinutesBefore: Array.isArray(formData.reminderMinutesBefore) 
        ? formData.reminderMinutesBefore 
        : [formData.reminderMinutesBefore],
      frequency: formData.frequency as EventFrequency,
      daysOfWeek: formData.frequency === 'WEEKLY'
        ? [...formData.daysOfWeek].sort((a, b) => a - b)
        : [],
      recurrenceEndsAt: formData.recurrenceEndsAt ?? undefined,
    };

    if (mode === 'update' && eventId) {
      updateEventMutation.mutate({ id: eventId, data: eventData }, {
        onSuccess: () => {
          setSelectedDate(formData.date);
          setFormVisible(false);
          setFormError(null);
          Toast.show({ type: 'success', text1: t('calendar.success.updateTitle') || 'Updated', text2: 'Event updated successfully!' });
        },
        onError: () => {
          setFormError(t('calendar.error.updateMessage') || 'Failed to update event. Please try again.');
        },
      });
    } else {
      createEventMutation.mutate(eventData, {
        onSuccess: () => {
          setSelectedDate(formData.date);
          setFormVisible(false);
          setFormError(null);
          Toast.show({ type: 'success', text1: t('calendar.success.createTitle') || 'Added', text2: 'Event added to your schedule!' });
        },
        onError: () => {
          setFormError(t('calendar.error.createMessage') || 'Failed to add event. Please try again.');
        },
      });
    }
  }, [createEventMutation, updateEventMutation, events, t]);

  const handleQuickDelete = useCallback((eventId: string) => {
    deleteEventMutation.mutate(eventId);
  }, [deleteEventMutation]);

  const isSubmitting = createEventMutation.isPending || updateEventMutation.isPending;

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.CALENDAR);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.CALENDAR).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
          />
        }
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
              <ChevronLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.headerTitle}>{t('calendar.title') || 'My Schedule'}</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {t('calendar.subtitle') || 'Trainings, reminders & deadlines'}
              </Text>
            </View>
          </View>

          {/* Month switcher */}
          <View style={styles.monthSwitcher}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('calendar.month.previous') || 'Previous month'}
              onPress={() => handleMonthChange('prev')}
              style={styles.switcherButton}
            >
              <ChevronLeft size={18} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={jumpToToday} style={styles.monthLabelBtn} activeOpacity={0.7}>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('calendar.month.next') || 'Next month'}
              onPress={() => handleMonthChange('next')}
              style={styles.switcherButton}
            >
              <ChevronRight size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ─── Calendar grid ───────────────────────────────────────────────────── */}
        <CopilotStep
          text="Reba hano gahunda y'ibikorwa byawe. Kanda ku itariki kugira ngo urebe ibikorwa byayo. Ibikorwa bimwe na bimwe bigufasha kwibutswa (reminders) mbere y'igihe."
          order={1}
          name="calendar-grid"
        >
        <WalkthroughableView style={[styles.calendarContainer, isDark && styles.calendarContainerDark]}>
          {/* Weekday headers (Monday-first) */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_KEYS.map(key => {
              const fullName = t(`calendar.weekdays.${key}`) || key;
              const { first, second } = splitWeekdayName(fullName);
              return (
                <View key={key} style={styles.weekdayCell}>
                  <Text
                    style={[styles.weekdayLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}
                    numberOfLines={1}
                  >
                    {first}
                  </Text>
                  <Text
                    style={[styles.weekdayLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}
                    numberOfLines={1}
                  >
                    {second}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Day cells */}
          <View style={styles.daysGrid}>
            {isLoading
              ? Array.from({ length: 35 }).map((_, i) => <DaySkeleton key={i} isDark={isDark} />)
              : calendarMatrix.map(({ date, inCurrentMonth }) => {
                  const key = getDateKey(date);
                  const isSelected = key === selectedDateKey;
                  const isToday = key === todaysKey;
                  const dayEvents = eventsByDate[key] ?? [];
                  const hasEvents = dayEvents.length > 0;

                  // Up to 3 distinct type colors for dots
                  const dotColors = [...new Set(dayEvents.map(e => EVENT_TYPE_COLORS[e.type] ?? themeColors.primary))].slice(0, 3);

                  return (
                    <TouchableOpacity
                      key={`${key}-${inCurrentMonth ? 'c' : 'o'}`}
                      style={[
                        styles.dayCell,
                        isSelected && {
                          backgroundColor: isDark ? '#312e81' : '#e0e7ff',
                          borderWidth: 2,
                          borderColor: themeColors.primary,
                          transform: [{ scale: 1.05 }],
                          ...(Platform.OS === 'ios'
                            ? { shadowColor: themeColors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
                            : { elevation: 6 }),
                        },
                        isToday && !isSelected && {
                          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)',
                          borderWidth: 2,
                          borderColor: themeColors.primary,
                          ...(Platform.OS === 'ios'
                            ? { shadowColor: themeColors.primary, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
                            : { elevation: 3 }),
                        },
                      ]}
                      onPress={advanceGrid(() => {
                        if (isSelected) {
                          setSelectedDate(null);
                        } else {
                          setSelectedDate(date);
                        }
                      })}
                      accessibilityRole="button"
                      accessibilityLabel={date.toDateString()}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          {
                            color: !inCurrentMonth
                              ? isDark ? '#1e293b' : '#cbd5e1'
                              : isSelected
                              ? themeColors.primary
                              : isToday
                              ? themeColors.primary
                              : isDark ? '#e2e8f0' : '#0f172a',
                            fontFamily: isSelected || isToday ? 'Inter-Bold' : 'Inter-Regular',
                            fontSize: isToday ? 17 : 15,
                          },
                        ]}
                      >
                        {date.getDate()}
                      </Text>

                      {/* Multi-color event dots */}
                      {hasEvents && inCurrentMonth && (
                        <View style={styles.dotsRow}>
                          {dotColors.map((color, i) => (
                            <View
                              key={i}
                              style={[
                                styles.eventDot,
                                { backgroundColor: color },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
          </View>
        </WalkthroughableView>
        </CopilotStep>

        {/* ─── Selected day events ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          {selectedDate === null ? (
            <View style={[styles.emptyState, { borderColor: isDark ? '#1e3a8a' : '#e2e8f0' }]}>
              <CalendarDays size={32} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={[styles.emptyStateTitle, { color: isDark ? '#cbd5f5' : '#1e293b' }]}>
                {t('calendar.selectDateTitle') || 'Select a date'}
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                {t('calendar.selectDateSubtitle') || 'Tap any date to see its events'}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
                  {selectedDateLabel}
                </Text>
                <View style={[styles.eventCountBadge, { backgroundColor: isDark ? '#1e293b' : '#e0e7ff' }]}>
                  <Text style={[styles.eventCountText, { color: themeColors.primary }]}>
                    {selectedDayEvents.length}
                  </Text>
                </View>
              </View>

              {selectedDayEvents.length === 0 ? (
                <View style={[styles.emptyState, { borderColor: isDark ? '#1e3a8a' : '#e2e8f0' }]}>
                  <CalendarDays size={28} color={isDark ? '#334155' : '#cbd5e1'} />
                  <Text style={[styles.emptyStateTitle, { color: isDark ? '#cbd5f5' : '#1e293b' }]}>
                    {t('calendar.emptyStateTitle') || 'No events scheduled'}
                  </Text>
                  <Text style={[styles.emptyStateSubtitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                    {t('calendar.emptyStateSubtitle') || 'Tap + to add an event for this day'}
                  </Text>
                </View>
              ) : (
                selectedDayEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isDark={isDark}
                    themeColors={themeColors}
                    onPress={() => openViewEvent(event.id)}
                    onDelete={() => handleQuickDelete(event.id)}
                    isUpcoming={upcomingEvent?.id === event.id}
                    countdown={
                      upcomingEvent?.id === event.id && !countdown.expired
                        ? { days: countdown.days, hours: countdown.hours, minutes: countdown.minutes, seconds: countdown.seconds }
                        : null
                    }
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ─── FAB row ─────────────────────────────────────────────────────────── */}
      <View style={[styles.fabRow, { bottom: insets.bottom + 24 }]}>
        <CopilotStep
          text="Kanda hano kureba amasomo cyangwa inama zafashwe mbere."
          order={2}
          name="calendar-recordings"
        >
          <WalkthroughableTouchable
            style={[styles.fabSecondary, { backgroundColor: themeColors.primary, shadowColor: themeColors.primary }]}
            activeOpacity={0.85}
            onPress={advanceRecordings(() => router.push(isAdmin ? '/recordings' : '/recordings/watch'))}
          >
            <PlayCircle size={18} color="#ffffff" />
            <Text style={styles.fabLabel}>Ibyafashwe mu Nama</Text>
          </WalkthroughableTouchable>
        </CopilotStep>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: themeColors.primary, shadowColor: themeColors.primary }]}
          activeOpacity={0.85}
          onPress={openCreateEvent}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          testID="add-event-fab"
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.fabLabel}>{t('calendar.addEvent') || 'Igikorwa gishya'}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      <EventFormModal
        visible={isFormVisible}
        onClose={closeForm}
        onSubmit={handleSubmitEvent}
        initialData={formInitialData}
        error={formError}
        mode={formMode}
        eventId={formEventId}
        isSubmitting={isSubmitting}
      />

      <EventViewModal
        visible={isViewModalVisible}
        onClose={closeViewModal}
        eventId={viewEventId}
        onEdit={openUpdateEvent}
      />
    </View>
  );
};

const CalendarScreen = () => (
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
    <CalendarScreenContent />
  </CopilotProvider>
);

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerContent: { flex: 1, alignItems: 'flex-start' },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginTop: 2,
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  switcherButton: { padding: 8, borderRadius: 10 },
  monthLabelBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  monthLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
    textTransform: 'capitalize',
  },

  calendarContainer: {
    marginTop: 12,
    marginHorizontal: 10,
    borderRadius: 20,
    paddingTop: 10,
    paddingBottom: 8,
    height: 300,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  calendarContainerDark: {
    backgroundColor: '#111827',
    shadowOpacity: 0,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  weekdayLabel: {
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 2,
  },
  dayLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
    justifyContent: 'center',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-Bold', flex: 1 },
  eventCountBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  eventCountText: { fontSize: 12, fontFamily: 'Inter-Bold' },

  emptyState: {
    borderWidth: 1, borderRadius: 18, padding: 28,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 16, fontFamily: 'Inter-SemiBold',
    textAlign: 'center', marginTop: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13, fontFamily: 'Inter-Regular',
    textAlign: 'center', lineHeight: 20,
  },

  // Event card
  eventCard: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
    overflow: 'hidden',
  },
  eventCardDark: {
    backgroundColor: '#1e293b',
    shadowOpacity: 0,
  },
  eventAccentBar: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  eventCardBody: { flex: 1, padding: 14 },
  eventTypeTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  typePillText: { fontSize: 10, fontFamily: 'Inter-SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTime: { fontSize: 10, fontFamily: 'Inter-Regular' },
  eventTitle: { fontSize: 12, fontFamily: 'Inter-SemiBold', marginBottom: 8, lineHeight: 22 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  metaChipText: { fontSize: 11, fontFamily: 'Inter-Medium' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  locationText: { fontSize: 12, fontFamily: 'Inter-Regular', flex: 1 },
  eventDescription: { fontSize: 13, fontFamily: 'Inter-Regular', lineHeight: 18, marginTop: 2 },

  fabRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 1000,
  },
  fab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.28,
    shadowRadius: 18,
    elevation: Platform.OS === 'android' ? 14 : 8,
  },
  fabSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.2,
    shadowRadius: 14,
    elevation: Platform.OS === 'android' ? 10 : 6,
    opacity: 0.9,
  },
  fabLabel: { color: '#ffffff', fontSize: 13, fontFamily: 'Inter-SemiBold' },

  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  countdownUnit: { alignItems: 'center', minWidth: 24 },
  countdownValue: { fontSize: 11, fontFamily: 'Inter-Bold', letterSpacing: 0.3 },
  countdownLabel: { fontSize: 8, fontFamily: 'Inter-Regular', marginTop: 1 },
  countdownColon: { fontSize: 11, fontFamily: 'Inter-Bold', marginBottom: 6 },

  // Legacy countdown styles (kept for reference)
  iosCountdownTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  iosTimerUnit: {
    alignItems: 'center',
  },
  iosTimerValue: {
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  iosTimerLabel: {
    fontFamily: 'Inter-Regular',
    marginTop: 1,
    letterSpacing: 0.1,
  },
  iosTimerSeparator: {
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTimerColon: {
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
});

export default CalendarScreen;