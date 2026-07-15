/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ViewStyle, 
  Animated, 
  Easing,
  Dimensions 
} from 'react-native';
import { useAudioPlayer, useAudioRecorder, useAudioRecorderState, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Upload, 
  Download,
  CheckCircle
} from 'lucide-react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AudioRecorderPlayerProps {
  value?: string;
  onChange?: (uri: string | null) => void;
  style?: ViewStyle;
  themeColors?: any;
  isDark?: boolean;
}

export default function AudioRecorderPlayer({ 
  value, 
  onChange, 
  style, 
  themeColors = { primary: '#6366f1', secondary: '#8b5cf6' },
  isDark = false 
}: AudioRecorderPlayerProps) {
  const [audioUri, setAudioUri] = useState<string | null>(value || null);
  const [isLoading, setIsLoading] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [playTime, setPlayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Animation values
  const waveformAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformData = useRef(Array.from({ length: 30 }, () => new Animated.Value(1))).current;
  const startTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  // Recorder setup
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Player setup
  const player = useAudioPlayer(audioUri);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for audio recording');
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  // Start animations when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Sync playing state with player
  useEffect(() => {
    setIsPlaying(player.playing);
  }, [player.playing]);

  // Get duration when audio loads
  useEffect(() => {
    if (audioUri && player.duration) {
      const newDuration = Math.floor(player.duration);
      setDuration(newDuration);
    }
  }, [audioUri, player.duration]);

  // Real-time progress tracking using manual timer
  useEffect(() => {
    if (isPlaying && duration > 0) {
      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Start timing from current playTime
      startTimeRef.current = Date.now() - (playTime * 1000);

      // Update progress more frequently for smooth animation
      progressIntervalRef.current = setInterval(() => {
        const currentTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        if (currentTime <= duration) {
          setPlayTime(currentTime);
          
          // Update progress animation
          const progress = currentTime / duration;
          Animated.timing(progressAnim, {
            toValue: progress > 1 ? 1 : progress,
            duration: 200,
            useNativeDriver: false,
          }).start();
        } else {
          // Audio ended
          setPlayTime(duration);
          progressAnim.setValue(1);
          setIsPlaying(false);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
      }, 200); // Update every 200ms for smooth progress
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isPlaying, duration, progressAnim, playTime]);

  // Reset progress when audio changes
  useEffect(() => {
    if (audioUri) {
      setPlayTime(0);
      progressAnim.setValue(0);
      setIsPlaying(false);
      startTimeRef.current = 0;
      accumulatedTimeRef.current = 0;
    }
  }, [audioUri, progressAnim]);

  // Handle player state changes
  useEffect(() => {
    if (!player.playing && isPlaying) {
      // Player was paused externally
      setIsPlaying(false);
      accumulatedTimeRef.current = playTime;
    }
  }, [player.playing, isPlaying, playTime]);

  // Animate waveform for recording
  useEffect(() => {
    if (recorderState.isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease)
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease)
          })
        ])
      ).start();

      // Animate waveform bars
      const animateWaveform = () => {
        waveformData.forEach((val, index) => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(val, {
                toValue: Math.random() * 2 + 0.5,
                duration: 200 + Math.random() * 300,
                useNativeDriver: true,
              }),
              Animated.timing(val, {
                toValue: 1,
                duration: 200 + Math.random() * 300,
                useNativeDriver: true,
              })
            ])
          ).start();
        });
      };
      
      animateWaveform();
      intervalRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } else {
      pulseAnim.setValue(1);
      waveformData.forEach(val => val.setValue(1));
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRecordTime(0);
    }
    
    return () => { 
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pulseAnim, recorderState.isRecording, waveformData]);

  const onRecord = async () => {
    setIsLoading(true);
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAudioUri(null);
      onChange?.(null);
    } catch (error) {
      Alert.alert('Recording Error', 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  const onStop = async () => {
    setIsLoading(true);
    try {
      await recorder.stop();
      setAudioUri(recorder.uri);
      onChange?.(recorder.uri);
    } catch (error) {
      Alert.alert('Recording Error', 'Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  };

  const onPlayPause = async () => {
    if (!audioUri) return;
    try {
      if (player.playing) {
        await player.pause();
        setIsPlaying(false);
        accumulatedTimeRef.current = playTime;
      } else {
        // If we're at the end, restart from beginning
        if (playTime >= duration && duration > 0) {
          setPlayTime(0);
          progressAnim.setValue(0);
          accumulatedTimeRef.current = 0;
        }
        
        await player.play();
        setIsPlaying(true);
        startTimeRef.current = Date.now() - (accumulatedTimeRef.current * 1000);
        
        // Ensure duration is set
        if (duration === 0 && player.duration) {
          const newDuration = Math.floor(player.duration);
          setDuration(newDuration);
        }
      }
    } catch (error) {
      console.log('Playback error:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  };

  const onSeek = (position: number) => {
    if (!audioUri || duration === 0) return;
    
    const newPosition = Math.max(0, Math.min(position, duration));
    setPlayTime(newPosition);
    accumulatedTimeRef.current = newPosition;
    
    const progress = newPosition / duration;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // If currently playing, adjust the start time
    if (isPlaying) {
      startTimeRef.current = Date.now() - (newPosition * 1000);
    }
  };

  const onDelete = () => {
    // Stop playback first
    if (player.playing) {
      player.pause();
    }
    
    setAudioUri(null);
    onChange?.(null);
    setPlayTime(0);
    setDuration(0);
    progressAnim.setValue(0);
    setIsPlaying(false);
    startTimeRef.current = 0;
    accumulatedTimeRef.current = 0;
  };

  const onUpload = async () => {
    setIsLoading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ 
        type: 'audio/*',
        copyToCacheDirectory: true 
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setAudioUri(uri);
        onChange?.(uri);
        // Reset playback state for new audio
        setPlayTime(0);
        setDuration(0);
        progressAnim.setValue(0);
        setIsPlaying(false);
        startTimeRef.current = 0;
        accumulatedTimeRef.current = 0;
      }
    } catch (error) {
      Alert.alert('Upload Error', 'Failed to upload audio file');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Handle progress bar tap for seeking
  const handleProgressBarPress = (event: any) => {
    if (!duration) return;
    
    const { locationX } = event.nativeEvent;
    const progressBarWidth = SCREEN_WIDTH - 64 - 40; // Adjust for padding
    const progress = Math.max(0, Math.min(locationX / progressBarWidth, 1));
    const newPosition = Math.floor(progress * duration);
    
    onSeek(newPosition);
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }] 
        },
        style
      ]}
    >
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner variant="inline" message="Processing..." isDark={isDark} />
        </View>
      )}

      {/* Recording UI */}
      {recorderState.isRecording && (
        <LinearGradient
          colors={isDark 
            ? ['#1e1b4b', '#312e81', '#1e1b4b'] 
            : ['#f0f9ff', '#e0f2fe', '#f0f9ff']
          }
          style={[
            styles.recordingContainer,
            { borderColor: isDark ? '#3730a3' : '#bae6fd' }
          ]}
        >
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
          
          <View style={styles.waveformContainer}>
            {waveformData.map((animValue, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    transform: [{ scaleY: animValue }],
                    backgroundColor: themeColors.primary,
                  }
                ]}
              />
            ))}
          </View>

          <View style={styles.recordingInfo}>
            <View style={styles.recordingStatus}>
              <View style={[styles.recordingDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.recordingText, { color: isDark ? '#f8fafc' : '#0f172a' }]}> 
                Irimo gufata amajwi • {formatTime(recordTime)}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.stopButton, { backgroundColor: '#ef4444' }]}
              onPress={onStop}
            >
              <Square size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}

      {/* Playback UI */}
      {audioUri && !recorderState.isRecording && (
        <View style={[
          styles.playbackContainer,
          { backgroundColor: isDark ? '#1e293b' : '#ffffff' }
        ]}>
          <LinearGradient
            colors={[themeColors.primary, themeColors.secondary]}
            style={styles.playbackHeader}
          >
            <Mic size={24} color="white" />
            <Text style={styles.playbackTitle}>
              {isPlaying ? 'Irimo gukina...' : 'Umva amajwi yawe'}
            </Text>
            <CheckCircle size={20} color="#22c55e" />
          </LinearGradient>

          <View style={styles.progressSection}>
            <View style={styles.timeLabels}>
              <Text style={[styles.timeText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
                {formatTime(playTime)}
              </Text>
              <Text style={[styles.timeText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
                {formatTime(duration)}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={handleProgressBarPress}
              activeOpacity={0.8}
            >
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  { 
                    width: progressWidth,
                    backgroundColor: themeColors.primary 
                  }
                ]} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.playbackControls}>
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}
              onPress={onDelete}
            >
              <Trash2 size={20} color={isDark ? '#ef4444' : '#dc2626'} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.playButton, { 
                backgroundColor: themeColors.primary,
                transform: [{ scale: isPlaying ? 1.05 : 1 }]
              }]}
              onPress={onPlayPause}
            >
              {isPlaying ? (
                <Pause size={28} color="white" />
              ) : (
                <Play size={28} color="white" />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}
              onPress={onUpload}
            >
              <Upload size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Playback status indicator */}
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <Text style={[styles.playingText, { color: themeColors.primary }]}> 
                ● Irimo gukina
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Idle UI - Record or Upload */}
      {!audioUri && !recorderState.isRecording && !isLoading && (
        <View style={styles.idleContainer}>
          <LinearGradient
            colors={isDark 
              ? ['#1e293b', '#334155'] 
              : ['#f8fafc', '#f1f5f9']
            }
            style={[
              styles.idleContent,
              { borderColor: isDark ? '#374151' : '#e2e8f0' }
            ]}
          >
            <View style={styles.idleHeader}>
              <Mic size={32} color={themeColors.primary} />
              <Text style={[styles.idleTitle, { color: isDark ? '#f8fafc' : '#1e293b' }]}> 
                Shyiramo Amajwi Yawe
              </Text>
              <Text style={[styles.idleSubtitle, { color: isDark ? '#cbd5e1' : '#64748b' }]}> 
                Fata amajwi mashya cyangwa shyiramo ayo usanganywe
              </Text>
            </View>

            <View style={styles.idleActions}>
              <TouchableOpacity 
                style={[styles.idleButton, { backgroundColor: themeColors.primary }]}
                onPress={onRecord}
              >
                <Mic size={20} color="white" />
                <Text style={styles.idleButtonText}>Fata Amajwi</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.idleButton, 
                  { backgroundColor: isDark ? '#374151' : '#e2e8f0' }
                ]}
                onPress={onUpload}
              >
                <Download size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
                <Text style={[
                  styles.idleButtonText, 
                  { color: isDark ? '#cbd5e1' : '#64748b' }
                ]}>
                  Shyiramo Amajwi
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    width: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  recordingContainer: {
    width: SCREEN_WIDTH - 64,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  pulseCircle: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginVertical: 20,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  stopButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playbackContainer: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  playbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingVertical: 12,
  },
  playbackTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  progressSection: {
    padding: 20,
    paddingBottom: 16,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 0,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playingIndicator: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  playingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  idleContainer: {
    width: SCREEN_WIDTH - 64,
  },
  idleContent: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  idleHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  idleTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginTop: 12,
    marginBottom: 4,
  },
  idleSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  idleActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  idleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  idleButtonText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
});