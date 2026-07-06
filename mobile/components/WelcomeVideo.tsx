import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Vibration } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASSETS_BASE_URL, UPLOADS_VIDEOS_PATH } from '@/config/constants';

const { width} = Dimensions.get('window');
const STORAGE_KEY_PREFIX = 'welcome_video_shown';
const DEFAULT_URI = `${ASSETS_BASE_URL}${UPLOADS_VIDEOS_PATH}/UBUTUMWA-KU-BAJYANAMA-B-UBUZIMA-EMERY-HEZAGIRA.mp4`;
const SFX_URL = 'https://assets.mixkit.co/sfx/preview/mixkit-small-bell-ring-925.wav';

interface Props {
  uri?: string;
  userId?: string; // optional user-specific key
  autoMarkSeen?: boolean; // mark seen automatically on start
  onDone?: () => void;
  // Testing/dev override to always show the welcome overlay
  forceVisible?: boolean;
}

export default function WelcomeVideo({ uri = DEFAULT_URI, userId, autoMarkSeen = false, onDone, forceVisible = false }: Props) {
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
  const [visible, setVisible] = useState(false); // whether to show this welcome component
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [, setVideoLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current; // idle pulse (1 == normal)
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const endAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    try { p.loop = false; } catch (e) { console.log('video player set loop error', e); }
  });

  const sfx = useRef<any | null>(null);

  useEffect(() => {
    // If forceVisible is set (testing), bypass storage and show
    if (forceVisible) {
      setVisible(true);
    } else {
      (async () => {
        try {
          const val = await AsyncStorage.getItem(storageKey);
          // Legacy bug wrote '1' before the video was shown — treat as not seen
          if (!val || val === '1') {
            setVisible(true);
          }
        } catch (e) {
          console.log('WelcomeVideo storage read error', e);
          setVisible(true);
        }
      })();
    }

    // load SFX using expo-audio
    (async () => {
      try {
        const player = createAudioPlayer({ uri: SFX_URL });
        sfx.current = player;
      } catch (e) {
        // expo-audio might not be fully initialized in some environments — that's ok
        console.log('Failed to load sfx (expo-audio error?):', e);
        sfx.current = null;
      }
    })();

    return () => {
      (async () => {
        try {
          if (sfx.current && typeof sfx.current.remove === 'function') {
            sfx.current.remove();
            sfx.current = null;
          }
        } catch (e) {
          console.log('remove sfx error', e);
        }
      })();
    };
  }, [storageKey, forceVisible]);

  const playSfx = React.useCallback(async () => {
    try {
      if (sfx.current && typeof sfx.current.play === 'function') {
        // Seek to beginning and play (no await needed, play() is synchronous in expo-audio)
        sfx.current.seekTo(0);
        sfx.current.play();
      }
    } catch (e) {
      console.log('playSfx error', e);
    }
  }, []);

  // Idle pulsing while the overlay is visible and not started
  useEffect(() => {
    if (visible && !started) {
      // gentle pulse between 0.98 and 1.04
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.98, duration: 900, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      // reset and stop
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    };
  }, [visible, started, pulseAnim]);

  const startSequence = React.useCallback(async () => {
    // small pre-play animation (flower pop & rotate)
    setStarted(true);
    // stop idle pulse
    pulseRef.current?.stop();

    Animated.parallel([
      Animated.sequence([
        Animated.spring(pulseAnim, { toValue: 1.12, useNativeDriver: true, speed: 18, bounciness: 12 }),
        Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }),
      ]),
      Animated.timing(rotateAnim, { toValue: 1, duration: 700, useNativeDriver: true })
    ]).start(async () => {
      try {
        // play a small chime and vibrate
        await playSfx();
        // Vibration.vibrate(200);
      } catch (e) { console.log('pre-start sfx error', e); }

      try {
        if (player && typeof player.play === 'function') await player.play();
      } catch (e) { console.log('player.play error', e); }

      if (autoMarkSeen) {
        try { await AsyncStorage.setItem(storageKey, String(Date.now())); } catch (e) { console.log('store welcome seen error', e); }
      }

      // hide the big overlay but keep controls visible
      setVisible(false);
    });
  }, [player, playSfx, autoMarkSeen, storageKey, rotateAnim, pulseAnim]);

  const toggleMute = () => {
    setMuted(prev => !prev);
    try {
      if (player && typeof (player as any).setIsMuted === 'function') {
        (player as any).setIsMuted(!muted);
      } else if (player) {
        (player as any).muted = !muted;
      }
    } catch (e) {
      console.log('toggleMute error', e);
    }
  };

  const markDone = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(storageKey, String(Date.now()));
    } catch (e) {
      console.log('store welcome seen error', e);
    }
    try { if (player && typeof player.pause === 'function') await player.pause(); } catch (e) { console.log('player.pause error', e); }
    if (onDone) onDone();
  }, [storageKey, player, onDone]);

  const handlePlaybackStatus = React.useCallback(async (status: any) => {
    try {
      if (status && status.didJustFinish) {
        // trigger end animation, play sfx and vibrate
        try { await playSfx(); Vibration.vibrate([100, 50, 100]); } catch (e) { console.log('end sfx error', e); }

        Animated.sequence([
          Animated.timing(endAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(endAnim, { toValue: 0, duration: 400, delay: 400, useNativeDriver: true })
        ]).start(() => {
          // mark as done after celebration
          markDone();
        });
      }
    } catch (err) {
      console.log('handlePlaybackStatus error', err);
    }
  }, [endAnim, markDone, playSfx]);

  // Attach playback status handler to the player instance if the runtime player API exposes a hook
  React.useEffect(() => {
    if (!player) return;

    // Try several common hooks that different players may expose. Guarded so it won't crash
    try {

      if (typeof (player as any).setOnPlaybackStatusUpdate === 'function') {
        (player as any).setOnPlaybackStatusUpdate((status: any) => handlePlaybackStatus(status));
        return;
      }

      // event emitter style
      if (typeof (player as any).addListener === 'function') {
        (player as any).addListener('playbackStatusUpdate', (status: any) => handlePlaybackStatus(status));
        return;
      }

      // generic callback property
      if (typeof (player as any).onPlaybackStatusUpdate === 'function' || typeof (player as any).onPlaybackStatusUpdate === 'undefined') {
        try { (player as any).onPlaybackStatusUpdate = (status: any) => handlePlaybackStatus(status); } catch (err) { console.log('set onPlaybackStatus update error', err); }
      }
    } catch (err) {
      console.log('attach playback status handler error', err);
    }
  }, [player, handlePlaybackStatus]);

  if (!visible && !started) return null; // nothing to show

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* show big overlay (flower + text) while the user hasn't started */}
      {visible && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Animated.View
              style={[styles.flower, {
                transform: [
                  { scale: pulseAnim },
                  { rotate: rotateAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg','8deg'] }) }
                ]
              }]}
            >
              <Text style={styles.flowerEmoji}>🌸</Text>
            </Animated.View>

            <Text style={styles.title}>Murakaza neza!</Text>
            <Text style={styles.subtitle}>Muri porogaramu y&apos;umujyanama w&apos;ubuzima</Text>

            <View style={styles.overlayButtonsRow}>
              <TouchableOpacity style={[styles.button, styles.startBtn]} onPress={startSequence}>
                <Text style={styles.buttonText}>Tangira</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.skipBtn]} onPress={markDone}>
                <Text style={[styles.buttonText]}>Funga</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Render the video only after the user taps "Tangira" (started === true) */}
      {started && (
        <View style={styles.videoWrap} onLayout={(e) => setVideoLayout(e.nativeEvent.layout)}>
          <VideoView
            style={[styles.video, { width: Math.min(width - 24, 900) }]}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
          />

          {/* Controls bar (mute only) */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleMute} style={styles.controlBtn}>
              <Text style={styles.controlText}>{muted ? '🔇' : '🔊'}</Text>
            </TouchableOpacity>
          {/* Center the done button and reduce size */}
            <View style={{ flex: 1, alignItems: 'flex-end'}}>
              <TouchableOpacity style={[styles.button, styles.skipBtn,  styles.doneBtn]} onPress={markDone}>
                <Text style={[styles.buttonText]}>Funga</Text>
              </TouchableOpacity>
            </View>
            {/* Center the done button and reduce size */}
            <View style={{ flex: 1, alignItems: 'flex-end'}}>
              <TouchableOpacity style={[styles.button, styles.startBtn, styles.doneBtn]} onPress={markDone}>
                <Text style={[styles.buttonText, styles.doneBtnText]}>Soza</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* end celebration overlay */}
          <Animated.View pointerEvents="none" style={[styles.endOverlay, { opacity: endAnim, transform: [{ scale: endAnim.interpolate({ inputRange: [0,1], outputRange: [0.8, 1.08] }) }] }]}> 
            <Text style={styles.endText}>Murakoze! 🎉</Text>
          </Animated.View>
        </View>
      )}

    </View>
  );
}

