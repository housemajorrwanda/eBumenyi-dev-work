import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

interface CHWCharacterProps {
  wave?: boolean;
  jump?: boolean;
  size?: number;
}

export default function CHWCharacter({ wave = false, jump = false, size = 160 }: CHWCharacterProps) {
  const bobY = useSharedValue(0);
  const armAngle = useSharedValue(0);
  const jumpY = useSharedValue(0);

  useEffect(() => {
    if (!jump) {
      bobY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
  }, [jump]);

  useEffect(() => {
    if (wave) {
      armAngle.value = withRepeat(
        withSequence(
          withTiming(30, { duration: 350 }),
          withTiming(-5, { duration: 350 }),
        ),
        4,
        false,
      );
    } else {
      armAngle.value = withTiming(0, { duration: 200 });
    }
  }, [wave]);

  useEffect(() => {
    if (jump) {
      bobY.value = 0;
      jumpY.value = withRepeat(
        withSequence(
          withSpring(-22, { damping: 6, stiffness: 180 }),
          withSpring(0, { damping: 8, stiffness: 120 }),
        ),
        3,
        false,
      );
    } else {
      jumpY.value = withSpring(0);
    }
  }, [jump]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bobY.value + jumpY.value }],
  }));

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[bodyStyle, { width: size, height: size }]}>
        {/* Main character SVG (body without right arm) */}
        <Svg width={size} height={size} viewBox="0 0 160 160">
          {/* Health vest / body */}
          <Rect x="52" y="78" width="56" height="48" rx="8" fill="#3363AD" />
          {/* White cross on vest */}
          <Rect x="75" y="86" width="10" height="28" rx="2" fill="white" />
          <Rect x="64" y="96" width="32" height="10" rx="2" fill="white" />

          {/* Neck */}
          <Rect x="72" y="68" width="16" height="14" rx="4" fill="#F5C89A" />

          {/* Head */}
          <Circle cx="80" cy="55" r="22" fill="#F5C89A" />
          {/* Hair */}
          <Ellipse cx="80" cy="34" rx="22" ry="10" fill="#2C1810" />
          <Path d="M58 48 Q80 30 102 48" fill="#2C1810" />

          {/* Eyes */}
          <Circle cx="72" cy="54" r="3.5" fill="#2C1810" />
          <Circle cx="88" cy="54" r="3.5" fill="#2C1810" />
          <Circle cx="73.5" cy="52.5" r="1.2" fill="white" />
          <Circle cx="89.5" cy="52.5" r="1.2" fill="white" />

          {/* Smile */}
          <Path d="M72 62 Q80 70 88 62" stroke="#2C1810" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Left arm (static) */}
          <Rect x="36" y="80" width="18" height="10" rx="5" fill="#3363AD" />
          <Rect x="28" y="86" width="14" height="8" rx="4" fill="#F5C89A" />

          {/* Legs */}
          <Rect x="60" y="122" width="16" height="22" rx="6" fill="#2C3E50" />
          <Rect x="84" y="122" width="16" height="22" rx="6" fill="#2C3E50" />
          <Ellipse cx="68" cy="144" rx="10" ry="5" fill="#1A252F" />
          <Ellipse cx="92" cy="144" rx="10" ry="5" fill="#1A252F" />
        </Svg>

        {/* Right arm — separately animated for wave, anchored at shoulder */}
        <Animated.View
          style={[
            armStyle,
            {
              position: 'absolute',
              // Position arm at right shoulder; rotate around shoulder origin
              top: (size * 80) / 160,
              left: (size * 106) / 160,
              width: (size * 36) / 160,
              height: (size * 20) / 160,
              transformOrigin: '0 50%',
            },
          ]}
        >
          <Svg
            width={(size * 36) / 160}
            height={(size * 20) / 160}
            viewBox="0 0 36 20"
          >
            <Rect x="0" y="4" width="20" height="10" rx="5" fill="#3363AD" />
            <Rect x="16" y="0" width="14" height="10" rx="5" fill="#F5C89A" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
