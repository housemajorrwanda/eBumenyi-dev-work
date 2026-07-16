import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Video, Calendar, X, Play } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getPublishedRecordings, buildRecordingUrl, IMeetingRecording } from '@/services/recording.api';
import VideoCard from '@/components/VideoViewer';
import { formatRwDateShort } from '@/utils/format';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

function RecordingCard({
  recording,
  onPress,
  themeColors,
  isDark,
}: {
  recording: IMeetingRecording;
  onPress: () => void;
  themeColors: any;
  isDark: boolean;
}) {
  const title = recording.title ?? recording.event?.title ?? 'Amavideyo';
  const eventSubtitle = recording.event?.description ?? recording.event?.title;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: isDark ? '#374151' : '#e5e7eb' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.cardThumb, { backgroundColor: isDark ? '#111827' : '#f1f5f9' }]}>
        <Play size={36} color={themeColors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
          {title}
        </Text>
        {eventSubtitle && (
          <View style={styles.cardMeta}>
            <Calendar size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.cardMetaText, { color: isDark ? '#9ca3af' : '#6b7280' }]} numberOfLines={1}>
              {eventSubtitle}
            </Text>
          </View>
        )}
        <Text style={[styles.cardDate, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
          {formatRwDateShort(recording.publishedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function WatchRecordingsScreenContent() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const [selected, setSelected] = useState<IMeetingRecording | null>(null);
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceWatchList = useTourStepAdvance('watch-list');
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
  const isFocused = useIsFocused();
  // If the user navigates away (tapping the real highlighted element can
  // itself trigger navigation, but this also covers back/tab-switch/etc.)
  // while a tour is visible, its CopilotProvider can stay mounted (stack
  // navigators often keep the previous screen alive) — without this, the
  // tour's Modal renders in RN's top-level layer and keeps floating over
  // whatever screen is now active. Close it on the focus transition.
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    if (wasFocusedRef.current && !isFocused && visible) {
      stop().catch(() => {});
    }
    wasFocusedRef.current = isFocused;
  }, [isFocused, visible, stop]);
  const autoStartAttemptedRef = useRef(false);

  const { data: recordings = [], isLoading, refetch, isRefreshing } = useQuery({
    queryKey: ['publishedRecordings'],
    queryFn: getPublishedRecordings,
  }) as any;

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && recordings.length > 0 && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.RECORDINGS_WATCH);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, recordings.length, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.RECORDINGS_WATCH).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  const videoUrl = selected ? buildRecordingUrl(selected.url) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1f2937' : '#fff', borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>Ibyafashwe mu Nama</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={!!isRefreshing} onRefresh={refetch} tintColor={themeColors.primary} />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Gutegura amavideyo...</Text>
          </View>
        ) : recordings.length === 0 ? (
          <View style={styles.center}>
            <Video size={48} color={isDark ? '#374151' : '#d1d5db'} />
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Nta mavideyo ahari ubu
            </Text>
          </View>
        ) : (
          recordings.map((r: IMeetingRecording, index: number) => {
            const card = (
              <RecordingCard
                recording={r}
                onPress={advanceWatchList(() => setSelected(r))}
                themeColors={themeColors}
                isDark={isDark}
              />
            );
            // Only the first card is a tour target — spotlighting the whole
            // list left too little room above/below the target for the
            // tooltip to fit without being clipped. A single card gives it
            // natural room to sit below.
            if (index === 0) {
              return (
                <CopilotStep
                  key={r.id}
                  text="Hano hagaragara amasomo cyangwa inama byafashwe mbere. Kanda ku gakarita kureba video."
                  order={1}
                  name="watch-list"
                >
                  <WalkthroughableView>{card}</WalkthroughableView>
                </CopilotStep>
              );
            }
            return <React.Fragment key={r.id}>{card}</React.Fragment>;
          })
        )}
      </ScrollView>

      {/* Video Player Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selected?.title ?? selected?.event?.title ?? 'Amavideyo'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.videoWrapper}>
            {selected && <VideoCard uri={videoUrl} />}
          </View>

          <ScrollView style={styles.modalInfo} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            <Text style={styles.modalRecTitle}>
              {selected?.title ?? selected?.event?.title ?? 'Amavideyo'}
            </Text>
            {(selected?.event?.description ?? selected?.event?.title) && (
              <View style={styles.modalMetaRow}>
                <Calendar size={15} color="#9ca3af" />
                <Text style={styles.modalMetaText}>{selected!.event!.description ?? selected!.event!.title}</Text>
              </View>
            )}
            <Text style={styles.modalMetaDate}>
              Yatangiwe: {formatRwDateShort(selected?.publishedAt ?? null)}
            </Text>
            {selected?.user?.fullNames && (
              <Text style={styles.modalMetaDate}>Na: {selected.user.fullNames}</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function WatchRecordingsScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      androidStatusBarVisible
      labels={{ finish: 'Rangiza', next: 'Ibikurikiraho', previous: 'Inyuma', skip: 'Simbuka' }}
    >
      <WatchRecordingsScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardThumb: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  cardBody: { flex: 1, padding: 12, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, flex: 1 },
  cardDate: { fontSize: 11, marginTop: 2 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  closeBtn: { padding: 4 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center', marginHorizontal: 8 },
  videoWrapper: { marginTop: 8, paddingHorizontal: 20 },
  modalInfo: { flex: 1, marginTop: 16 },
  modalRecTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 8 },
  modalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  modalMetaText: { fontSize: 14, color: '#9ca3af' },
  modalMetaDate: { fontSize: 13, color: '#6b7280', marginTop: 4 },
});