const styles: any = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  videoWrap: { width: '94%', maxWidth: 900,height: 310, alignItems: 'center', backgroundColor: '#3363AD', borderRadius: 12, overflow: 'hidden' },
  video: { height: 260, backgroundColor: '#000', borderRadius: 12 },
  controls: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  controlBtn: { padding: 8, backgroundColor: '#979ea8ff', borderWidth: 1, borderColor: 'rgba(96, 98, 105, 0.12)', borderRadius: 8 },
  controlText: { color: '#000', fontWeight: '700' },

  // smaller centered done button in the controls bar
  doneBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, minWidth: 96, alignItems: 'center' },
  doneBtnText: { fontSize: 14 },

  overlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11, 22, 33, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  overlayCard: { width: '100%', maxWidth: 480, backgroundColor: '#3363AD', borderRadius: 16, padding: 10, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  flower: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  flowerEmoji: { fontSize: 44 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#E5E7EB', fontSize: 13, textAlign: 'center', marginBottom: 18, maxWidth: 420 },
  buttonsRow: { flexDirection: 'row', marginHorizontal: -6 },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, marginHorizontal: 6 },
  startBtn: { backgroundColor: '#16A34A' },
  skipBtn: { backgroundColor: '#979ea8ff', borderWidth: 1, borderColor: 'rgba(96, 98, 105, 0.12)' },
  buttonText: { color: '#fff', fontWeight: '700' },

  endOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  endText: { color: '#fff', fontSize: 22, fontWeight: '800' },

  bottomActions: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
  actionsBg: { backgroundColor: 'transparent', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
  overlayButtonsRow: { flexDirection: 'row', marginTop: 12 },
});
