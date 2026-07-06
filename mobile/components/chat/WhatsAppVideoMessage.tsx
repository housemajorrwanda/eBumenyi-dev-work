import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  ViewStyle,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';

export interface WhatsAppVideoMessageProps {
  uri: string;
  style?: ViewStyle;
  bubbleWidth?: number;
  bubbleHeight?: number;
  onError?: (error: Error) => void;
}

export const WhatsAppVideoMessage: React.FC<WhatsAppVideoMessageProps> = ({
  uri,
  style,
  bubbleWidth = 240,
  bubbleHeight = 180,
  onError,
}) => {
  const correctedUri = uri.replace('/api/uploads/', '/uploads/');

  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs so event handlers always read the latest values without re-registering listeners
  const isFullscreenRef = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => { isFullscreenRef.current = isFullscreenVisible; }, [isFullscreenVisible]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const player = useVideoPlayer(correctedUri, (p) => {
    p.muted = true;
    p.loop = true;
  });

  // Register listeners once — use ref for fullscreen state to avoid stale closures
  useEffect(() => {
    // Read current status immediately in case the player is already ready
    // (e.g. component re-mounts while video was already cached)
    if ((player as any).status === 'readyToPlay') {
      setIsLoading(false);
      try { player.play(); } catch {}
    }

    const statusSub = player.addListener('statusChange', (newStatus: any) => {
      // expo-video passes the status string as first arg directly, not as {status}
      const status: string = typeof newStatus === 'string' ? newStatus : (newStatus?.status ?? '');
      if (status === 'readyToPlay') {
        setIsLoading(false);
        setHasError(false);
        try { player.play(); } catch {}
      } else if (status === 'error') {
        setIsLoading(false);
        setHasError(true);
        const err = typeof newStatus === 'object' && newStatus?.error
          ? newStatus.error
          : new Error('Video failed to load');
        onErrorRef.current?.(err);
      }
    });

    const playingSub = player.addListener('playingChange', (newIsPlaying: any) => {
      const playing = typeof newIsPlaying === 'boolean' ? newIsPlaying : (newIsPlaying?.isPlaying ?? false);
      setIsPlaying(playing);
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]); // Only re-run if player instance changes

  // Pause on unmount
  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, []);

  const handleBubbleTap = () => {
    if (isFullscreenVisible) return;
    // Open fullscreen regardless of load state — modal shows spinner if still loading
    player.muted = false;
    player.loop = false;
    setIsFullscreenVisible(true);
    if (!isLoading) {
      try { player.play(); } catch {}
    }
    // If still loading, statusChange → readyToPlay will call player.play() automatically
  };

  const handleFullscreenClose = () => {
    player.muted = true;
    player.loop = true;
    try { player.currentTime = 0; } catch {}
    setIsFullscreenVisible(false);
    // Resume muted bubble preview
    if (!isLoading) {
      try { player.play(); } catch {}
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    try { player.replace(correctedUri); } catch {}
  };

  const showPlayOverlay = !isPlaying && !isLoading && !isFullscreenVisible;

  // ── Low-network timeout: if still loading after 15s, surface the retry UI ──
  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
      onErrorRef.current?.(new Error('Video load timed out'));
    }, 15_000);
    return () => clearTimeout(timeout);
  }, [isLoading, uri]);

  if (hasError) {
    return (
      <TouchableOpacity
        onPress={handleRetry}
        activeOpacity={0.75}
        style={[
          styles.bubbleContainer,
          { width: bubbleWidth, height: bubbleHeight },
          styles.errorContainer,
          style,
        ]}
      >
        <View style={styles.retryIconCircle}>
          <Play size={20} color="#9ca3af" />
        </View>
        <Text style={styles.errorText}>Video itashobora gufunguwa</Text>
        <Text style={styles.retryText}>Kanda ugerageze ukundi</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bubble thumbnail — always tappable */}
      <TouchableOpacity
        onPress={handleBubbleTap}
        activeOpacity={0.85}
        style={[styles.bubbleContainer, { width: bubbleWidth, height: bubbleHeight }, style]}
      >
        <View style={styles.videoView} pointerEvents="none">
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls={false}
            contentFit="cover"
          />
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <LoadingSpinner variant="inline" message="" isDark />
          </View>
        )}

        {showPlayOverlay && (
          <View style={styles.playIconOverlay}>
            <View style={styles.playIconBackground}>
              <Play size={32} color="#ffffff" fill="#ffffff" />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen modal — reuses the same player */}
      <Modal
        visible={isFullscreenVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={handleFullscreenClose}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            onPress={handleFullscreenClose}
            style={styles.closeButton}
            activeOpacity={0.75}
          >
            <View style={styles.closeButtonBackground}>
              <Text style={styles.closeButtonText}>✕</Text>
            </View>
          </TouchableOpacity>

          {isLoading && (
            <View style={styles.fullscreenLoadingOverlay}>
              <LoadingSpinner variant="inline" message="Loading…" isDark />
            </View>
          )}

          <VideoView
            player={player}
            style={styles.fullscreenVideo}
            nativeControls={true}
            contentFit="contain"
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bubbleContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  retryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  retryText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenLoadingOverlay: {
    position: 'absolute',
    zIndex: 5,
    alignItems: 'center',
    gap: 12,
  },
  fullscreenLoadingText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
});

export default WhatsAppVideoMessage;
