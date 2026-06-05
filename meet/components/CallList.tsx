'use client';

import { Call, CallRecording } from '@stream-io/video-react-sdk';
import { Video, Calendar, PlayCircle } from 'lucide-react';

import Loader from './Loader';
import { useGetCalls } from '@/hooks/useGetCalls';
import MeetingCard from './MeetingCard';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CallList = ({ type }: { type: 'ended' | 'upcoming' | 'recordings' }) => {
  const router = useRouter();
  const { endedCalls, upcomingCalls, callRecordings, isLoading } =
    useGetCalls();
  const [recordings, setRecordings] = useState<CallRecording[]>([]);

  const getCalls = () => {
    switch (type) {
      case 'ended':
        return endedCalls;
      case 'recordings':
        return recordings;
      case 'upcoming':
        return upcomingCalls;
      default:
        return [];
    }
  };

  const getNoCallsMessage = () => {
    switch (type) {
      case 'ended':
        return 'No previous calls';
      case 'upcoming':
        return 'No upcoming calls';
      case 'recordings':
        return 'No recordings yet';
      default:
        return '';
    }
  };

  const getNoCallsDescription = () => {
    switch (type) {
      case 'ended':
        return 'Your past meetings will appear here';
      case 'upcoming':
        return 'Schedule a meeting to see it here';
      case 'recordings':
        return 'Start recording in your next meeting';
      default:
        return '';
    }
  };

  const getNoCallsIcon = () => {
    switch (type) {
      case 'ended':
        return Calendar;
      case 'upcoming':
        return Video;
      case 'recordings':
        return PlayCircle;
      default:
        return Calendar;
    }
  };

  useEffect(() => {
    const fetchRecordings = async () => {
      const callData = await Promise.all(
        callRecordings?.map((meeting) => meeting.queryRecordings()) ?? [],
      );

      const recordings = callData
        .filter((call) => call.recordings.length > 0)
        .flatMap((call) => call.recordings);

      setRecordings(recordings);
    };

    if (type === 'recordings') {
      fetchRecordings();
    }
  }, [type, callRecordings]);

  if (isLoading) return <Loader />;

  const calls = getCalls();
  const noCallsMessage = getNoCallsMessage();
  const noCallsDescription = getNoCallsDescription();
  const NoCallsIcon = getNoCallsIcon();

  return (
    <div className="flex flex-col gap-5">
      {calls && calls.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {calls.map((meeting: Call | CallRecording) => (
            <MeetingCard
              key={(meeting as Call).id}
              icon={
                type === 'ended'
                  ? '/icons/previous.svg'
                  : type === 'upcoming'
                    ? '/icons/upcoming.svg'
                    : '/icons/recordings.svg'
              }
              title={
                (meeting as Call).state?.custom?.description ||
                (meeting as CallRecording).filename?.substring(0, 20) ||
                'Instant Meeting'
              }
              date={
                // For calls, prefer startsAt, fall back to createdAt for instant meetings
                (meeting as Call).state?.startsAt?.toLocaleString() ||
                (meeting as Call).state?.createdAt?.toLocaleString() ||
                (meeting as CallRecording).start_time?.toLocaleString() ||
                'Unknown date'
              }
              isPreviousMeeting={type === 'ended'}
              link={
                type === 'recordings'
                  ? (meeting as CallRecording).url
                  : `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${(meeting as Call).id}`
              }
              buttonIcon1={type === 'recordings' ? '/icons/play.svg' : undefined}
              buttonText={type === 'recordings' ? 'Play' : 'Start'}
              handleClick={
                type === 'recordings'
                  ? () => router.push(`${(meeting as CallRecording).url}`)
                  : () => router.push(`/meeting/${(meeting as Call).id}`)
              }
              participants={
                type !== 'recordings'
                  ? (meeting as Call).state?.members?.map((member) => ({
                    id: member.user_id,
                    image: member.user?.image,
                    name: member.user?.name,
                  }))
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        // Empty state
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dark-3 bg-dark-2 py-16">
          <div className="flex size-16 items-center justify-center rounded-full bg-dark-3">
            <NoCallsIcon size={28} className="text-white/40" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-white">{noCallsMessage}</h3>
          <p className="mt-2 text-sm text-white/50">{noCallsDescription}</p>
        </div>
      )}
    </div>
  );
};

export default CallList;
