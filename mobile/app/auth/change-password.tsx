import { View, Text, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import TextField from '@/components/TextField';
import { Lock } from 'lucide-react-native';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

  const topSpacer = Dimensions.get('window').height * 0.20;
const formOffset = topSpacer / 4;
  const handleChange = () => {
    setPasswordError(undefined);
    setConfirmError(undefined);
    if (!password || !confirm) {
      if (!password) setPasswordError(t('newPasswordRequired'));
      if (!confirm) setConfirmError(t('confirmPasswordRequired'));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t('profile.passwordMismatch'));
      return;
    }
    // password changed - go to app
   router.push ('/auth/level-category');
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: isDark ? '#111827' : themeColors.primary }} keyboardShouldPersistTaps="handled">
      <LinearGradient
        colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
        style={{ height: 200, justifyContent: 'center', alignItems: 'center', paddingTop: topSpacer }}
      >
        <Text style={{ fontSize: 20, color: 'white', fontFamily: 'Inter-Bold', marginBottom: 12, textAlign: 'center' }}>{t('changePassword.title')}</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>{t('changePassword.subtitle')}</Text>
      </LinearGradient>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 30,  marginTop: formOffset }}>
        <TextField
          label={t('changePassword.newPassword')}
          value={password}
          onChangeText={(v) => { setPassword(v); setPasswordError(undefined); }}
          placeholder={t('changePassword.newPassword')}
          secureTextEntry
          icon={<Lock color={isDark ? '#d1d5db' : themeColors.primary70} size={20} />}
          error={passwordError}
        />

        <TextField
          label={t('changePassword.confirmPassword')}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setConfirmError(undefined); }}
          placeholder={t('changePassword.confirmPassword')}
          secureTextEntry
           icon={<Lock color={isDark ? '#d1d5db' : themeColors.primary70} size={20} />}
          error={confirmError}
        />

        <Button
          title={t('changePassword.title')}
          onPress={handleChange}
          variant="secondary"
        />

      </View>
    </ScrollView>
  );
}
