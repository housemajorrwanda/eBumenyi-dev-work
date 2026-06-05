'use client';

import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';
import { PhoneOff } from 'lucide-react';

const EndCallButton = () => {
  const call = useCall();
  const router = useRouter();

  if (!call)
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );

  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  const isMeetingOwner =
    localParticipant &&
    call.state.createdBy &&
    localParticipant.userId === call.state.createdBy.id;

  if (!isMeetingOwner) return null;

  const endCall = async () => {
    await call.endCall();
    router.push('/');
  };

  return (
    <button
      onClick={endCall}
      className="flex h-14 sm:h-12 items-center gap-2 rounded-full bg-meet-red px-6 sm:px-5 font-medium text-white transition-all hover:bg-red-600 hover:shadow-lg active:scale-95"
    >
      <PhoneOff size={22} />
      <span className="hidden sm:inline">End for all</span>
    </button>
  );
};

export default EndCallButton;
