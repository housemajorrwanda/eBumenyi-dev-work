/* eslint-disable camelcase */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import HomeCard from './HomeCard';
import MeetingModal from './MeetingModal';
import { Call, useStreamVideoClient } from '@stream-io/video-react-sdk';
import { useAuth } from '@/context/AuthContext';
import Loader from './Loader';
import { Textarea } from './ui/textarea';
import ReactDatePicker from 'react-datepicker';
import { useToast } from './ui/use-toast';
import { Input } from './ui/input';
import { Plus, Copy, Check } from 'lucide-react';

const initialValues = {
  dateTime: new Date(),
  description: '',
  link: '',
};

const MeetingTypeList = () => {
  const router = useRouter();
  const [meetingState, setMeetingState] = useState<
    'isScheduleMeeting' | 'isJoiningMeeting' | 'isInstantMeeting' | undefined
  >(undefined);
  const [values, setValues] = useState(initialValues);
  const [callDetail, setCallDetail] = useState<Call>();
  const [copied, setCopied] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const client = useStreamVideoClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const createMeeting = async () => {
    if (!client || !user) return;
    try {
      if (!values.dateTime) {
        toast({ title: 'Please select a date and time' });
        return;
      }
      setIsCreatingMeeting(true);
      const id = crypto.randomUUID();
      const call = client.call('default', id);
      if (!call) throw new Error('Failed to create meeting');
      const startsAt =
        values.dateTime.toISOString() || new Date(Date.now()).toISOString();
      const description = values.description || 'Instant Meeting';
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          custom: {
            description,
          },
          settings_override: {
            screensharing: {
              enabled: true,
              access_request_enabled: false,
            },
          },
        },
      });
      setCallDetail(call);
      if (!values.description) {
        router.push(`/meeting/${call.id}`);
      }
      toast({
        title: 'Meeting Created',
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to create Meeting' });
      setIsCreatingMeeting(false);
    }
  };

  const copyMeetingLink = () => {
    const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetail?.id}`;
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!client || !user) return <Loader />;

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${callDetail?.id}`;

  return (
    <section className="grid grid-cols-1 gap-3 xs:gap-4 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:gap-7 xl:grid-cols-4">
      {/* New Meeting Card */}
      <HomeCard
        img="/icons/add-meeting.svg"
        title="New Meeting"
        description="Start an instant meeting"
        handleClick={() => setMeetingState('isInstantMeeting')}
        variant="blue"
      />

      {/* Join Meeting Card */}
      <HomeCard
        img="/icons/join-meeting.svg"
        title="Join Meeting"
        description="via invitation link"
        handleClick={() => setMeetingState('isJoiningMeeting')}
        variant="teal"
      />

      {/* Schedule Meeting Card */}
      <HomeCard
        img="/icons/schedule.svg"
        title="Schedule Meeting"
        description="Plan your meeting"
        handleClick={() => setMeetingState('isScheduleMeeting')}
        variant="purple"
      />

      {/* View Recordings Card */}
      <HomeCard
        img="/icons/recordings.svg"
        title="View Recordings"
        description="Meeting recordings"
        handleClick={() => router.push('/recordings')}
        variant="yellow"
      />

      {/* Schedule Meeting Modal */}
      {!callDetail ? (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => setMeetingState(undefined)}
          title="Schedule a Meeting"
          handleClick={createMeeting}
          isLoading={isCreatingMeeting}
        >
          <div className="flex flex-col gap-4">
            {/* Description input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/80">
                Meeting description
              </label>
              <Textarea
                className="min-h-[100px] border-dark-4 bg-dark-3 text-white placeholder:text-white/40 focus:border-blue-2 focus:ring-1 focus:ring-blue-2"
                placeholder="Add a description for your meeting..."
                onChange={(e) =>
                  setValues({ ...values, description: e.target.value })
                }
              />
            </div>

            {/* Date picker */}
            <div className="flex w-full flex-col gap-2">
              <label className="text-sm font-medium text-white/80">
                Select date and time
              </label>
              <div className="relative">
                <ReactDatePicker
                  selected={values.dateTime}
                  onChange={(date) => setValues({ ...values, dateTime: date! })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  timeCaption="Time"
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="w-full rounded-lg border border-dark-4 bg-dark-3 p-3 text-white focus:border-blue-2 focus:outline-none focus:ring-1 focus:ring-blue-2"
                />
              </div>
            </div>
          </div>
        </MeetingModal>
      ) : (
        <MeetingModal
          isOpen={meetingState === 'isScheduleMeeting'}
          onClose={() => {
            setMeetingState(undefined);
            setCallDetail(undefined);
          }}
          title="Meeting Scheduled!"
          handleClick={copyMeetingLink}
          buttonIcon={copied ? "/icons/checked.svg" : "/icons/copy.svg"}
          buttonText={copied ? "Copied!" : "Copy Meeting Link"}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-meet/20">
              <Check className="size-8 text-green-400" />
            </div>
            <p className="text-center text-white/70">
              Your meeting has been scheduled. Share the link with participants.
            </p>
            <div className="flex w-full items-center gap-2 rounded-lg bg-dark-3 p-3">
              <input
                type="text"
                value={meetingLink}
                readOnly
                className="flex-1 bg-transparent text-sm text-white/60 outline-none"
              />
              <button
                onClick={copyMeetingLink}
                className="rounded-lg bg-blue-1 p-2 transition-colors hover:bg-blue-3"
              >
                {copied ? (
                  <Check className="size-4 text-white" />
                ) : (
                  <Copy className="size-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </MeetingModal>
      )}

      {/* Join Meeting Modal */}
      <MeetingModal
        isOpen={meetingState === 'isJoiningMeeting'}
        onClose={() => setMeetingState(undefined)}
        title="Join a Meeting"
        buttonText="Join Meeting"
        handleClick={() => router.push(values.link)}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/80">
              Meeting link or code
            </label>
            <Input
              placeholder="Enter meeting link or code"
              onChange={(e) => setValues({ ...values, link: e.target.value })}
              className="border-dark-4 bg-dark-3 text-white placeholder:text-white/40 focus:border-blue-2 focus:ring-1 focus:ring-blue-2"
            />
          </div>
          <p className="text-xs text-white/40">
            Paste the meeting link shared by the host
          </p>
        </div>
      </MeetingModal>

      {/* Instant Meeting Modal */}
      <MeetingModal
        isOpen={meetingState === 'isInstantMeeting'}
        onClose={() => setMeetingState(undefined)}
        title="Start an Instant Meeting"
        buttonText="Start Meeting"
        handleClick={createMeeting}
        isLoading={isCreatingMeeting}
      >
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-20 items-center justify-center rounded-full bg-blue-1/20">
            <Plus className="size-10 text-blue-2" />
          </div>
          <p className="text-center text-white/70">
            Start a meeting instantly and invite others to join
          </p>
        </div>
      </MeetingModal>
    </section>
  );
};

export default MeetingTypeList;
