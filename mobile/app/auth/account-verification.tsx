import { View, Text, TextInput, ScrollView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyLogin } from '@/services/auth';
import { handleResponse } from '@/utils/responseHandler';
import * as Clipboard from 'expo-clipboard';

export default function OTPVerificationScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [, setLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);
  const inputRefs = useRef<any[]>([]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    if (otp.every((d) => d.length === 1)) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // Aggressive autofill: poll clipboard for a 6-digit code for a short time and fill inputs
  useEffect(() => {
    let attempts = 0;
    let stopped = false;

    // Clear any previously filled OTP when screen mounts to avoid stale values
    setOtp(['', '', '', '', '', '']);

    const tryReadClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text) return false;

        // Avoid reusing same clipboard OTP we've already consumed
        try {
          const lastOtp = await AsyncStorage.getItem('lastOtpValue');
          if (lastOtp && lastOtp === text) {
            return false;
          }
        } catch {
          // ignore storage errors
        }

        const m = text.match(/\b(\d{6})\b/);
        if (m && m[1]) {
          const code = m[1];
          setOtp(code.split(''));

          // store and clear clipboard to avoid reuse
          try {
            await AsyncStorage.setItem('lastOtpValue', code);
            await AsyncStorage.setItem('lastOtpTime', new Date().toISOString());
          } catch {
            // ignore storage errors
          }
          try {
            await Clipboard.setStringAsync('');
          } catch {
            // ignore
          }

          stopped = true;
          return true;
        }
      } catch {
        // ignore clipboard errors
      }
      return false;
    };

    // initial immediate check
    (async () => {
      const found = await tryReadClipboard();
      if (found) return;
    })();

    const interval = setInterval(async () => {
      if (stopped) return;
      attempts += 1;
      await tryReadClipboard();
      if (attempts >= 8) {
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (otpError) setOtpError(undefined);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length === 6) {
      setLoading(true);
      try {
          // mark phone as verified and navigate to app
          // phone should already be stored during login; ensure it's present
          const stored = await AsyncStorage.getItem('userPhone');
          if (!stored) {
            return;
          }
          // call verify API
          const res = await verifyLogin(otpCode, stored);
          const ok = handleResponse({ response: res });
          if (ok) {
            // verified, navigate to splash-auth
            router.push('/auth/splash-auth');

            // clear stored lastOtp to avoid reuse
            try {
              await AsyncStorage.removeItem('lastOtpValue');
              await AsyncStorage.removeItem('lastOtpTime');
            } catch {
              // ignore
            }
          }
          // persist phone anyway
          await AsyncStorage.setItem('userPhone', stored);
      } catch (err) {
        handleResponse({ response: err })
        // Let the user retry the code in place instead of bouncing them
        // back to login over a simple mistyped digit.
        setOtpError(t('otp.invalid') || 'Invalid code');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } finally {
        setLoading(false);
      }
    }
  };


  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} style={{ flex: 1, backgroundColor: isDark ? '#111827' : themeColors.primary }} keyboardShouldPersistTaps="handled">
      <LinearGradient
        colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
        style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Inter-Bold', marginBottom: 12, textAlign: 'center' }}>{t('otp.title')}</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>{t('otp.subtitle')}</Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 2, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: otpError ? 8 : 40 }}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref ?? undefined; }}
              style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 2, fontSize: 18, textAlign: 'center', backgroundColor: isDark ? '#1f2937' : '#f9fafb', borderColor: otpError ? '#ef4444' : (digit ? themeColors.primary : (isDark ? '#374151' : '#d1d5db')), color: isDark ? '#ffffff' : '#111827', fontFamily: 'Inter-SemiBold' }}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleOtpKeyPress(e, index)}
              onFocus={async () => {
                try {
                  const text = await Clipboard.getStringAsync();
                  const m = text?.match(/\b(\d{6})\b/);
                  if (m && m[1]) setOtp(m[1].split(''));
                } catch (e) {
                   console.log(e)
                }
              }}
              maxLength={1}
              keyboardType="numeric"
              textAlign="center"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              importantForAutofill="yes"
              autoFocus={index === 0}
            />
          ))}
        </View>
        {otpError ? (
          <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>{otpError}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
