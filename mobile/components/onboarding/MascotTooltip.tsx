import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { type TooltipProps, useCopilot } from 'react-native-copilot';
import CHWCharacter from './CHWCharacter';

export default function MascotTooltip({ labels }: TooltipProps) {
  const { currentStep, isFirstStep, isLastStep, currentStepNumber, stop, goToNext } = useCopilot();

  const bounceY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  // Bounce + fade-in whenever the step changes
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
    bounceY.value = withSequence(
      withSpring(-10, { damping: 6, stiffness: 200 }),
      withSpring(0, { damping: 8, stiffness: 140 }),
    );
  }, [currentStepNumber]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Mascot positioned above / overlapping the bubble */}
      <Animated.View style={[styles.mascotWrapper, mascotStyle]}>
        <CHWCharacter wave={isFirstStep} size={90} />
      </Animated.View>

      {/* Speech bubble */}
      <View style={styles.bubble}>
        {/* Bubble pointer (triangle) */}
        <View style={styles.bubblePointer} />

        <Text style={styles.text}>{currentStep?.text}</Text>

        <View style={styles.actions}>
          {/* Skip — ghost style, always visible */}
          <TouchableOpacity onPress={stop} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>{labels?.skip ?? 'Simbura'}</Text>
          </TouchableOpacity>

          {/* Next / Finish */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={isLastStep ? stop : goToNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>
              {isLastStep
                ? (labels?.finish ?? 'Tangira!')
                : (labels?.next ?? 'Ibikurikiraho')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    maxWidth: 300,
  },
  mascotWrapper: {
    zIndex: 10,
    marginBottom: -16,
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  bubble: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    paddingTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 240,
    maxWidth: 300,
  },
  bubblePointer: {
    position: 'absolute',
    top: -10,
    left: 32,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
  },
  text: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 21,
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
  },
  nextButton: {
    backgroundColor: '#3363AD',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  nextText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
});
