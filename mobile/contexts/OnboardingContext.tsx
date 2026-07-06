import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onboardingService, TOUR_KEYS } from '@/services/onboarding.service';

interface OnboardingContextType {
  hasCompleted: (tourKey: string) => boolean;
  markComplete: (tourKey: string) => Promise<void>;
  syncReady: boolean;
  /** Call once after the user's JWT is confirmed valid */
  triggerSync: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  hasCompleted: () => false,
  markComplete: async () => {},
  syncReady: false,
  triggerSync: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());
  const [syncReady, setSyncReady] = useState(false);
  const syncStartedRef = useRef(false);
  // Whether local storage had any completed tours (drives which path we take)
  const localHadDataRef = useRef(false);

  // Read local AsyncStorage on mount.
  // - If local is empty → first-time user → set syncReady immediately (no network needed).
  // - If local has data → may be stale → wait for triggerSync() to confirm from server.
  useEffect(() => {
    const init = async () => {
      const allKeys = Object.values(TOUR_KEYS) as string[];
      try {
        const results = await Promise.all(
          allKeys.map(async (key) => ({ key, done: await onboardingService.hasCompleted(key) })),
        );
        const localSet = new Set(results.filter((r) => r.done).map((r) => r.key));
        setCompletedTours(localSet);
        localHadDataRef.current = localSet.size > 0;

        if (localSet.size === 0) {
          // Definitely a first-time user on this device — no need to wait for network
          setSyncReady(true);
        }
        // If localSet.size > 0: syncReady stays false until triggerSync() resolves,
        // so the server can correct any stale keys (e.g. after a DB reset).
      } catch {
        // Read failed — assume first-time
        setSyncReady(true);
      }
    };
    init();
  }, []);

  // Called by authenticated screens (home, training) after their token is validated.
  // Updates completedTours from the server and unblocks the tour trigger if we were waiting.
  const triggerSync = useCallback(() => {
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;

    onboardingService
      .syncFromBackend()
      .then((serverCompleted) => {
        setCompletedTours(new Set(serverCompleted));
        setSyncReady(true);
      })
      .catch(() => {
        // Network failed — fall back to local state and unblock anyway
        setSyncReady(true);
      });
  }, []);

  const hasCompleted = (tourKey: string): boolean => completedTours.has(tourKey);

  const markComplete = async (tourKey: string): Promise<void> => {
    await onboardingService.markComplete(tourKey);
    setCompletedTours((prev) => new Set(prev).add(tourKey));
  };

  return (
    <OnboardingContext.Provider value={{ hasCompleted, markComplete, syncReady, triggerSync }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
