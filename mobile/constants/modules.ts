import { assets } from '@/theme';
import type { ImageSourcePropType } from 'react-native';

export type AppModule = 'cemr' | 'ebumenyi' | 'egenzura';

export const ACTIVE_MODULE_KEY = '@active_module';

export type ModuleCardConfig = {
  key: AppModule;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
  wideIcon?: boolean;
};

export function getModuleCards(t: (key: string) => string): ModuleCardConfig[] {
  return [
    {
      key: 'cemr',
      title: t('splash.cemr.title') || 'cEMR',
      subtitle:
        t('splash.cemr.subtitle') || 'Primary aid and patient basic diagnosis.',
      icon: assets.cEMR,
    },
    {
      key: 'ebumenyi',
      title:
        t('splash.ebumenyi.title') ||
        t('splash.etraining.title') ||
        'eBumenyi',
      subtitle:
        t('splash.ebumenyi.subtitle') ||
        t('splash.etraining.subtitle') ||
        'Access all content for Community Health Workers.',
      icon: assets.etrainingIcon,
      wideIcon: true,
    },
    {
      key: 'egenzura',
      title:
        t('splash.egenzura.title') ||
        t('splash.weltel.title') ||
        'eGenzura',
      subtitle:
        t('splash.egenzura.subtitle') ||
        t('splash.weltel.subtitle') ||
        'Messaging and communication between community health workers and patients.',
      icon: assets.weltelIcon,
    },
  ];
}

export function moduleFromPathname(pathname: string | null): AppModule {
  if (!pathname) return 'ebumenyi';
  if (
    pathname === '/egenzura' ||
    pathname.startsWith('/egenzura/') ||
    pathname === '/weltel' ||
    pathname.startsWith('/weltel/')
  ) {
    return 'egenzura';
  }
  if (pathname === '/cemr' || pathname.startsWith('/cemr/')) return 'cemr';
  return 'ebumenyi';
}
