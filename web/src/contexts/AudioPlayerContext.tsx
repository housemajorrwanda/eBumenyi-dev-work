import React, { createContext, useContext, useState } from "react";

interface AudioPlayerContextValue {
  activeAudioId: string | null;
  setActiveAudio: (id: string | null) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  return (
    <AudioPlayerContext.Provider value={{ activeAudioId, setActiveAudio: setActiveAudioId }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayerContextValue => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return ctx;
};
