import React, { useRef, useMemo } from 'react';
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

  const isCHO = user?.roles?.includes('CHO') ?? false;

  const TAB_CONFIG = useMemo(
    () => (isCHO ? ALL_TAB_CONFIG : ALL_TAB_CONFIG.filter((t) => t.name !== 'itsinda')),
    [isCHO],
  );

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
          <TouchableOpacity
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={descriptors[tab.name]?.options.tabBarAccessibilityLabel}
            onPress={() => navigation.navigate(tab.name)}
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
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <AnimatedTabBar {...props} />}
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
