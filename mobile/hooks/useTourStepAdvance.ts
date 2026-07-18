import { useCallback } from 'react';
import { useCopilot } from 'react-native-copilot';

// react-native-copilot's useCopilot() throws if there's no CopilotProvider
// ancestor. Some components that use this hook (e.g. ChatInput) are shared
// across screens that mount a CopilotProvider and screens that don't — the
// useContext() call inside useCopilot() itself always runs unconditionally
// (satisfying the rules of hooks); only the subsequent manual throw is being
// suppressed here, once that call has already completed.
function useSafeCopilot() {
  try {
    return useCopilot();
  } catch {
    return null;
  }
}

// Wrap a target's real onPress handler so that, if the tour is currently
// showing THIS step, tapping through to the real action (enabled by the
// pointerEvents="box-none" patch on the tour overlay) also advances the
// tour — or ends it, on the last step — instead of leaving the tooltip
// floating over whatever the real action just changed.
//
// The same box-none patch that lets the CURRENT target be tapped also lets
// taps reach any OTHER already-registered tour target still on screen (nothing
// scopes the "hole" to just the active step) — e.g. tapping a step-2 button
// while step 3's tooltip is showing. When that happens this stops the tour
// outright rather than leaving a tooltip for an unrelated step floating over
// whatever the real tap just changed.
export function useTourStepAdvance(stepName: string) {
  const copilot = useSafeCopilot();
  return useCallback(
    <A extends unknown[]>(handler: (...args: A) => void) =>
      (...args: A) => {
        handler(...args);
        if (!copilot?.visible) return;
        if (copilot.currentStep?.name === stepName) {
          copilot.isLastStep ? copilot.stop() : copilot.goToNext();
        } else {
          copilot.stop();
        }
      },
    [copilot, stepName],
  );
}
