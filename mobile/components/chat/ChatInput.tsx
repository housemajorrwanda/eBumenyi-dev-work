import { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Text,
  Modal,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardEvent,
  Platform,
} from 'react-native';
import {
  Send,
  Smile,
  Paperclip,
  Mic,
  Trash2,
  ImageIcon,
  Camera,
  FileText,
  Music,
  Lock,
  Video,
} from 'lucide-react-native';
import { File } from 'expo-file-system';
import EmojiPicker from './EmojiPicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { Waveform, UpdateFrequency } from '@simform_solutions/react-native-audio-waveform';
import type { IWaveformRef } from '@simform_solutions/react-native-audio-waveform';
import { uploadChatFile } from '@/services/messaging.api';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { CopilotStep } from 'react-native-copilot';
import { WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

// ─── Types ────────────────────────────────────────────────────────────────────
type RecordingMode = 'idle' | 'locked';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendAttachment?: (url: string, type: 'image' | 'file' | 'audio' | 'video', fileName: string) => void;
  disabled?: boolean;
  initialMessage?: string;
  isEditing?: boolean;
  onEditCancel?: () => void;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  onEmojiPickerToggle?: (open: boolean) => void;
  // Only set true on screens that mount ChatInput inside a CopilotProvider.
  // CopilotStep internally calls useCopilot() which throws without a provider,
  // so this must remain false on all other screens that render ChatInput.
  tourEnabled?: boolean;
  // For screens that wrap this whole component in their OWN CopilotStep
  // (e.g. community/[id].tsx's "feed-input") instead of using tourEnabled's
  // internal chat-media/chat-voice steps — wraps the Send button so tapping
  // it advances/dismisses that outer step. See hooks/useTourStepAdvance.ts.
  tourAdvance?: (handler: () => void) => () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60).toString();
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Component ────────────────────────────────────────────────────────────────
export const ChatInput = forwardRef<TextInput, ChatInputProps>(
  function ChatInput(
    {
      onSendMessage,
      onSendAttachment,
      disabled = false,
      initialMessage = '',
      isEditing = false,
      onEditCancel,
      onStartTyping,
      onStopTyping,
      onEmojiPickerToggle,
      tourEnabled = false,
      tourAdvance,
    }: ChatInputProps,
    ref,
  ) {
    // ── Text / emoji / keyboard state ──────────────────────────────────────
    const [message, setMessage] = useState(initialMessage);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(300);
    const [showAttachSheet, setShowAttachSheet] = useState(false);
    const pendingEmojiOpenRef = useRef(false);
    const keyboardVisibleRef = useRef(false);

    // ── Typing auto-stop timer ────────────────────────────────────────────
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Recording state machine ────────────────────────────────────────────
    const [recordingMode, setRecordingMode] = useState<RecordingMode>('idle');
    const [recordingSec, setRecordingSec] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const liveWaveformRef = useRef<IWaveformRef>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { setActiveAudio } = useAudioPlayerContext();

    const { width } = useWindowDimensions();
    const rs = getResponsiveStyles(width);

    const advanceMedia = useTourStepAdvance('chat-media');
    const advanceVoice = useTourStepAdvance('chat-voice');

    // ── Sync initialMessage (edit mode) ───────────────────────────────────
    useEffect(() => { setMessage(initialMessage); }, [initialMessage]);

    // ── Cleanup typing timer on unmount ───────────────────────────────────
    useEffect(() => {
      return () => {
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        onStopTyping?.();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Keyboard listeners ────────────────────────────────────────────────
    useEffect(() => {
      const show = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e: KeyboardEvent) => { keyboardVisibleRef.current = true; setKeyboardHeight(e.endCoordinates.height); },
      );
      const hide = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => {
          keyboardVisibleRef.current = false;
          if (pendingEmojiOpenRef.current) {
            pendingEmojiOpenRef.current = false;
            setShowEmojiPicker(true);
            onEmojiPickerToggle?.(true);
          }
        },
      );
      return () => { show.remove(); hide.remove(); };
    }, [onEmojiPickerToggle]);

    // ── Start Simform live recording when locked mode mounts ─────────────
    useEffect(() => {
      if (recordingMode === 'locked') {
        liveWaveformRef.current?.startRecord({ updateFrequency: UpdateFrequency.high });
      }
    }, [recordingMode]);

    // ── Timer helpers ─────────────────────────────────────────────────────
    const clearTimer = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    // ── Recording functions (Simform-based) ───────────────────────────────
    const finishRecording = useCallback(async (): Promise<string | null> => {
      clearTimer();
      try {
        const path = await liveWaveformRef.current?.stopRecord();
        setRecordingSec(0);
        if (!path) return null;
        return path.startsWith('file://') ? path : `file://${path}`;
      } catch (err) {
        console.log('finishRecording error:', err);
        return null;
      }
    }, []);

    const cancelRecording = useCallback(async () => {
      clearTimer();
      try { await liveWaveformRef.current?.stopRecord(); } catch { /* ignore */ }
      setRecordingSec(0);
    }, []);

    // ── Mic tap → check permissions then enter locked recording mode ──────
    const handleMicPress = useCallback(async () => {
      setActiveAudio(null);
      try {
        const { status } = await AudioModule.requestRecordingPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Uburenganzira', 'Tukenera uburenganzira bwo gukoresha microphone.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        setRecordingSec(0);
        clearTimer();
        timerRef.current = setInterval(() => setRecordingSec((s) => s + 1), 1000);
        setRecordingMode('locked'); // mounts the live Waveform → useEffect calls startRecord
      } catch (err) {
        console.log('handleMicPress error:', err);
        Alert.alert('Ikosa', 'Ntishoboka gutangira kwandika ijwi.');
      }
    }, [setActiveAudio]);

    // ── Locked recording controls ──────────────────────────────────────────
    const handleLockedCancel = useCallback(async () => {
      setRecordingMode('idle');
      await cancelRecording();
    }, [cancelRecording]);

    const handleLockedSend = useCallback(async () => {
      if (!onSendAttachment) { setRecordingMode('idle'); return; }
      setIsUploading(true);
      try {
        const uri = await finishRecording();
        if (!uri) { setRecordingMode('idle'); return; }
        const fileName = uri.split('/').pop() ?? `audio_${Date.now()}.m4a`;
        const uploaded = await uploadChatFile(uri, 'document', fileName, 'audio/m4a');
        onSendAttachment(uploaded.url, 'audio', fileName);
        try { new File(uri).delete(); } catch {}
        setRecordingMode('idle');
      } catch (err) {
        console.log('Audio upload error:', err);
        Alert.alert('Ikosa', 'Ntishoboka kohereza ijwi.');
        setRecordingMode('idle');
      } finally {
        setIsUploading(false);
      }
    }, [finishRecording, onSendAttachment]);

    // ── Text / emoji handlers ─────────────────────────────────────────────
    const handleSend = () => {
      if (message.trim()) {
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        onSendMessage(message.trim());
        setMessage('');
        onStopTyping?.();
        setShowEmojiPicker(false);
        onEmojiPickerToggle?.(false);
      }
    };
    const handleChangeText = (text: string) => {
      setMessage(text);
      if (text.length > 0) {
        onStartTyping?.();
        // Auto-stop typing after 2s of inactivity (WhatsApp behaviour)
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
          onStopTyping?.();
        }, 2000);
      } else {
        // Text cleared — stop immediately
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        onStopTyping?.();
      }
    };
    const handleEmojiSelected = (emoji: string) => {
      setMessage((prev) => prev + emoji);
      onStartTyping?.();
    };
    const handleBackspace = () => {
      setMessage((prev) => [...prev].slice(0, -1).join(''));
    };
    const handleEmojiButtonPress = () => {
      if (showEmojiPicker) {
        pendingEmojiOpenRef.current = false;
        setShowEmojiPicker(false);
        onEmojiPickerToggle?.(false);
      } else {
        pendingEmojiOpenRef.current = true;
        if (keyboardVisibleRef.current) {
          Keyboard.dismiss();
        } else {
          pendingEmojiOpenRef.current = false;
          setShowEmojiPicker(true);
          onEmojiPickerToggle?.(true);
        }
      }
    };

    // ── Attachment handlers ───────────────────────────────────────────────
    const handlePickImage = async () => {
      setShowAttachSheet(false);
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Uburenganzira', 'Tukenera uburenganzira bwo gufungura amafoto yawe.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true,
        });
        if (result.canceled || !result.assets?.length) return;
        setIsUploading(true);
        const errors: string[] = [];
        for (const asset of result.assets) {
          const fileName = asset.fileName || `image_${Date.now()}.jpg`;
          try {
            const uploaded = await uploadChatFile(asset.uri, 'image', fileName, asset.mimeType || 'image/jpeg');
            onSendAttachment?.(uploaded.url, 'image', fileName);
          } catch { errors.push(fileName); }
        }
        if (errors.length) Alert.alert('Ikosa', `Ntishoboka kohereza: ${errors.join(', ')}`);
      } catch { Alert.alert('Ikosa', 'Ntishoboka gufungura amafoto.'); }
      finally { setIsUploading(false); }
    };

    const handleTakePhoto = async () => {
      setShowAttachSheet(false);
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Uburenganzira', 'Tukenera uburenganzira bwo gukoresha kamera.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
          setIsUploading(true);
          try {
            const uploaded = await uploadChatFile(asset.uri, 'image', fileName, asset.mimeType || 'image/jpeg');
            onSendAttachment?.(uploaded.url, 'image', fileName);
          } catch { Alert.alert('Ikosa', 'Ntishoboka kohereza ifoto.'); }
          finally { setIsUploading(false); }
        }
      } catch { Alert.alert('Ikosa', 'Ntishoboka gufungura kamera.'); setIsUploading(false); }
    };

    const handlePickDocument = async () => {
      setShowAttachSheet(false);
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
        if (result.canceled || !result.assets?.length) return;
        setIsUploading(true);
        const errors: string[] = [];
        for (const asset of result.assets) {
          try {
            const isImage = asset.mimeType?.startsWith('image/') ?? false;
            const uploaded = await uploadChatFile(asset.uri, isImage ? 'image' : 'document', asset.name, asset.mimeType || 'application/octet-stream');
            onSendAttachment?.(uploaded.url, isImage ? 'image' : 'file', asset.name);
          } catch { errors.push(asset.name); }
        }
        if (errors.length) Alert.alert('Ikosa', `Ntishoboka kohereza: ${errors.join(', ')}`);
      } catch { Alert.alert('Ikosa', 'Ntishoboka gufungura dosiye.'); }
      finally { setIsUploading(false); }
    };

    const handlePickAudio = async () => {
      setShowAttachSheet(false);
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) return;
        setIsUploading(true);
        const errors: string[] = [];
        for (const asset of result.assets) {
          try {
            const uploaded = await uploadChatFile(asset.uri, 'document', asset.name, asset.mimeType || 'audio/mpeg');
            onSendAttachment?.(uploaded.url, 'audio', asset.name);
          } catch { errors.push(asset.name); }
        }
        if (errors.length) Alert.alert('Ikosa', `Ntishoboka kohereza: ${errors.join(', ')}`);
      } catch { Alert.alert('Ikosa', "Ntishoboka gufungura dosiye y'ijwi."); }
      finally { setIsUploading(false); }
    };

    const handlePickVideo = async () => {
      setShowAttachSheet(false);
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.8,
          allowsMultipleSelection: false,
        });
        if (result.canceled || !result.assets?.length) return;
        setIsUploading(true);
        const asset = result.assets[0];
        const fileName = asset.fileName || `video_${Date.now()}.mp4`;
        try {
          const uploaded = await uploadChatFile(asset.uri, 'video', fileName, asset.mimeType || 'video/mp4');
          onSendAttachment?.(uploaded.url, 'video', fileName);
        } catch (error) {
          console.error('[handlePickVideo] Upload error:', error);
          Alert.alert('Ikosa', 'Ntishoboka kohereza video.');
        } finally {
          setIsUploading(false);
        }
      } catch (error) {
        console.error('[handlePickVideo] Picker error:', error);
        Alert.alert('Ikosa', 'Ntishoboka gufungura video.');
        setIsUploading(false);
      }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <>
        {/* ── LOCKED: hands-free recording with controls ── */}
        {recordingMode === 'locked' && (
          <View style={lockedStyles.container}>
            <View style={lockedStyles.topRow}>
              <Text style={lockedStyles.timer}>{fmtDuration(recordingSec)}</Text>
              <View style={lockedStyles.waveformBox}>
                <Waveform
                  mode="live"
                  ref={liveWaveformRef}
                  candleSpace={2}
                  candleWidth={4}
                  waveColor="#4D81D2"
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </View>
            <View style={lockedStyles.bottomRow}>
              <TouchableOpacity onPress={handleLockedCancel} style={lockedStyles.trashBtn} activeOpacity={0.7} disabled={isUploading}>
                <Trash2 size={22} color="#8696A0" />
              </TouchableOpacity>
              {/* <View style={lockedStyles.lockBadge}>
                <Lock size={16} color="#4D81D2" />
                <Text style={lockedStyles.lockLabel}>Yanditswe</Text>
              </View> */}
              <TouchableOpacity onPress={handleLockedSend} style={lockedStyles.sendBtn} activeOpacity={0.85} disabled={isUploading}>
                {isUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Send size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── IDLE / NORMAL INPUT BAR ── */}
        {recordingMode === 'idle' && (
          <View>
            {/* Editing indicator - shown above the input */}
            {isEditing && (
              <View style={styles.editingIndicator}>
                <Text style={styles.editingText}>Vugurura ubutumwa bwawe</Text>
                <TouchableOpacity onPress={onEditCancel} style={styles.cancelEditButton}>
                  <Text style={styles.cancelEditText}>Oya</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.container, { paddingHorizontal: rs.paddingHorizontal }]}>
              <View style={[styles.inputContainer, { paddingVertical: rs.inputPaddingVertical }]}>
                <TouchableOpacity style={styles.iconButton} onPress={handleEmojiButtonPress} activeOpacity={0.7}>
                  <Smile size={rs.iconSize} color={showEmojiPicker ? '#4D81D2' : '#8696A0'} />
                </TouchableOpacity>

                <TextInput
                  ref={ref}
                  style={[styles.input, { fontSize: rs.fontSize }]}
                  placeholder="Ubutumwa cg igitekerezo cyawe"
                  placeholderTextColor="#8696A0"
                  value={message}
                  onChangeText={handleChangeText}
                  multiline
                  maxLength={1000}
                  editable={!disabled && recordingMode === 'idle'}
                  onBlur={onStopTyping}
                  onFocus={() => {
                    pendingEmojiOpenRef.current = false;
                    setShowEmojiPicker(false);
                    onEmojiPickerToggle?.(false);
                  }}
                />

                {tourEnabled ? (
                  <CopilotStep
                    text="Kanda hano kongeraho ifoto, video, dosiye cyangwa ijwi mu biganiro."
                    order={1}
                    name="chat-media"
                  >
                    <WalkthroughableTouchable
                      style={styles.iconButton}
                      onPress={advanceMedia(() => !isUploading && setShowAttachSheet(true))}
                      activeOpacity={0.7}
                      disabled={recordingMode !== 'idle'}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#4D81D2" />
                      ) : (
                        <Paperclip size={rs.iconSize} color={showAttachSheet ? '#4D81D2' : '#8696A0'} />
                      )}
                    </WalkthroughableTouchable>
                  </CopilotStep>
                ) : (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => !isUploading && setShowAttachSheet(true)}
                    activeOpacity={0.7}
                    disabled={recordingMode !== 'idle'}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#4D81D2" />
                    ) : (
                      <Paperclip size={rs.iconSize} color={showAttachSheet ? '#4D81D2' : '#8696A0'} />
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Send button (text) or Mic button (gesture) */}
              {message.trim() && recordingMode === 'idle' ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { width: rs.buttonSize, height: rs.buttonSize }, styles.actionBtnActive]}
                  onPress={tourAdvance ? tourAdvance(handleSend) : handleSend}
                  disabled={disabled}
                >
                  <Send size={rs.sendIconSize} color="#fff" />
                </TouchableOpacity>
              ) : tourEnabled ? (
                <CopilotStep
                  text="Kanda hano gutangira gufata ijwi. Nusoza gufata ubutumwa bwawe hano, buto izahinduka kohereza."
                  order={2}
                  name="chat-voice"
                >
                  <WalkthroughableTouchable
                    style={[styles.actionBtn, { width: rs.buttonSize, height: rs.buttonSize }]}
                    onPress={advanceVoice(handleMicPress)}
                    disabled={isUploading}
                    activeOpacity={0.7}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#4D81D2" />
                    ) : (
                      <Mic size={rs.micIconSize} color="#8696A0" />
                    )}
                  </WalkthroughableTouchable>
                </CopilotStep>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { width: rs.buttonSize, height: rs.buttonSize }]}
                  onPress={handleMicPress}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#4D81D2" />
                  ) : (
                    <Mic size={rs.micIconSize} color="#8696A0" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Emoji Picker ── */}
        <EmojiPicker
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelected={handleEmojiSelected}
          onBackspace={handleBackspace}
          pickerHeight={keyboardHeight > 200 ? keyboardHeight : 300}
        />

        {/* ── Attachment sheet ── */}
        <Modal
          visible={showAttachSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAttachSheet(false)}
        >
          <TouchableOpacity style={attachStyles.backdrop} activeOpacity={1} onPress={() => setShowAttachSheet(false)} />
          <View style={attachStyles.sheet}>
            <View style={attachStyles.handle} />
            <Text style={attachStyles.title}>Ongeraho dosiye</Text>
            <View style={attachStyles.grid}>
              {[
                { label: 'Amafoto', icon: ImageIcon, color: '#3B82F6', bg: '#EFF6FF', onPress: handlePickImage },
                { label: 'Kamera', icon: Camera, color: '#F97316', bg: '#FFF7ED', onPress: handleTakePhoto },
                { label: 'Video', icon: Video, color: '#8B5CF6', bg: '#F5F3FF', onPress: handlePickVideo },
                { label: 'Dosiye', icon: FileText, color: '#22C55E', bg: '#F0FDF4', onPress: handlePickDocument },
                { label: 'Ijwi', icon: Music, color: '#EF4444', bg: '#FFF0F0', onPress: handlePickAudio },
              ].map(({ label, icon: Icon, color, bg, onPress }) => (
                <TouchableOpacity key={label} style={attachStyles.item} onPress={onPress}>
                  <View style={[attachStyles.iconBox, { backgroundColor: bg }]}>
                    <Icon size={28} color={color} />
                  </View>
                  <Text style={attachStyles.itemLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </>
    );
  },
);

// ─── Responsive style helper ──────────────────────────────────────────────────
function getResponsiveStyles(width: number) {
  const sm = width < 400;
  const lg = width > 768;
  return {
    paddingHorizontal: sm ? 4 : lg ? 16 : 8,
    inputPaddingVertical: sm ? 6 : lg ? 10 : 8,
    fontSize: sm ? 14 : lg ? 18 : 16,
    iconSize: sm ? 20 : lg ? 28 : 24,
    buttonSize: sm ? 36 : lg ? 48 : 42,
    sendIconSize: sm ? 16 : lg ? 24 : 20,
    micIconSize: sm ? 26 : 28,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: '#E5DDD5',
    alignItems: 'flex-end',
    gap: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 42,
  },
  iconButton: { padding: 4 },
  input: {
    flex: 1,
    color: '#000',
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxHeight: 100,
  },
  actionBtn: {
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: { backgroundColor: '#4D81D2' },
  editingIndicator: {
    backgroundColor: '#fff9c4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#fbc02d',
    borderBottomWidth: 1,
    borderBottomColor: '#fbc02d',
  },
  editingText: { fontSize: 13, fontWeight: '600', color: '#f57f17', flex: 1 },
  cancelEditButton: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f57f17', borderRadius: 6 },
  cancelEditText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
});


const lockedStyles = StyleSheet.create({
  container: {
    backgroundColor: '#E5DDD5',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timer: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    minWidth: 48,
  },
  waveformBox: {
    flex: 1,
    height: 56,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  trashBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lockLabel: {
    fontSize: 13,
    color: '#4D81D2',
    fontWeight: '600',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const attachStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
    flexWrap: 'wrap',
  },
  item: { alignItems: 'center', gap: 8, width: '18%' },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 12, fontWeight: '500', color: '#374151', textAlign: 'center' },
});
