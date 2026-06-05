'use client';

import React from 'react';
import Image from 'next/image';
import { useCallStateHooks, useCall, OwnCapability, SfuModels } from '@stream-io/video-react-sdk';
import { Mic, MicOff, Video, VideoOff, Search, ShieldAlert, Hand } from 'lucide-react';

import { useToast } from './ui/use-toast';

// Raised hand tracking type
interface RaisedHand {
    userId: string;
    participantName: string;
    timestamp: number;
}

interface CustomParticipantsListProps {
    onClose?: () => void;
    raisedHands?: RaisedHand[];
    onLowerHand?: (userId: string, participantName: string) => void;
}

const CustomParticipantsList = ({ onClose, raisedHands = [], onLowerHand }: CustomParticipantsListProps) => {
    const { useParticipants, useLocalParticipant, useHasPermissions } = useCallStateHooks();
    const call = useCall();
    const participants = useParticipants();
    const localParticipant = useLocalParticipant();
    const [searchQuery, setSearchQuery] = React.useState('');
    const { toast } = useToast();

    // Check if current user has moderation capabilities
    const canMuteUsers = useHasPermissions(OwnCapability.MUTE_USERS);

    // Check if current user is the meeting host/creator
    const isHost = React.useMemo(() => {
        if (!call || !localParticipant) return false;
        const createdBy = call.state.createdBy;
        return createdBy?.id === localParticipant.userId;
    }, [call, localParticipant]);

    // Check if participant has their hand raised
    const hasRaisedHand = (userId: string) => {
        return raisedHands.some((h) => h.userId === userId);
    };

    // Sort participants: matching search query first, then others
    const filteredParticipants = participants.filter((p) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.userId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Toggle local participant's audio
    const toggleLocalAudio = async () => {
        if (!call) return;
        try {
            await call.microphone.toggle();
        } catch (error) {
            console.error('Error toggling microphone:', error);
        }
    };

    // Toggle local participant's video
    const toggleLocalVideo = async () => {
        if (!call) return;
        try {
            await call.camera.toggle();
        } catch (error) {
            console.error('Error toggling camera:', error);
        }
    };



    // Host control: Mute participant's microphone
    const muteParticipantAudio = async (userId: string, participantName: string) => {
        if (!call || !(canMuteUsers || isHost)) return;
        try {
            await call.muteUser(userId, 'audio');
            toast({
                title: 'Participant muted',
                description: `${participantName}'s microphone has been muted`,
            });
        } catch (error) {
            console.error('Error muting participant:', error);
            toast({
                title: 'Error',
                description: 'Failed to mute participant',
                variant: 'destructive',
            });
        }
    };

    // Host control: Disable participant's camera
    const disableParticipantVideo = async (userId: string, participantName: string) => {
        if (!call || !(canMuteUsers || isHost)) return;
        try {
            await call.muteUser(userId, 'video');
            toast({
                title: 'Camera disabled',
                description: `${participantName}'s camera has been turned off`,
            });
        } catch (error) {
            console.error('Error disabling participant camera:', error);
            toast({
                title: 'Error',
                description: 'Failed to disable camera',
                variant: 'destructive',
            });
        }
    };





    // Get initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Generate consistent avatar color based on name
    const getAvatarColor = (name: string) => {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div className="custom-participants-list">
            {/* Search bar */}
            <div className="custom-participants-list__search">
                <Search size={18} className="custom-participants-list__search-icon" />
                <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="custom-participants-list__search-input"
                />
            </div>

            {/* Participants list */}
            <div className="custom-participants-list__items">
                {filteredParticipants.map((participant) => {
                    const isLocal = participant.userId === localParticipant?.userId;
                    // Use proper Stream SDK track type detection with fallback
                    // Debug logs
                    console.log(`Participant ${participant.userId} tracks:`, participant.publishedTracks);

                    const isMuted = !participant.publishedTracks.includes(SfuModels.TrackType.AUDIO) && !participant.publishedTracks.includes(1);
                    const isVideoOff = !participant.publishedTracks.includes(SfuModels.TrackType.VIDEO) && !participant.publishedTracks.includes(2);

                    const isParticipantHost = call?.state.createdBy?.id === participant.userId;

                    return (
                        <div
                            key={participant.sessionId}
                            className="custom-participant-item"
                        >
                            {/* Avatar */}
                            <div className="relative">
                                <div
                                    className="custom-participant-item__avatar"
                                    style={{ background: getAvatarColor(participant.name || 'U') }}
                                >
                                    {participant.image ? (
                                        <Image src={participant.image} alt={participant.name || 'Participant'} width={40} height={40} className="rounded-full object-cover" />
                                    ) : (
                                        getInitials(participant.name || 'Unknown')
                                    )}
                                </div>
                                {/* Mic status indicator badge - bottom right corner */}
                                <div className={`absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-dark-1 ${isMuted ? 'bg-red-500' : 'bg-green-500'
                                    }`}>
                                    {isMuted ? <MicOff size={10} className="text-white" /> : <Mic size={10} className="text-white" />}
                                </div>
                            </div>

                            {/* Name and host badge */}
                            <div className="custom-participant-item__info">
                                <span className="custom-participant-item__name">
                                    {participant.name || 'Unknown'}
                                    {isLocal && ' (Me)'}
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                    {isParticipantHost && (
                                        <span className="custom-participant-item__host-badge">
                                            <ShieldAlert size={10} />
                                            Host
                                        </span>
                                    )}
                                    {/* Raised hand badge */}
                                    {hasRaisedHand(participant.userId) && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                                            <Hand size={10} />
                                            Hand up
                                            {/* Lower button for host */}
                                            {isHost && !isLocal && onLowerHand && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onLowerHand(participant.userId, participant.name || 'Participant');
                                                    }}
                                                    className="ml-1 rounded bg-yellow-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300 transition-colors hover:bg-red-500/30 hover:text-red-300"
                                                >
                                                    Lower
                                                </button>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="custom-participant-item__actions">
                                {/* Mic button - Local can toggle, Host can mute others */}
                                <button
                                    onClick={async () => {
                                        if (isLocal) {
                                            // Local user toggles their own mic
                                            await toggleLocalAudio();
                                        } else if ((canMuteUsers || isHost) && !isMuted) {
                                            // Host can mute others (not unmute - privacy)
                                            await muteParticipantAudio(participant.userId, participant.name || 'Participant');
                                        }
                                    }}
                                    className={`custom-participant-item__btn ${isMuted ? 'custom-participant-item__btn--muted' : 'custom-participant-item__btn--active'
                                        } ${isLocal || ((canMuteUsers || isHost) && !isMuted)
                                            ? 'custom-participant-item__btn--interactive'
                                            : ''
                                        }`}
                                    disabled={!isLocal && (!(canMuteUsers || isHost) || isMuted)}
                                    title={
                                        isLocal
                                            ? (isMuted ? 'Turn on microphone' : 'Turn off microphone')
                                            : ((canMuteUsers || isHost) && !isMuted)
                                                ? 'Mute this participant'
                                                : (isMuted ? 'Microphone is off' : 'Microphone is on')
                                    }
                                >
                                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                                </button>

                                {/* Video button - Local can toggle, Host can disable others */}
                                <button
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        if (isLocal) {
                                            // Local user toggles their own camera
                                            console.log('Toggling local camera...');
                                            await toggleLocalVideo();
                                        } else if ((canMuteUsers || isHost) && !isVideoOff) {
                                            // Host can turn off others' camera (not turn on - privacy)
                                            console.log('Host disabling participant camera...');
                                            await disableParticipantVideo(participant.userId, participant.name || 'Participant');
                                        }
                                    }}
                                    className={`custom-participant-item__btn ${isVideoOff ? 'custom-participant-item__btn--off' : 'custom-participant-item__btn--active'} ${isLocal || ((canMuteUsers || isHost) && !isVideoOff) ? 'custom-participant-item__btn--interactive' : ''}`}
                                    disabled={!isLocal && (!(canMuteUsers || isHost) || isVideoOff)}
                                    title={
                                        isLocal
                                            ? (isVideoOff ? 'Turn on camera' : 'Turn off camera')
                                            : ((canMuteUsers || isHost) && !isVideoOff)
                                                ? 'Turn off camera for this participant'
                                                : (isVideoOff ? 'Camera is off' : 'Camera is on')
                                    }
                                >
                                    {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
                                </button>

                                {/* Menu removed - centralized in Host Controls Settings */}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mute All / Unmute All control - Only for hosts */}
            {(canMuteUsers || isHost) && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={async () => {
                            if (!call) return;
                            try {
                                // Mute all participants except the host
                                const participantsToMute = participants.filter(
                                    (p) => p.userId !== localParticipant?.userId
                                );

                                for (const participant of participantsToMute) {
                                    const isMuted = !participant.publishedTracks.includes(1);
                                    if (!isMuted) {
                                        await call.muteUser(participant.userId, 'audio');
                                    }
                                }

                                toast({
                                    title: 'All participants muted',
                                    description: 'All participants have been muted',
                                });
                            } catch (error) {
                                console.error('Error muting all participants:', error);
                                toast({
                                    title: 'Error',
                                    description: 'Failed to mute all participants',
                                    variant: 'destructive',
                                });
                            }
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
                    >
                        <MicOff size={16} />
                        <span>Mute All</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!call) return;
                            try {
                                // Mute all participants' cameras except the host
                                const participantsToMuteVideo = participants.filter(
                                    (p) => p.userId !== localParticipant?.userId
                                );

                                for (const participant of participantsToMuteVideo) {
                                    const isVideoOff = !participant.publishedTracks.includes(SfuModels.TrackType.VIDEO) && !participant.publishedTracks.includes(2);
                                    if (!isVideoOff) {
                                        await call.muteUser(participant.userId, 'video');
                                    }
                                }

                                toast({
                                    title: 'All cameras disabled',
                                    description: 'All participants\' cameras have been turned off',
                                });
                            } catch (error) {
                                console.error('Error disabling all cameras:', error);
                                toast({
                                    title: 'Error',
                                    description: 'Failed to disable all cameras',
                                    variant: 'destructive',
                                });
                            }
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
                    >
                        <VideoOff size={16} />
                        <span>Mute All</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomParticipantsList;
