import React from 'react';
import { View, TouchableOpacity, Alert, Text } from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractMeetingId } from '@/utils/deepLinking';
import { MEETING_BASE_URL } from '@/config/constants';

export default function MeetingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [authInjection, setAuthInjection] = React.useState<string>('true;');

  // Load token + user from AsyncStorage and build the JS to inject into the WebView
  // so chw-meeting's AuthContext finds the session and skips the guest name form.
  React.useEffect(() => {
    (async () => {
      try {
        const [token, userData] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('userData'),
        ]);
        if (token && userData) {
          const user = JSON.parse(userData);
          const authUser = JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.fullNames,
            role: user.userRoles?.[0]?.name ?? 'USER',
            avatar: user.photo ?? undefined,
          });
          const escapedToken = JSON.stringify(token);
          const escapedUser = JSON.stringify(authUser);
          setAuthInjection(`
            try {
              // Auth — localStorage read by AuthContext, cookie read by tokenProvider server action
              localStorage.setItem('accessToken', ${escapedToken});
              localStorage.setItem('auth_user', ${escapedUser});
              var maxAge = 60 * 60 * 24;
              document.cookie = 'accessToken=' + ${escapedToken} + '; path=/; max-age=' + maxAge + '; SameSite=Lax';

              // navigator.mediaDevices is only available in secure contexts (HTTPS/localhost).
              // On HTTP (local dev over IP), shim it so Stream SDK doesn't crash before
              // showing a user-friendly error message.
              if (!navigator.mediaDevices) {
                try {
                  Object.defineProperty(navigator, 'mediaDevices', {
                    value: {
                      addEventListener: function() {},
                      removeEventListener: function() {},
                      dispatchEvent: function() { return false; },
                      getUserMedia: function() { return Promise.reject(new DOMException('NotSupportedError')); },
                      enumerateDevices: function() { return Promise.resolve([]); },
                      getSupportedConstraints: function() { return {}; },
                      ondevicechange: null
                    },
                    configurable: true,
                    writable: true
                  });
                } catch(shimErr) {}
              }
            } catch(e) {}
            true;
          `);
        }
      } catch (_) {}
    })();
  }, []);

  // Always rebuild meeting URL from the meeting ID using the current env's base URL.
  // This normalizes localhost / old IPs / production domains stored in the DB.
  const meetingUrl = React.useMemo(() => {
    const meetingId = typeof params.meetingId === 'string' ? params.meetingId : null;
    const fullUrl = typeof params.fullUrl === 'string' ? params.fullUrl : null;

    // Prefer explicit meetingId param (set by calendar/[id].tsx router.push)
    if (meetingId) {
      return `${MEETING_BASE_URL}/meeting/${meetingId}`;
    }

    // Fallback: extract ID from any stored URL regardless of host
    if (fullUrl) {
      const id = extractMeetingId(fullUrl);
      if (id) return `${MEETING_BASE_URL}/meeting/${id}`;
    }

    return null;
  }, [params.meetingId, params.fullUrl]);

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = (error: any) => {
    setError(error.nativeEvent.description || 'Failed to load meeting');
    setIsLoading(false);
  };

  const handleCloseMeeting = () => {
    Alert.alert(
      'Sohoka mu nama',
      'Urumva neza ko ushaka kwiva mu nama',
      [
        {
          text: 'Oya',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Sohoka',
          onPress: () => router.back(),
          style: 'destructive',
        },
      ]
    );
  };

  if (!meetingUrl) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header Bar with Close Button - Always visible */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 4,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
      </View>

      {/* WebView Container */}
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {meetingUrl && (
          <WebView
            source={{ uri: meetingUrl }}
            style={{ flex: 1 }}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            startInLoadingState={true}
            injectedJavaScriptBeforeContentLoaded={authInjection}
            renderLoading={() => (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <LoadingSpinner variant="inline" message="" />
              </View>
            )}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo={true}
            useWebKit={true}
            // Allow accessing microphone and camera
            onShouldStartLoadWithRequest={() => true}
          />
        )}
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          <LoadingSpinner variant="inline" message="" />
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom,
            left: 0,
            right: 0,
            padding: 16,
            backgroundColor: '#ff6b6b',
          }}
        >
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={{ color: '#fff', textAlign: 'center', fontSize: 14 }}>
              {error}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}