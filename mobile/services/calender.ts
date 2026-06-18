import { ICalendarEvent, ICreateCalendarEventRequest } from '@/types';
import httpClient from './httpClient';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NativeAlarmScheduler } from './NativeAlarmScheduler';

export const getCalendarEvents = async (): Promise<ICalendarEvent[]> => {
  const response = await httpClient.get('/calendar/events');
  const data = (response as any).data;

  let events = [];
  if (Array.isArray(data)) {
    events = data;
  } else if (data && Array.isArray(data.data)) {
    events = data.data;
  } else if (data && typeof data === 'object') {
    events = [data];
  }

  return events.map((event: any) => ({
    ...event,
    startAt: new Date(event.startAt),
    endAt: event.endAt ? new Date(event.endAt) : null,
    participants: event.participants || [],
  }));
};

// Global reminder service that works app-wide (IN-APP notifications only)
// For EXTERNAL notifications (when app is closed), see ExternalNotificationService below
export class GlobalReminderService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static shownReminders = new Set<string>();
  private static shownAlarms = new Set<string>();
  private static alarmCallback: ((event: ICalendarEvent) => void) | null = null;
  // Exact-time timeouts (one per future event) — fire at the millisecond the event starts
  private static exactAlarmTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private static events: ICalendarEvent[] = [];
  private static language: string = 'en';
  private static locale: string = 'en-US';

  static initialize(language: string, locale: string) {
    this.language = language;
    this.locale = locale;
  }

  static updateEvents(events: ICalendarEvent[]) {
    this.events = events;
    this.scheduleExactAlarms(events);
  }

  private static scheduleExactAlarms(events: ICalendarEvent[]) {
    // Clear previous exact timeouts
    this.exactAlarmTimeouts.forEach(t => clearTimeout(t));
    this.exactAlarmTimeouts.clear();

    const now = Date.now();
    const MAX_WINDOW = 24 * 60 * 60 * 1000; // only schedule within next 24 h

    events.forEach(event => {
      // Skip events without a real server-assigned id (optimistic placeholders, etc.)
      if (!event.id || String(event.id).startsWith('optimistic-')) return;

      const startMs = new Date(event.startAt).getTime();
      const delay = startMs - now;
      // NaN (Invalid Date) or out-of-range — skip
      if (!Number.isFinite(delay) || delay <= 0 || delay > MAX_WINDOW) return;

      const t = setTimeout(() => {
        const alarmId = `alarm-${event.id}`;
        if (!this.shownAlarms.has(alarmId) && this.alarmCallback) {
          this.shownAlarms.add(alarmId);
          this.alarmCallback(event);
        }
      }, delay);

      this.exactAlarmTimeouts.set(event.id, t);
    });
  }

  static setAlarmCallback(cb: ((event: ICalendarEvent) => void) | null) {
    this.alarmCallback = cb;
  }

  static getEventById(id: string): ICalendarEvent | undefined {
    return this.events.find(e => e.id === id);
  }

  static unmarkAlarm(alarmId: string) {
    this.shownAlarms.delete(alarmId);
  }

  static updateLanguage(language: string, locale: string) {
    this.language = language;
    this.locale = locale;
  }

  static startReminderChecking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check every 30 seconds for upcoming reminders
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, 30000);
  }

  static stopReminderChecking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.exactAlarmTimeouts.forEach(t => clearTimeout(t));
    this.exactAlarmTimeouts.clear();
  }

  private static checkReminders() {
    const now = new Date();

    this.events.forEach(event => {
      // ── Reminder check (X minutes before event) ──────────────────────────
      const reminderMinutes = Array.isArray(event.reminderMinutesBefore)
        ? event.reminderMinutesBefore[0]
        : event.reminderMinutesBefore;

      if (reminderMinutes && reminderMinutes > 0) {
        const reminderTime = new Date(event.startAt.getTime() - (reminderMinutes * 60 * 1000));
        const reminderId = `reminder-${event.id}`;
        const isReminderTime = now >= reminderTime && now <= new Date(reminderTime.getTime() + 30_000);
        const isFutureEvent = event.startAt > now;
        const notShownYet = !this.shownReminders.has(reminderId);

        if (isReminderTime && isFutureEvent && notShownYet) {
          this.showReminder(event, reminderId);
        }
      }

      // ── Alarm check (event start time reached) ───────────────────────────
      const alarmId = `alarm-${event.id}`;
      const isStartTime =
        now >= event.startAt &&
        now <= new Date(event.startAt.getTime() + 30_000);

      if (isStartTime && !this.shownAlarms.has(alarmId) && this.alarmCallback) {
        this.shownAlarms.add(alarmId);
        this.alarmCallback(event);
      }
    });
  }

  private static showReminder(event: ICalendarEvent, reminderId: string) {
    // Toast is now handled by NotificationsContext via socket
    // Just mark as shown to prevent duplicate tracking
    this.shownReminders.add(reminderId);

    if (this.shownReminders.size > 50) {
      const remindersArray = Array.from(this.shownReminders);
      this.shownReminders = new Set(remindersArray.slice(-25));
    }
  }

  static resetShownReminders() {
    this.shownReminders.clear();
    this.shownAlarms.clear();
  }

  static getStatus() {
    return {
      isRunning: this.intervalId !== null,
      eventsCount: this.events.length,
      shownRemindersCount: this.shownReminders.size,
      language: this.language,
      locale: this.locale,
    };
  }
}

