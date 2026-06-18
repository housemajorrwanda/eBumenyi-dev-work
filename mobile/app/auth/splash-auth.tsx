import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, fonts, assets } from '@/theme';
import { useModuleSwitch } from '@/hooks/useModuleSwitch';
import ModuleCardsList from '@/components/ModuleCardsList';
import type { AppModule } from '@/constants/modules';

export default function SplashScreen() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { loadingModule, selectModule } = useModuleSwitch();

  const themeColors = isDark ? colors.dark : colors.light;

  const { width, height } = useWindowDimensions();
  const logoSize = Math.min(140, Math.round(width * 0.22));
  const paddingTop = Math.max(insets.top + 12, Math.round(height * 0.03));

  const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Math.max(16, width * 0.04),
      paddingTop,
    },
    header: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Math.round(height * 0.035),
    },
    seal: {
      width: logoSize,
      height: logoSize,
      marginTop: 0,
      marginBottom: Math.round(height * 0.01),
    },
    ministry1: {
      fontSize: Math.round(Math.max(14, width * 0.035)),
      color: '#fff',
      marginTop: 8,
    },
    ministry2: {
      fontSize: Math.round(Math.max(12, width * 0.035)),
      color: '#fff',
      marginTop: 4,
    },
    ministryDivider: {
      width: Math.round(Math.max(40, width * 0.48)),
      height: 1,
      marginVertical: 2,
      borderRadius: 1,
    },
    cardsWrapper: {
      flex: 1,
      width: '100%',
      marginTop: Math.round(height * 0.01),
      paddingBottom: Math.round(height * 0.05),
    },
  });

  const handlePress = (key: AppModule) => {
    selectModule(key, { skipIfActive: false });
  };

  return (
    <LinearGradient
      colors={[themeColors.primary, themeColors.primary] as const}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Image
            source={assets.rwanda}
            style={styles.seal}
            resizeMode="contain"
          />
          <Text style={[styles.ministry1, { fontFamily: fonts.medium }]}>
            {t('splash.ministryLine1')}
          </Text>
          <View
            style={[
              styles.ministryDivider,
              { backgroundColor: isDark ? '#fff' : '#fff' },
            ]}
          />
          <Text style={[styles.ministry2, { fontFamily: fonts.regular }]}>
            {t('splash.ministryLine2')}
          </Text>
        </View>

        <View style={styles.cardsWrapper}>
          <ModuleCardsList
            variant="splash"
            loadingModule={loadingModule}
            onSelect={handlePress}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
