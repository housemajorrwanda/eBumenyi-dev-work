'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StreamCall, StreamTheme } from '@stream-io/video-react-sdk';
import { useParams, useRouter } from 'next/navigation';
import { Loader, User } from 'lucide-react';

import { useGetCallById } from '@/hooks/useGetCallById';
import Alert from '@/components/Alert';
import MeetingSetupAdvanced from '@/components/MeetingSetupAdvanced';
import MeetingRoom from '@/components/MeetingRoom';
import StreamVideoProvider from '@/providers/StreamClientProvider';
import { HostSettingsProvider } from '@/context/HostSettingsContext';

const MeetingPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);

  // Check if we should show guest form
  useEffect(() => {
    if (!isLoading && !user) {
      setShowGuestForm(true);
    }
  }, [isLoading, user]);

  // Guest name form for non-authenticated users
  if (showGuestForm && !isGuestMode) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-dark-1">
        <div className="mx-4 w-full max-w-md rounded-xl bg-dark-2 p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-1">
              <User size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Join Meeting</h2>
            <p className="mt-2 text-center text-sm text-gray-400">
              Enter your name to join as a guest
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (guestName.trim()) {
                setIsGuestMode(true);
                setShowGuestForm(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="guestName" className="mb-2 block text-sm font-medium text-gray-300">
                Your Name
              </label>
              <input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-lg border border-dark-3 bg-dark-3 px-4 py-3 text-white placeholder:text-gray-500 focus:border-blue-1 focus:outline-none focus:ring-1 focus:ring-blue-1"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!guestName.trim()}
              className="w-full rounded-lg bg-blue-1 py-3 font-semibold text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join as Guest
            </button>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dark-3"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-dark-2 px-2 text-gray-500">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/sign-in')}
              className="w-full rounded-lg border border-dark-3 bg-dark-3 py-3 font-medium text-white transition-all hover:bg-dark-4"
            >
              Sign in with account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Show loader while auth is loading
  if (isLoading && !isGuestMode) return <Loader />;

  // Render meeting with appropriate provider
  return (
    <StreamVideoProvider guestMode={isGuestMode} guestName={guestName || 'Guest'}>
      <MeetingContent
        id={id as string}
        user={user}
        isSetupComplete={isSetupComplete}
        setIsSetupComplete={setIsSetupComplete}
      />
    </StreamVideoProvider>
  );
};

// Separate component for meeting content to use the Stream hooks properly
const MeetingContent = ({
  id,
  user,
  isSetupComplete,
  setIsSetupComplete,
}: {
  id: string;
  user: Awaited<ReturnType<typeof useAuth>>['user'];
  isSetupComplete: boolean;
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const { call, isCallLoading, callError } = useGetCallById(id);

  if (isCallLoading) return <Loader />;

  if (callError) {
    return <Alert title={callError} />;
  }

  if (!call)
    return (
      <p className="text-center text-3xl font-bold text-white">
        Call Not Found
      </p>
    );

  // Check if this is an "invited" call type and user is not a member
  // For guests, we skip this check as they should be allowed to join
  const notAllowed =
    call.type === 'invited' &&
    user &&
    !call.state.members.find((m) => m.user.id === user.id);

  if (notAllowed)
    return <Alert title="You are not allowed to join this meeting" />;

  return (
    <main className="meeting-mobile-root h-screen w-full">
      <StreamCall call={call}>
        <StreamTheme>
          <HostSettingsProvider callId={id} isHost={user ? !user.id.startsWith('guest') : false}>
            {!isSetupComplete ? (
              <MeetingSetupAdvanced setIsSetupComplete={setIsSetupComplete} />
            ) : (
              <MeetingRoom />
            )}
          </HostSettingsProvider>
        </StreamTheme>
      </StreamCall>
    </main>
  );
};

export default MeetingPage;
