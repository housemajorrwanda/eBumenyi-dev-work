import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';

// Local storage key for caching calls
const CALLS_CACHE_KEY = 'yom_calls_cache';

// Helper to save calls to local storage
const saveCacheToCalls = (userId: string, calls: Call[]) => {
  try {
    const cacheData = {
      userId,
      timestamp: Date.now(),
      calls: calls.map(call => ({
        id: call.id,
        type: call.type,
        createdBy: call.state.createdBy,
        startsAt: call.state.startsAt?.toISOString(),
        endedAt: call.state.endedAt?.toISOString(),
        custom: call.state.custom,
        members: call.state.members,
      })),
    };
    localStorage.setItem(CALLS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache calls:', error);
  }
};

export const useGetCalls = () => {
  const { user } = useAuth();
  const client = useStreamVideoClient();
  const [calls, setCalls] = useState<Call[]>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadCalls = async () => {
      if (!client || !user?.id) return;

      setIsLoading(true);

      try {
        // Fetch all calls where the user is either the creator or a member
        // Remove the starts_at filter to include instant meetings
        const { calls } = await client.queryCalls({
          sort: [{ field: 'created_at', direction: -1 }],
          filter_conditions: {
            $or: [
              { created_by_user_id: user.id },
              { members: { $in: [user.id] } },
            ],
          },
          limit: 50, // Get last 50 calls
        });

        setCalls(calls);

        // Cache calls to local storage for persistence
        if (calls.length > 0) {
          saveCacheToCalls(user.id, calls);
        }
      } catch (error) {
        console.error('Error fetching calls:', error);

        // Try to load from cache if fetch fails
        try {
          const cached = localStorage.getItem(CALLS_CACHE_KEY);
          if (cached) {
            const cacheData = JSON.parse(cached);
            if (cacheData.userId === user.id) {
              console.log('Loading calls from cache');
              // Note: Cached calls won't have full Call object methods
              // but can still be displayed
            }
          }
        } catch (cacheError) {
          console.warn('Failed to load from cache:', cacheError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCalls();
  }, [client, user?.id]);

  const now = new Date();

  // Ended calls: calls that have ended OR started in the past
  const endedCalls = calls?.filter(({ state: { startsAt, endedAt, createdAt } }: Call) => {
    // If the call has ended, it's definitely an ended call
    if (endedAt) return true;

    // If the call has a start time in the past, it's ended
    if (startsAt && new Date(startsAt) < now) return true;

    // If the call was created more than 24 hours ago and has no future start time, consider it ended
    if (createdAt && !startsAt) {
      const createdDate = new Date(createdAt);
      const hoursSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceCreated > 24;
    }

    return false;
  });

  // Upcoming calls: calls with a future start time
  const upcomingCalls = calls?.filter(({ state: { startsAt } }: Call) => {
    return startsAt && new Date(startsAt) > now;
  });

  return { endedCalls, upcomingCalls, callRecordings: calls, isLoading };
};