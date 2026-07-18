import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts } from '@/theme';
import { Eye, EyeOff } from 'lucide-react-native';

type Props = {
  label?: string;
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon?: React.ReactNode;
  /** if true the field is invalid; if string provided it will be shown below the field */
  error?: boolean | string;
  editable?: boolean;
  labelColor?: string;
};

export default function TextField({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default', autoCapitalize = 'none', icon, error, editable = true, labelColor }: Props) {
  const { isDark, themeColors } = useTheme();
  const [currentKeyboard, setCurrentKeyboard] = useState<KeyboardTypeOptions>(keyboardType);
  const [manualOverride, setManualOverride] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const handleChange = (val: string) => {
    // For password fields we should NOT auto-switch the keyboard based on
    // the first character (e.g., switching to numeric). Just forward the
    // value to the parent and keep the current keyboard state.
    if (secureTextEntry) {
      onChangeText(val);
      return;
    }
    // if user hasn't manually overridden, auto-detect first character
    if (!manualOverride) {
      if (val && val.length > 0 && /^\d/.test(val)) {
        if (currentKeyboard !== 'numeric') setCurrentKeyboard('numeric');
      } else {
        if (currentKeyboard !== 'default') setCurrentKeyboard('default');
      }
    } else {
      // when manually overridden, keep manual until input is cleared
      if (!val || val.length === 0) {
        setManualOverride(false);
        setCurrentKeyboard('default');
      }
    }

    onChangeText(val);
  };

  const toggleKeyboard = () => {
    const next = currentKeyboard === 'numeric' ? 'default' : 'numeric';
    setManualOverride(true);
    setCurrentKeyboard(next);
    // refocus so the keyboard update takes effect
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const toggleShowPassword = () => {
    // Toggle visibility only. Do NOT refocus the input — refocusing can cause
    // the keyboard to switch (especially on Android). Let the input retain
    // its current focus/keyboard state.
    setShowPassword((s) => !s);
  };

  // safe theme tokens (fallbacks to keep runtime stable)
  const tColors: any = themeColors || {};
  const placeholderColor = isDark ? '#6b7280' : tColors.primary70 ;
  const selColor = tColors.primary ?? '#3363AD';
  const bg = tColors.cardBg ?? (isDark ? '#111827' : '#ffffff');
  const border = tColors.cardSubtitle ?? tColors.neutral60 ?? (isDark ? '#374151' : '#d1d5db');
  const errorColor = tColors.error ?? '#ef4444';
  const effectiveBorder = error ? errorColor : border;
  const txtColor = tColors.cardText ?? (isDark ? '#ffffff' : '#111827');

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: labelColor || (isDark ? '#d1d5db' : '#374151'), fontFamily: fonts.medium }]}>{label}</Text> : null}

      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          keyboardType={currentKeyboard}
          autoCapitalize={autoCapitalize}
          underlineColorAndroid="transparent"
          placeholderTextColor={placeholderColor}
          secureTextEntry={secureTextEntry && !showPassword}
          selectionColor={selColor}
          editable={editable}
          accessibilityState={{ invalid: !!error } as any}
          style={[styles.input, { backgroundColor: bg, borderColor: effectiveBorder, color: txtColor, fontFamily: fonts.regular, textDecorationLine: 'none' }]}
        />

        {icon ? <View style={styles.iconLeft}>{icon}</View> : null}

        <View style={styles.toggles}>
          {secureTextEntry ? (
            // For password fields, only show the eye toggle
            <TouchableOpacity
              onPress={toggleShowPassword}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            >
              {showPassword ? <EyeOff color={tColors.primary70 ?? '#6366f1'} size={18} /> : <Eye color={tColors.primary70 ?? '#6366f1'} size={18} />}
            </TouchableOpacity>
          ) : (
            // For other fields, show only the keyboard toggle
            <TouchableOpacity
              onPress={toggleKeyboard}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityLabel="Toggle keyboard type"
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            >
              {/* <Text style={{ color: tColors.primary70 ?? '#6366f1', fontFamily: fonts.semibold }}>{currentKeyboard === 'numeric' ? '123' : 'ABC'}</Text> */}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sibling of inputWrapper, not a child — a child here would grow
          inputWrapper's height and shift iconLeft's absolute centering
          (top:0, bottom:0, justifyContent:'center') down with it. */}
      {typeof error === 'string' && error.length ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  inputWrapper: { position: 'relative', width: '100%' },
  iconLeft: { position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 16, paddingRight: 10, paddingLeft: 40 },
  toggles: { position: 'absolute', right: 8, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 },
  iconButton: { marginLeft: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, width: 44, height: '100%' },
  errorText: { color: '#ef4444', marginTop: 6, fontSize: 12 },
});
