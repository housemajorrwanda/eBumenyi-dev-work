import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fonts } from '@/theme';
import { getModuleCards, type AppModule } from '@/constants/modules';

type Variant = 'splash' | 'sheet';

type Props = {
  onSelect: (key: AppModule) => void;
  loadingModule: AppModule | null;
  activeModule?: AppModule | null;
  variant?: Variant;
};

export default function ModuleCardsList({
  onSelect,
  loadingModule,
  activeModule = null,
  variant = 'sheet',
}: Props) {
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [ebumenyiPressed, setEbumenyiPressed] = useState(false);

  const cards = getModuleCards(t);
  const isSplash = variant === 'splash';
  const cardWidth = isSplash ? Math.min(width - 40, 760) : width - 40;
  const iconBoxSize = Math.round(Math.max(48, width * (isSplash ? 0.12 : 0.11)));
  const iconSize = Math.round(iconBoxSize * 0.9);

  return (
    <View style={isSplash ? styles.splashWrapper : styles.sheetWrapper}>
      {cards.map((card) => {
        const isActive = activeModule === card.key;
        const isBusy = loadingModule === card.key;
        const isEbumenyi = card.key === 'ebumenyi';

        const containerStyle = [
          styles.card,
          {
            width: cardWidth,
            backgroundColor: themeColors.cardBg,
            shadowColor: themeColors.cardShadow ?? '#000',
            padding: Math.round(Math.max(14, width * 0.04)),
            marginBottom: isSplash
              ? Math.round(Math.max(12, height * 0.02))
              : 10,
          },
          isActive && {
            borderWidth: 2,
            borderColor: themeColors.primary,
          },
          isBusy && { opacity: 0.6 },
        ];

        const iconBoxStyle = [
          styles.iconBox,
          {
            width: iconBoxSize,
            height: iconBoxSize,
            borderRadius: Math.min(16, Math.round(iconBoxSize / 4)),
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.9)',
          },
        ];

        const subtitle =
          isBusy && card.key === 'ebumenyi'
            ? t('moduleSwitcher.validating') || 'Gusuzuma uburenganzira...'
            : isBusy && card.key === 'egenzura'
              ? t('splash.egenzura.loading') ||
                t('splash.weltel.loading') ||
                'Opening eGenzura...'
              : card.subtitle;

        return (
          <TouchableOpacity
            key={card.key}
            activeOpacity={0.85}
            onPress={() => onSelect(card.key)}
            onPressIn={isEbumenyi ? () => setEbumenyiPressed(true) : undefined}
            onPressOut={isEbumenyi ? () => setEbumenyiPressed(false) : undefined}
            style={containerStyle}
            disabled={loadingModule !== null}
          >
            <View style={iconBoxStyle}>
              <Image
                source={card.icon}
                style={[
                  styles.icon,
                  {
                    width: card.wideIcon
                      ? Math.round(iconSize * 1.8)
                      : iconSize,
                    height: card.wideIcon
                      ? Math.round(iconSize * 1.3)
                      : iconSize,
                  },
                  isEbumenyi && ebumenyiPressed
                    ? { tintColor: themeColors.primary }
                    : undefined,
                ]}
                resizeMode="contain"
              />
            </View>

            <View style={styles.cardTextWrap}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: themeColors.cardText, fontFamily: fonts.bold },
                ]}
              >
                {card.title}
              </Text>
              <Text
                style={[
                  styles.cardSubtitle,
                  { color: themeColors.cardSubtitle, fontFamily: fonts.regular },
                ]}
                numberOfLines={3}
              >
                {subtitle}
              </Text>
            </View>

            {isActive && (
              <View style={styles.activeBadge}>
                <CheckCircle size={20} color={themeColors.primary} />
                <Text
                  style={[
                    styles.activeLabel,
                    { color: themeColors.primary, fontFamily: fonts.medium },
                  ]}
                >
                  {t('moduleSwitcher.current') || 'Current'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  splashWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetWrapper: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {},
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  activeBadge: {
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  activeLabel: {
    fontSize: 10,
  },
});
