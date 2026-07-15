import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle, StyleProp } from 'react-native';

type LoadingSpinnerProps = {
  message?: string;
  isDark?: boolean;
  variant?: 'fullscreen' | 'inline';
  style?: StyleProp<ViewStyle>;
};

export function LoadingSpinner({
  message = 'Tegereza...',
  isDark = false,
  variant = 'fullscreen',
  style,
}: LoadingSpinnerProps) {
  const isInline = variant === 'inline';
  const wrapSize = isInline ? 36 : 64;
  const dotSize = isInline ? 12 : 20;
  const ringWidth = isInline ? 2 : 3;

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 450);
    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
    };
  }, [ring1, ring2]);

  const ringStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  });

  const showMessage = Boolean(message);

  return (
    <View
      style={[
        isInline ? styles.inlineContainer : styles.container,
        !isInline && isDark && styles.containerDark,
        style,
      ]}
    >
      <View style={[styles.spinnerWrap, { width: wrapSize, height: wrapSize }]}>
        <Animated.View
          style={[
            styles.ring,
            ringStyle(ring1),
            {
              width: wrapSize,
              height: wrapSize,
              borderRadius: wrapSize / 2,
              borderWidth: ringWidth,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            ringStyle(ring2),
            {
              width: wrapSize,
              height: wrapSize,
              borderRadius: wrapSize / 2,
              borderWidth: ringWidth,
            },
          ]}
        />
        <View
          style={[
            styles.innerDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />
      </View>
      {showMessage ? (
        <Text
          style={[
            styles.text,
            isInline && styles.inlineText,
            isDark && styles.textDark,
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const BRAND = '#3363AD';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  spinnerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderColor: BRAND,
  },
  innerDot: {
    backgroundColor: BRAND,
  },
  text: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '500',
    color: BRAND,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  inlineText: {
    marginTop: 8,
    fontSize: 13,
  },
  textDark: {
    color: '#93B4E6',
  },
});
