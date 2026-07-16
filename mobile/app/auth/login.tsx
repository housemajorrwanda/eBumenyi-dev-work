import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import {  Phone, IdCardIcon } from 'lucide-react-native';
import { assets } from '@/theme';
import TextField from '@/components/TextField';
import { loginWithIdAndPhone } from '@/services/auth';
import { handleResponse } from '@/utils/responseHandler';

export default function LoginScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [nid, setNid] = useState('');
  const [loading, setLoading] = useState(false);
  // field-level errors for inputs (match TextField error prop: string | boolean | undefined)
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [nidError, setNidError] = useState<string | undefined>(undefined);
  const topSpacer = Dimensions.get('window').height * 0.18;
  const formOffset = topSpacer / 4;

  const isValidRwandanPhone = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    const allowed = ['078', '079', '072', '073'];
    const validLocal = cleaned.length === 10 && allowed.some((p) => cleaned.startsWith(p));
    const validIntl = cleaned.length === 12 && allowed.some((p) => cleaned.startsWith('250' + p.slice(1)));
    return validLocal || validIntl;
  };

  const isValidNID = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    // expecting 16-digit national ID
    return cleaned.length === 16;
  };

  useEffect(() => {
    const checkStored = async () => {
      try {
        const stored = await AsyncStorage.getItem('accessToken');
        if (stored) {
          // If we have a phone stored, go straight to the app
          router.push('/auth/splash-auth');
        }
      } catch (err) {
       console.log(err)
      }
    };
    checkStored();
  }, [router]);

  const handleLogin = async () => {
    // clear previous field errors
    setPhoneError(undefined);
    setNidError(undefined);

    // Validate both fields up front so both errors show at once, rather
    // than bailing out on the first failing field and hiding the other.
    let hasError = false;

    if (!phone) {
      setPhoneError(t('phoneRequired'));
      hasError = true;
    } else if (!isValidRwandanPhone(phone)) {
      setPhoneError(t('invalidPhone'));
      hasError = true;
    }

    if (!nid) {
      setNidError(t('nidRequired'));
      hasError = true;
    } else if (!isValidNID(nid)) {
      setNidError('Irangamuntu igomba kuba imibare 16');
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, '');
      const cleanedNid = nid.replace(/\D/g, '');
      // store raw cleaned number (could be 250... or 0...)
      await AsyncStorage.setItem('userPhone', cleaned);
      await AsyncStorage.setItem('userNid', cleanedNid);

      // Call API to initiate login / send OTP
      const res = await loginWithIdAndPhone(cleanedNid, cleaned);
      const ok = handleResponse({ response: res });
      if (ok) {
        // clear errors on success
        setPhoneError(undefined);
        setNidError(undefined);
        // direct sign-in (no OTP) -> go to splash-auth
        router.push('/auth/splash-auth');
      }
    } catch (err: any) {
      handleResponse({ response: err?.response ?? err });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    router.push('/auth/signup');
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : themeColors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
          style={[styles.header, { paddingTop: topSpacer }]}
        >
          <Text style={[styles.headerTitle, { fontFamily: 'Inter-Bold' }]}>{t('login')}</Text>
          <Text style={[styles.headerSubtitle, { fontFamily: 'Inter-Regular' }]}>shyiramo amakuru ubazwa maze winjire</Text>
        </LinearGradient>

        <View style={[styles.form, { marginTop: formOffset }]}>
          <TextField
            label={t('signup.id')}
            value={nid}
            onChangeText={(v) => { setNid(v); setNidError(undefined); }}
            placeholder={t('signup.id')}
            labelColor="#d1d5db"
            icon={<IdCardIcon color={isDark ? '#d1d5db' : themeColors.primary70} size={20} />}
            error={nidError}
            keyboardType="numeric"
          />

          <TextField
            label={t('phone')}
            value={phone}
            onChangeText={(v) => { setPhone(v); setPhoneError(undefined); }}
            placeholder={t('phone')}
            labelColor="#d1d5db"
            icon={<Phone color={isDark ? '#d1d5db' : themeColors.primary70} size={20} />}
            keyboardType="numeric"
            error={phoneError}
          />

          <Button
            title={t('login')}
            onPress={handleLogin}
            variant="secondary"
            style={{ marginTop: 16 }}
            icon={<Image source={assets.loginIcon} style={{ width: 18, height: 18, tintColor: '#fff' }} />}
            loading={loading}
            disabled={loading}
          />

          <View style={styles.signupLink}>
            <Text style={[styles.signupText, { fontFamily: 'Inter-Regular', color: isDark ? '#d1d5db' : '#d1d5db', marginRight: 6 }]}>{t('dontHaveAccount')}</Text>
            <TouchableOpacity onPress={handleSignup} activeOpacity={0.7}>
              <Text style={{ color: isDark ? '#6366f1' : '#d1d5db', fontFamily: 'Inter-SemiBold', fontSize: 16 }}>{t('signup')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 220, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 32, color: 'white', marginBottom: 8 },
  headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  signupLink: { alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center' },
  signupText: { fontSize: 14 },
});