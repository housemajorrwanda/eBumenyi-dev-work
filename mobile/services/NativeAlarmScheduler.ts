/**
 * NativeAlarmScheduler.ts
 *
 * Thin wrapper around expo-alarm-module.
 *
 * ── Design ──────────────────────────────────────────────────────────────────
 * We rely 100% on expo-alarm-module's native alarm system:
 *   • AlarmReceiver fires at the scheduled time (works when app is killed/locked)
 *   • AlarmService plays alarm.wav (patched in Manager.java) via ALARM stream
 *   • Built-in "Hagarika" (dismiss) and "Rindira 5 min" (snooze) buttons
 *   • BootReceiver reschedules alarms after device reboot
 *
 * There is NO custom AlarmRingScreen. The native alarm UI handles everything.
 * This eliminates all dual-sound, re-open, and race-condition bugs.
 */

import {
  scheduleAlarm as nativeScheduleAlarm,
  removeAlarm as nativeRemoveAlarm,
  removeAllAlarms as nativeRemoveAllAlarms,
  getAllAlarms as nativeGetAllAlarms,
  stopAlarm as nativeStopAlarm,
  getAlarmState as nativeGetAlarmState,
} from 'expo-alarm-module';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

// ─── Internal registry key ────────────────────────────────────────────────────

const ALARM_REGISTRY_KEY = 'native_alarm_registry';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlarmRegistryEntry {
  uid: string;
  eventId: string;
  eventTitle: string;
  eventTime: string; // ISO — the alarm's own fire time (reminder offset or snooze time)
  variant: string; // offset in minutes as a string (e.g. "30"), or "snooze"
  scheduledAt: string;
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

async function saveToRegistry(entry: AlarmRegistryEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_REGISTRY_KEY);
    const list: AlarmRegistryEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(e => e.uid !== entry.uid);
    filtered.push(entry);
    await AsyncStorage.setItem(ALARM_REGISTRY_KEY, JSON.stringify(filtered));
  } catch { /* best effort */ }
}

async function removeFromRegistry(eventId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_REGISTRY_KEY);
    if (!raw) return;
    const list: AlarmRegistryEntry[] = JSON.parse(raw);
    await AsyncStorage.setItem(
      ALARM_REGISTRY_KEY,
      JSON.stringify(list.filter(e => e.eventId !== eventId)),
    );
  } catch { /* best effort */ }
}

