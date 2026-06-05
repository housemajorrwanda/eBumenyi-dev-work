'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import {
  Bell,
  Captions,
  Eye,
  Headphones,
  Maximize,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  PictureInPicture,
  Settings,
  ToggleLeft,
  ToggleRight,
  Users,
  Video,
  Volume2,
  Volume,
  Hand,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import {
  initializeSpeechRecognition,
  playNotificationSound,
} from '@/lib/callSettings.utils';

interface CallSettingsProps {
  onClose?: () => void;
}

interface DeviceSettings {
  selectedMicrophone: string;
  selectedSpeaker: string;
  selectedCamera: string;
  speakerVolume: number;
}

interface DisplaySettings {
  fontSize: 'small' | 'medium' | 'large';
}

interface AccessibilitySettings {
  enableCaptions: boolean;
  highContrast: boolean;
  reduceAnimations: boolean;
}

interface NotificationSettings {
  soundNotifications: boolean;
  participantJoinedNotification: boolean;
  participantLeftNotification: boolean;
  recordingStartedNotification: boolean;
  handRaisedNotification: boolean;
  messageNotification: boolean;
  notificationVolume: number;
}

const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  selectedMicrophone: '',
  selectedSpeaker: '',
  selectedCamera: '',
  speakerVolume: 80,
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontSize: 'medium',
};

const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  enableCaptions: false,
  highContrast: false,
  reduceAnimations: false,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  soundNotifications: true,
  participantJoinedNotification: true,
  participantLeftNotification: true,
  recordingStartedNotification: true,
  handRaisedNotification: true,
  messageNotification: true,
  notificationVolume: 70,
};

