'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

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

interface HostSettingsContextType {
  permissionSettings: PermissionSettings;
  securitySettings: SecuritySettings;
  setPermissionSettings: React.Dispatch<React.SetStateAction<PermissionSettings>>;
  setSecuritySettings: React.Dispatch<React.SetStateAction<SecuritySettings>>;
  callId: string | null;
  isHost: boolean;
}

const HostSettingsContext = createContext<HostSettingsContextType | undefined>(undefined);

export const HostSettingsProvider: React.FC<{
  children: React.ReactNode;
  callId?: string;
  isHost?: boolean;
}> = ({ children, callId, isHost = false }) => {
  const [permissionSettings, setPermissionSettings] = useState<PermissionSettings>({
    allowAudio: true,
    allowVideo: true,
    allowScreenShare: true,
    allowParticipantRecording: false,
    allowChat: true,
    allowHandRaise: true,
    allowReactions: true,
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    recordingEnabled: false,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    if (!callId) return;
    try {
      const savedPermissions = localStorage.getItem(`hostSettings_permissions_${callId}`);
      const savedSecurity = localStorage.getItem(`hostSettings_security_${callId}`);

      if (savedPermissions) {
        setPermissionSettings(JSON.parse(savedPermissions));
      }
      if (savedSecurity) {
        setSecuritySettings(JSON.parse(savedSecurity));
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
  }, [callId]);

  useEffect(() => {
    if (!callId) return;
    try {
      localStorage.setItem(`hostSettings_permissions_${callId}`, JSON.stringify(permissionSettings));
    } catch (error) {
      console.error('Failed to save permission settings to localStorage:', error);
    }
  }, [callId, permissionSettings]);

  useEffect(() => {
    if (!callId) return;
    try {
      localStorage.setItem(`hostSettings_security_${callId}`, JSON.stringify(securitySettings));
    } catch (error) {
      console.error('Failed to save security settings to localStorage:', error);
    }
  }, [callId, securitySettings]);

  return (
    <HostSettingsContext.Provider
      value={{
        permissionSettings,
        securitySettings,
        setPermissionSettings,
        setSecuritySettings,
        callId: callId || null,
        isHost,
      }}
    >
      {children}
    </HostSettingsContext.Provider>
  );
};

export const useHostSettings = () => {
  const context = useContext(HostSettingsContext);
  if (!context) {
    return {
      permissionSettings: {
        allowAudio: true,
        allowVideo: true,
        allowScreenShare: true,
        allowParticipantRecording: false,
        allowChat: true,
        allowHandRaise: true,
        allowReactions: true,
      },
      securitySettings: {
        recordingEnabled: false,
      },
      setPermissionSettings: () => undefined,
      setSecuritySettings: () => undefined,
      callId: null,
      isHost: false,
    };
  }
  return context;
};
