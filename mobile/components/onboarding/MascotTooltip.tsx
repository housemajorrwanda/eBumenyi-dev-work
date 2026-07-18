import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type TooltipProps, useCopilot } from 'react-native-copilot';
import { ChevronRight } from 'lucide-react-native';
import CHWCharacter from './CHWCharacter';

// Horizontal margin the copilot library itself reserves around the tooltip
// (MARGIN = 13 on each side, per react-native-copilot's CopilotModal default).
const LIBRARY_MARGIN = 13;

// Minimum breathing room to keep between the tooltip and the top/bottom screen
// edges, on top of the device's safe-area insets.
const EDGE_MARGIN = 12;

// Extra props our patch (patches/react-native-copilot+3.3.3.patch) makes
// CopilotModal pass down: the top/bottom it computed for the OUTER tooltip
// wrapper (before it knows our content's real height), and the full-screen
// layout it measured everything against. We use these to work out, from our
// own actual rendered height, whether the library's guess would clip us —
// and if so, correct it analytically before the tooltip is ever shown.
type Props = TooltipProps & {
  tooltipStyles?: { top?: number; bottom?: number; left?: number; right?: number; maxWidth?: number };
  screenLayout?: { width: number; height: number };
};

// The pointer triangle is drawn by the copilot library itself (styles.arrow /
// arrowStyles in CopilotModal), computed from the real target rect — not by
// this component. A custom pointer here would just be a fixed decoration
// that can't actually track the target's position.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MascotTooltip({ labels, tooltipStyles, screenLayout }: Props) {
  const { currentStep, isFirstStep, isLastStep, currentStepNumber, stop, goToNext } = useCopilot();
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The library clamps the tooltip's own width to roughly `width - LIBRARY_MARGIN * 2`
  // depending on which side of the target it anchors to. Keep our own width at or
  // under that so we never ask for more room than the library will actually give us.
  //
  // This must be a fixed `width`, not `minWidth`/`maxWidth` — with only min/max
  // bounds and no definite width, this row (a fixed-size avatar next to a
  // `flex: 1` text column with wrapping enabled) has no fixed width to
  // distribute, so Yoga sizes it to the content's minimum wrap width instead
  // of filling the available space. That collapsed the bubble down to a
  // narrow column with text wrapping after every word or two, inconsistently
  // depending on which step/target it happened to render against.
  const isSmallScreen = width < 360;
  // tooltipStyles.maxWidth is the library's own computed horizontal room for
  // THIS target's anchor position (see the patch in
  // patches/react-native-copilot+3.3.3.patch) — a target sitting near a
  // screen edge has less room than the generic width-minus-margins guess
  // below assumes, and ignoring it is what let the profile-photo step's
  // bubble render past the right edge, cut off.
  const bubbleWidth = Math.min(
    320,
    width - LIBRARY_MARGIN * 2 - 24,
    tooltipStyles?.maxWidth ?? Infinity,
  );
  const fontSize = isSmallScreen ? 13 : 14;
  // The character competes for horizontal space with the text column now
  // (it used to sit above the bubble, where width wasn't a constraint), so
  // it's sized down from its original stacked-layout dimensions (up to 110).
  const avatarSize = isSmallScreen ? 52 : 68;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  // Vertical correction applied on top of the library's guessed position, so
  // the tooltip's actual rendered height never pushes it off-screen. Computed
  // once per step, from a real measure() reading, before the tooltip is
  // revealed — so there's no visible jump or flash.
  const shiftY = useSharedValue(0);
  // One-shot flourish: a nudge on the Next chevron every time the step
  // changes. (The character's own idle bob and first-step wave — see its
  // `wave` prop below — run independently, inside CHWCharacter itself.)
  const chevronX = useSharedValue(0);
  const skipScale = useSharedValue(1);
  const nextScale = useSharedValue(1);
  // Continuous "breathing" pulse on the Next button, so it draws the eye
  // without requiring a tap first. Runs for as long as the tooltip exists —
  // started once below, independent of step changes/measurement.
  const nextIdlePulse = useSharedValue(1);

  // react-native-reanimated's Animated.View forwards its ref to the underlying
  // host view, which still exposes the imperative `measure` method.
  const containerRef = useRef<Animated.View & { measure: (callback: (x: number, y: number, width: number, height: number) => void) => void }>(null);

  // Idle pulse starts once and runs for the component's whole lifetime —
  // unrelated to step changes/measurement, so it's a separate effect.
  useEffect(() => {
    nextIdlePulse.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [nextIdlePulse]);

  useEffect(() => {
    shiftY.value = 0;
    opacity.value = 0;
    scale.value = 0.92;
    chevronX.value = 0;

    const screenHeight = screenLayout?.height ?? windowHeight;
    const safeTop = insets.top + EDGE_MARGIN;
    const safeBottom = screenHeight - insets.bottom - EDGE_MARGIN;

    const reveal = (contentHeight: number) => {
      let shift = 0;
      if (typeof tooltipStyles?.top === 'number') {
        // Tooltip is anchored below the target: [top, top + contentHeight].
        const bottomEdge = tooltipStyles.top + contentHeight;
        if (bottomEdge > safeBottom) {
          shift = safeBottom - bottomEdge;
        }
        // Don't let the correction push the top edge above the safe zone.
        shift = Math.max(shift, safeTop - tooltipStyles.top);
      } else if (typeof tooltipStyles?.bottom === 'number') {
        // Tooltip is anchored above the target: [screenHeight - bottom - contentHeight, screenHeight - bottom].
        const topEdge = screenHeight - tooltipStyles.bottom - contentHeight;
        if (topEdge < safeTop) {
          shift = safeTop - topEdge;
        }
        // Don't let the correction push the bottom edge past the safe zone.
        shift = Math.min(shift, safeBottom - (screenHeight - tooltipStyles.bottom));
      }

      shiftY.value = shift;

      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 14, stiffness: 180 });
      chevronX.value = withSequence(
        withTiming(4, { duration: 180 }),
        withTiming(0, { duration: 180 }),
      );
    };

    // Poll via measure() (imperative, not tied to a single onLayout event)
    // until we get a STABLE height. A single reading isn't enough: native
    // text measurement/wrapping and the button row can settle a frame or two
    // later on Android, so a one-shot check risks computing a correction from
    // a height smaller than the real, final one — which looks identical to
    // "no correction applied". Requiring several consecutive matching
    // readings before accepting closes that gap. The copilot library itself
    // has to retry up to 120 times for a related (zero-height) reason when
    // measuring step targets.
    let cancelled = false;
    let tries = 0;
    let lastH = -1;
    let stableFrames = 0;
    const MAX_TRIES = 90;
    const STABLE_FRAMES_REQUIRED = 3; // consecutive rAF callbacks with ~same height
    const STABLE_EPSILON = 2; // px tolerance between frames
    const MEASUREMENT_SAFETY_MARGIN = 16; // cheap insurance against residual under-measurement
    const attempt = () => {
      if (cancelled) return;
      containerRef.current?.measure((_x, _y, _w, h) => {
        if (cancelled) return;
        tries += 1;

        const matchesPrev = Math.abs(h - lastH) <= STABLE_EPSILON;
        stableFrames = h >= 20 && matchesPrev ? stableFrames + 1 : h >= 20 ? 1 : 0;
        lastH = h;

        const settled = stableFrames >= STABLE_FRAMES_REQUIRED;
        const exhausted = tries >= MAX_TRIES;
        if (!settled && !exhausted) {
          requestAnimationFrame(attempt);
          return;
        }
        if (__DEV__ && exhausted && !settled) {
          console.warn('[MascotTooltip] gave up waiting for a stable height reading', { tries, lastH });
        }
        reveal(h + MEASUREMENT_SAFETY_MARGIN);
      });
    };
    requestAnimationFrame(attempt);

    return () => { cancelled = true; };
    // currentStepNumber changes synchronously when the step advances, but the
    // library only computes tooltipStyles/screenLayout for the NEW target
    // afterward (setCurrentStep -> setTimeout -> step.measure() ->
    // animateMove(), see CopilotProvider's setCurrentStep). So on step change
    // this effect first runs with stale tooltipStyles from the previous step,
    // then must re-run again once the real values for the new step arrive —
    // otherwise the correction (and the whole tooltip) stays aimed at where
    // the previous target was instead of the current one.
  }, [
    currentStepNumber,
    tooltipStyles?.top,
    tooltipStyles?.bottom,
    screenLayout?.height,
    insets.top,
    insets.bottom,
    windowHeight,
    shiftY,
    opacity,
    scale,
    chevronX,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: shiftY.value }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chevronX.value }],
  }));

  const skipPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: skipScale.value }],
  }));

  // Idle pulse and press-scale are independent shared values, combined
  // multiplicatively so a tap still reads as a distinct, immediate response
  // layered on top of the continuous ambient pulse rather than fighting it.
  const nextPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value * nextIdlePulse.value }],
  }));

  return (
    <Animated.View
      ref={containerRef}
      style={[
        styles.bubble,
        { width: bubbleWidth },
        containerStyle,
      ]}
    >
      <CHWCharacter wave={isFirstStep} size={avatarSize} />

      <View style={styles.content}>
        <Text style={[styles.text, { fontSize }]}>{currentStep?.text}</Text>

        <View style={styles.actions}>
          {/* Skip — ghost style, always visible */}
          <AnimatedPressable
            onPress={stop}
            onPressIn={() => { skipScale.value = withSpring(0.94, { damping: 15, stiffness: 300 }); }}
            onPressOut={() => { skipScale.value = withSpring(1, { damping: 12, stiffness: 220 }); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={skipPressStyle}
          >
            <Text style={styles.skipText}>{labels?.skip ?? 'Simbuka'}</Text>
          </AnimatedPressable>

          {/* Next / Finish */}
          <AnimatedPressable
            onPress={isLastStep ? stop : goToNext}
            onPressIn={() => { nextScale.value = withSpring(0.94, { damping: 15, stiffness: 300 }); }}
            onPressOut={() => { nextScale.value = withSpring(1, { damping: 12, stiffness: 220 }); }}
            style={[styles.nextButton, nextPressStyle]}
          >
            <Text style={styles.nextText}>
              {isLastStep
                ? (labels?.finish ?? 'Kurangiza')
                : (labels?.next ?? 'Ibikurikiraho')}
            </Text>
            {!isLastStep && (
              <Animated.View style={chevronStyle}>
                <ChevronRight size={14} color="#ffffff" />
              </Animated.View>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 16,
    paddingLeft: 8,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flex: 1,
  },
  text: {
    color: '#1E293B',
    lineHeight: 21,
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  skipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#3363AD',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexShrink: 1,
  },
  nextText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
});
