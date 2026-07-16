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
  // Ring-alarm dedup, keyed `alarm-${eventId}-${minutesBefore}` — one per offset
  private static shownAlarms = new Set<string>();
  // Plain-notification dedup, keyed `notify-${eventId}` — one per event, at startAt
  private static shownNotifications = new Set<string>();
  private static alarmCallback: ((event: ICalendarEvent) => void) | null = null;
  // Exact-time timeouts, keyed `${eventId}:ring:${minutes}` or `${eventId}:notify`
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

      // ── Ring timers — one per selected reminder offset ─────────────────────
      const offsets = Array.isArray(event.reminderMinutesBefore)
        ? event.reminderMinutesBefore
        : (event.reminderMinutesBefore ? [event.reminderMinutesBefore] : []);

      offsets.forEach(minutes => {
        if (!minutes || minutes <= 0) return;
        const fireAt = startMs - minutes * 60 * 1000;
        const delay = fireAt - now;
        if (!Number.isFinite(delay) || delay <= 0 || delay > MAX_WINDOW) return;

        const t = setTimeout(() => {
          const alarmId = `alarm-${event.id}-${minutes}`;
          if (!this.shownAlarms.has(alarmId) && this.alarmCallback) {
            this.shownAlarms.add(alarmId);
            this.alarmCallback(event);
          }
        }, delay);

        this.exactAlarmTimeouts.set(`${event.id}:ring:${minutes}`, t);
      });

      // ── Notify timer — fires once, at the event's actual start time ────────
      const notifyDelay = startMs - now;
      if (Number.isFinite(notifyDelay) && notifyDelay > 0 && notifyDelay <= MAX_WINDOW) {
        const t = setTimeout(() => {
          const notifyId = `notify-${event.id}`;
          if (!this.shownNotifications.has(notifyId)) {
            this.shownNotifications.add(notifyId);
            ExternalNotificationService.notifyEventStarting(event);
          }
        }, notifyDelay);

        this.exactAlarmTimeouts.set(`${event.id}:notify`, t);
      }
    });
  }

  static setAlarmCallback(cb: ((event: ICalendarEvent) => void) | null) {
    this.alarmCallback = cb;
  }

  static getEventById(id: string): ICalendarEvent | undefined {
    return this.events.find(e => e.id === id);
  }

  static unmarkAlarmsForEvent(eventId: string) {
    const prefix = `alarm-${eventId}-`;
    Array.from(this.shownAlarms)
      .filter(id => id.startsWith(prefix))
      .forEach(id => this.shownAlarms.delete(id));
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
      // ── Ring check (X minutes before event, once per selected offset) ────
      const offsets = Array.isArray(event.reminderMinutesBefore)
        ? event.reminderMinutesBefore
        : (event.reminderMinutesBefore ? [event.reminderMinutesBefore] : []);

      offsets.forEach(minutes => {
        if (!minutes || minutes <= 0) return;
        const reminderTime = new Date(event.startAt.getTime() - (minutes * 60 * 1000));
        const alarmId = `alarm-${event.id}-${minutes}`;
        const isReminderTime = now >= reminderTime && now <= new Date(reminderTime.getTime() + 30_000);
        const isFutureEvent = event.startAt > now;

        if (isReminderTime && isFutureEvent && !this.shownAlarms.has(alarmId) && this.alarmCallback) {
          this.shownAlarms.add(alarmId);
          this.alarmCallback(event);
        }
      });

      // ── Notify check (event start time reached) ───────────────────────────
      const notifyId = `notify-${event.id}`;
      const isStartTime =
        now >= event.startAt &&
        now <= new Date(event.startAt.getTime() + 30_000);

      if (isStartTime && !this.shownNotifications.has(notifyId)) {
        this.shownNotifications.add(notifyId);
        ExternalNotificationService.notifyEventStarting(event);
      }
    });
  }

  static resetShownReminders() {
    this.shownAlarms.clear();
    this.shownNotifications.clear();
  }

  static getStatus() {
    return {
      isRunning: this.intervalId !== null,
      eventsCount: this.events.length,
      shownNotificationsCount: this.shownNotifications.size,
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
        description: 'Alarm that fires ahead of an event, at your reminder time',
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
   * Posts a plain (non-ringing) local notification when an event starts NOW.
   * Uses the default notification channel/sound \u2014 the loud alarm already
   * happened earlier, at the reminder offset time, via NativeAlarmScheduler.
   */
  static async notifyEventStarting(event: ICalendarEvent): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `\u23F0 ${event.title}`,
          body: event.location
            ? `Gitangiye ubu \u00B7 ${event.location}`
            : 'Igikorwa cyawe gitangiye ubu!',
          sound: 'default',
          data: {
            eventId:    event.id,
            type:       'event-start',
            eventTitle: event.title,
            eventTime:  new Date(event.startAt).toISOString(),
          },
        },
        trigger: null, // fires immediately
        ...(Platform.OS === 'android' && {
          android: { channelId: 'calendar-reminders' },
        } as any),
      });
    } catch (err) {
      console.log('[ExternalNotificationService] Failed to post start notification:', err);
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
 * Schedule a native alarm for each of an event's reminder offsets
 * (startAt − minutesBefore), one ring per selected offset.
 * Uses expo-alarm-module for reliable background/locked-screen delivery.
 * Safe to call multiple times — clears this event's previously-scheduled
 * offsets before scheduling the current set.
 */
export async function scheduleEventAlarm(event: ICalendarEvent): Promise<void> {
  if (!event.startAt || !event.id || String(event.id).startsWith('optimistic-')) return;
  const startAt = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);

  // Clear any previously-scheduled offsets for this event so edits that
  // remove/change an offset don't leave an orphaned native alarm behind.
  await NativeAlarmScheduler.cancelAlarm(event.id).catch(() => {});

  const offsets = Array.isArray(event.reminderMinutesBefore) ? event.reminderMinutesBefore : [];
  for (const minutes of offsets) {
    if (!minutes || minutes <= 0) continue;
    const fireAt = new Date(startAt.getTime() - minutes * 60 * 1000);
    if (fireAt.getTime() <= Date.now()) continue; // this offset already elapsed — skip silently
    try {
      await NativeAlarmScheduler.scheduleAlarm(fireAt, event.id, event.title, String(minutes));
    } catch (err) {
      console.warn('[calender] scheduleEventAlarm failed for offset', minutes, err);
    }
  }
}

/**
 * Cancel every previously-scheduled alarm (all offsets) for the given event id.
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