async function getRegistry(): Promise<AlarmRegistryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Permission helper (Android 12+) ─────────────────────────────────────────

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const { status: asked } = await Notifications.requestPermissionsAsync({
      android: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    if (asked !== 'granted') {
      Alert.alert(
        'Alarm Permission Required',
        'Please enable "Alarms & reminders" so your events can alert you even when the app is closed.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }
    return true;
  } catch {
    return true; // older Android — assume granted
  }
}

// ─── Main service ─────────────────────────────────────────────────────────────

export const NativeAlarmScheduler = {

  /**
   * Schedule a native alarm for an event.
   * The alarm fires via expo-alarm-module's AlarmReceiver → AlarmService.
   * Sound: alarm.wav (patched in Manager.java).
   * Dismiss/Snooze: native notification buttons.
   */
  async scheduleAlarm(
    targetDate: Date,
    eventId: string,
    eventTitle: string,
    variant: string,
  ): Promise<string | null> {
    if (!eventId) {
      console.warn('[NativeAlarmScheduler] Skipping alarm — eventId is missing');
      return null;
    }
    if (targetDate.getTime() <= Date.now()) {
      console.warn(`[NativeAlarmScheduler] Skipping past alarm: ${targetDate.toISOString()}`);
      return null;
    }

    const ok = await ensurePermissions();
    if (!ok) {
      console.warn('[NativeAlarmScheduler] Permission denied — alarm not scheduled');
      return null;
    }

    const uid = `alarm_${eventId}_${variant}`;

    // Idempotently clear this specific offset's alarm before re-scheduling it —
    // do NOT touch sibling offsets for the same event.
    try {
      await nativeRemoveAlarm(uid);
    } catch { /* didn't exist — fine */ }

    // This rings AHEAD of the event (at the reminder offset), not at the
    // event's own start time — the copy must say "reminder", not "starting".
    // Snooze reschedules 5 minutes out, so it reuses that same minute count.
    const minutesLabel = variant === 'snooze' ? '5' : variant;

    try {
      await nativeScheduleAlarm({
        uid,
        day: targetDate,
        title: '⏰ Ukwibutsa',
        description: `Igikorwa «${eventTitle}» gitangira mu minota ${minutesLabel}.`,
        active: true,
        // Native dismiss button — stops AlarmService sound
        showDismiss: true,
        dismissText: 'Hagarika',
        // Native snooze button — reschedules alarm 5 minutes later
        showSnooze: true,
        snoozeInterval: 5,
        snoozeText: 'Rindira 5 min',
        repeating: false,
      });

      await saveToRegistry({
        uid,
        eventId,
        eventTitle,
        eventTime: targetDate.toISOString(),
        variant,
        scheduledAt: new Date().toISOString(),
      });

      console.log(`[NativeAlarmScheduler] ✅ Scheduled — uid: ${uid}, fires: ${targetDate.toISOString()}`);
      return uid;
    } catch (err) {
      console.error('[NativeAlarmScheduler] Failed to schedule:', err);
      return null;
    }
  },

  /**
   * Stop the currently ringing alarm (sound + foreground service + notification).
   * Safe to call even when no alarm is ringing.
   */
  async stopRinging(): Promise<void> {
    try {
      await nativeStopAlarm();
    } catch (err) {
      console.warn('[NativeAlarmScheduler] stopRinging failed:', err);
    }
  },

  /**
   * Returns the UID of the currently ringing alarm, or null if nothing is ringing.
   * Used for bidirectional sync: if null while alarm screen is showing, the user
   * dismissed via the notification panel.
   */
  async getActiveAlarmUid(): Promise<string | null> {
    try {
      const state = await nativeGetAlarmState();
      return state ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Cancel every scheduled alarm (all offsets/variants) for an event.
   */
  async cancelAlarm(eventId: string): Promise<void> {
    if (!eventId || String(eventId).startsWith('optimistic-')) return;
    const registry = await getRegistry();
    const entries = registry.filter(e => e.eventId === eventId);
    for (const entry of entries) {
      try {
        await nativeRemoveAlarm(entry.uid);
      } catch {
        // nativeRemoveAlarm throws if alarm doesn't exist — that's fine
      }
    }
    await removeFromRegistry(eventId);
    if (entries.length > 0) {
      console.log(`[NativeAlarmScheduler] ✅ Cancelled ${entries.length} alarm(s) for event ${eventId}`);
    }
  },

  /**
   * Cancel a single alarm by its exact uid, leaving sibling offsets for the
   * same event (if any) untouched. Used when dismissing one ringing alarm.
   */
  async cancelAlarmByUid(uid: string): Promise<void> {
    try {
      await nativeRemoveAlarm(uid);
    } catch {
      // didn't exist — fine
    }
    try {
      const raw = await AsyncStorage.getItem(ALARM_REGISTRY_KEY);
      if (!raw) return;
      const list: AlarmRegistryEntry[] = JSON.parse(raw);
      await AsyncStorage.setItem(
        ALARM_REGISTRY_KEY,
        JSON.stringify(list.filter(e => e.uid !== uid)),
      );
    } catch { /* best effort */ }
  },

  /**
   * Look up which event a given native alarm uid belongs to.
   */
  async getEventIdForUid(uid: string): Promise<string | null> {
    const registry = await getRegistry();
    return registry.find(e => e.uid === uid)?.eventId ?? null;
  },

  /**
   * Return all alarms currently tracked in our registry.
   */
  async getScheduledAlarms(): Promise<AlarmRegistryEntry[]> {
    return getRegistry();
  },

  /**
   * Cancel every scheduled alarm (use on logout / full reset).
   */
  async cancelAllAlarms(): Promise<void> {
    try {
      await nativeRemoveAllAlarms();
      await AsyncStorage.removeItem(ALARM_REGISTRY_KEY).catch(() => {});
      console.log('[NativeAlarmScheduler] ✅ All alarms cancelled');
    } catch (err) {
      console.error('[NativeAlarmScheduler] Failed to cancel all:', err);
    }
  },

  /**
   * Cross-check our registry against what expo-alarm-module has scheduled.
   * Removes stale entries. Also removes any alarms for past events.
   * Call on app foreground resume.
   */
  async syncRegistry(): Promise<void> {
    try {
      const [registry, nativeAlarms] = await Promise.all([
        getRegistry(),
        nativeGetAllAlarms(),
      ]);
      const nativeUids = new Set(nativeAlarms.map(a => a.uid));
      const now = new Date();
      
      // Filter out:
      // 1. Entries not in native alarms (stale)
      // 2. Entries with event times in the past (expired)
      const stale = registry.filter(e => {
        const hasNativeAlarm = nativeUids.has(e.uid);
        const eventTime = new Date(e.eventTime);
        const isPast = eventTime <= now;
        
        return !hasNativeAlarm || isPast;
      });
      
      if (stale.length > 0) {
        const staleUids = new Set(stale.map(e => e.uid));
        const remaining = registry.filter(e => !staleUids.has(e.uid));
        await AsyncStorage.setItem(ALARM_REGISTRY_KEY, JSON.stringify(remaining));
      }
      for (const entry of stale) {
        // Also try to cancel from native in case it exists
        try {
          await nativeRemoveAlarm(entry.uid);
        } catch {
          // Alarm might not exist in native — that's ok
        }
      }
      
      if (stale.length > 0) {
        console.log(`[NativeAlarmScheduler] Removed ${stale.length} stale/expired entries after reboot`);
      }
    } catch (err) {
      console.warn('[NativeAlarmScheduler] syncRegistry failed:', err);
    }
  },
};