const CallSettings: React.FC<CallSettingsProps> = ({ onClose }) => {
  const call = useCall();
  const {
    useMicrophoneState,
    useCameraState,
    useSpeakerState,
  } = useCallStateHooks();
  const { isMute: isMicMuted, microphone, devices: micDevices, selectedDevice: selectedMic } = useMicrophoneState();
  const { isEnabled: isCameraEnabled, camera, devices: camDevices, selectedDevice: selectedCam } = useCameraState();
  const speakerState = useSpeakerState();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'audio-video' | 'display' | 'accessibility' | 'notifications'>('audio-video');
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(DEFAULT_DEVICE_SETTINGS);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>(DEFAULT_ACCESSIBILITY_SETTINGS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [testAudioActive, setTestAudioActive] = useState(false);
  const loadedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const appliedInitialDevicesRef = useRef(false);
  const canSelectSpeaker = speakerState.isDeviceSelectionSupported;

  useEffect(() => {
    try {
      const savedDevice = localStorage.getItem('callSettings_device');
      const savedDisplay = localStorage.getItem('callSettings_display');
      const savedAccessibility = localStorage.getItem('callSettings_accessibility');
      const savedNotification = localStorage.getItem('callSettings_notification');
      if (savedDevice) setDeviceSettings({ ...DEFAULT_DEVICE_SETTINGS, ...JSON.parse(savedDevice) });
      if (savedDisplay) setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(savedDisplay) });
      if (savedAccessibility) setAccessibilitySettings({ ...DEFAULT_ACCESSIBILITY_SETTINGS, ...JSON.parse(savedAccessibility) });
      if (savedNotification) setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(savedNotification) });
    } catch (error) {
      console.error('Failed to load call settings:', error);
    }
    loadedRef.current = true;
    setIsLoaded(true);
  }, []);

  const saveConfiguration = () => {
    try {
      localStorage.setItem('callSettings_device', JSON.stringify(deviceSettings));
      localStorage.setItem('callSettings_display', JSON.stringify(displaySettings));
      localStorage.setItem('callSettings_accessibility', JSON.stringify(accessibilitySettings));
      localStorage.setItem('callSettings_notification', JSON.stringify(notificationSettings));
      window.dispatchEvent(new CustomEvent('call-settings-updated'));
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to save call settings:', error);
    }
  };

  useEffect(() => {
    const sizeMap: Record<DisplaySettings['fontSize'], string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    document.documentElement.style.fontSize = sizeMap[displaySettings.fontSize];
  }, [displaySettings.fontSize]);

  useEffect(() => {
    if (accessibilitySettings.highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [accessibilitySettings.highContrast]);

  useEffect(() => {
    if (accessibilitySettings.reduceAnimations) {
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduce-motion');
    }
  }, [accessibilitySettings.reduceAnimations]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (!accessibilitySettings.enableCaptions) return;
    // Probe support once when enabling from settings.
    initializeSpeechRecognition(() => undefined);
  }, [accessibilitySettings.enableCaptions]);

  useEffect(() => {
    const clamped = Math.min(100, Math.max(0, deviceSettings.speakerVolume)) / 100;
    document.querySelectorAll('audio').forEach((a) => {
      (a as HTMLAudioElement).volume = clamped;
    });
  }, [deviceSettings.speakerVolume]);

  useEffect(() => {
    if (!isLoaded || appliedInitialDevicesRef.current) return;
    appliedInitialDevicesRef.current = true;
    const apply = async () => {
      try {
        if (deviceSettings.selectedMicrophone && deviceSettings.selectedMicrophone !== selectedMic) {
          await microphone.select(deviceSettings.selectedMicrophone);
        }
        if (deviceSettings.selectedCamera && deviceSettings.selectedCamera !== selectedCam) {
          await camera.select(deviceSettings.selectedCamera);
        }
        if (deviceSettings.selectedSpeaker && canSelectSpeaker && deviceSettings.selectedSpeaker !== speakerState.selectedDevice) {
          await speakerState.speaker.select(deviceSettings.selectedSpeaker);
        }
      } catch (error) {
        console.error('Failed to apply saved device settings:', error);
      }
    };
    apply();
  }, [
    isLoaded,
    deviceSettings.selectedMicrophone,
    deviceSettings.selectedCamera,
    deviceSettings.selectedSpeaker,
    selectedMic,
    selectedCam,
    speakerState.selectedDevice,
    canSelectSpeaker,
    microphone,
    camera,
    speakerState.speaker,
  ]);

  const audioInputs = useMemo(
    () => (micDevices || []).map((d: MediaDeviceInfo) => ({ id: d.deviceId, label: d.label || 'Microphone' })),
    [micDevices],
  );
  const videoInputs = useMemo(
    () => (camDevices || []).map((d: MediaDeviceInfo) => ({ id: d.deviceId, label: d.label || 'Camera' })),
    [camDevices],
  );
  const audioOutputs = useMemo(
    () => (speakerState.devices || []).map((d: MediaDeviceInfo) => ({ id: d.deviceId, label: d.label || 'Speaker' })),
    [speakerState.devices],
  );

  const testAudio = () => {
    setTestAudioActive(true);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    gain.gain.value = 0.25;
    oscillator.frequency.value = 900;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
    setTimeout(() => setTestAudioActive(false), 450);
  };

  const TabButton = ({ icon: Icon, label, value }: { icon: any; label: string; value: typeof activeTab }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-all',
        activeTab === value ? 'bg-blue-1 text-white shadow-lg shadow-blue-1/20' : 'text-white/60 hover:bg-dark-3 hover:text-white',
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  const ToggleSwitch = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-all', checked ? 'bg-green-500' : 'bg-dark-3', disabled && 'cursor-not-allowed opacity-50')}
    >
      {checked ? <ToggleRight size={16} className="text-white" /> : <ToggleLeft size={16} className="text-white/40" />}
    </button>
  );

  const SettingRow = ({ icon: Icon, label, description, children }: { icon: any; label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-dark-3/30 p-4">
      <div className="flex flex-1 items-center gap-3">
        <Icon size={20} className="shrink-0 text-blue-1" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">{label}</span>
          {description && <span className="text-xs text-white/40">{description}</span>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const renderAudioVideoSettings = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Mic size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Microphone</h3>
        </div>
        <SettingRow icon={Headphones} label="Input Device" description="Select your microphone">
          <select
            value={deviceSettings.selectedMicrophone}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={async (e) => {
              const id = e.target.value;
              setDeviceSettings((prev) => ({ ...prev, selectedMicrophone: id }));
              if (id) await microphone.select(id);
            }}
            className="call-settings-select relative z-20 rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 text-sm text-white focus:border-blue-1 focus:outline-none"
          >
            <option value="">Default</option>
            {audioInputs.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow icon={Mic} label="Microphone" description={isMicMuted ? 'Currently muted' : 'Currently enabled'}>
          <ToggleSwitch
            checked={!isMicMuted}
            onChange={async (enabled) => {
              if (!call) return;
              if (enabled) await call.microphone.enable();
              else await call.microphone.disable();
            }}
          />
        </SettingRow>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Volume2 size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Speaker</h3>
        </div>
        <SettingRow icon={Headphones} label="Output Device" description={canSelectSpeaker ? 'Select your speaker' : 'Speaker selection is not supported on this browser'}>
          <select
            value={deviceSettings.selectedSpeaker}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const id = e.target.value;
              setDeviceSettings((prev) => ({ ...prev, selectedSpeaker: id }));
              if (id && canSelectSpeaker) speakerState.speaker.select(id);
            }}
            disabled={!canSelectSpeaker}
            className="call-settings-select relative z-20 rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 text-sm text-white focus:border-blue-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Default</option>
            {audioOutputs.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow icon={Volume} label="Speaker Volume" description={`Current: ${deviceSettings.speakerVolume}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={deviceSettings.speakerVolume}
            onChange={(e) => setDeviceSettings((prev) => ({ ...prev, speakerVolume: Number(e.target.value) }))}
            className="w-28"
          />
        </SettingRow>
        <button
          onClick={testAudio}
          disabled={testAudioActive}
          className={cn('w-full rounded-lg px-4 py-2 text-sm font-medium transition-all', testAudioActive ? 'cursor-not-allowed bg-blue-1/50 text-white' : 'bg-blue-1 text-white hover:bg-blue-600 active:scale-95')}
        >
          {testAudioActive ? 'Playing...' : 'Test Speaker'}
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Video size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Camera</h3>
        </div>
        <SettingRow icon={Monitor} label="Video Device" description="Select your camera">
          <select
            value={deviceSettings.selectedCamera}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={async (e) => {
              const id = e.target.value;
              setDeviceSettings((prev) => ({ ...prev, selectedCamera: id }));
              if (id) await camera.select(id);
            }}
            className="call-settings-select relative z-20 rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 text-sm text-white focus:border-blue-1 focus:outline-none"
          >
            <option value="">Default</option>
            {videoInputs.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow icon={Video} label="Camera" description={isCameraEnabled ? 'Currently enabled' : 'Currently disabled'}>
          <ToggleSwitch
            checked={isCameraEnabled}
            onChange={async (enabled) => {
              if (!call) return;
              if (enabled) await call.camera.enable();
              else await call.camera.disable();
            }}
          />
        </SettingRow>
      </section>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Moon size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Appearance</h3>
        </div>
        <SettingRow icon={Moon} label="Dark Mode">
          <ToggleSwitch
            checked={theme === 'dark'}
            onChange={(value) => {
              if ((theme === 'dark') !== value) toggleTheme();
            }}
          />
        </SettingRow>
        <SettingRow icon={Maximize} label="Text Size">
          <select
            value={displaySettings.fontSize}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setDisplaySettings({ fontSize: e.target.value as DisplaySettings['fontSize'] })}
            className="call-settings-select relative z-20 rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 text-sm text-white focus:border-blue-1 focus:outline-none"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </SettingRow>
      </section>
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <PictureInPicture size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Screen Options</h3>
        </div>
        <button
          onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }}
          className="w-full rounded-lg bg-blue-1 px-4 py-3 font-medium text-white transition-all hover:bg-blue-600 active:scale-95"
        >
          <Maximize size={18} className="mr-2 inline" />
          Toggle Fullscreen
        </button>
        <button
          onClick={() => {
            const videoEl = document.querySelector('video') as HTMLVideoElement | null;
            if (!videoEl || !document.pictureInPictureEnabled) return;
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else videoEl.requestPictureInPicture();
          }}
          className="w-full rounded-lg bg-blue-1 px-4 py-3 font-medium text-white transition-all hover:bg-blue-600 active:scale-95"
        >
          <PictureInPicture size={18} className="mr-2 inline" />
          Picture in Picture
        </button>
      </section>
    </div>
  );

  const renderAccessibilitySettings = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Captions size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Accessibility</h3>
        </div>
        <SettingRow icon={Captions} label="Live Captions" description="Real-time speech-to-text (Web Speech API)">
          <ToggleSwitch
            checked={accessibilitySettings.enableCaptions}
            onChange={(v) => setAccessibilitySettings((prev) => ({ ...prev, enableCaptions: v }))}
          />
        </SettingRow>
        {accessibilitySettings.enableCaptions && (
          <div className="rounded-lg border border-blue-1/30 bg-blue-1/20 p-3 text-xs text-white/80">
            Live captions will appear in the meeting room overlay.
          </div>
        )}
        <SettingRow icon={Eye} label="High Contrast Mode" description="Increase visual contrast">
          <ToggleSwitch
            checked={accessibilitySettings.highContrast}
            onChange={(v) => setAccessibilitySettings((prev) => ({ ...prev, highContrast: v }))}
          />
        </SettingRow>
        <SettingRow icon={Volume2} label="Reduce Animations" description="Minimize motion effects">
          <ToggleSwitch
            checked={accessibilitySettings.reduceAnimations}
            onChange={(v) => setAccessibilitySettings((prev) => ({ ...prev, reduceAnimations: v }))}
          />
        </SettingRow>
      </section>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Bell size={18} className="text-blue-1" />
          <h3 className="font-semibold text-white">Notifications</h3>
        </div>
        <SettingRow icon={Bell} label="Enable All Sounds" description="Applies to participant join/leave, chat, hand raise, recording start">
          <ToggleSwitch
            checked={notificationSettings.soundNotifications}
            onChange={(v) => setNotificationSettings((prev) => ({ ...prev, soundNotifications: v }))}
          />
        </SettingRow>
        {notificationSettings.soundNotifications && (
          <>
            <SettingRow icon={Users} label="Participant Joined">
              <ToggleSwitch
                checked={notificationSettings.participantJoinedNotification}
                onChange={(v) => setNotificationSettings((prev) => ({ ...prev, participantJoinedNotification: v }))}
              />
            </SettingRow>
            <SettingRow icon={Users} label="Participant Left">
              <ToggleSwitch
                checked={notificationSettings.participantLeftNotification}
                onChange={(v) => setNotificationSettings((prev) => ({ ...prev, participantLeftNotification: v }))}
              />
            </SettingRow>
            <SettingRow icon={Video} label="Recording Started">
              <ToggleSwitch
                checked={notificationSettings.recordingStartedNotification}
                onChange={(v) => setNotificationSettings((prev) => ({ ...prev, recordingStartedNotification: v }))}
              />
            </SettingRow>
            <SettingRow icon={Hand} label="Hand Raised">
              <ToggleSwitch
                checked={notificationSettings.handRaisedNotification}
                onChange={(v) => setNotificationSettings((prev) => ({ ...prev, handRaisedNotification: v }))}
              />
            </SettingRow>
            <SettingRow icon={MessageCircle} label="New Message">
              <ToggleSwitch
                checked={notificationSettings.messageNotification}
                onChange={(v) => setNotificationSettings((prev) => ({ ...prev, messageNotification: v }))}
              />
            </SettingRow>
            <SettingRow icon={Volume} label="Notification Volume" description={`Current: ${notificationSettings.notificationVolume}%`}>
              <input
                type="range"
                min="0"
                max="100"
                value={notificationSettings.notificationVolume}
                onChange={(e) => setNotificationSettings((prev) => ({ ...prev, notificationVolume: Number(e.target.value) }))}
                className="w-28"
              />
            </SettingRow>
            <button
              onClick={() => playNotificationSound('messageNotification', notificationSettings.notificationVolume)}
              className="w-full rounded-lg bg-blue-1 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-600"
            >
              Test Notification Sound
            </button>
          </>
        )}
      </section>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-dark-1">
      <div className="flex items-center justify-between border-b border-dark-3 bg-gradient-to-r from-dark-2 to-dark-3 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-1/20 p-2">
            <Settings size={24} className="text-blue-1" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Call Settings</h2>
            <p className="text-xs text-white/40">Only functional options are shown</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="custom-scrollbar w-56 space-y-2 overflow-y-auto border-r border-dark-3 bg-dark-2 p-4">
          <TabButton icon={Volume2} label="Audio & Video" value="audio-video" />
          <TabButton icon={Maximize} label="Display" value="display" />
          <TabButton icon={Eye} label="Accessibility" value="accessibility" />
          <TabButton icon={Bell} label="Notifications" value="notifications" />
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {activeTab === 'audio-video' && renderAudioVideoSettings()}
          {activeTab === 'display' && renderDisplaySettings()}
          {activeTab === 'accessibility' && renderAccessibilitySettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-dark-3 bg-dark-2 p-6">
        <div className="text-xs text-white/40">Changes are saved when you click Save</div>
        <button
          onClick={saveConfiguration}
          className="rounded-lg bg-blue-1 px-6 py-2 font-medium text-white transition-all hover:bg-blue-600 active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default CallSettings;
