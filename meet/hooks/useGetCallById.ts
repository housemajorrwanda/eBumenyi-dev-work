import { useEffect, useState } from 'react';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';

export const useGetCallById = (id: string | string[]) => {
  const [call, setCall] = useState<Call>();
  const [isCallLoading, setIsCallLoading] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);

  const client = useStreamVideoClient();

  useEffect(() => {
    if (!client) return;

    const loadCall = async () => {
      try {
        setIsCallLoading(true);
        setCallError(null);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Meeting lookup timed out. Please try again.')), 12000);
        });

        // https://getstream.io/video/docs/react/guides/querying-calls/#filters
        const { calls } = (await Promise.race([
          client.queryCalls({ filter_conditions: { id } }),
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof client.queryCalls>>;

        if (calls.length > 0) {
          setCall(calls[0]);
        } else {
          setCall(undefined);
        }

        setIsCallLoading(false);
      } catch (error) {
        console.error(error);
        setCall(undefined);
        setCallError(error instanceof Error ? error.message : 'Failed to load meeting');
        setIsCallLoading(false);
      }
    };

    loadCall();
  }, [client, id]);

  return { call, isCallLoading, callError };
};
