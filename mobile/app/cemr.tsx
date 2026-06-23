import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LayoutGrid, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModuleSwitcher } from '@/contexts/ModuleSwitcherContext';
import { colors, fonts, assets } from '@/theme';

export default function CemrComingSoonScreen() {
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const { open: openModuleSwitcher } = useModuleSwitcher();

  const palette = isDark ? colors.dark : colors.light;

  return (
    <LinearGradient
      colors={[palette.primary, palette.primary] as const}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={openModuleSwitcher}
            style={styles.switchButton}
            accessibilityLabel={
              t('moduleSwitcher.open') || 'Switch application'
            }
          >
            <LayoutGrid size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' },
            ]}
          >
            <Image
              source={assets.cEMR}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, { fontFamily: fonts.bold }]}>
            {t('splash.cemr.title') || 'cEMR'}
          </Text>

          <View style={styles.badge}>
            <Clock size={16} color={themeColors.primary} />
            <Text
              style={[
                styles.badgeText,
                { color: themeColors.primary, fontFamily: fonts.medium },
              ]}
            >
              {t('cemr.comingSoon.badge') || 'Coming soon'}
            </Text>
          </View>

          <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>
            {t('cemr.comingSoon.message') ||
              'cEMR is under development. Check back soon for primary aid and patient diagnosis tools.'}
          </Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isDark ? '#fff' : '#fff' },
            ]}
            onPress={openModuleSwitcher}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: themeColors.primary, fontFamily: fonts.semibold },
              ]}
            >
              {t('cemr.comingSoon.switchApp') || 'Switch to another app'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  switchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 14,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionButtonText: {
    fontSize: 15,
  },
});