// TRUE EXTERNAL NOTIFICATIONS (works when app is closed/backgrounded)
export class ExternalNotificationService {
  static async setup() {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Android notification channels
    if (Platform.OS === 'android') {
      // ── Regular reminder channel (pre-event FCM reminders) ────────────────
      await Notifications.setNotificationChannelAsync('calendar-reminders', {
        name: 'Calendar Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Reminders for calendar events',
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        showBadge: true,
      });

      // ── Alarm channel ─────────────────────────────────────────────────────
      // Delete first so Android picks up the updated sound setting.
      // (Android caches channel config on first creation — delete + recreate
      //  is the only reliable way to change sound after first install.)
      await Notifications.deleteNotificationChannelAsync('event-alarm').catch(() => {});
      await Notifications.setNotificationChannelAsync('event-alarm', {
        name: 'Event Alarms',
        importance: Notifications.AndroidImportance.MAX,
        description: 'Alarm that fires when an event is starting now',
        // 'alarm' maps to the bundled alarm.wav (no extension on Android)
        sound: 'alarm',
        vibrationPattern: [0, 500, 300, 500, 300, 500],
        lightColor: '#3363AD',
        showBadge: true,
        // ALARM audio stream — plays even in Silent / Vibrate mode
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    }

    // ── Alarm action category (dismiss / snooze buttons on foreground banner) ─
    await Notifications.setNotificationCategoryAsync('alarm-actions', [
      {
        identifier: 'dismiss',
        buttonTitle: 'Hagarika',
        options: { isDestructive: false, opensAppToForeground: false },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Rindira 5 min',
        options: { isDestructive: false, opensAppToForeground: false },
      },
    ]);

    // Set up notification handler.
    // NOTE: this handler only applies while the app is in the FOREGROUND.
    // Background / killed-app notifications are always shown by the OS natively.
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data ?? {};
        // Alarm notifications: show the banner even in foreground so the user
        // can see and tap the native "Hagarika" (dismiss) / "Rindira 5 min"
        // (snooze) buttons. Without this, AlarmService keeps running with no
        // visible way to stop it when the app is open.
        if (data?.type === 'alarm') {
          return {
            shouldShowAlert: true,
            shouldPlaySound: false, // AlarmService already plays sound natively
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: false,
          };
        }
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
    return true;
  }

  static async scheduleEventReminder(event: ICalendarEvent): Promise<string | null> {
    // Backend handles push notifications via FCM when app is background/closed
    // Local scheduling is disabled to prevent duplicates
    console.log('[ExternalNotificationService] Skipping local schedule - backend handles FCM push');
    return null;
  }

  /**
   * Triggers an immediate alarm-grade notification when an event starts NOW.
   * Uses the ALARM audio channel on Android (bypasses silent mode) and
   * timeSensitive interruption level on iOS (bypasses most Focus modes).
   */
  static async triggerImmediateAlarm(event: ICalendarEvent): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `\u23F0 ${event.title}`,
          body: event.location
            ? `Gitangiye ubu \u00B7 ${event.location}`
            : 'Igikorwa cyawe gitangiye ubu!',
          sound: Platform.OS === 'android' ? 'alarm' : 'alarm.wav',
          categoryIdentifier: 'alarm-actions',
          data: {
            alarmId:    event.id,
            type:       'alarm',
            eventTitle: event.title,
            eventTime:  new Date(event.startAt).toISOString(),
          },
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'timeSensitive' as const,
          }),
        },
        trigger: null, // fires immediately
        ...(Platform.OS === 'android' && {
          android: { channelId: 'event-alarm' },
        } as any),
      });
    } catch (err) {
      console.log('[ExternalNotificationService] Failed to trigger alarm:', err);
    }
  }

  static async cancelEventReminder(eventId: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const eventNotifications = scheduledNotifications.filter(
        notification => notification.content.data?.eventId === eventId
      );

      for (const notification of eventNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.log('❌ Failed to cancel external reminder:', error);
    }
  }

  static async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.log('❌ Failed to get scheduled notifications:', error);
      return [];
    }
  }

  static async cancelAllReminders() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.log('❌ Failed to cancel all external reminders:', error);
    }
  }

  static async rescheduleAllReminders(events: ICalendarEvent[]): Promise<void> {
    // Clear any previously scheduled local notifications
    await this.cancelAllReminders();
    
    // Backend FCM handles all push notifications
    console.log('[ExternalNotificationService] Cleared local notifications - backend FCM is source of truth');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alarm helpers — thin wrappers that delegate to NativeAlarmScheduler
// (imported here so callers can use a single import from '@/services/calender')
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedule a native alarm for an event's start time.
 * Uses expo-alarm-module for reliable background/locked-screen delivery.
 * Safe to call multiple times — cancels any previous alarm before scheduling.
 */
export async function scheduleEventAlarm(event: ICalendarEvent): Promise<void> {
  if (!event.startAt) return;
  const startAt = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
  if (startAt.getTime() <= Date.now()) return; // past events — skip silently
  try {
    await NativeAlarmScheduler.scheduleAlarm(
      startAt,
      event.id,
      event.title,
    );
  } catch (err) {
    console.warn('[calender] scheduleEventAlarm failed:', err);
  }
}

/**
 * Cancel a previously-scheduled alarm for the given event id.
 */
export async function cancelEventAlarm(eventId: string): Promise<void> {
  try {
    await NativeAlarmScheduler.cancelAlarm(eventId);
  } catch (err) {
    console.warn('[calender] cancelEventAlarm failed:', err);
  }
}

export const createCalendarEvent = async (
  payload: ICreateCalendarEventRequest
): Promise<ICalendarEvent> => {
  const apiPayload = {
    ...payload,
    startAt: payload.startAt.toISOString(),
    endAt: payload.endAt.toISOString(),
    // Frequencies and types are already uppercase in the type definition
    // Add sensible mobile defaults for fields we don't expose in the form
    meetingType: payload.meetingType ?? 'OTHER',
    priority: payload.priority ?? 'MEDIUM',
    timezone: payload.timezone ?? 'Africa/Kigali',
    reminderMinutesBefore: Array.isArray(payload.reminderMinutesBefore)
      ? payload.reminderMinutesBefore
      : [payload.reminderMinutesBefore ?? 30],
    recurrenceEndsAt: payload.recurrenceEndsAt
      ? payload.recurrenceEndsAt.toISOString()
      : undefined,
  };

  const response = await httpClient.post('/calendar/events', apiPayload);
  const raw = (response as any).data;
  // API returns { message, statusCode, data: { ...event } } — unwrap one level
  const data = raw?.data ?? raw;

  const createdEvent = {
    ...data,
    startAt: new Date(data.startAt),
    endAt: data.endAt ? new Date(data.endAt) : null,
    participants: data.participants || [],
  };
  return createdEvent;
};

export const updateCalendarEvent = async (
  id: string,
  payload: Partial<ICreateCalendarEventRequest>
): Promise<ICalendarEvent> => {
  const apiPayload: Record<string, unknown> = { ...payload };

  if (payload.startAt) apiPayload.startAt = payload.startAt.toISOString();
  if (payload.endAt)   apiPayload.endAt   = payload.endAt.toISOString();
  if (payload.recurrenceEndsAt) {
    apiPayload.recurrenceEndsAt = payload.recurrenceEndsAt.toISOString();
  }
  if (payload.reminderMinutesBefore !== undefined) {
    apiPayload.reminderMinutesBefore = Array.isArray(payload.reminderMinutesBefore)
      ? payload.reminderMinutesBefore
      : [payload.reminderMinutesBefore];
  }
  // Ensure mobile defaults on update too
  if (!apiPayload.meetingType) apiPayload.meetingType = 'OTHER';
  if (!apiPayload.priority)    apiPayload.priority    = 'MEDIUM';
  if (!apiPayload.timezone)    apiPayload.timezone    = 'Africa/Kigali';

  const response = await httpClient.put(`/calendar/events/${id}`, apiPayload);
  const raw = (response as any).data;
  const data = raw?.data ?? raw;

  return {
    ...data,
    startAt: new Date(data.startAt),
    endAt: data.endAt ? new Date(data.endAt) : null,
  };
};

export const deleteCalendarEvent = async (id: string): Promise<void> => {
  await httpClient.delete(`/calendar/events/${id}`);
};

export const getCalendarEventById = async (
  id: string
): Promise<ICalendarEvent> => {
  const response = await httpClient.get(`/calendar/events/${id}`);
  const data = (response as any).data.data;
  return {
    ...data,
    startAt: new Date(data.startAt),
    endAt: data.endAt ? new Date(data.endAt) : null,
    participants: data.participants || [],
  };
};