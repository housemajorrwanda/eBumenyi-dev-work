import { useEffect, useCallback, useRef } from 'react';
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

export default function UpdateManager() {
  const isCheckingRef = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    try {
      console.log('🔍 UpdateManager: Checking for updates...');
      console.log('📱 Channel:', Updates.channel);
      console.log('📊 Runtime Version:', Updates.runtimeVersion);

      const update = await Updates.checkForUpdateAsync();
      console.log('📦 Update available?', update.isAvailable);

      if (!update.isAvailable) {
        console.log('✅ App is up to date');
        return;
      }

      console.log('📥 Downloading update...');
      const fetchResult = await Updates.fetchUpdateAsync();

      if (!fetchResult.isNew) {
        console.log('ℹ️ No new update bundle to apply');
        return;
      }

      console.log('✅ Update downloaded — reloading on next foreground');
      // Reload only after a short delay so splash / auth can finish first.
      setTimeout(() => {
        Updates.reloadAsync().catch((err) => {
          console.log('❌ Update reload failed (app keeps running):', err);
        });
      }, 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('❌ Update check failed (app keeps running):', message);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const handleAppStateChange = useCallback(
    (nextAppState: string) => {
      if (nextAppState === 'active') {
        setTimeout(checkForUpdates, 2000);
      }
    },
    [checkForUpdates],
  );

  useEffect(() => {
    // Delay first check so cold start is never blocked by OTA.
    const startupTimer = setTimeout(checkForUpdates, 8000);
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearTimeout(startupTimer);
      subscription.remove();
    };
  }, [checkForUpdates, handleAppStateChange]);

  return null;
}
