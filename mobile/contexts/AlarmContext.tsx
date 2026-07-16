import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ICalendarEvent } from '@/types';
import { GlobalReminderService } from '@/services/calender';
import { NativeAlarmScheduler } from '@/services/NativeAlarmScheduler';

interface AlarmContextType {
  activeAlarm: ICalendarEvent | null;
  triggerAlarm: (event: ICalendarEvent) => void;
  dismissAlarm: (eventId: string) => Promise<void>;
  snoozeAlarm: (eventId: string) => Promise<void>;
}

const AlarmContext = createContext<AlarmContextType | null>(null);

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [activeAlarm, setActiveAlarm] = useState<ICalendarEvent | null>(null);
  const activeAlarmRef = useRef<ICalendarEvent | null>(null);
  activeAlarmRef.current = activeAlarm;

  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAlarm = useCallback((event: ICalendarEvent) => {
    setActiveAlarm(event);
  }, []);

  // Check whether the native AlarmService is currently ringing and, if so,
  // immediately show the alarm screen. Called on mount and on every foreground
  // resume so the screen appears regardless of whether the user was in-app or
  // coming back from the background.
  const checkAndRestoreActiveAlarm = useCallback(async () => {
    if (activeAlarmRef.current) return; // already showing

    const uid = await NativeAlarmScheduler.getActiveAlarmUid().catch(() => null);
    if (!uid) return;

    const eventId = await NativeAlarmScheduler.getEventIdForUid(uid);
    if (!eventId) return;
    const event = GlobalReminderService.getEventById(eventId);
    if (event) {
      triggerAlarm(event);
    }
  }, [triggerAlarm]);

  const dismissAlarm = useCallback(async (eventId: string) => {
    setActiveAlarm(null);
    // Cancel only the specific ringing offset — sibling offsets for the same
    // event (e.g. a later "10 min before" reminder) should still fire.
    const uid = await NativeAlarmScheduler.getActiveAlarmUid().catch(() => null);
    await NativeAlarmScheduler.stopRinging();
    if (uid) {
      await NativeAlarmScheduler.cancelAlarmByUid(uid).catch(() => {});
    } else {
      await NativeAlarmScheduler.cancelAlarm(eventId).catch(() => {});
    }
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
  }, []);

  const snoozeAlarm = useCallback(async (eventId: string) => {
    const event = activeAlarmRef.current;
    setActiveAlarm(null);

    await NativeAlarmScheduler.stopRinging();
    await Notifications.dismissAllNotificationsAsync().catch(() => {});

    const snoozeMs = 5 * 60 * 1000;
    const snoozeTime = new Date(Date.now() + snoozeMs);
    await NativeAlarmScheduler.scheduleAlarm(
      snoozeTime,
      eventId,
      event?.title ?? '',
      'snooze',
    ).catch(() => {});

    GlobalReminderService.unmarkAlarmsForEvent(eventId);

    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => {
      if (event) triggerAlarm(event);
    }, snoozeMs);
  }, [triggerAlarm]);

  // Register exact-time alarm callback with GlobalReminderService
  useEffect(() => {
    GlobalReminderService.setAlarmCallback(triggerAlarm);
    return () => {
      GlobalReminderService.setAlarmCallback(null);
    };
  }, [triggerAlarm]);

  // Check on mount — handles cold-start while alarm is already ringing
  useEffect(() => {
    checkAndRestoreActiveAlarm();
  }, [checkAndRestoreActiveAlarm]);

  // Check every time app comes to foreground — if native alarm is ringing,
  // block the UI immediately regardless of what screen the user was on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndRestoreActiveAlarm();
    });
    return () => sub.remove();
  }, [checkAndRestoreActiveAlarm]);

  // Bidirectional sync: while alarm screen is visible, poll getActiveAlarmUid().
  // When it returns null the user dismissed/snoozed via the notification panel —
  // close the screen to match.
  useEffect(() => {
    if (!activeAlarm) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      const uid = await NativeAlarmScheduler.getActiveAlarmUid().catch(() => 'unknown');
      if (cancelled) return;

      if (!uid) {
        setActiveAlarm(null);
        return;
      }
      timer = setTimeout(poll, 1500);
    };

    // Give AlarmService a moment to fully initialise before first poll
    timer = setTimeout(poll, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeAlarm?.id]);

  // Clean up snooze timer on unmount
  useEffect(() => {
    return () => {
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, []);

  return (
    <AlarmContext.Provider value={{ activeAlarm, triggerAlarm, dismissAlarm, snoozeAlarm }}>
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarmContext(): AlarmContextType {
  const ctx = useContext(AlarmContext);
  if (!ctx) throw new Error('useAlarmContext must be used inside AlarmProvider');
  return ctx;
}
