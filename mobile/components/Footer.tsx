import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BookOpen, Award, Users, Handshake } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';

const BASE_TAB_CONFIG = [
  { name: 'index', icon: Home, label: 'Ahabanza' },
  { name: 'training', icon: BookOpen, label: 'Amasomo' },
  { name: 'certificate', icon: Award, label: 'Icyemezo' },
  { name: 'itsinda', icon: Handshake, label: 'Itsinda' },
  { name: 'community', icon: Users, label: 'Kominote' },
];

type FooterProps = {
  activeTab: string;
  onTabPress: (tabName: string) => void;
};

export default function Footer({ activeTab, onTabPress }: FooterProps) {
  const { themeColors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  const [isCEHO, setIsCEHO] = useState(false);
  useEffect(() => {
    const detected = user?.roles?.includes('CEHO') ?? false;
    if (detected) setIsCEHO(true);
  }, [user]);

  const TAB_CONFIG = useMemo(
    () => (isCEHO ? BASE_TAB_CONFIG : BASE_TAB_CONFIG.filter((t) => t.name !== 'itsinda')),
    [isCEHO],
  );

  const barStyle = {
    backgroundColor: isDark ? '#1f2937' : '#fff',
    borderTopColor: isDark ? '#374151' : '#e5e7eb',
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    paddingBottom: Math.max(insets.bottom + 4, 12),
    minHeight: 60 + insets.bottom,
  };

  // Hold rendering until we know the user's role — prevents the tab count jumping
  if (loading && !isCEHO) {
    return <View style={[styles.tabBar, barStyle]} />;
  }

  const tabWidth = Dimensions.get('window').width / TAB_CONFIG.length;

  return (
    <View style={[styles.tabBar, barStyle]}>
      {TAB_CONFIG.map((tab) => {
        const isFocused = activeTab === tab.name;
        const color = isFocused ? themeColors.primary : (isDark ? '#9ca3af' : '#6b7280');
        return (
          <TouchableOpacity
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={() => onTabPress(tab.name)}
            style={[styles.tab, { width: tabWidth }]}
            activeOpacity={0.8}
          >
            <tab.icon size={28} color={color} />
            <View style={{ marginTop: 2 }}>
              <Text style={{
                color,
                fontWeight: isFocused ? 'bold' : 'normal',
                fontSize: 12,
                textAlign: 'center',
                opacity: isFocused ? 1 : 0.7,
                letterSpacing: 0.2,
              }}>{tab.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
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
});
