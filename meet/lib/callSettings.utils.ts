/**
 * Call Settings Utilities
 * Handles advanced call settings implementations
 */

// Notification sound mapping
export const NOTIFICATION_SOUNDS = {
  joinNotification: '/notifications/mixkit-positive-notification-951.wav',
  leaveNotification: '/notifications/mixkit-software-interface-back-2575.wav',
  messageNotification: '/notifications/mixkit-message-pop-alert-2354.mp3',
  handRaisedNotification: '/notifications/mixkit-bell-notification-933.wav',
  recordingStartedNotification: '/notifications/mixkit-confirmation-tone-2867.wav',
};

/**
 * Play notification sound
 * @param soundType - Type of notification sound to play
 * @param volume - Volume level (0-100)
 */
export const playNotificationSound = async (soundType: keyof typeof NOTIFICATION_SOUNDS, volume: number = 70) => {
  try {
    const soundPath = NOTIFICATION_SOUNDS[soundType];
    const audio = new Audio(soundPath);
    audio.volume = volume / 100;
    await audio.play();
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

/**
 * Enable audio processing for noise cancellation
 * Uses Web Audio API with built-in browser capabilities
 */
export const enableNoiseSuppressionConstraints = () => {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
};

/**
 * Get device list for audio/video
 */
export const getDeviceList = async (kind: 'audioinput' | 'audiooutput' | 'videoinput') => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === kind);
  } catch (error) {
    console.error('Failed to enumerate devices:', error);
    return [];
  }
};

/**
 * Switch audio/video device
 * @param constraint - Type of device to switch (audioinput, audiooutput, videoinput)
 * @param deviceId - Device ID to switch to
 */
export const switchDevice = async (constraint: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
  try {
    const constraints: any = { audio: {}, video: {} };

    if (constraint === 'audioinput') {
      constraints.audio = { deviceId: { exact: deviceId } };
    } else if (constraint === 'audiooutput') {
      // Audio output switching is handled differently via audio element
      return deviceId;
    } else if (constraint === 'videoinput') {
      constraints.video = { deviceId: { exact: deviceId } };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach(track => track.stop());
    return deviceId;
  } catch (error) {
    console.error('Failed to switch device:', error);
    return null;
  }
};

/**
 * Get real-time network quality metrics
 * Returns quality level based on connection stats
 */
export const analyzeNetworkQuality = (stats: any): 'excellent' | 'good' | 'fair' | 'poor' => {
  try {
    // Placeholder for actual Stream SDK stats analysis
    // This should be called with actual call stats from Stream SDK
    if (!stats) return 'good';

    const { bandwidth, latency, packetLoss } = stats;

    // High bandwidth, low latency, minimal packet loss = excellent
    if (bandwidth > 5000 && latency < 50 && packetLoss < 1) {
      return 'excellent';
    }
    // Good bandwidth, reasonable latency, low packet loss = good
    if (bandwidth > 2000 && latency < 100 && packetLoss < 3) {
      return 'good';
    }
    // Fair conditions
    if (bandwidth > 1000 && latency < 200 && packetLoss < 5) {
      return 'fair';
    }
    // Poor conditions
    return 'poor';
  } catch (error) {
    console.error('Failed to analyze network quality:', error);
    return 'good';
  }
};

/**
 * Apply low light enhancement to video
 * Uses Canvas API to process video frames in real-time
 */
export const createLowLightEnhancer = (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return null;

  const enhance = () => {
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = imageData.data;

    // Enhance brightness and contrast
    for (let i = 0; i < data.length; i += 4) {
      // Increase brightness by 30%
      data[i] = Math.min(255, data[i] * 1.3);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * 1.3); // Green
      data[i + 2] = Math.min(255, data[i + 2] * 1.3); // Blue
      // Alpha stays same
    }

    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(enhance);
  };

  return enhance;
};

/**
 * Web Speech API for live captions
 * Requires browser support for SpeechRecognition
 */
export let recognitionInstance: any = null;

export const initializeSpeechRecognition = (onResultCallback: (transcript: string, isFinal: boolean) => void) => {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech Recognition API not supported in this browser');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    console.log('Speech recognition started');
  };

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      onResultCallback(finalTranscript, true);
    } else if (interimTranscript) {
      onResultCallback(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
    // Optionally restart for continuous captions
    try {
      recognition.start();
    } catch (e) {
      console.log('Recognition already started');
    }
  };

  recognitionInstance = recognition;
  return recognition;
};

export const startSpeechRecognition = () => {
  if (recognitionInstance) {
    try {
      recognitionInstance.start();
    } catch (e) {
      console.log('Recognition already started');
    }
  }
};

export const stopSpeechRecognition = () => {
  if (recognitionInstance) {
    recognitionInstance.stop();
  }
};

export const abortSpeechRecognition = () => {
  if (recognitionInstance) {
    recognitionInstance.abort();
  }
};

/**
 * Calculate dynamic bitrate based on network quality
 */
export const calculateDynamicBitrate = (quality: 'excellent' | 'good' | 'fair' | 'poor') => {
  const bitrateMap = {
    excellent: { video: 5000, audio: 320 },
    good: { video: 2500, audio: 128 },
    fair: { video: 1000, audio: 64 },
    poor: { video: 500, audio: 32 },
  };

  return bitrateMap[quality];
};

/**
 * Apply getUserMedia constraints for low light mode
 */
export const getLowLightConstraints = () => {
  return {
    video: {
      brightness: { ideal: 150 },
      contrast: { ideal: 150 },
      saturation: { ideal: 100 },
    },
    audio: true,
  };
};
