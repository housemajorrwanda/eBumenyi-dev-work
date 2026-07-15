import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LayoutGrid } from 'lucide-react-native';
import { buildWeltelLoginUrl } from '@/services/weltel.api';
import { useModuleSwitcher } from '@/contexts/ModuleSwitcherContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function EGenzuraScreen() {
  const insets = useSafeAreaInsets();
  const { open: openModuleSwitcher } = useModuleSwitcher();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    loginUrl?: string | string[];
    jwtKey?: string | string[];
  }>();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const loaderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const webUri = React.useMemo(() => {
    const loginUrlParam = Array.isArray(params.loginUrl)
      ? params.loginUrl[0]
      : params.loginUrl;
    if (loginUrlParam) {
      return loginUrlParam;
    }

    const jwtKey = Array.isArray(params.jwtKey) ? params.jwtKey[0] : params.jwtKey;
    if (jwtKey) {
      return buildWeltelLoginUrl(jwtKey);
    }

    return null;
  }, [params.loginUrl, params.jwtKey]);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
    if (loaderTimeoutRef.current) {
      clearTimeout(loaderTimeoutRef.current);
      loaderTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!webUri) {
      setError(
        t('egenzura.error.missingLogin') ||
          'eGenzura login link is missing. Open eGenzura from the home screen again.',
      );
      setIsLoading(false);
      return;
    }

    loaderTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 12000);

    return () => {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
      }
    };
  }, [webUri, t]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#eee',
        }}
      >
        <TouchableOpacity
          onPress={openModuleSwitcher}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f1f5f9',
          }}
          accessibilityLabel={t('moduleSwitcher.open') || 'Switch application'}
        >
          <LayoutGrid size={22} color="#3363AD" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#3363AD' }}>
          {t('splash.egenzura.title') || t('splash.weltel.title') || 'eGenzura'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {webUri ? (
          <WebView
            source={{ uri: webUri }}
            style={{ flex: 1 }}
            onLoadStart={() => setIsLoading(true)}
            onLoad={() => stopLoading()}
            onLoadEnd={() => stopLoading()}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 0.9) {
                stopLoading();
              }
            }}
            onError={(event) => {
              setError(
                event.nativeEvent.description ||
                  t('egenzura.error.loadFailed') ||
                  'Failed to load eGenzura',
              );
              stopLoading();
            }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            useWebKit={true}
          />
        ) : null}
      </View>

      {isLoading && webUri && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <LoadingSpinner variant="inline" message="" />
        </View>
      )}

      {error && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom,
            left: 0,
            right: 0,
            padding: 12,
            backgroundColor: '#ef4444',
          }}
        >
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
