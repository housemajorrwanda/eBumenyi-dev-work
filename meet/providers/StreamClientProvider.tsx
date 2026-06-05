'use client';

import { ReactNode, useEffect, useState } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

import { tokenProvider, guestTokenProvider } from '@/actions/stream.actions';
import Loader from '@/components/Loader';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;

interface StreamVideoProviderProps {
  children: ReactNode;
  guestMode?: boolean;
  guestName?: string;
}

const StreamVideoProvider = ({
  children,
  guestMode = false,
  guestName = 'Guest'
}: StreamVideoProviderProps) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const [initError, setInitError] = useState<string | null>(null);
  const { user, isLoading } = useAuth();

  useEffect(() => {
    let clientInstance: StreamVideoClient | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    // Wait for auth check if not in guest mode
    if (!guestMode && isLoading) return;

    timeoutId = setTimeout(() => {
      setInitError('Connection to meeting service is taking too long. Please retry.');
    }, 12000);

    // If authenticated user exists, use their credentials
    if (user && !guestMode) {
      if (!API_KEY) {
        setInitError('Stream API key is missing');
        return;
      }

      const displayName = user.name || user.email?.split('@')[0] || user.id;

      clientInstance = new StreamVideoClient({
        apiKey: API_KEY,
        user: {
          id: user.id,
          name: displayName,
          image: user.avatar,
        },
        tokenProvider,
      });

      setVideoClient(clientInstance);
      setInitError(null);
      if (timeoutId) clearTimeout(timeoutId);
    }

    // Guest mode - create anonymous user
    if (guestMode) {
      if (!API_KEY) {
        setInitError('Stream API key is missing');
        return;
      }

      // Generate unique guest ID
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      clientInstance = new StreamVideoClient({
        apiKey: API_KEY,
        user: {
          id: guestId,
          name: guestName,
        },
        tokenProvider: () => guestTokenProvider(guestId),
      });

      setVideoClient(clientInstance);
      setInitError(null);
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (clientInstance) {
        clientInstance.disconnectUser().catch(() => undefined);
      }
    };
  }, [user, isLoading, guestMode, guestName]);

  useEffect(() => {
    if (videoClient) {
      setInitError(null);
    }
  }, [videoClient]);

  if (initError) {
    return (
      <section className="flex-center h-screen w-full bg-dark-1 px-4">
        <div className="w-full max-w-md rounded-2xl border border-dark-3 bg-dark-2 p-6 text-white">
          <h2 className="text-xl font-semibold">Unable to join meeting</h2>
          <p className="mt-2 text-sm text-white/70">{initError}</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-1 px-4 py-2 text-sm font-medium text-white"
            >
              Retry
            </button>
            <Link href="/" className="rounded-lg border border-dark-3 px-4 py-2 text-sm font-medium text-white/90">
              Back Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!videoClient) return <Loader />;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
