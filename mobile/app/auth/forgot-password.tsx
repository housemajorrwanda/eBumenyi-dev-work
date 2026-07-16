import { View, Text, Alert, ScrollView, Dimensions } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import TextField from '@/components/TextField';
import { Mail } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);

  const topSpacer = Dimensions.get('window').height * 0.20;
const formOffset = topSpacer / 4;
  const title = t('emailVerification.forgotTitle');
  const handleVerify = () => {
    setEmailError(undefined);
    if (!email) {
      setEmailError(t('emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('invalidEmail'));
      return;
    }

    router.push('/auth/email-verification');
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: isDark ? '#111827' : themeColors.primary }} keyboardShouldPersistTaps="handled">
      <LinearGradient
        colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
        style={{ height: 200, justifyContent: 'center', alignItems: 'center', paddingTop: topSpacer }}
      >
        <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Inter-Bold', marginBottom: 12, textAlign: 'center' }}>{title}</Text>
      </LinearGradient>

      <View style={[{ flex: 1, paddingHorizontal: 20, paddingTop: 30, marginTop: formOffset }]}>
        <TextField
          label={t('email')}
          value={email}
          onChangeText={(v) => { setEmail(v); setEmailError(undefined); }}
          placeholder={t('email.placeHolder')}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Mail color={themeColors.primary ?? '#3363AD'} size={20} />}
          error={emailError}
        />

        <Button
          title={t('button.verify')}
          onPress={handleVerify}
          variant="secondary"
          style={{ marginTop: 10 }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <Text style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#d1d5db', fontFamily: 'Inter-Regular' }}>{t('emailVerification.forgotSubtitle')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}