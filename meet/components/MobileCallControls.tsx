'use client';

import {
    OwnCapability,
    useCall,
    useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from './ui/use-toast';
import { useHostSettings } from '@/context/HostSettingsContext';

interface MobileCallControlsProps {
    onLeave?: () => void;
    itemClassName?: string;
    isAnotherParticipantSharing?: boolean;
    currentSharerName?: string;
    currentSharerId?: string;
    hostCanOverrideShare?: boolean;
    isLocalSharing?: boolean;
}

/**
 * Mobile-specific CallControls component that excludes the reaction button.
 * Includes only mic, camera, screen share, record, and leave buttons.
 * Layout is optimized for mobile screens.
 */
const MobileCallControls = ({
    onLeave,
    itemClassName,
    isAnotherParticipantSharing = false,
    currentSharerName,
    currentSharerId,
    hostCanOverrideShare = false,
    isLocalSharing = false,
}: MobileCallControlsProps) => {
    const router = useRouter();
    const { toast } = useToast();
    const { permissionSettings } = useHostSettings();

    const handleLeave = () => {
        if (onLeave) {
            onLeave();
        } else {
            router.push('/');
        }
    };

    // Custom mic and camera toggle logic
    const call = useCall();
    const { useCameraState, useMicrophoneState, useLocalParticipant, useIsCallRecordingInProgress } = useCallStateHooks();
    const { isEnabled: isCameraEnabled } = useCameraState();
    const { isEnabled: isMicrophoneEnabled } = useMicrophoneState();
    const localParticipant = useLocalParticipant();
    const isHost = call?.state.createdBy?.id === localParticipant?.userId;
    const isRecording = useIsCallRecordingInProgress();
    const canRecord = isHost || permissionSettings.allowParticipantRecording;

    const handleToggleCamera = async () => {
        if (!call) return;
        if (!permissionSettings.allowVideo && !isCameraEnabled && !isHost) {
            toast({
                title: 'Video disabled',
                description: 'The host has disabled video for this meeting',
                variant: 'destructive',
            });
            return;
        }
        if (isCameraEnabled) {
            await call.camera.disable();
        } else {
            await call.camera.enable();
        }
    };

    const handleToggleMic = async () => {
        if (!call) return;
        if (!permissionSettings.allowAudio && !isMicrophoneEnabled && !isHost) {
            toast({
                title: 'Audio disabled',
                description: 'The host has disabled audio for this meeting',
                variant: 'destructive',
            });
            return;
        }
        if (isMicrophoneEnabled) {
            await call.microphone.disable();
        } else {
            await call.microphone.enable();
        }
    };

    const handleToggleScreenShare = async () => {
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
    };

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
        <div className={`${itemClassName || ''} flex gap-3 items-center justify-center`}>
            {/* Mic toggle */}
            <button
                onClick={handleToggleMic}
                disabled={!permissionSettings.allowAudio && !isMicrophoneEnabled && !isHost}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition ${(!permissionSettings.allowAudio && !isMicrophoneEnabled && !isHost) ? 'bg-gray-600 text-white/50 cursor-not-allowed opacity-50' : isMicrophoneEnabled ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                aria-label="Toggle microphone"
            >
                {isMicrophoneEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            {/* Camera toggle */}
            <button
                onClick={handleToggleCamera}
                disabled={!permissionSettings.allowVideo && !isCameraEnabled && !isHost}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition ${(!permissionSettings.allowVideo && !isCameraEnabled && !isHost) ? 'bg-gray-600 text-white/50 cursor-not-allowed opacity-50' : isCameraEnabled ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                aria-label="Toggle camera"
            >
                {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            {/* Screen share - available to everyone */}
            <button
                onClick={handleToggleScreenShare}
                disabled={!permissionSettings.allowScreenShare && !isLocalSharing && !isHost}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition ${
                    (!permissionSettings.allowScreenShare && !isLocalSharing && !isHost)
                        ? 'bg-gray-600 text-white/50 cursor-not-allowed opacity-50'
                        : isLocalSharing
                        ? 'bg-blue-1 hover:bg-blue-3 text-white'
                        : 'bg-[#333] hover:bg-[#444] text-white'
                }`}
                aria-label={isLocalSharing ? 'Stop screen sharing' : 'Share screen'}
                title={isLocalSharing ? 'Stop sharing your screen' : 'Share your screen'}
            >
                {isLocalSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
            </button>
            {/* Record - host + registered users only */}
            <button
                onClick={handleToggleRecord}
                disabled={!canRecord}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition ${
                    !canRecord
                        ? 'bg-gray-600 text-white/50 cursor-not-allowed opacity-50'
                        : isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-[#333] hover:bg-[#444] text-white'
                }`}
                aria-label="Toggle recording"
                title={!canRecord ? 'Recording disabled by host' : isRecording ? 'Stop recording' : 'Start recording'}
            >
                <Circle size={20} fill={isRecording ? 'currentColor' : 'none'} />
            </button>
            {/* Leave call button - always red */}
            <button
                onClick={handleLeave}
                className={`flex items-center justify-center w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white transition`}
                aria-label="Leave call"
            >
                {/* You can use a phone-off icon here if you want, or just text */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.46V18a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3 6.18 2 2 0 0 1 5 4h2.54a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11l-.27.27a16 16 0 0 0 6.29 6.29l.27-.27a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 21 15.46z"/></svg>
            </button>
        </div>
    );
};

export default MobileCallControls;
