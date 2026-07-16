import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-storage-only onboarding helpers. Deliberately has no dependency on
// httpClient so it can be safely imported from utils/authSession.ts (which
// httpClient itself depends on, via getAccessToken) without creating a
// require cycle: httpClient -> authSession -> onboarding.service -> httpClient.

export const TOUR_KEYS = {
  WELCOME_VIDEO: 'welcome-video',
  APP: 'app',
  TAB_BAR: 'tab-bar',
  COURSE: 'course',
  TRAINING: 'training',
  COURSE_INTRO: 'course-intro',
  LESSON: 'lesson',
  CERTIFICATE: 'certificate',
  COMMUNITY: 'community',
  DIRECT_CHAT: 'direct-chat',
  GROUP_CHAT: 'group-chat',
  COMMUNITY_FEED: 'community-feed',
  CREATE_CHAT: 'create-chat',
  CREATE_GROUP: 'create-group',
  CREATE_COMMUNITY: 'create-community',
  ITSINDA: 'itsinda',
  INVITE_CHW: 'invite-chw',
  STUDENT_DETAIL: 'student-detail',
  CALENDAR: 'calendar',
  EVENT_DETAIL: 'event-detail',
  RECORDINGS_ADMIN: 'recordings-admin',
  RECORDINGS_WATCH: 'recordings-watch',
  NOTIFICATIONS: 'notifications',
  PROFILE: 'profile',
  ANNOUNCEMENT: 'announcement',
} as const;

export type TourKey = (typeof TOUR_KEYS)[keyof typeof TOUR_KEYS];

export const localKey = (tourKey: string) => `onboarding_${tourKey}`;

// All tour keys the app knows about — used to remove stale keys after a DB reset
export const ALL_KNOWN_KEYS = Object.values(TOUR_KEYS) as string[];

export async function hasCompletedLocal(tourKey: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(localKey(tourKey));
    return val !== null;
  } catch {
    return false;
  }
}

export async function markCompleteLocal(tourKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(localKey(tourKey), '1');
  } catch {
    // Local write failed — not fatal, backend sync will still attempt
  }
}

// Wipes locally-cached onboarding state. Must run on logout, otherwise the next
// user to sign in on this device sees the previous user's completed tours
// until a backend sync succeeds (and never, if that sync fails).
//
// Sweeps by the `onboarding_` prefix rather than just ALL_KNOWN_KEYS: some
// tours (e.g. the per-page Questionnaire callouts in components/Questionnaire.tsx)
// use dynamically-computed keys that aren't enumerated in TOUR_KEYS, and those
// need clearing too — otherwise they'd leak to the next user on this device.
export async function clearLocalOnboarding(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const onboardingKeys = allKeys.filter((key) => key.startsWith('onboarding_'));
    await AsyncStorage.multiRemove(onboardingKeys);
  } catch {
    // Fall back to the known fixed keys if getAllKeys() fails for any reason.
    await Promise.all(ALL_KNOWN_KEYS.map((key) => AsyncStorage.removeItem(localKey(key))));
  }
}
