'use client';
import { useEffect, useState } from 'react';
import {
  VideoPreview,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import Alert from './Alert';
import { Button } from './ui/button';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const { useCallEndedAt, useCallStartsAt } = useCallStateHooks();
  const callStartsAt = useCallStartsAt();
  const callEndedAt = useCallEndedAt();
  const callTimeNotArrived =
    callStartsAt && new Date(callStartsAt) > new Date();
  const callHasEnded = !!callEndedAt;

  const call = useCall();

  if (!call) {
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );
  }

  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);

  useEffect(() => {
    if (!isMicEnabled) {
      call.microphone.disable();
    } else {
      call.microphone.enable();
    }
  }, [isMicEnabled, call.microphone]);

  useEffect(() => {
    if (!isCamEnabled) {
      call.camera.disable();
    } else {
      call.camera.enable();
    }
  }, [isCamEnabled, call.camera]);

  if (callTimeNotArrived)
    return (
      <Alert
        title={`Your Meeting has not started yet. It is scheduled for ${callStartsAt.toLocaleString()}`}
      />
    );

  if (callHasEnded)
    return (
      <Alert
        title="The call has been ended by the host"
        iconUrl="/icons/call-ended.svg"
      />
    );

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-dark-1 px-4 py-8 text-white">
      {/* Container */}
      <div className="flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:gap-12">

        {/* Video Preview Section */}
        <div className="relative w-full max-w-xl flex-1">
          {/* Video preview container */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-dark-3 shadow-meet-lg">
            <VideoPreview />

            {/* Overlay gradient at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Device toggle controls overlay */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
              {/* Microphone toggle */}
              <button
                onClick={() => setIsMicEnabled((prev) => !prev)}
                className={`flex size-14 sm:size-12 items-center justify-center rounded-full transition-all ${isMicEnabled
                  ? 'bg-dark-3/80 text-white hover:bg-dark-4'
                  : 'bg-meet-red text-white hover:bg-red-600'
                  }`}
              >
                {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
              </button>

              {/* Camera toggle */}
              <button
                onClick={() => setIsCamEnabled((prev) => !prev)}
                className={`flex size-14 sm:size-12 items-center justify-center rounded-full transition-all ${isCamEnabled
                  ? 'bg-dark-3/80 text-white hover:bg-dark-4'
                  : 'bg-meet-red text-white hover:bg-red-600'
                  }`}
              >
                {isCamEnabled ? <Video size={24} /> : <VideoOff size={24} />}
              </button>

            </div>
          </div>
        </div>

        {/* Right side - Join info */}
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              Ready to join?
            </h1>
            <p className="mt-2 text-base text-white/60">
              Check your audio and video before joining
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isMicEnabled ? 'bg-green-meet/20 text-green-400' : 'bg-meet-red/20 text-red-400'
              }`}>
              {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
              <span>{isMicEnabled ? 'Mic on' : 'Mic off'}</span>
            </div>
            <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isCamEnabled ? 'bg-green-meet/20 text-green-400' : 'bg-meet-red/20 text-red-400'
              }`}>
              {isCamEnabled ? <Video size={16} /> : <VideoOff size={16} />}
              <span>{isCamEnabled ? 'Camera on' : 'Camera off'}</span>
            </div>
          </div>

          {/* Join button */}
          <Button
            className="h-14 w-full rounded-full bg-blue-1 px-8 text-base font-semibold text-white transition-all hover:bg-blue-3 hover:shadow-lg sm:w-auto"
            onClick={() => {
              call.join();
              setIsSetupComplete(true);
            }}
          >
            Join now
          </Button>

          {/* Additional info */}
          <p className="text-xs text-white/40">
            By joining, you agree to the meeting guidelines
          </p>
        </div>
      </div>
    </div>
  );
};

export default MeetingSetup;
