import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Bell, Clock, X, AlarmClock } from 'lucide-react-native';
import { useAlarmContext } from '@/contexts/AlarmContext';
import { useTheme } from '@/contexts/ThemeContext';

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  TRAINING: { bg: '#dbeafe', text: '#1d4ed8' },
  REMINDER: { bg: '#fef9c3', text: '#854d0e' },
  DEADLINE: { bg: '#fee2e2', text: '#b91c1c' },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * This screen can appear either as a reminder (ringing ahead of the event,
 * at the user's chosen offset) or, rarely, once the event has already
 * started (e.g. a delayed/queued ring). Compute which wording applies at
 * render time from the live gap to startAt, rather than trusting a static
 * label — the alarm no longer always fires exactly at start time.
 */
function getRingLabel(startAt: Date): { label: string; minutesRemaining: number | null } {
  const minutesRemaining = Math.round((startAt.getTime() - Date.now()) / 60000);
  if (minutesRemaining > 0) {
    return { label: 'Ukwibutsa', minutesRemaining };
  }
  return { label: 'Igikorwa gitangiye', minutesRemaining: null };
}

export default function AlarmRingScreen() {
  const { activeAlarm, dismissAlarm, snoozeAlarm } = useAlarmContext();
  const { isDark, themeColors } = useTheme();

  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const ringAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!activeAlarm) {
      ringAnimation.current?.stop();
      Vibration.cancel();
      return;
    }

    Vibration.vibrate([0, 500, 300, 500, 300, 500], true);

    const swing = Animated.sequence([
      Animated.timing(rotation, { toValue: 1, duration: 100, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(rotation, { toValue: -1, duration: 200, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(rotation, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(rotation, { toValue: -1, duration: 200, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(rotation, { toValue: 0, duration: 100, useNativeDriver: true, easing: Easing.linear }),
    ]);
    const pulse = Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);
    ringAnimation.current = Animated.loop(
      Animated.parallel([swing, Animated.sequence([pulse, Animated.delay(620)])]),
    );
    ringAnimation.current.start();

    return () => {
      ringAnimation.current?.stop();
      Vibration.cancel();
    };
  }, [activeAlarm, rotation, scale]);

  const rotationDeg = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-22deg', '22deg'],
  });

  if (!activeAlarm) return null;

  const startAt =
    activeAlarm.startAt instanceof Date
      ? activeAlarm.startAt
      : new Date(activeAlarm.startAt);

  const typeMeta =
    EVENT_TYPE_COLORS[activeAlarm.type] ?? { bg: '#f3f4f6', text: '#374151' };

  const { label: ringLabel, minutesRemaining } = getRingLabel(startAt);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const surface = isDark ? '#1e293b' : '#f0f4ff';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const divider = isDark ? '#334155' : '#e2e8f0';
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';

  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => dismissAlarm(activeAlarm.id)}
    >
      <StatusBar
        backgroundColor={bg}
        barStyle={statusBarStyle}
        translucent
      />
      <View
        style={[
          styles.root,
          { backgroundColor: bg, paddingTop: statusBarHeight },
        ]}
      >
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <AlarmClock size={20} color={themeColors.primary} />
          <Text style={[styles.topBarLabel, { color: themeColors.primary }]}>
            {ringLabel}
          </Text>
        </View>

        {/* ── Scrollable centre content ─────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.centerContent}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Animated bell */}
          <View style={[styles.bellWrapper, { backgroundColor: surface }]}>
            <Animated.View
              style={{ transform: [{ rotate: rotationDeg }, { scale }] }}
            >
              <Bell size={64} color={themeColors.primary} strokeWidth={1.4} />
            </Animated.View>
          </View>

          {/* Type badge */}
          <View style={[styles.typeBadge, { backgroundColor: typeMeta.bg }]}>
            <Text style={[styles.typeBadgeText, { color: typeMeta.text }]}>
              {activeAlarm.type}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textPrimary }]}>
            {activeAlarm.title}
          </Text>

          {/* Time */}
          <View style={styles.timeRow}>
            <Clock size={15} color={textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.timeText, { color: textSecondary }]}>
              {formatDate(startAt)} · {formatTime(startAt)}
              {minutesRemaining !== null ? ` · mu minota ${minutesRemaining}` : ''}
            </Text>
          </View>

          {/* Description */}
          {!!activeAlarm.description && (
            <Text style={[styles.description, { color: textSecondary }]}>
              {activeAlarm.description}
            </Text>
          )}
        </ScrollView>

        {/* ── Bottom actions ────────────────────────────────────── */}
        <View style={styles.bottomSection}>
          <View style={[styles.divider, { backgroundColor: divider }]} />
          <View style={styles.actions}>
            {/* Snooze */}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.snoozeBtn,
                { borderColor: divider, backgroundColor: surface },
              ]}
              onPress={() => snoozeAlarm(activeAlarm.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.btnText, { color: textPrimary }]}>
                Rindira 5 min
              </Text>
            </TouchableOpacity>

            {/* Dismiss */}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.dismissBtn,
                { backgroundColor: themeColors.primary },
              ]}
              onPress={() => dismissAlarm(activeAlarm.id)}
              activeOpacity={0.75}
            >
              <X size={17} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.btnText, { color: '#ffffff' }]}>
                Hagarika
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  topBarLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  bellWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  snoozeBtn: {
    borderWidth: 1.5,
  },
  dismissBtn: {},
  btnText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
});
