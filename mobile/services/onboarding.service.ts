import AsyncStorage from '@react-native-async-storage/async-storage';
import httpClient from './httpClient';

export const TOUR_KEYS = {
  APP: 'app',
  COURSE: 'course',
  TRAINING: 'training',
} as const;

export type TourKey = (typeof TOUR_KEYS)[keyof typeof TOUR_KEYS];

const localKey = (tourKey: string) => `onboarding_${tourKey}`;

// All tour keys the app knows about — used to remove stale keys after a DB reset
const ALL_KNOWN_KEYS = Object.values(TOUR_KEYS) as string[];

export const onboardingService = {
  async hasCompleted(tourKey: string): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(localKey(tourKey));
      return val !== null;
    } catch {
      return false;
    }
  },

  async markComplete(tourKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(localKey(tourKey), '1');
    } catch {
      // Local write failed — not fatal, backend sync will still attempt
    }
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

    // Write completed tours locally
    await Promise.all(completedTours.map((key) => AsyncStorage.setItem(localKey(key), '1')));

    // Remove any known tour keys the server doesn't have (e.g. after a DB reset)
    const stale = ALL_KNOWN_KEYS.filter((key) => !completedTours.includes(key));
    await Promise.all(stale.map((key) => AsyncStorage.removeItem(localKey(key))));

    return completedTours;
  },
};
