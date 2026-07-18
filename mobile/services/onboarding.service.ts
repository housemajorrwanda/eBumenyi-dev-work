import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import httpClient from './httpClient';
import {
  TOUR_KEYS,
  TourKey,
  localKey,
  ALL_KNOWN_KEYS,
  hasCompletedLocal,
  markCompleteLocal,
  clearLocalOnboarding,
} from './onboardingLocal';

export { TOUR_KEYS };
export type { TourKey };

const TOUR_START_TRAILING_DELAY = 150;

// Waits for any in-flight screen-transition animation to finish, then adds a
// short trailing delay so freshly-rendered content gets one layout pass to
// settle before the copilot library measures its target. On screens with
// nothing to wait for (no loader, no transition in flight) this resolves
// almost immediately — replacing a flat 500ms setTimeout that was applied
// uniformly regardless of whether there was anything to wait for, which read
// as a sluggish tour specifically on screens with no loading state of their own.
export function scheduleTourStart(start: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const handle = InteractionManager.runAfterInteractions(() => {
    timer = setTimeout(start, TOUR_START_TRAILING_DELAY);
  });
  return () => {
    handle.cancel();
    if (timer) clearTimeout(timer);
  };
}

export const onboardingService = {
  hasCompleted: hasCompletedLocal,

  async markComplete(tourKey: string): Promise<void> {
    await markCompleteLocal(tourKey);
    // Fire and forget — don't block UI on network
    httpClient
      .post('/onboarding/complete', { tourKey })
      .catch(() => {/* backend sync is best-effort */});
  },

  // Returns the list of completed tour keys from the backend.
  // Also removes any local keys that the server no longer knows about (handles DB resets).
  async syncFromBackend(): Promise<string[]> {
    const response = await httpClient.get<{ data: { completedTours: string[] } }>('/onboarding');
    const completedTours: string[] = (response as any)?.data?.data?.completedTours ?? [];
    console.log('[onboarding] syncFromBackend — server completedTours:', completedTours);

    // Write completed tours locally
    await Promise.all(completedTours.map((key) => AsyncStorage.setItem(localKey(key), '1')));

    // Remove any known tour keys the server doesn't have (e.g. after a DB reset)
    const stale = ALL_KNOWN_KEYS.filter((key) => !completedTours.includes(key));
    await Promise.all(stale.map((key) => AsyncStorage.removeItem(localKey(key))));

    return completedTours;
  },

  clearLocal: clearLocalOnboarding,
};
