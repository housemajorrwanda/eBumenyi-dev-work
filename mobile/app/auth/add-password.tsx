import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Button from '@/components/Button';
import TextField from '@/components/TextField';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
 
export default function AddPasswordScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

    const topSpacer = Dimensions.get('window').height * 0.18;
    const formOffset = topSpacer / 4;

  const handleSetPassword = async () => {
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

    // store a mock token to represent authenticated user
    try {
      await AsyncStorage.setItem('userToken', 'mock-token');
      router.push('/auth/level-category');
    } catch (err) {
      console.log('Error storing token', err);
      Alert.alert(t('error'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : themeColors.primary }] }>
       <LinearGradient
                 colors={isDark ? [themeColors.primary, '#1e1b4b'] : [themeColors.primary, themeColors.primary]}
                 style={[styles.header, { paddingTop: topSpacer }]}
               >
        <Text style={[styles.headerTitle, { fontFamily: 'Inter-Bold' }]}>{t('addPassword.title') || 'Set a password'}</Text>
        <Text style={[styles.headerSubtitle, { fontFamily: 'Inter-Regular' }]}>{t('addPassword.subtitle') || 'Choose a secure password for your account'}</Text>
       </LinearGradient>

      <View style={[styles.form, { marginTop: formOffset }]}>
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

        <Button title={t('button.continue') || 'Continue'} onPress={handleSetPassword} variant="secondary" style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 220, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, color: 'white', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
});