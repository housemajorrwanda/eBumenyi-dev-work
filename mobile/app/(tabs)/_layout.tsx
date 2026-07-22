import React, { useRef, useMemo, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Home, BookOpen, Award, Users, Handshake } from 'lucide-react-native';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useQuery } from '@tanstack/react-query';
import * as MessagingAPI from '@/services/messaging.api';
import { useAuth } from '@/hooks/useAuth';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

const TAB_TOUR_TEXT: Record<string, string> = {
  index: "Hano ni Ahabanza — urebe incamake y'amasomo n'ibikorwa byawe.",
  training: 'Hano ubona ibigendanye na masomo yawe.',
  certificate: 'Hano ubona impamyabushobozi wabonye.',
  itsinda: "Hano ubona itsinda ryawe ry'akazi.",
  community: 'Hano uganira n\'abandi bakoresha porogaramu.',
};

const ALL_TAB_CONFIG = [
  { name: 'index', icon: Home, label: 'Ahabanza' },
  { name: 'training', icon: BookOpen, label: 'Amasomo' },
  { name: 'certificate', icon: Award, label: 'Icyemezo' },
  { name: 'itsinda', icon: Handshake, label: 'Itsinda' },
  { name: 'community', icon: Users, label: 'Kominote' },
];

function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark, themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getConversationUnread } = useUnreadCount();
  const { user } = useAuth();

  const isCEHO = user?.roles?.includes('CEHO') ?? false;

  const TAB_CONFIG = useMemo(
    () => (isCEHO ? ALL_TAB_CONFIG : ALL_TAB_CONFIG.filter((t) => t.name !== 'itsinda')),
    [isCEHO],
  );

  const { start, copilotEvents } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { hasCompleted, markComplete, syncReady } = useOnboarding();
  // The tab bar is always-mounted chrome, visible the whole time the home
  // screen's own welcome video and "APP" tour run — wait for both to finish
  // (or be skipped) before this tour ever attempts to start, so they don't
  // overlap. The welcome video's dismissal state lives in home screen
  // component state, invisible to this always-mounted tab bar, which is why
  // it has to be read through the same reactive onboarding context instead.
  const welcomeVideoDone = hasCompleted(TOUR_KEYS.WELCOME_VIDEO);
  const appTourDone = hasCompleted(TOUR_KEYS.APP);
  const autoStartAttemptedRef = useRef(false);
  // ALL_TAB_CONFIG (not the rendered/filtered TAB_CONFIG, which varies with
  // isCEHO) so this calls the same fixed number of hooks every render,
  // regardless of which tabs are actually visible for this user.
  const advanceIndex = useTourStepAdvance('tab-index');
  const advanceTraining = useTourStepAdvance('tab-training');
  const advanceCertificate = useTourStepAdvance('tab-certificate');
  const advanceItsinda = useTourStepAdvance('tab-itsinda');
  const advanceCommunity = useTourStepAdvance('tab-community');
  const advanceByTab: Record<string, ReturnType<typeof useTourStepAdvance>> = {
    index: advanceIndex,
    training: advanceTraining,
    certificate: advanceCertificate,
    itsinda: advanceItsinda,
    community: advanceCommunity,
  };

  useEffect(() => {
    // syncReady is required too: completedTours is populated from local
    // AsyncStorage before the backend sync resolves, so without this a
    // stale/pre-sync read (e.g. left over from a previous account tested on
    // this device) could satisfy both conditions before the real, synced
    // truth for the current user comes in.
    if (!syncReady || !welcomeVideoDone || !appTourDone || autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const done = await onboardingService.hasCompleted(TOUR_KEYS.TAB_BAR);
      if (cancelled) return;
      if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
    })();
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [syncReady, welcomeVideoDone, appTourDone]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.TAB_BAR).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  // Read the same cached conversation lists that community.tsx keeps warm.
  // staleTime: Infinity so this never triggers its own network request —
  // it only reads from the shared React Query cache.
  const { data: directChats = [] } = useQuery({
    queryKey: ['directChats'],
    queryFn: async () => (await MessagingAPI.getDirectChats().catch(() => [])).map((c: any) => ({ ...c, type: 'direct' })),
    staleTime: Infinity,
  });
  const { data: groupChats = [] } = useQuery({
    queryKey: ['groupChats'],
    queryFn: async () => (await MessagingAPI.getGroupChats().catch(() => [])).map((c: any) => ({ ...c, type: 'group' })),
    staleTime: Infinity,
  });
  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: async () => (await MessagingAPI.getCommunities().catch(() => [])).map((c: any) => ({ ...c, type: 'community' })),
    staleTime: Infinity,
  });

  // Exclude conversations where the current user sent the last message —
  // the backend can spuriously count those as unread for the sender.
  const effectiveTotalAll = useMemo(() => {
    const all = [...directChats, ...groupChats, ...communities] as any[];
    return all.reduce((sum, chat) =>
      chat.lastMessageSender === 'me' ? sum : sum + getConversationUnread(chat.id), 0);
  }, [directChats, groupChats, communities, getConversationUnread]);

  const tabWidth = Dimensions.get('window').width / TAB_CONFIG.length;

  // Find the focused index within our visible TAB_CONFIG
  const focusedTabName = state.routes[state.index]?.name;
  const focusedIdx = TAB_CONFIG.findIndex((t) => t.name === focusedTabName);
  const effectiveIdx = focusedIdx >= 0 ? focusedIdx : 0;

  const underlineAnim = useRef(new Animated.Value(effectiveIdx * tabWidth)).current;

  React.useEffect(() => {
    Animated.spring(underlineAnim, {
      toValue: effectiveIdx * tabWidth,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [effectiveIdx, tabWidth, underlineAnim]);

  return (
    <View style={[
      styles.tabBar,
      {
        backgroundColor: isDark ? '#1f2937' : '#fff',
        borderTopColor: isDark ? '#374151' : '#e5e7eb',
        paddingBottom: Math.max(insets.bottom + 4, 12),
        minHeight: 60 + insets.bottom,
      }
    ]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: tabWidth,
          height: 4,
          borderRadius: 2,
          backgroundColor: themeColors.primary,
          transform: [{ translateX: underlineAnim }],
        }}
      />
      {TAB_CONFIG.map((tab, idx) => {
        const isFocused = effectiveIdx === idx;
        const color = isFocused ? themeColors.primary : (isDark ? '#9ca3af' : '#6b7280');
        return (
          <CopilotStep
            key={tab.name}
            text={TAB_TOUR_TEXT[tab.name] ?? tab.label}
            order={idx + 1}
            name={`tab-${tab.name}`}
          >
            <WalkthroughableTouchable
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[tab.name]?.options.tabBarAccessibilityLabel}
              onPress={advanceByTab[tab.name](() => navigation.navigate(tab.name))}
              style={[styles.tab, { width: tabWidth }]}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative' }}>
                <tab.icon size={28} color={color} />
                {tab.name === 'community' && effectiveTotalAll > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{effectiveTotalAll > 99 ? '99+' : effectiveTotalAll}</Text>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 2 }}>
                <Animated.Text style={{
                  color,
                  fontWeight: isFocused ? 'bold' : 'normal',
                  fontSize: 12,
                  textAlign: 'center',
                  opacity: isFocused ? 1 : 0.7,
                  letterSpacing: 0.2,
                }}>
                  {tab.label}
                </Animated.Text>
              </View>
            </WalkthroughableTouchable>
          </CopilotStep>
        );
      })}
    </View>
  );
}

// Defined at module scope so it's a stable component reference across
// re-renders of the Tabs navigator's `tabBar` prop — otherwise a fresh
// CopilotProvider (and its tour state) would remount on every tab switch.
function TabBarWithTour(props: BottomTabBarProps) {
  return (
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
      <AnimatedTabBar {...props} />
    </CopilotProvider>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  // Keys TabBarWithTour (and its CopilotProvider) by the current user id so it
  // fully remounts on every account switch — react-native-copilot's own
  // internal tour state and autoStartAttemptedRef otherwise persist across
  // logins on the same device/app session (this navigator isn't unmounted by
  // a plain auth-state change), letting a previous account's tour progress
  // leak into the next one.
  return (
    <Tabs
      tabBar={props => <TabBarWithTour {...props} key={user?.id ?? 'anonymous'} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ahabanza' }} />
      <Tabs.Screen name="training" options={{ title: 'Amasomo' }} />
      <Tabs.Screen name="certificate" options={{ title: 'Icyemezo' }} />
      <Tabs.Screen name="itsinda" options={{ title: 'Itsinda' }} />
      <Tabs.Screen name="community" options={{ title: 'Kominote' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
