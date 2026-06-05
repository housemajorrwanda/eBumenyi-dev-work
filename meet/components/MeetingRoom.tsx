'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  ParticipantView,
  CustomVideoEvent,
  SfuModels,
  OwnCapability,
  ParticipantViewProps,
} from '@stream-io/video-react-sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Clock,
  Copy,
  Check,
  X,
  ChevronLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Smile,
  Circle,
  SwitchCamera,
  MessageCircle,
  MonitorUp,
  MonitorOff,
  Settings,
  Shield,
  Minimize,
} from 'lucide-react';
import { useHostSettings } from '@/context/HostSettingsContext';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import Loader from './Loader';
import EndCallButton from './EndCallButton';
import CustomCallControls from './CustomCallControls';
import ChatPanel from './ChatPanel';
import CustomParticipantsList from './CustomParticipantsList';
import CallSettingsModal from './CallSettingsModal';
import HostSettingsModal from './HostSettingsModal';
import { cn } from '@/lib/utils';
import { useToast } from './ui/use-toast';
import {
  initializeSpeechRecognition,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '@/lib/callSettings.utils';

// Emoji reaction type
interface EmojiReaction {
  id: string;
  emoji: string;
  x: number; // horizontal position percentage
  drift: number;
  duration: number;
  delay: number;
  scale: number;
  rotate: number;
}

// Raised hand tracking type
interface RaisedHand {
  userId: string;
  participantName: string;
  timestamp: number;
}

// Chat message type
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

interface AccessibilitySettings {
  enableCaptions: boolean;
}

// Available emoji reactions (Google Meet style)
const REACTION_EMOJIS = ['👍', '❤️', '😂', '👏', '😮', '🎉'];

// Simple UI for participant cards to remove the default menu
const SimpleParticipantViewUI = (props: ParticipantViewProps) => {
  const { participant } = props;
  if (!participant) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between p-2 pointer-events-none">
      <div className="flex items-center gap-1.5 rounded-lg bg-dark-2/40 px-2 py-1 backdrop-blur-md border border-white/5">
        <span className="text-[10px] font-medium text-white/90 truncate max-w-[100px]">
          {participant.name || 'Participant'}
        </span>
        {participant.isLocalParticipant && <span className="text-[8px] text-white/40 font-bold uppercase">(You)</span>}
      </div>
    </div>
  );
};

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const { toast } = useToast();
  const { permissionSettings, securitySettings, setPermissionSettings, setSecuritySettings } = useHostSettings();
  const [showParticipants, setShowParticipants] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState<EmojiReaction[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const [showRaisedHandsPanel, setShowRaisedHandsPanel] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isViewingSelfShare, setIsViewingSelfShare] = useState(false);
  // viewer's control to maximize an ongoing screen share
  const [isShareMaximized, setIsShareMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [showOverlayActions, setShowOverlayActions] = useState(true);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({ enableCaptions: false });
  const [liveCaption, setLiveCaption] = useState('');
  const [captionHistory, setCaptionHistory] = useState<string[]>([]);
  const grantedScreenshareUserIds = useRef<Set<string>>(new Set());
  const {
    useCallCallingState,
    useParticipantCount,
    useLocalParticipant,
    useMicrophoneState,
    useCameraState,
    useHasOngoingScreenShare,
    useIsCallRecordingInProgress,
    useParticipants,
    useHasPermissions
  } = useCallStateHooks();
  const call = useCall();

  const canUpdatePermissions = useHasPermissions(OwnCapability.UPDATE_CALL_PERMISSIONS);


  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const localParticipant = useLocalParticipant();
  // eslint-disable-next-line no-unused-vars
  const participants = useParticipants(); // Used for future participant video overlay indicators
  const { isMute: isMicMuted, isEnabled: isMicEnabled } = useMicrophoneState();
  const { isEnabled: isCameraEnabled, camera, devices: cameraDevices, selectedDevice: selectedCameraDevice } = useCameraState();
  const isSomewhereScreenSharing = useHasOngoingScreenShare();
  const isCallRecordingInProgress = useIsCallRecordingInProgress();

  // identify who is sharing right now (if any)
  const sharingParticipant = useMemo(() => {
    return participants.find((p) =>
      p.publishedTracks.includes(SfuModels.TrackType.SCREEN_SHARE) ||
      p.publishedTracks.includes(3)
    );
  }, [participants]);



  const isLocalSharing = useMemo(() => {
    return localParticipant?.publishedTracks.includes(SfuModels.TrackType.SCREEN_SHARE) ||
      localParticipant?.publishedTracks.includes(3);
  }, [localParticipant]);

  const activeSharerName = useMemo(() => {
    if (!sharingParticipant) return null;
    return sharingParticipant.userId === localParticipant?.userId
      ? 'You'
      : sharingParticipant.name || 'A participant';
  }, [sharingParticipant, localParticipant?.userId]);

  const mobileVisibleParticipants = useMemo(() => {
    return participants.slice(0, 12);
  }, [participants]);

  const mobileExtraParticipants = useMemo(() => {
    return Math.max(participantCount - 1 - mobileVisibleParticipants.length, 0);
  }, [participantCount, mobileVisibleParticipants.length]);

  // Auto-grant screenshare permission to participants (including guests)
  // when current user can manage call permissions.
  useEffect(() => {
    if (!call || !canUpdatePermissions) return;

    const grantScreenshare = async (userId: string) => {
      try {
        await call.grantPermissions(userId, [OwnCapability.SCREENSHARE]);
        grantedScreenshareUserIds.current.add(userId);
      } catch (error) {
        // Keep non-blocking: some roles/call types may reject duplicate or restricted grants.
        console.error(`Failed to grant screenshare for ${userId}:`, error);
      }
    };

    for (const participant of participants) {
      if (!participant.userId) continue;
      if (participant.userId === localParticipant?.userId) continue;
      if (grantedScreenshareUserIds.current.has(participant.userId)) continue;
      grantScreenshare(participant.userId).catch((error) => {
        console.error(`Failed to grant screenshare for ${participant.userId}:`, error);
      });
    }
  }, [call, canUpdatePermissions, participants, localParticipant?.userId]);

  // Reset self-view when sharing ends
  useEffect(() => {
    if (!isLocalSharing) {
      setIsViewingSelfShare(false);
    }
  }, [isLocalSharing, isSomewhereScreenSharing]);

  // when no one is sharing anymore make sure maximize state is cleared
  useEffect(() => {
    if (!isSomewhereScreenSharing) {
      setIsShareMaximized(false);
    }
  }, [isSomewhereScreenSharing]);


  // Check if current user is the host (created the call)
  const isHost = useMemo(() => {
    if (!call || !localParticipant) return false;
    const callCreatedBy = call.state.createdBy?.id;
    return callCreatedBy === localParticipant.userId;
  }, [call, localParticipant]);

  const meetingTitle = useMemo(() => {
    const customTitle = call?.state?.custom?.description as string | undefined;
    return customTitle?.trim() || 'Instant Meeting';
  }, [call]);

  useEffect(() => {
    const loadAccessibility = () => {
      try {
        const saved = localStorage.getItem('callSettings_accessibility');
        if (saved) {
          const parsed = JSON.parse(saved) as AccessibilitySettings;
          setAccessibilitySettings({ enableCaptions: !!parsed.enableCaptions });
          return;
        }
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
      setAccessibilitySettings({ enableCaptions: false });
    };
    const onSettingsUpdated = () => loadAccessibility();

    loadAccessibility();
    window.addEventListener('call-settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('call-settings-updated', onSettingsUpdated);
  }, []);

  useEffect(() => {
    if (!accessibilitySettings.enableCaptions) {
      stopSpeechRecognition();
      setLiveCaption('');
      return;
    }

    const recognition = initializeSpeechRecognition((transcript: string, isFinal: boolean) => {
      if (isFinal) {
        setCaptionHistory((prev) => [...prev, transcript].slice(-10));
        setLiveCaption('');
      } else {
        setLiveCaption(transcript);
      }
    });

    if (recognition) startSpeechRecognition();
    return () => stopSpeechRecognition();
  }, [accessibilitySettings.enableCaptions]);

  // Keep host settings recording flag synchronized with actual SDK state.
  useEffect(() => {
    setSecuritySettings((prev) => {
      if (prev.recordingEnabled === isCallRecordingInProgress) return prev;
      return { ...prev, recordingEnabled: isCallRecordingInProgress };
    });
  }, [isCallRecordingInProgress, setSecuritySettings]);

  // Broadcast host settings so all participants receive current rules.
  useEffect(() => {
    if (!call || !isHost || !localParticipant) return;

    call.sendCustomEvent({
      type: 'host-settings-update',
      senderId: localParticipant.userId,
      permissionSettings,
      securitySettings,
      timestamp: Date.now(),
    }).catch((error) => {
      console.error('Failed to broadcast host settings:', error);
    });
  }, [call, isHost, localParticipant, permissionSettings, securitySettings, participantCount]);

  // Toggle raise hand - broadcasts to all participants
  const toggleRaiseHand = useCallback(async () => {
    if (!call || !localParticipant) return;

    // Check if hand raise is allowed
    if (!permissionSettings.allowHandRaise && !isHandRaised && !isHost) {
      toast({
        title: 'Hand Raise Disabled',
        description: 'The host has disabled hand raise for this meeting',
        variant: 'destructive',
      });
      return;
    }

    const newHandState = !isHandRaised;
    setIsHandRaised(newHandState);

    try {
      await call.sendCustomEvent({
        type: 'hand-raise',
        action: newHandState ? 'raise' : 'lower',
        userId: localParticipant.userId,
        participantName: localParticipant.name || 'Unknown',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to send hand raise event:', error);
      // Revert local state on failure
      setIsHandRaised(!newHandState);
    }
  }, [call, localParticipant, isHandRaised, permissionSettings.allowHandRaise, toast, isHost]);

  const toggleMobileMic = useCallback(async () => {
    if (!call) return;
    if (!permissionSettings.allowAudio && !isMicEnabled && !isHost) {
      toast({
        title: 'Audio disabled',
        description: 'The host has disabled audio for this meeting',
        variant: 'destructive',
      });
      return;
    }
    if (isMicEnabled) {
      await call.microphone.disable();
    } else {
      await call.microphone.enable();
    }
  }, [call, permissionSettings.allowAudio, isMicEnabled, isHost, toast]);

  const toggleMobileCamera = useCallback(async () => {
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
  }, [call, permissionSettings.allowVideo, isCameraEnabled, isHost, toast]);

  const toggleMobileShare = useCallback(async () => {
    if (!call) return;
    try {
      if (!permissionSettings.allowScreenShare && !isLocalSharing && !isHost) {
        toast({
          title: 'Screen sharing disabled',
          description: 'The host has disabled screen sharing for participants',
          variant: 'destructive',
        });
        return;
      }

      if (isSomewhereScreenSharing && !isLocalSharing) {
        if (isHost && sharingParticipant?.userId) {
          await call.muteUser(sharingParticipant.userId, 'screenshare');
          await call.muteUser(sharingParticipant.userId, 'screenshare_audio');
          await call.screenShare.toggle();
          toast({
            title: 'Screen share takeover',
            description: `You are now sharing. ${activeSharerName || 'Participant'} was stopped.`,
          });
          return;
        }
        toast({
          title: 'Screen sharing in progress',
          description: `${activeSharerName || 'Another participant'} is already sharing the screen`,
        });
        return;
      }

      const hasScreensharePermission =
        call.state.ownCapabilities.includes(OwnCapability.SCREENSHARE) ||
        call.state.ownCapabilities.includes('screenshare');

      if (hasScreensharePermission) {
        await call.screenShare.toggle();
      } else {
        await call.requestPermissions({ permissions: [OwnCapability.SCREENSHARE] });
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
  }, [
    call,
    permissionSettings.allowScreenShare,
    isLocalSharing,
    isHost,
    isSomewhereScreenSharing,
    sharingParticipant?.userId,
    activeSharerName,
    toast,
  ]);

  const toggleMobileRecording = useCallback(async () => {
    if (!call) return;
    const canRecordNow = isHost || permissionSettings.allowParticipantRecording;
    if (!canRecordNow) {
      toast({
        title: 'Recording unavailable',
        description: 'Recording is disabled by host',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isCallRecordingInProgress) {
        await call.stopRecording();
      } else {
        await call.startRecording();
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error);
    }
  }, [call, isHost, permissionSettings.allowParticipantRecording, isCallRecordingInProgress, toast]);

  const handleMobileLeave = useCallback(async () => {
    try {
      await call?.leave();
    } catch (error) {
      console.error('Failed to leave call cleanly:', error);
    } finally {
      router.push(`/`);
    }
  }, [call, router]);

  const toggleOverlayActions = useCallback(() => {
    setShowOverlayActions((prev) => !prev);
  }, []);

  const rotateMobileCamera = useCallback(async () => {
    if (!camera) return;
    const list = (cameraDevices || []).filter((d) => d?.deviceId);
    if (list.length <= 1) return;

    const currentId = selectedCameraDevice || '';
    const currentIndex = list.findIndex((d) => d.deviceId === currentId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % list.length : 0;
    const nextDeviceId = list[nextIndex]?.deviceId;

    if (nextDeviceId) {
      await camera.select(nextDeviceId);
    }
  }, [camera, cameraDevices, selectedCameraDevice]);

  // Host function to lower a participant's hand
  const lowerParticipantHand = useCallback(async (userId: string, participantName: string) => {
    if (!call || !isHost) return;

    try {
      await call.sendCustomEvent({
        type: 'hand-raise',
        action: 'lower',
        userId,
        participantName,
        loweredByHost: true,
        timestamp: Date.now(),
      });

      // Remove from local raised hands list
      setRaisedHands((prev) => prev.filter((h) => h.userId !== userId));

      toast({
        title: 'Hand lowered',
        description: `${participantName}'s hand has been lowered`,
      });
    } catch (error) {
      console.error('Failed to lower participant hand:', error);
    }
  }, [call, isHost, toast]);

  // Check if a specific participant has their hand raised
  // eslint-disable-next-line no-unused-vars
  const hasRaisedHand = useCallback((userId: string) => {
    return raisedHands.some((h) => h.userId === userId);
  }, [raisedHands]); // Used for future participant video overlay indicators

  // Send emoji reaction - creates floating animation and broadcasts to all participants
  const sendEmoji = useCallback(async (emoji: string) => {
    // Check if reactions are allowed
    if (!permissionSettings.allowReactions && !isHost) {
      toast({
        title: 'Reactions Disabled',
        description: 'The host has disabled reactions for this meeting',
        variant: 'destructive',
      });
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Random horizontal position (10% to 90% of screen width)
    const x = Math.random() * 80 + 10;
    const drift = Math.random() * 140 - 70; // -70px to +70px
    const duration = 2.6 + Math.random() * 1.2; // 2.6s to 3.8s
    const delay = Math.random() * 0.18; // slight stagger
    const scale = 0.9 + Math.random() * 0.45; // varied emoji size
    const rotate = Math.random() * 20 - 10; // subtle tilt

    const newReaction: EmojiReaction = {
      id,
      emoji,
      x,
      drift,
      duration,
      delay,
      scale,
      rotate,
    };

    // Show locally immediately
    setActiveEmojis((prev) => [...prev, newReaction]);

    // Remove emoji after animation completes (5 seconds)
    setTimeout(() => {
      setActiveEmojis((prev) => prev.filter((r) => r.id !== id));
    }, Math.ceil((duration + delay + 0.5) * 1000));

    // Broadcast to all participants
    if (call) {
      try {
        await call.sendCustomEvent({
          type: 'emoji-reaction',
          emoji,
          senderId: localParticipant?.userId || 'unknown',
          senderName: localParticipant?.name || 'Unknown',
          reactionId: id,
          x, // Share the same position so it appears in the same place for everyone
          drift,
          duration,
          delay,
          scale,
          rotate,
        });
      } catch (error) {
        console.error('Failed to send emoji reaction:', error);
      }
    }
  }, [call, localParticipant?.userId, localParticipant?.name, permissionSettings.allowReactions, toast, isHost]);

  // Listen for incoming custom events (chat messages, emoji reactions, and hand raises)
  useEffect(() => {
    if (!call) return;

    const handleCustomEvent = (event: { type: 'custom' } & CustomVideoEvent) => {
      const customData = event.custom as Record<string, unknown>;

      // Handle chat messages
      if (customData?.type === 'chat-message') {
        const messageId = (customData.messageId as string) || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const senderId = (customData.senderId as string) || 'unknown';
        const senderName = (customData.senderName as string) || 'Unknown';
        const text = (customData.message as string) || '';
        const timestamp = new Date((customData.timestamp as string) || Date.now());

        const incomingMessage: ChatMessage = {
          id: messageId,
          senderId,
          senderName,
          text,
          timestamp,
          isOwn: senderId === localParticipant?.userId,
        };

        // Add message to state
        setMessages((prev) => {
          // Check if message already exists (e.g. if we added our own locally)
          if (prev.some(m => m.id === messageId)) return prev;
          return [...prev, incomingMessage];
        });

        // Only increment if it's not our own message and chat is closed
        if (senderId !== localParticipant?.userId && !showChat) {
          setUnreadMessageCount((prev) => prev + 1);
        }
      }

      // Handle emoji reactions from other participants
      if (customData?.type === 'emoji-reaction') {
        const senderId = customData.senderId as string;
        // Only show if it's not our own reaction (we already show it locally)
        if (senderId !== localParticipant?.userId) {
          const emoji = customData.emoji as string;
          const x = customData.x as number;
          const reactionId = (customData.reactionId as string) || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const drift = (customData.drift as number) ?? (Math.random() * 140 - 70);
          const duration = (customData.duration as number) ?? (2.6 + Math.random() * 1.2);
          const delay = (customData.delay as number) ?? (Math.random() * 0.18);
          const scale = (customData.scale as number) ?? (0.9 + Math.random() * 0.45);
          const rotate = (customData.rotate as number) ?? (Math.random() * 20 - 10);

          const incomingReaction: EmojiReaction = {
            id: reactionId,
            emoji,
            x,
            drift,
            duration,
            delay,
            scale,
            rotate,
          };

          setActiveEmojis((prev) => [...prev, incomingReaction]);

          // Remove after animation completes
          setTimeout(() => {
            setActiveEmojis((prev) => prev.filter((r) => r.id !== reactionId));
          }, Math.ceil((duration + delay + 0.5) * 1000));
        }
      }

      // Handle hand raise events
      if (customData?.type === 'hand-raise') {
        const action = customData.action as string;
        const userId = customData.userId as string;
        const participantName = customData.participantName as string;
        const timestamp = customData.timestamp as number;
        const loweredByHost = customData.loweredByHost as boolean;

        if (action === 'raise') {
          // Add to raised hands list (avoid duplicates)
          setRaisedHands((prev) => {
            if (prev.some((h) => h.userId === userId)) return prev;
            return [...prev, { userId, participantName, timestamp }];
          });

          // If this is our own hand being raised, update local state
          if (userId === localParticipant?.userId) {
            setIsHandRaised(true);
          }

          // Show notification to host when someone raises their hand
          if (isHost && userId !== localParticipant?.userId) {
            toast({
              title: '✋ Hand raised',
              description: `${participantName} raised their hand`,
              duration: 5000,
            });
          }
        } else if (action === 'lower') {
          // Remove from raised hands list
          setRaisedHands((prev) => prev.filter((h) => h.userId !== userId));

          // If this is our hand being lowered (by host), update local state
          if (userId === localParticipant?.userId) {
            setIsHandRaised(false);
            // Notify user if host lowered their hand
            if (loweredByHost) {
              toast({
                title: 'Hand lowered',
                description: 'The host has lowered your hand',
              });
            }
          }
        }
      }

      // Sync host settings to all participants (host remains source of truth)
      if (customData?.type === 'host-settings-update') {
        const senderId = customData.senderId as string | undefined;
        const hostId = call.state.createdBy?.id;
        if (!senderId || senderId !== hostId || isHost) return;

        const incomingPermissions = customData.permissionSettings as typeof permissionSettings | undefined;
        const incomingSecurity = customData.securitySettings as typeof securitySettings | undefined;

        if (incomingPermissions) {
          setPermissionSettings(incomingPermissions);
        }
        if (incomingSecurity) {
          setSecuritySettings(incomingSecurity);
        }
      }
    };

    call.on('custom', handleCustomEvent);
    return () => {
      call.off('custom', handleCustomEvent);
    };
  }, [call, localParticipant?.userId, showChat, isHost, toast, permissionSettings, securitySettings, setPermissionSettings, setSecuritySettings]);

  // Clear unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessageCount(0);
    }
  }, [showChat]);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format duration as HH:MM:SS or MM:SS
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy meeting link
  const copyMeetingLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Responsive breakpoint detection with debounce
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsSmallMobile(width < 480);
      setIsMobile(width < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Dynamic grid sizing based on participants and screen
  const gridSize = useMemo(() => {
    if (isSmallMobile) return 10;
    if (isMobile) return 12;
    return 8;
  }, [isSmallMobile, isMobile]);

  const participantsBarPosition = useMemo(() => {
    if (isMobile) return null;
    if (isSomewhereScreenSharing) return null;
    if (participantCount <= 2) return null;
    return 'right';
  }, [isMobile, participantCount, isSomewhereScreenSharing]);

  const isImmersiveShare = isSomewhereScreenSharing && !showOverlayActions;

  useEffect(() => {
    if (!isImmersiveShare) return;
    setShowChat(false);
    setShowParticipants(false);
    setShowEmojiPicker(false);
  }, [isImmersiveShare]);

  // Memoize the call layout to prevent video elements from being recreated
  const CallLayout = useMemo(() => {
    // if viewer has maximized any screen share, show just that feed
    if (isShareMaximized && sharingParticipant) {
      return (
        <div className="relative size-full bg-dark-1">
          <ParticipantView
            participant={sharingParticipant}
            trackType="screenShareTrack"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsShareMaximized(false);
            }}
            className="absolute left-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-dark-3/80 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-dark-4"
          >
            <Minimize size={16} />
            Back to meeting
          </button>
        </div>
      );
    }
    // If local user wants to see their own share explicitly
    if (isViewingSelfShare && localParticipant) {
      return (
        <div className="relative size-full bg-dark-1">
          <ParticipantView
            participant={localParticipant}
            trackType="screenShareTrack"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsViewingSelfShare(false);
            }}
            className="absolute left-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-dark-3/80 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-dark-4"
          >
            <X size={16} />
            Back to meeting
          </button>
        </div>
      );
    }

    // If someone is sharing screen, always prioritize SpeakerLayout but with specific settings
    if (isSomewhereScreenSharing) {
      return (
        <SpeakerLayout
          participantsBarPosition={participantsBarPosition}
          ParticipantViewUISpotlight={SimpleParticipantViewUI as any}
          ParticipantViewUIBar={SimpleParticipantViewUI as any}
        />
      );
    }

    return (
      <PaginatedGridLayout
        groupSize={gridSize}
        pageArrowsVisible={!isMobile}
        ParticipantViewUI={SimpleParticipantViewUI as any}
      />
    );
  }, [gridSize, isMobile, participantsBarPosition, isSomewhereScreenSharing, isViewingSelfShare, localParticipant, isShareMaximized, sharingParticipant]);

  // Show loader while not joined
  if (callingState !== CallingState.JOINED) return <Loader />;

  // Mobile Google Meet Layout - Tall vertical container with rounded corners
  if (isMobile) {
    return (
      <section className="mobile-meet-page relative h-dvh w-full overflow-hidden text-white">
        {!showChat && !showParticipants && (
          <div
            role="button"
            tabIndex={0}
            aria-label={showOverlayActions ? 'Hide controls' : 'Show controls'}
            className="mobile-meet-tap-toggle"
            onClick={toggleOverlayActions}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleOverlayActions();
              }
            }}
          />
        )}
        {showOverlayActions && !isImmersiveShare && (
          <div className="mobile-meet-header-stack" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-meet-topbar">
            <button
              onClick={() => router.push('/')}
              className="mobile-meet-back-btn"
              aria-label="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="mobile-meet-title-pill">
              <span className="truncate">{meetingTitle}</span>
            </div>
          </div>
          {isSomewhereScreenSharing && activeSharerName && (
            <div className="mobile-meet-share-pill">
              <span className="block max-w-full truncate">
                {activeSharerName === 'You'
                  ? 'You are sharing your screen'
                  : `${activeSharerName} is sharing their screen`}
              </span>
            </div>
          )}
        </div>
        )}
        {accessibilitySettings.enableCaptions && (liveCaption || captionHistory.length > 0) && (
          <div className="absolute bottom-24 left-1/2 z-40 w-[92vw] max-w-[640px] -translate-x-1/2 rounded-lg border border-white/10 bg-dark-2/90 px-3 py-2 text-center text-sm text-white backdrop-blur-md">
            {liveCaption || captionHistory[captionHistory.length - 1]}
          </div>
        )}


        {/* Main video area - Centered tall vertical container */}
        <div className={cn('mobile-meet-main-video', isImmersiveShare && 'mobile-meet-main-video--immersive-share')}>
          {/* Tall vertical video card with rounded corners */}
          <div className={cn(
            'mobile-meet-video-card',
            isSomewhereScreenSharing && 'mobile-meet-video-card--sharing',
            isImmersiveShare && 'mobile-meet-video-card--immersive-share'
          )}>
            {CallLayout}
          </div>

          {showOverlayActions && !isImmersiveShare && (
            <div
              className={cn('mobile-meet-name-overlay', isSomewhereScreenSharing && 'mobile-meet-name-overlay--share')}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{localParticipant?.name || 'You'}</span>
            </div>
          )}
        </div>

        {/* Self-view floating card - bottom right corner */}
        {showOverlayActions && !isImmersiveShare && (
          <div
            className="mobile-meet-self-view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-meet-self-video">
              {/* Render actual self-view video */}
              {localParticipant && (
                <ParticipantView
                  participant={localParticipant}
                  ParticipantViewUI={null}
                />
              )}
              {/* Mute indicator - top right of self-view when mic is muted */}
              {isMicMuted && (
                <div className="mobile-meet-self-mute">
                  <MicOff size={12} />
                </div>
              )}
              {/* Raised hand indicator - top left of self-view when hand is raised */}
              {isHandRaised && (
                <div className="raised-hand-indicator raised-hand-indicator--self">
                  <Hand size={14} />
                </div>
              )}
            </div>
            {/* Name at bottom of self-view */}
            <div className="mobile-meet-self-name">{localParticipant?.name || 'You'}</div>
          </div>
        )}

        {/* Floating emoji reactions overlay */}
        <div className="emoji-reactions-container">
          {activeEmojis.map((reaction) => (
            <span
              key={reaction.id}
              className="emoji-reaction"
              style={{
                left: `${reaction.x}%`,
                ['--emoji-drift' as string]: `${reaction.drift}px`,
                ['--emoji-duration' as string]: `${reaction.duration}s`,
                ['--emoji-delay' as string]: `${reaction.delay}s`,
                ['--emoji-scale' as string]: reaction.scale,
                ['--emoji-rotate' as string]: `${reaction.rotate}deg`,
              } as React.CSSProperties}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>

        {showOverlayActions && !showChat && !showParticipants && (
          <div
            className="mobile-meet-side-controls"
            onClick={(e) => e.stopPropagation()}
          >
          <button
            onClick={toggleMobileShare}
            disabled={!permissionSettings.allowScreenShare && !isLocalSharing && !isHost}
            className={cn(
              'mobile-meet-side-btn',
              isLocalSharing && 'mobile-meet-side-btn--active',
              !permissionSettings.allowScreenShare && !isLocalSharing && !isHost && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={isLocalSharing ? 'Stop sharing your screen' : 'Share screen'}
          >
            {isLocalSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
          </button>
          <button
            onClick={toggleMobileCamera}
            disabled={!permissionSettings.allowVideo && !isCameraEnabled && !isHost}
            className={cn(
              'mobile-meet-side-btn',
              !isCameraEnabled && 'mobile-meet-side-btn--warn',
              !permissionSettings.allowVideo && !isCameraEnabled && !isHost && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Toggle camera"
          >
            {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button
            onClick={rotateMobileCamera}
            disabled={(cameraDevices || []).length <= 1}
            className={cn(
              'mobile-meet-side-btn',
              (cameraDevices || []).length <= 1 && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Rotate camera"
          >
            <SwitchCamera size={18} />
          </button>
          <button
            onClick={toggleMobileMic}
            disabled={!permissionSettings.allowAudio && !isMicEnabled && !isHost}
            className={cn(
              'mobile-meet-side-btn',
              !isMicEnabled && 'mobile-meet-side-btn--warn',
              !permissionSettings.allowAudio && !isMicEnabled && !isHost && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Toggle microphone"
          >
            {isMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button
            onClick={toggleMobileRecording}
            disabled={!(isHost || permissionSettings.allowParticipantRecording)}
            className={cn(
              'mobile-meet-side-btn',
              isCallRecordingInProgress && 'mobile-meet-side-btn--recording',
              !(isHost || permissionSettings.allowParticipantRecording) && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={isCallRecordingInProgress ? 'Stop recording' : 'Start recording'}
          >
            <Circle size={18} fill={isCallRecordingInProgress ? 'currentColor' : 'none'} />
          </button>
          </div>
        )}

        {showOverlayActions && !showChat && !showParticipants && (
          <div
            className="mobile-meet-bottom-actions"
            onClick={(e) => e.stopPropagation()}
          >
          <button
            onClick={toggleRaiseHand}
            disabled={!permissionSettings.allowHandRaise && !isHandRaised && !isHost}
            className={cn('mobile-meet-bottom-btn', isHandRaised && 'mobile-meet-bottom-btn--hand-active')}
            aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand size={18} />
          </button>
          <button
            onClick={() => (permissionSettings.allowReactions || isHost) && setShowEmojiPicker((prev) => !prev)}
            disabled={!permissionSettings.allowReactions && !isHost}
            className={cn('mobile-meet-bottom-btn', showEmojiPicker && 'mobile-meet-bottom-btn--emoji-active')}
            aria-label="Send reaction"
          >
            <Smile size={18} />
          </button>
          <button
            onClick={handleMobileLeave}
            className="mobile-meet-end-btn"
            aria-label="Leave call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.46V18a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3 6.18 2 2 0 0 1 5 4h2.54a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11l-.27.27a16 16 0 0 0 6.29 6.29l.27-.27a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 21 15.46z"/></svg>
          </button>
          <button
            onClick={() => {
              setShowEmojiPicker(false);
              setShowChat(false);
              setShowParticipants(true);
            }}
            className="mobile-meet-bottom-btn"
            aria-label="Participants"
          >
            <Users size={18} />
          </button>
          <button
            onClick={() => {
              setShowEmojiPicker(false);
              setShowParticipants(false);
              setShowChat(true);
            }}
            className="mobile-meet-bottom-btn relative"
            aria-label="Chat"
          >
            <MessageCircle size={18} />
            {unreadMessageCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </button>
          </div>
        )}

        {showOverlayActions && !showChat && !showParticipants && (
          <div
            className="mobile-meet-participants-strip"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="mobile-meet-participants-strip__header">
            <span>Online <span className="mobile-meet-online-dot">●</span></span>
            <span>{participantCount} Participant</span>
          </div>
          <div className="mobile-meet-participants-strip__avatars">
            {mobileVisibleParticipants.map((participant) => {
              const label = participant.name || 'P';
              const initial = label.charAt(0).toUpperCase();
              return (
                <div key={participant.userId} className="mobile-meet-avatar" title={label}>
                  {participant.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={participant.image} alt={label} />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              );
            })}
            {mobileExtraParticipants > 0 && (
              <div className="mobile-meet-avatar mobile-meet-avatar--extra">+{mobileExtraParticipants}</div>
            )}
          </div>
          </div>
        )}

        {/* Emoji reactions bar - shows when picker is open */}
        {
          showEmojiPicker && showOverlayActions && (
            <div
              className={cn("mobile-meet-emoji-picker-wrap fixed left-0 right-0 z-40 flex justify-center gap-2 px-4 pb-2", (showChat || showParticipants) && "hidden")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-2 rounded-full bg-dark-2/90 px-3 py-2 backdrop-blur-md border border-white/10 shadow-xl">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      sendEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="emoji-picker-btn text-2xl hover:scale-125 transition-transform duration-100"
                    aria-label={`Send ${emoji} reaction`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        }

        {/* Mobile participants panel - Bottom sheet style */}
        <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
          <SheetContent
            side="bottom"
            className="h-dvh max-h-dvh rounded-none border-none bg-dark-1 p-0 overflow-hidden flex flex-col"
          >
            <SheetHeader className="border-b border-dark-3 px-4 py-3">
              <SheetTitle className="text-left text-white">
                Participants ({participantCount})
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <CustomParticipantsList
                onClose={() => setShowParticipants(false)}
                raisedHands={raisedHands}
                onLowerHand={lowerParticipantHand}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile chat panel - Bottom sheet style */}
        <Sheet open={showChat} onOpenChange={setShowChat}>
          <SheetContent
            side="bottom"
            className="max-h-[95dvh] rounded-t-2xl border-none bg-dark-1 p-0 overflow-hidden flex flex-col"
          >
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                onClose={() => setShowChat(false)}
                isMobile
                messages={messages}
                setMessages={setMessages}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Raised Hands Panel - Bottom sheet for host to manage raised hands */}
        <Sheet open={showRaisedHandsPanel} onOpenChange={setShowRaisedHandsPanel}>
          <SheetContent
            side="bottom"
            className="max-h-[60vh] rounded-t-2xl border-none bg-dark-1 p-0"
          >
            <SheetHeader className="border-b border-dark-3 px-4 py-3">
              <SheetTitle className="flex items-center gap-2 text-left text-white">
                <Hand size={20} className="text-yellow-400" />
                Raised Hands ({raisedHands.length})
              </SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(60vh-60px)] overflow-auto p-4">
              {raisedHands.length === 0 ? (
                <p className="py-8 text-center text-white/50">No hands are raised</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {raisedHands
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((hand, index) => (
                      <div
                        key={hand.userId}
                        className="flex items-center justify-between rounded-xl bg-dark-2 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-yellow-500/20">
                            <Hand size={18} className="text-yellow-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{hand.participantName}</p>
                            <p className="text-xs text-white/50">#{index + 1} in queue</p>
                          </div>
                        </div>
                        <button
                          onClick={() => lowerParticipantHand(hand.userId, hand.participantName)}
                          className="rounded-full bg-dark-3 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500/20 hover:text-red-400"
                        >
                          Lower Hand
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </section >
    );
  }

  // Desktop Layout (unchanged)
  return (
    <section className={cn('meeting-desktop-root relative h-dvh w-full overflow-hidden bg-dark-1 text-white', isImmersiveShare && 'meeting-desktop-root--immersive-share')}>
      {!isImmersiveShare && isSomewhereScreenSharing && activeSharerName && (
        <div className="absolute left-1/2 top-14 z-40 max-w-[min(84vw,560px)] -translate-x-1/2 rounded-full border border-blue-1/40 bg-dark-2/90 px-3 py-1 text-[11px] font-medium text-blue-2 backdrop-blur-md sm:text-xs">
          <span className="block max-w-full truncate">
            {activeSharerName === 'You'
              ? 'You are sharing your screen'
              : `${activeSharerName} is sharing their screen`}
          </span>
        </div>
      )}
      {accessibilitySettings.enableCaptions && (liveCaption || captionHistory.length > 0) && (
        <div className="absolute bottom-24 left-1/2 z-40 w-[92vw] max-w-[760px] -translate-x-1/2 rounded-lg border border-white/10 bg-dark-2/90 px-4 py-2 text-center text-sm text-white backdrop-blur-md">
          {liveCaption || captionHistory[captionHistory.length - 1]}
        </div>
      )}


      {/* Top bar - Minimal Google Meet style */}
      {!isImmersiveShare && (
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        {/* Meeting duration - Left side */}
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 rounded-full bg-dark-2/90 px-3 py-1.5 backdrop-blur-md sm:gap-2 sm:px-4 sm:py-2">
            <Clock size={14} className="text-white/70" />
            <span className="meeting-time text-xs font-medium text-white/90 sm:text-sm">
              {formatDuration(meetingDuration)}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[36vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-full bg-dark-2/90 px-3 py-1.5 text-center text-xs font-medium text-white/90 backdrop-blur-md sm:max-w-[28vw] sm:text-sm">
          {meetingTitle}
        </div>

        {/* Copy link button - Right side */}
        <button
          onClick={copyMeetingLink}
          className="flex items-center gap-1.5 rounded-full bg-dark-2/90 px-3 py-1.5 backdrop-blur-md transition-colors hover:bg-dark-3 active:scale-95 sm:gap-2 sm:px-4 sm:py-2"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-xs text-green-400 sm:text-sm">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} className="text-white/70" />
              <span className="text-xs text-white/70 sm:text-sm">Copy link</span>
            </>
          )}
        </button>
      </div>
      )}

      {/* Main video area - Optimized for video rendering */}
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center',
          isImmersiveShare ? 'pt-0 pb-0' : 'pt-14 pb-24'
        )}
        onClick={toggleOverlayActions}
      >
        {/* Video layout container with GPU acceleration */}
        <div className="size-full transform-gpu">
          {CallLayout}
        </div>
      </div>

      {/* Desktop participants panel - slide in overlay */}
      <div
        className={cn(
          'fixed right-0 top-14 z-40 w-full xs:w-[320px] sm:w-[320px]',
          'transition-all duration-300 ease-out',
          showParticipants ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{
          height: isMobile ? 'calc(100vh - 56px - 120px)' : 'calc(100vh - 56px - 100px)',
          bottom: isMobile ? '120px' : '100px'
        }}
      >
        <div className="participants-panel mx-2 my-2 h-full overflow-hidden rounded-xl border border-dark-3/50 shadow-2xl">
          <div className="flex items-center justify-between border-b border-dark-3 px-4 py-3">
            <h3 className="text-sm font-medium text-white">
              Participants ({participantCount})
            </h3>
            <button
              onClick={() => setShowParticipants(false)}
              className="flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-dark-3 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="h-[calc(100%-52px)] overflow-auto">
            <CustomParticipantsList
              onClose={() => setShowParticipants(false)}
              raisedHands={raisedHands}
              onLowerHand={lowerParticipantHand}
            />
          </div>
        </div>
      </div>

      {/* Desktop chat panel - slide in overlay */}
      <div
        className={cn(
          'fixed right-0 top-14 z-40 w-full xs:w-[360px] sm:w-[360px]',
          'transition-all duration-300 ease-out',
          showChat ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{
          height: isMobile ? 'calc(100vh - 56px - 120px)' : 'calc(100vh - 56px - 100px)',
          bottom: isMobile ? '120px' : '100px'
        }}
      >
        <div className="mx-2 my-2 h-full overflow-hidden rounded-xl bg-dark-1 border border-dark-3/50 shadow-2xl">
          <ChatPanel
            onClose={() => setShowChat(false)}
            messages={messages}
            setMessages={setMessages}
          />
        </div>
      </div>

      {/* Floating emoji reactions overlay */}
      <div className="emoji-reactions-container">
        {activeEmojis.map((reaction) => (
          <span
            key={reaction.id}
            className="emoji-reaction"
            style={{
              left: `${reaction.x}%`,
              ['--emoji-drift' as string]: `${reaction.drift}px`,
              ['--emoji-duration' as string]: `${reaction.duration}s`,
              ['--emoji-delay' as string]: `${reaction.delay}s`,
              ['--emoji-scale' as string]: reaction.scale,
              ['--emoji-rotate' as string]: `${reaction.rotate}deg`,
            } as React.CSSProperties}
          >
            {reaction.emoji}
          </span>
        ))}
      </div>

      {/* Google Meet-style floating control bar */}
      {showOverlayActions && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-center pb-safe">
        <div className="mb-3 flex flex-col items-center gap-2">
          {/* Emoji picker popup - shows when button is clicked */}
          {showEmojiPicker && (
            <div className="flex items-center justify-center gap-2 rounded-full bg-dark-2 px-4 py-3">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    sendEmoji(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="emoji-picker-btn"
                  aria-label={`Send ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="meeting-controls flex items-center justify-center gap-2">
            {/* Main call controls - using custom controls without reaction button */}
            <CustomCallControls
              onLeave={() => router.push(`/`)}
              isAnotherParticipantSharing={isSomewhereScreenSharing && !isLocalSharing}
              currentSharerName={activeSharerName || undefined}
              currentSharerId={sharingParticipant?.userId}
              hostCanOverrideShare={isHost}
              isLocalSharing={!!isLocalSharing}
            />

            {/* Divider */}
            <div className="mx-1 h-8 w-px bg-dark-4" />

            {/* Emoji reaction button */}
            <button
              onClick={() => (permissionSettings.allowReactions || isHost) && setShowEmojiPicker((prev) => !prev)}
              disabled={!permissionSettings.allowReactions && !isHost}
              className={cn(
                'flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                !permissionSettings.allowReactions && !isHost && 'opacity-50 cursor-not-allowed',
                showEmojiPicker
                  ? 'bg-blue-1 text-white'
                  : 'bg-dark-3 text-white hover:bg-dark-4'
              )}
              aria-label="Send reaction"
              title={!permissionSettings.allowReactions && !isHost ? 'Reactions disabled by host' : ''}
            >
              <span className="text-xl">😊</span>
            </button>

            {/* Raise Hand button */}
            <button
              onClick={toggleRaiseHand}
              disabled={!permissionSettings.allowHandRaise && !isHandRaised && !isHost}
              className={cn(
                'relative flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                !permissionSettings.allowHandRaise && !isHandRaised && !isHost && 'opacity-50 cursor-not-allowed',
                isHandRaised
                  ? 'bg-yellow-500 text-dark-1'
                  : 'bg-dark-3 text-white hover:bg-dark-4'
              )}
              aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
              title={!permissionSettings.allowHandRaise && !isHandRaised && !isHost ? 'Hand raise disabled by host' : (isHandRaised ? 'Lower hand' : 'Raise hand')}
            >
              <Hand size={18} />
              {/* Badge showing raised hands count for host */}
              {isHost && raisedHands.length > 0 && !isHandRaised && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-dark-1">
                  {raisedHands.length}
                </span>
              )}
            </button>

            {/* Participants toggle */}
            <button
              onClick={() => {
                if (!showParticipants) setShowChat(false);
                setShowParticipants((prev) => !prev);
              }}
              className={cn(
                'relative flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                showParticipants
                  ? 'bg-blue-1 text-white'
                  : 'bg-dark-3 text-white hover:bg-dark-4'
              )}
            >
              <Users size={18} />
              {participantCount > 1 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-blue-2 text-xs font-semibold text-dark-1">
                  {participantCount}
                </span>
              )}
            </button>

            {/* Chat toggle */}
            <button
              onClick={() => {
                if (!showChat) setShowParticipants(false);
                setShowChat((prev) => !prev);
              }}
              className={cn(
                'relative flex size-12 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95',
                showChat
                  ? 'bg-blue-1 text-white'
                  : 'bg-dark-3 text-white hover:bg-dark-4'
              )}
              aria-label="Toggle chat"
            >
              <MessageCircle size={18} />
              {unreadMessageCount > 0 && !showChat && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </button>



            {/* Divider before end call */}
            <div className="mx-1 h-8 w-px bg-dark-4" />

            {/* End call button */}
            {!isPersonalRoom && <EndCallButton />}
          </div>
        </div>
      </div>
      )}




      {/* Settings & Host Controls - Bottom Right Corner (Desktop) */}
      {showOverlayActions && (
        <div className="fixed bottom-6 right-6 z-[9999] hidden lg:flex pointer-events-auto gap-3 flex-row">
        {/* Host Settings Button - Only show if user is host or has permissions */}
        {(isHost || canUpdatePermissions) && (
          <button
        onClick={(e) => {
          e.stopPropagation();
          setShowHostSettings(true);
        }}
        className="flex size-14 cursor-pointer items-center justify-center rounded-full bg-purple-600 text-white shadow-2xl transition-all hover:bg-purple-700 hover:scale-110 active:scale-90 border-2 border-white/20"
        title="Host Settings"
          >
        <Shield size={24} />
          </button>
        )}
        
        {/* Settings Button */}
        <button
          onClick={(e) => {
        e.stopPropagation();
        setShowSettings(true);
          }}
          className="flex size-14 cursor-pointer items-center justify-center rounded-full bg-blue-1 text-white shadow-2xl transition-all hover:bg-blue-600 hover:scale-110 active:scale-90 border-2 border-white/20"
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>
      )}

      {/* Call Settings Modal */}
      <CallSettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Host Settings Modal */}
      <HostSettingsModal open={showHostSettings} onOpenChange={setShowHostSettings} />
    </section>
  );
};

export default MeetingRoom;
