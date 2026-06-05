'use client';

import React from 'react';
import { OwnCapability, useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Circle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHostSettings } from '@/context/HostSettingsContext';
import { useToast } from './ui/use-toast';

interface CustomCallControlsProps {
    onLeave?: () => void;
    isAnotherParticipantSharing?: boolean;
    currentSharerName?: string;
    currentSharerId?: string;
    hostCanOverrideShare?: boolean;
    isLocalSharing?: boolean;
}

/**
 * Custom CallControls component that excludes the reaction button.
 * We use our own custom emoji picker instead.
 * Mic and camera use simple toggle without device selection.
 * Now enforces host-set permissions.
 */
const CustomCallControls = ({
    onLeave,
    isAnotherParticipantSharing = false,
    currentSharerName,
    currentSharerId,
    hostCanOverrideShare = false,
    isLocalSharing = false,
}: CustomCallControlsProps) => {
    const router = useRouter();
    const call = useCall();
    const { useMicrophoneState, useCameraState, useLocalParticipant, useIsCallRecordingInProgress } = useCallStateHooks();
    const { isMute } = useMicrophoneState();
    const { isEnabled: isCameraEnabled } = useCameraState();
    const { permissionSettings } = useHostSettings();
    const localParticipant = useLocalParticipant();
    const isHost = React.useMemo(() => {
        if (!call || !localParticipant) return false;
        return call.state.createdBy?.id === localParticipant.userId;
    }, [call, localParticipant]);
    const { toast } = useToast();

    const handleLeave = () => {
        if (onLeave) {
            onLeave();
        } else {
            router.push('/');
        }
    };

    const handleToggleMic = async () => {
        // Check if audio is allowed
        if (!permissionSettings.allowAudio && isMute && !isHost) {
            toast({
                title: 'Audio Disabled',
                description: 'The host has disabled audio for this meeting',
                variant: 'destructive',
            });
            return;
        }

        try {
            if (isMute) {
                await call?.microphone.enable();
            } else {
                await call?.microphone.disable();
            }
        } catch (error) {
            console.error('Failed to toggle microphone:', error);
        }
    };

    const handleToggleCamera = async () => {
        // Check if video is allowed
        if (!permissionSettings.allowVideo && !isCameraEnabled && !isHost) {
            toast({
                title: 'Video Disabled',
                description: 'The host has disabled video for this meeting',
                variant: 'destructive',
            });
            return;
        }

        try {
            if (isCameraEnabled) {
                await call?.camera.disable();
            } else {
                await call?.camera.enable();
            }
        } catch (error) {
            console.error('Failed to toggle camera:', error);
        }
    };

    const isRecording = useIsCallRecordingInProgress();
    const canRecord = isHost || permissionSettings.allowParticipantRecording;

    const handleToggleRecord = async () => {
        if (!canRecord) {
            toast({
                title: 'Recording unavailable',
                description: 'Recording is disabled by host',
                variant: 'destructive',
            });
            return;
        }

        try {
            if (isRecording) {
                await call?.stopRecording();
            } else {
                await call?.startRecording();
            }
        } catch (error) {
            console.error('Failed to toggle recording:', error);
        }
    };

    return (
        <div className="flex gap-3 sm:gap-4 md:gap-6 flex-wrap justify-center h-12">
            {/* Audio toggle (microphone) - with permission check */}
            <button
                onClick={handleToggleMic}
                disabled={!permissionSettings.allowAudio && isMute && !isHost}
                className={cn(
                    'flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                    !permissionSettings.allowAudio && isMute && !isHost
                        ? 'bg-gray-500 text-white/50 cursor-not-allowed opacity-50'
                        : isMute
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-dark-3 text-white hover:bg-dark-4'
                )}
                title={
                    !permissionSettings.allowAudio && isMute && !isHost
                        ? 'Host has disabled audio'
                        : isMute
                        ? 'Unmute microphone'
                        : 'Mute microphone'
                }
            >
                {isMute ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Video toggle (camera) - with permission check */}
            <button
                onClick={handleToggleCamera}
                disabled={!permissionSettings.allowVideo && !isCameraEnabled && !isHost}
                className={cn(
                    'flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                    !permissionSettings.allowVideo && !isCameraEnabled && !isHost
                        ? 'bg-gray-500 text-white/50 cursor-not-allowed opacity-50'
                        : !isCameraEnabled
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-dark-3 text-white hover:bg-dark-4'
                )}
                title={
                    !permissionSettings.allowVideo && !isCameraEnabled && !isHost
                        ? 'Host has disabled video'
                        : isCameraEnabled
                        ? 'Turn off camera'
                        : 'Turn on camera'
                }
            >
                {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>


            {/* Screen share - available for all users; requests permission when needed */}
            <button
                onClick={async () => {
                    try {
                        if (!permissionSettings.allowScreenShare && !isLocalSharing && !isHost) {
                            toast({
                                title: 'Screen sharing disabled',
                                description: 'The host has disabled screen sharing for participants',
                                variant: 'destructive',
                            });
                            return;
                        }

                        if (isAnotherParticipantSharing) {
                            if (hostCanOverrideShare && currentSharerId && call) {
                                await call.muteUser(currentSharerId, 'screenshare');
                                await call.muteUser(currentSharerId, 'screenshare_audio');
                                await call.screenShare.toggle();
                                toast({
                                    title: 'Screen share takeover',
                                    description: `You are now sharing. ${currentSharerName || 'Participant'} was stopped.`,
                                });
                                return;
                            }

                            toast({
                                title: 'Screen sharing in progress',
                                description: `${currentSharerName || 'Another participant'} is already sharing the screen`,
                            });
                            return;
                        }

                        const hasScreensharePermission =
                            call?.state.ownCapabilities.includes(OwnCapability.SCREENSHARE) ||
                            call?.state.ownCapabilities.includes('screenshare');

                        if (hasScreensharePermission) {
                            await call?.screenShare.toggle();
                        } else {
                            await call?.requestPermissions({ permissions: [OwnCapability.SCREENSHARE] });
                            toast({
                                title: 'Permission requested',
                                description: 'Waiting for host to allow screen sharing',
                            });
                        }
                    } catch (error) {
                        toast({
                            title: 'Screen share unavailable',
                            description: 'Unable to start screen sharing in this meeting',
                            variant: 'destructive',
                        });
                        console.error('Failed to toggle/request screen share:', error);
                    }
                }}
                className={cn(
                    'flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                    !permissionSettings.allowScreenShare && !isLocalSharing && !isHost
                        ? 'bg-gray-500 text-white/50 cursor-not-allowed opacity-50'
                        : '',
                    isLocalSharing
                        ? 'bg-blue-1 text-white hover:bg-blue-3'
                        : 'bg-dark-3 text-white hover:bg-dark-4'
                )}
                disabled={!permissionSettings.allowScreenShare && !isLocalSharing && !isHost}
                title={isLocalSharing ? 'Stop sharing your screen' : 'Share your screen'}
            >
                {isLocalSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
            </button>


            {/* Record call button */}
            <button
                onClick={handleToggleRecord}
                disabled={!canRecord}
                className={cn(
                    'flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                    !canRecord
                        ? 'bg-gray-500 text-white/50 cursor-not-allowed opacity-50'
                        : '',
                    isRecording
                        ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl'
                        : 'bg-dark-3 text-white hover:bg-dark-4'
                )}
                title={!canRecord ? 'Recording disabled by host' : isRecording ? 'Stop recording' : 'Start recording'}
            >
                <Circle size={20} fill={isRecording ? 'currentColor' : 'none'} />
            </button>

            {/* Leave call button */}
            <button
                onClick={handleLeave}
                className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95 shadow-lg hover:shadow-xl"
                title="Leave call"
            >
                <Phone size={20} className="rotate-180" />
            </button>
        </div>
    );
};

export default CustomCallControls;
