/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { BackHandler, AppState, Platform, DeviceEventEmitter } from 'react-native';
import { Stack, useNavigationContainerRef, useRouter } from 'expo-router';

import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { ModuleSwitcherProvider } from '@/contexts/ModuleSwitcherContext';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/utils/toast';
import { COURSE_WORKSPACE_QUERY_KEY, patchCourseProgressInCache } from '@/hooks/useCourseWorkspace';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import '../global.css';
import NoNetwork from './NoNetwork';
import {
  ExternalNotificationService,
  GlobalReminderService,
} from '@/services/calender';
import { NativeAlarmScheduler } from '@/services/NativeAlarmScheduler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateManager from '@/components/UpdateManager';
import { SocketService } from '@/services/socket.service';
import { NotificationListener } from '@/components/NotificationListener';
import { MessagingListener } from '@/components/MessagingListener';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { SimplifiedMessagingProvider } from '@/contexts/SimplifiedMessagingContext';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { AlarmProvider } from '@/contexts/AlarmContext';
import AlarmRingScreen from '@/components/AlarmRingScreen';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { AUTH_CHANGED_EVENT } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

// Set notification handler at module level so foreground notifications show AND are tappable
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Create a QueryClient with proper configuration ONCE
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Never mark as stale automatically
      gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
      refetchOnWindowFocus: false, // Don't refetch on focus
      refetchOnReconnect: 'always', // Always refetch when reconnected
      retry: 1, // Retry failed requests once
    },
  },
});

const NAVIGATION_STATE_KEY = 'navigation_state';

// Deep linking is handled automatically by expo-router

