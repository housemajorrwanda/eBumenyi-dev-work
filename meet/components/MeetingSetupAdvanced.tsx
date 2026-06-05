'use client';
import { useEffect, useState } from 'react';
import {
  VideoPreview,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import Alert from './Alert';
import CallSettings from './CallSettings';
import { Button } from './ui/button';
import { Mic, MicOff, Video, VideoOff, Settings, ArrowRight } from 'lucide-react';

const MeetingSetupAdvanced = ({
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
  const [showSettings, setShowSettings] = useState(false);

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

  if (showSettings) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-dark-1 px-4 py-8">
        <div className="w-full max-w-5xl h-[90vh] flex flex-col">
          <CallSettings onClose={() => setShowSettings(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-dark-1 via-dark-2 to-dark-1 px-4 py-8 text-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-1/5 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-1/5 rounded-full blur-3xl opacity-20"></div>
      </div>

      {/* Main container */}
      <div className="relative flex w-full max-w-6xl flex-col items-center gap-8 lg:flex-row lg:gap-16">
        {/* Left side - Video Preview */}
        <div className="relative w-full max-w-2xl flex-1">
          {/* Card container */}
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-dark-2 backdrop-blur-sm">
            {/* Video preview container */}
            <div className="relative aspect-video overflow-hidden bg-dark-3">
              <VideoPreview className='w-full'/>

              {/* Overlay gradient at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Device status badges */}
              {/* <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md border ${
                    isMicEnabled
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}
                >
                  {isMicEnabled ? <Mic size={12} /> : <MicOff size={12} />}
                  <span>{isMicEnabled ? 'Mic On' : 'Mic Off'}</span>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md border ${
                    isCamEnabled
                      ? 'bg-green-500/20 text-green-300 border-green-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}
                >
                  {isCamEnabled ? <Video size={12} /> : <VideoOff size={12} />}
                  <span>{isCamEnabled ? 'Camera On' : 'Camera Off'}</span>
                </div>
              </div> */}

              {/* Device toggle controls overlay */}
              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4">
                {/* Microphone toggle */}
                <button
                  onClick={() => setIsMicEnabled((prev) => !prev)}
                  className={`flex size-16 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 font-bold ${
                    isMicEnabled
                      ? 'bg-blue-1/80 text-white hover:bg-blue-1 shadow-lg shadow-blue-1/30'
                      : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                  }`}
                  title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                {/* Camera toggle */}
                <button
                  onClick={() => setIsCamEnabled((prev) => !prev)}
                  className={`flex size-16 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 font-bold ${
                    isCamEnabled
                      ? 'bg-blue-1/80 text-white hover:bg-blue-1 shadow-lg shadow-blue-1/30'
                      : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                  }`}
                  title={isCamEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isCamEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                {/* Settings button */}
                {/* <button
                  onClick={() => setShowSettings(true)}
                  className="flex size-16 items-center justify-center rounded-full bg-slate-600/80 text-white hover:bg-slate-700 transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg shadow-slate-600/30"
                  title="Open settings"
                >
                  <Settings size={24} />
                </button> */}
              </div>
            </div>

            {/* Additional status info card */}
            <div className="p-4 bg-dark-3/50 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs text-white/60">
                Camera: <span className="font-semibold text-white">{isCamEnabled ? 'Active' : 'Disabled'}</span>
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <div className="text-xs text-white/60">
                Mic: <span className="font-semibold text-white">{isMicEnabled ? 'Active' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Join info and controls */}
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center lg:items-start lg:text-left">
          {/* Header text */}
          <div className="space-y-3">
            {/* <div className="inline-block px-3 py-1 rounded-full bg-blue-1/20 border border-blue-1/30 text-xs font-semibold text-blue-1 uppercase tracking-wider">
              Meeting Setup
            </div> */}
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              Ready to Join?
            </h1>
            <p className="text-base text-white/60 leading-relaxed">
              Check your audio and video settings before joining the call. Everything is configured automatically.
            </p>
          </div>

          {/* Status indicators with detailed info */}
          {/* <div className="w-full space-y-3">
            <div
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                isMicEnabled
                  ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isMicEnabled ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {isMicEnabled ? (
                    <Mic size={18} className="text-green-400" />
                  ) : (
                    <MicOff size={18} className="text-red-400" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Microphone</p>
                  <p className="text-xs text-white/50">
                    {isMicEnabled ? 'Enabled and ready' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${
                  isMicEnabled ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></div>
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                isCamEnabled
                  ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isCamEnabled ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {isCamEnabled ? (
                    <Video size={18} className="text-green-400" />
                  ) : (
                    <VideoOff size={18} className="text-red-400" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Camera</p>
                  <p className="text-xs text-white/50">
                    {isCamEnabled ? 'Enabled and ready' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${
                  isCamEnabled ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></div>
            </div>
          </div> */}

          {/* Action buttons */}
          <div className="w-full space-y-3 pt-4">
            {/* Join button */}
            <Button
              className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-1 to-blue-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-1/30 transition-all hover:shadow-xl hover:scale-105 active:scale-95"
              onClick={() => {
                call.join();
                setIsSetupComplete(true);
              }}
            >
              <span>Join Meeting Now</span>
              <ArrowRight size={18} className="ml-2" />
            </Button>

            {/* Settings button (alternate) */}
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/30 active:scale-95"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={16} className="mr-2" />
              Adjust Settings
            </Button>
          </div>

          {/* Additional info */}
          <div className="w-full pt-4 space-y-2 border-t border-white/10">
            <p className="text-xs text-white/40">
              💡 <span className="font-medium">Pro tip:</span> You can adjust your audio & video settings anytime during the call from the settings menu.
            </p>
            <p className="text-xs text-white/30">
              By joining, you agree to our meeting guidelines and terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingSetupAdvanced;
