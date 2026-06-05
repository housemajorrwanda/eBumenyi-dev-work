'use client';
import React, { useState, useEffect } from 'react';
import {
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import {
  Shield,
  Users,
  VideoOff,
  MicOff,
  MonitorUp,
  Mic,
  Video,
  Mic as RecordIcon,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Zap,
  RotateCcw,
  Activity,
  Hand,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './ui/use-toast';
import { useHostSettings } from '@/context/HostSettingsContext';

interface HostSettingsProps {
  onClose?: () => void;
}

interface PermissionSettings {
  allowAudio: boolean;
  allowVideo: boolean;
  allowScreenShare: boolean;
  allowParticipantRecording: boolean;
  allowChat: boolean;
  allowHandRaise: boolean;
  allowReactions: boolean;
}

interface SecuritySettings {
  recordingEnabled: boolean;
}

const DEFAULT_PERMISSIONS: PermissionSettings = {
  allowAudio: true,
  allowVideo: true,
  allowScreenShare: true,
  allowParticipantRecording: false,
  allowChat: true,
  allowHandRaise: true,
  allowReactions: true,
};

const DEFAULT_SECURITY: SecuritySettings = {
  recordingEnabled: false,
};

const HostSettings: React.FC<HostSettingsProps> = ({ onClose }) => {
  const call = useCall();
  const { useParticipants, useLocalParticipant, useIsCallRecordingInProgress } = useCallStateHooks();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const isRecordingLive = useIsCallRecordingInProgress();

  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'permissions' | 'participants' | 'advanced'>('permissions');
  const [meetingStartTime] = useState(new Date());
  const { permissionSettings, setPermissionSettings, setSecuritySettings, callId } = useHostSettings();

  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [meetingStats, setMeetingStats] = useState({
    totalParticipants: participants.length,
    audioEnabled: 0,
    videoEnabled: 0,
    recordingActive: false,
  });

  useEffect(() => {
    const audioEnabled = participants.filter((p) => p.publishedTracks.includes(1)).length;
    const videoEnabled = participants.filter((p) => p.publishedTracks.includes(2)).length;
    setMeetingStats({
      totalParticipants: participants.length,
      audioEnabled,
      videoEnabled,
      recordingActive: isRecordingLive,
    });
  }, [participants, isRecordingLive]);

  const toggleParticipantSelection = (userId: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedParticipants(newSelected);
  };

  const muteAllAudio = async () => {
    try {
      const nonHostParticipants = participants.filter(p => p.userId !== localParticipant?.userId);
      for (const participant of nonHostParticipants) {
        await call?.muteUser(participant.userId, 'audio');
      }
      toast({
        title: 'Success',
        description: `Muted audio for ${nonHostParticipants.length} participants`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mute audio for all participants',
        variant: 'destructive',
      });
    }
  };

  const muteAllVideo = async () => {
    try {
      const nonHostParticipants = participants.filter(p => p.userId !== localParticipant?.userId);
      for (const participant of nonHostParticipants) {
        await call?.muteUser(participant.userId, 'video');
      }
      toast({
        title: 'Success',
        description: `Turned off video for ${nonHostParticipants.length} participants`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to turn off video for all participants',
        variant: 'destructive',
      });
    }
  };

  const removeSelectedParticipants = async () => {
    try {
      for (const userId of selectedParticipants) {
        await call?.blockUser(userId);
      }
      toast({
        title: 'Success',
        description: `Removed ${selectedParticipants.size} participant(s)`,
      });
      setSelectedParticipants(new Set());
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove participants',
        variant: 'destructive',
      });
    }
  };

  const toggleRecording = async () => {
    try {
      if (isRecordingLive) {
        await call?.stopRecording();
      } else {
        await call?.startRecording();
      }
      toast({
        title: isRecordingLive ? 'Recording Stopped' : 'Recording Started',
        description: isRecordingLive
          ? 'Meeting is no longer being recorded'
          : 'Meeting is being recorded. Participants will be notified.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle recording',
        variant: 'destructive',
      });
    }
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    disabled = false,
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative w-12 h-7 rounded-full transition-all flex items-center justify-center',
        checked ? 'bg-green-500' : 'bg-dark-3',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {checked ? (
        <ToggleRight size={16} className="text-white" />
      ) : (
        <ToggleLeft size={16} className="text-white/40" />
      )}
    </button>
  );

  const SettingRow = ({
    icon: Icon,
    label,
    description,
    children,
    danger = false,
  }: {
    icon: any;
    label: string;
    description?: string;
    children: React.ReactNode;
    danger?: boolean;
  }) => (
    <div className={cn(
      'flex items-center justify-between p-4 rounded-xl border transition-all',
      danger
        ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/30'
        : 'bg-dark-3/30 border-white/5 hover:border-white/10'
    )}>
      <div className="flex items-center gap-3 flex-1">
        <Icon size={20} className={cn(
          'shrink-0',
          danger ? 'text-red-400' : 'text-blue-1'
        )} />
        <div className="flex flex-col">
          <span className="font-medium text-sm text-white">{label}</span>
          {description && (
            <span className="text-xs text-white/40">{description}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">{children}</div>
    </div>
  );

  const TabButton = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value: typeof activeTab;
  }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all w-full text-left',
        activeTab === value
          ? 'bg-blue-1 text-white shadow-lg shadow-blue-1/20'
          : 'text-white/60 hover:bg-dark-3 hover:text-white'
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  const renderPermissionsTab = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <Mic size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Audio & Video Controls</h3>
        </div>

        <SettingRow
          icon={Mic}
          label="Allow Audio"
          description="Participants can use microphone"
        >
          <ToggleSwitch
            checked={permissionSettings.allowAudio}
            onChange={(value) =>
              setPermissionSettings({ ...permissionSettings, allowAudio: value })
            }
          />
        </SettingRow>

        <SettingRow
          icon={Video}
          label="Allow Video"
          description="Participants can use camera"
        >
          <ToggleSwitch
            checked={permissionSettings.allowVideo}
            onChange={(value) =>
              setPermissionSettings({ ...permissionSettings, allowVideo: value })
            }
          />
        </SettingRow>

        <SettingRow
          icon={MonitorUp}
          label="Allow Screen Share"
          description="Participants can share screen"
        >
          <ToggleSwitch
            checked={permissionSettings.allowScreenShare}
            onChange={(value) =>
              setPermissionSettings({
                ...permissionSettings,
                allowScreenShare: value,
              })
            }
          />
        </SettingRow>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <Users size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Participant Interaction</h3>
        </div>

        <SettingRow
          icon={MessageCircle}
          label="Allow Chat"
          description="Participants can send messages"
        >
          <ToggleSwitch
            checked={permissionSettings.allowChat}
            onChange={(value) =>
              setPermissionSettings({ ...permissionSettings, allowChat: value })
            }
          />
        </SettingRow>

        <SettingRow
          icon={Hand}
          label="Allow Hand Raise"
          description="Participants can raise hand"
        >
          <ToggleSwitch
            checked={permissionSettings.allowHandRaise}
            onChange={(value) =>
              setPermissionSettings({
                ...permissionSettings,
                allowHandRaise: value,
              })
            }
          />
        </SettingRow>

        <SettingRow
          icon={Zap}
          label="Allow Reactions"
          description="Participants can use emoji reactions"
        >
          <ToggleSwitch
            checked={permissionSettings.allowReactions}
            onChange={(value) =>
              setPermissionSettings({
                ...permissionSettings,
                allowReactions: value,
              })
            }
          />
        </SettingRow>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <RecordIcon size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Recording</h3>
        </div>
        <SettingRow
          icon={RecordIcon}
          label="Allow Participant Recording"
          description="Participants can record the meeting"
        >
          <ToggleSwitch
            checked={permissionSettings.allowParticipantRecording}
            onChange={(value) =>
              setPermissionSettings({
                ...permissionSettings,
                allowParticipantRecording: value,
              })
            }
          />
        </SettingRow>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40">Quick Actions</h4>
        <button
          onClick={muteAllAudio}
          className="w-full px-4 py-3 bg-orange-500/10 text-orange-400 rounded-lg font-medium hover:bg-orange-500/20 transition-all border border-orange-500/20 hover:border-orange-500/30 flex items-center justify-center gap-2"
        >
          <MicOff size={18} />
          Mute All Audio
        </button>
        <button
          onClick={muteAllVideo}
          className="w-full px-4 py-3 bg-orange-500/10 text-orange-400 rounded-lg font-medium hover:bg-orange-500/20 transition-all border border-orange-500/20 hover:border-orange-500/30 flex items-center justify-center gap-2"
        >
          <VideoOff size={18} />
          Disable All Video
        </button>
      </section>
    </div>
  );

  const renderParticipantsTab = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-1" />
            <h3 className="font-semibold text-white">Participants ({participants.length})</h3>
          </div>
          {selectedParticipants.size > 0 && (
            <button
              onClick={removeSelectedParticipants}
              className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30"
            >
              Remove {selectedParticipants.size}
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {participants.map((participant) => {
            const hasAudio = participant.publishedTracks.includes(1);
            const hasVideo = participant.publishedTracks.includes(2);
            const isLocal = participant.userId === localParticipant?.userId;
            return (
              <div
                key={participant.userId}
                onClick={() => !isLocal && toggleParticipantSelection(participant.userId)}
                className={cn(
                  'p-4 rounded-xl border transition-all flex items-center justify-between',
                  isLocal ? 'cursor-default bg-dark-3/20 border-white/5' : 'cursor-pointer',
                  !isLocal && selectedParticipants.has(participant.userId)
                    ? 'bg-blue-1/20 border-blue-1/50'
                    : !isLocal && 'bg-dark-3/30 border-white/5 hover:border-white/10'
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="size-10 rounded-full bg-blue-1/20 flex items-center justify-center text-blue-1 font-bold text-sm">
                    {participant.name?.charAt(0) || 'P'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">
                      {participant.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-white/40">
                      {isLocal ? 'You' : 'Participant'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasAudio ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
                  {hasVideo ? <Video size={14} className="text-green-400" /> : <VideoOff size={14} className="text-red-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40">Bulk Actions</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={muteAllAudio}
            className="px-3 py-2 bg-dark-3 text-white/60 hover:text-white rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-white/10"
          >
            <MicOff size={14} className="inline mr-2" />
            Mute All
          </button>
          <button
            onClick={muteAllVideo}
            className="px-3 py-2 bg-dark-3 text-white/60 hover:text-white rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-white/10"
          >
            <VideoOff size={14} className="inline mr-2" />
            Stop Videos
          </button>
        </div>
      </section>
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <Activity size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Meeting Statistics</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-dark-3/50 border border-white/5">
            <div className="text-2xl font-bold text-blue-1">{meetingStats.totalParticipants}</div>
            <div className="text-xs text-white/60 mt-1">Total Participants</div>
          </div>
          <div className="p-4 rounded-lg bg-dark-3/50 border border-white/5">
            <div className="text-2xl font-bold text-green-400">{meetingStats.audioEnabled}</div>
            <div className="text-xs text-white/60 mt-1">Audio Active</div>
          </div>
          <div className="p-4 rounded-lg bg-dark-3/50 border border-white/5">
            <div className="text-2xl font-bold text-green-400">{meetingStats.videoEnabled}</div>
            <div className="text-xs text-white/60 mt-1">Video Streams</div>
          </div>
          <div className="p-4 rounded-lg bg-dark-3/50 border border-white/5">
            <div className="text-2xl font-bold text-yellow-400">
              {Math.floor((new Date().getTime() - meetingStartTime.getTime()) / 60000)}m
            </div>
            <div className="text-xs text-white/60 mt-1">Duration</div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <Zap size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Recording & Controls</h3>
        </div>

        <SettingRow
          icon={RecordIcon}
          label="Meeting Recording"
          description={`${isRecordingLive ? 'Recording in progress' : 'Recording disabled'}`}
          danger={isRecordingLive}
        >
          <ToggleSwitch
            checked={isRecordingLive}
            onChange={toggleRecording}
          />
        </SettingRow>

        <SettingRow
          icon={AlertTriangle}
          label="End Meeting For All"
          description="Terminate the meeting immediately"
          danger={true}
        >
          <button
            onClick={async () => {
              try {
                await call?.endCall();
                toast({
                  title: 'Meeting Ended',
                  description: 'Meeting has been ended for all participants',
                });
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to end meeting',
                  variant: 'destructive',
                });
              }
            }}
            className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-all border border-red-500/30"
          >
            End
          </button>
        </SettingRow>

        <SettingRow
          icon={RotateCcw}
          label="Reset Meeting Settings"
          description="Restore default permissions"
        >
          <button
            onClick={() => {
              try {
                // Reset to defaults
                setPermissionSettings(DEFAULT_PERMISSIONS);
                setSecuritySettings(DEFAULT_SECURITY);
                
                // Clear localStorage
                if (callId) {
                  localStorage.removeItem(`hostSettings_permissions_${callId}`);
                  localStorage.removeItem(`hostSettings_security_${callId}`);
                }
                
                toast({
                  title: 'Settings Reset',
                  description: 'All meeting settings have been restored to defaults',
                });
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to reset settings',
                  variant: 'destructive',
                });
              }
            }}
            className="px-3 py-1.5 bg-blue-1/20 text-blue-1 hover:bg-blue-1/30 rounded-lg text-xs font-bold transition-all border border-blue-1/30"
          >
            Reset
          </button>
        </SettingRow>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40">Host Information</h4>
        <div className="p-4 rounded-lg bg-dark-3/30 border border-white/5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Host Name:</span>
            <span className="text-white font-medium">{localParticipant?.name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Meeting Status:</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Recording:</span>
            <span className={cn(
              'font-medium',
              isRecordingLive ? 'text-red-400' : 'text-white/60'
            )}>
              {isRecordingLive ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-dark-1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-dark-3 bg-gradient-to-r from-dark-2 to-dark-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-1/20">
            <Shield size={24} className="text-blue-1" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Host Settings</h2>
            <p className="text-xs text-white/40">Meeting controls & administration</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-56 border-r border-dark-3 p-4 overflow-y-auto space-y-2 custom-scrollbar bg-dark-2">
          <TabButton icon={Shield} label="Permissions" value="permissions" />
          <TabButton icon={Users} label="Participants" value="participants" />
          <TabButton icon={Zap} label="Advanced" value="advanced" />
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'permissions' && renderPermissionsTab()}
          {activeTab === 'participants' && renderParticipantsTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-6 border-t border-dark-3 bg-dark-2">
        <div className="text-xs text-white/40">
          ✓ Changes applied in real-time
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-1 text-white rounded-lg font-medium hover:bg-blue-600 transition-all active:scale-95"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default HostSettings;