export default function RootLayout() {
  useFrameworkReady();

  const navigationRef = useNavigationContainerRef();
  const router = useRouter();
  const [appState, setAppState] = useState(AppState.currentState);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  /**
   * Navigate from a push notification data payload.
   * Uses router.push() for Expo Router compatibility.
   */
  const navigateFromNotificationData = useCallback(
    (data: Record<string, any>) => {
      console.log(
        '📱 [NAV] navigateFromNotificationData called with:',
        JSON.stringify(data)
      );

      const deepLink: string =
        data?.deepLink || data?.actionUrl || data?.url || '';

      if (!deepLink) {
        console.warn(
          '📱 [NAV] ❌ No deep link found in notification data:',
          data
        );
        return;
      }

      console.log('📱 [NAV] ✅ Deep link received:', deepLink);

      let route = '';

      // Certificate uses /certificate which has no ID segment, handle it before regex
      if (deepLink === '/certificate') {
        route = '/certificate';
      } else {
        // Parse format: /resource/id  (e.g. /chat/abc123, /course/xyz)
        const match = deepLink.match(/^\/([a-z_]+)\/(.+?)(?:\?|$)/i);
        if (!match) {
          console.warn('📱 [NAV] ❌ Could not parse deep link:', deepLink);
          return;
        }

        const [, resourceType, resourceId] = match;
        console.log(
          `📱 [NAV] ✅ Parsed: resourceType="${resourceType}", resourceId="${resourceId}"`
        );

        switch (resourceType.toLowerCase()) {
          case 'chat':
          case 'conversation':
            route = `/chat/${resourceId}`;
            break;
          case 'group':
            route = `/group/${resourceId}`;
            break;
          case 'community':
            route = `/community/${resourceId}`;
            break;
          case 'courses':
          case 'course':
            route = `/courses/${resourceId}/chapters`;
            break;
          case 'chapter':
            route = `/courses/${resourceId}`;
            break;
          case 'attempt':
            route = `/courses/${resourceId}`;
            break;
          case 'calendar':
          case 'event':
          case 'calendar_reminder':
            route = `/calendar/${resourceId}`;
            break;
          case 'announcement':
            route = `/announcements/${resourceId}`;
            break;
          default:
            console.warn(`📱 [NAV] ❌ Unknown resource type: ${resourceType}`);
            return;
        }
      }

      console.log(`📱 [NAV] ✅ Target route: ${route}`);
      console.log(
        `📱 [NAV] navigationRef.isReady(): ${navigationRef.isReady()}`
      );

      // Use router.push() for Expo Router compatibility
      if (navigationRef.isReady()) {
        console.log(`📱 [NAV] ✅ Navigating immediately to: ${route}`);
        try {
          router.push(route as any);
        } catch (err) {
          console.error(`📱 [NAV] ❌ Navigation error:`, err);
        }
      } else {
        console.log(`📱 [NAV] ⏳ navigationRef not ready, polling...`);
        let attempts = 0;
        // navigationRef not ready yet — wait and retry
        const interval = setInterval(() => {
          attempts++;
          console.log(
            `📱 [NAV] ⏳ Poll attempt ${attempts}/50, isReady: ${navigationRef.isReady()}`
          );
          if (navigationRef.isReady()) {
            clearInterval(interval);
            console.log(
              `📱 [NAV] ✅ navigationRef ready after ${attempts} attempts, navigating to: ${route}`
            );
            try {
              router.push(route as any);
            } catch (err) {
              console.error(`📱 [NAV] ❌ Navigation error:`, err);
            }
          }
        }, 100);
        // Give up after 5 seconds
        setTimeout(() => {
          clearInterval(interval);
          console.error(
            `📱 [NAV] ❌ Timeout: navigationRef never became ready after 5 seconds`
          );
        }, 5000);
      }
    },
    [navigationRef, router]
  );

  // Navigation state persistence functions
  const saveNavigationState = async () => {
    try {
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute();
        if (currentRoute) {
          const navigationState = {
            routeName: currentRoute.name,
            params: currentRoute.params,
            timestamp: Date.now(),
          };
          await AsyncStorage.setItem(
            NAVIGATION_STATE_KEY,
            JSON.stringify(navigationState)
          );
          console.log('Navigation state saved:', navigationState);
        }
      }
    } catch (error) {
      console.log('Error saving navigation state:', error);
    }
  };

  const restoreNavigationState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
      if (savedState) {
        const navigationState = JSON.parse(savedState);
        const timeDiff = Date.now() - (navigationState.timestamp || 0);

        // Only restore if saved within last 30 minutes to avoid stale navigation
        if (timeDiff < 30 * 60 * 1000) {
          console.log('Restoring navigation state:', navigationState);

          // Small delay to ensure navigation is ready
          setTimeout(() => {
            if (
              navigationState.routeName &&
              navigationState.routeName !== 'splash'
            ) {
              // Navigate to the saved route
              if (navigationState.params) {
                router.push({
                  pathname: `/${navigationState.routeName}`,
                  params: navigationState.params,
                });
              } else {
                router.push(`/${navigationState.routeName}`);
              }
            }
          }, 100);
        } else {
          // Clear stale navigation state
          await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
        }
      }
    } catch (error) {
      console.log('Error restoring navigation state:', error);
    }
  };

  // Initialize notification services
  useEffect(() => {
    if (fontsLoaded) {
      const initializeNotifications = async () => {
        // Set up external notifications (works when app closed)
        await ExternalNotificationService.setup();

        // Request notification permissions (required on iOS, good practice on Android 13+)
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          console.log('📱 [ROOT] Notification permission status:', status);
        }

        // Register push token with backend for FCM delivery
        try {
          // Get token regardless of permission status
          const tokenData = await Notifications.getDevicePushTokenAsync();
          const pushToken = tokenData.data; // Native FCM token on Android, APNs on iOS
          const accessToken = await AsyncStorage.getItem('accessToken');

          if (accessToken && pushToken) {
            const cleanToken = accessToken.replace(/^Bearer\s+/i, '');
            const { getApiBaseURL } = await import('@/config/api.config');

            await fetch(`${getApiBaseURL()}/notifications/push-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: cleanToken,
              },
              body: JSON.stringify({
                token: pushToken,
                platform: Platform.OS === 'ios' ? 'ios' : 'android',
              }),
            }).catch((err) =>
              console.log('Push token registration failed:', err)
            );

            console.log('✅ [ROOT] Push token registered with backend');
          }
        } catch (err) {
          console.log('Push token registration error:', err);
        }

        // Purge stale/past alarms from the JS registry and native storage on
        // every cold start — the AppState listener only fires on resume, not
        // on initial launch, so this covers the boot→open path.
        NativeAlarmScheduler.syncRegistry().catch(() => {});

        // Start in-app reminder checking (works when app open)
        GlobalReminderService.startReminderChecking();

        // Initialize Socket connection for all users (both new and existing)
        try {
          console.log('🔌 [ROOT] Attempting to initialize Socket...');
          const socket = await SocketService.initialize();
          await SocketService.initializeNamespaces();
          if (socket) {
            console.log('🔌 [ROOT] Socket initialization complete');
            SocketService.logStatus();
          } else {
            console.log(
              '🔌 [ROOT] Socket initialization skipped - user not authenticated yet'
            );

            // For existing users, try initializing socket with stored token
            const { initializeSocketForExistingUser } = await import(
              '@/services/auth'
            );
            const initialized = await initializeSocketForExistingUser();
            if (initialized) {
              console.log('🔌 [ROOT] Socket initialized for existing user');
              SocketService.logStatus();
            }
          }
        } catch (error) {
          console.log('🔌 [ROOT] Socket initialization error:', error);
        }
      };

      initializeNotifications();

      // ── Background / Foreground tap listener ──────────────────────────────────────
      const tapSubscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log('📱 [ROOT] Notification tapped (fg/bg)');
          const data = response.notification.request.content.data ?? {};
          // Alarm action buttons (dismiss/snooze) are handled inside AlarmProvider —
          // skip navigation here to avoid conflicts.
          if ((data as any)?.type === 'alarm') return;
          // Small delay for bg→fg app transition
          setTimeout(() => {
            navigateFromNotificationData(data as Record<string, any>);
          }, 300);
        });

      // ── Foreground received listener (update badge/state without navigating) ────────
      const receiveSubscription = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log(
            '📱 [ROOT] Notification received in foreground:',
            notification.request.content.title
          );
          // NotificationsContext handles state update via socket — no action needed here
        }
      );

      // Cleanup
      return () => {
        GlobalReminderService.stopReminderChecking();
        tapSubscription.remove();
        receiveSubscription.remove();
      };
    }
  }, [fontsLoaded, navigateFromNotificationData]);

  // ── Killed state: app opened by tapping a notification ──────────────────
  useEffect(() => {
    if (!fontsLoaded) return;

    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();

        // 🔍 DEBUG: Log the full response to see what we're getting
        console.log('📱 Last notification response:', JSON.stringify(response));

        // 🔍 DEBUG: Log FCM token to verify push setup
        try {
          const token = await Notifications.getDevicePushTokenAsync();
          console.log('📱 FCM Token:', token.data);
        } catch (tokenErr) {
          console.warn('📱 Could not get FCM token:', tokenErr);
        }

        if (response) {
          console.log(
            '📱 [ROOT] App opened from killed state via notification'
          );
          const data = response.notification.request.content.data ?? {};
          console.log('📱 [ROOT] Notification data:', JSON.stringify(data));

          // Wait longer for cold start — router and auth need time to initialize
          setTimeout(() => {
            navigateFromNotificationData(data as Record<string, any>);
          }, 1500);
        } else {
          console.log(
            '📱 [ROOT] No notification response found (normal app launch)'
          );
        }
      } catch (err) {
        console.warn('📱 [ROOT] getLastNotificationResponseAsync error:', err);
      }
    };

    checkInitialNotification();
  }, [fontsLoaded, navigateFromNotificationData]);

  // App state listener for navigation persistence + missed alarm detection
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (
          appState.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          console.log('App came to foreground');

          // ── Sync native alarm registry (remove stale entries) ──────────────
          NativeAlarmScheduler.syncRegistry().catch(() => {});

          // ── Refresh real-time data (courses + calendar) ────────────────────
          // Invalidate stale queries so they refetch if their screen is active,
          // or on next mount if the screen is not currently rendered.
          queryClient.invalidateQueries({ queryKey: ['ALL_COURSES'] });
          queryClient.invalidateQueries({ queryKey: ['CALENDAR_EVENTS'] });

          // If socket is already connected (wasn't disconnected during background),
          // re-request notifications so the notification watchers can fire.
          const socket = SocketService.getInstance();
          if (socket?.connected) {
            socket.emit('get_notifications');
          }
          // If socket was disconnected, it will reconnect automatically and
          // the handleConnect listener in NotificationsContext will emit get_notifications.

          // ── Navigation state restore (splash / auth screens only) ──────────
          try {
            const token = await AsyncStorage.getItem('accessToken');
            if (token && navigationRef.isReady()) {
              const currentRoute = navigationRef.getCurrentRoute();
              if (
                currentRoute &&
                (currentRoute.name === 'splash' ||
                  currentRoute.name?.includes('auth'))
              ) {
                restoreNavigationState();
              }
            }
          } catch (error) {
            console.log('Error checking token for navigation restore:', error);
          }
        } else if (
          appState === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          // App going to background - save navigation state
          console.log('App going to background');
          saveNavigationState();
        }
        setAppState(nextAppState);
      }
    );

    return () => {
      subscription.remove();
    };
  }, [appState, navigationRef]);

  // Listen for network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    // Never leave users stuck on the native splash if fonts fail to load.
    const safetyTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 8000);

    return () => clearTimeout(safetyTimer);
  }, [fontsLoaded]);

  // Global back handler: exit app only if no screens to go back to
  useEffect(() => {
    const onBackPress = () => {
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute();
        if (navigationRef.canGoBack()) {
          navigationRef.goBack();
          return true;
        } else if (currentRoute && currentRoute.name === 'splash') {
          BackHandler.exitApp();
          return true;
        }
      }
      // Let navigation handle it if not handled above
      return false;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, [navigationRef]);

  useEffect(() => {
    const invalidateAuthQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['USER_INFO'] });
      queryClient.invalidateQueries({ queryKey: ['COURSE'] });
      queryClient.invalidateQueries({ queryKey: [COURSE_WORKSPACE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['STUDENT_STATS'] });
    };

    const subscription = DeviceEventEmitter.addListener(
      AUTH_CHANGED_EVENT,
      invalidateAuthQueries,
    );

    const handleWebAuthChange = () => invalidateAuthQueries();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('auth-changed', handleWebAuthChange);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('auth-changed', handleWebAuthChange);
      }
    };
  }, []);

  useEffect(() => {
    let socket: ReturnType<typeof SocketService.getInstance> | null = null;

    const handleCourseProgressUpdated = (payload: {
      courseId: string;
      progress: number;
      isCompleted: boolean;
    }) => {
      if (!payload?.courseId) return;
      patchCourseProgressInCache(queryClient, payload.courseId, {
        progress: payload.progress,
        isCompleted: payload.isCompleted,
      });
    };

    const attach = async () => {
      await SocketService.initialize();
      socket = SocketService.getInstance();
      socket?.on('course_progress_updated', handleCourseProgressUpdated);
    };

    void attach();

    return () => {
      socket?.off('course_progress_updated', handleCourseProgressUpdated);
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  // Show NoNetwork screen if there is no internet connection
  if (isConnected === false) {
    return <NoNetwork />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UpdateManager />
        <QueryClientProvider client={queryClient}>
          <NotificationsProvider>
            <SimplifiedMessagingProvider>
              <AudioPlayerProvider>
                <ThemeProvider>
                  <LanguageProvider>
                    <OnboardingProvider>
                      <BackButtonProvider>
                        <ModuleSwitcherProvider>
                          <AlarmProvider>
                            <NotificationListener />
                            <MessagingListener />
                            <Stack screenOptions={{ headerShown: false }}>
                              <Stack.Screen name="splash" />
                              <Stack.Screen name="auth" />
                              <Stack.Screen name="(tabs)" />
                              <Stack.Screen name="chat/[id]" />
                              <Stack.Screen name="meeting/[meetingId]" />
                              <Stack.Screen name="egenzura" />
                              <Stack.Screen name="cemr" />
                              <Stack.Screen name="+not-found" />
                            </Stack>
                            <AlarmRingScreen />
                            <StatusBar style="auto" />
                            <Toast config={toastConfig} />
                          </AlarmProvider>
                        </ModuleSwitcherProvider>
                      </BackButtonProvider>
                    </OnboardingProvider>
                  </LanguageProvider>
                </ThemeProvider>
              </AudioPlayerProvider>
            </SimplifiedMessagingProvider>
          </NotificationsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
