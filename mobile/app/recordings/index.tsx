import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Video, Eye, EyeOff, Trash2, X, Check, Search } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getAllRecordings,
  publishRecording,
  unpublishRecording,
  deleteRecording,
  getTrainees,
  buildRecordingUrl,
  IMeetingRecording,
  ITraineeOption,
  RecordingAudience,
} from '@/services/recording.api';
import { getCalendarEventById } from '@/services/calender';
import VideoCard from '@/components/VideoViewer';
import { formatRwDateShort } from '@/utils/format';

const AUDIENCE_LABELS: Record<RecordingAudience, string> = {
  ALL: 'Abakoresha bose',
  TRAINEES: "Abajyanama b'ubuzima (CHW)",
  INVITED: 'Abatumiwe gusa',
};

const AUDIENCE_OPTIONS: { value: RecordingAudience; label: string; description: string }[] = [
  { value: 'ALL', label: 'Abakoresha bose', description: 'Umuntu wese uri muri sisitemu' },
  { value: 'TRAINEES', label: "Abajyanama b'ubuzima", description: 'CHW / Supervisors gusa' },
  { value: 'INVITED', label: 'Abatumiwe gusa', description: 'Hitamo abantu ku giti cyabo' },
];

function AudienceBadge({ audience }: { audience: RecordingAudience }) {
  const colors: Record<RecordingAudience, { bg: string; text: string }> = {
    ALL: { bg: '#dbeafe', text: '#1d4ed8' },
    TRAINEES: { bg: '#d1fae5', text: '#065f46' },
    INVITED: { bg: '#fef3c7', text: '#92400e' },
  };
  const c = colors[audience];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{AUDIENCE_LABELS[audience]}</Text>
    </View>
  );
}

// ─── Publish Audience Modal ────────────────────────────────────────────────────
function PublishModal({
  visible,
  recording,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  recording: IMeetingRecording | null;
  onClose: () => void;
  onConfirm: (audience: RecordingAudience, invitedIds: string[]) => void;
  loading: boolean;
}) {
  const { isDark, themeColors } = useTheme();
  const [audience, setAudience] = useState<RecordingAudience>('ALL');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ITraineeOption[]>([]);

  const hasEventId = !!recording?.eventId;

  // When linked to an event, fetch that event's participants instead of all trainees
  const { data: eventData, isLoading: loadingEvent } = useQuery({
    queryKey: ['event-participants', recording?.eventId],
    queryFn: () => getCalendarEventById(recording!.eventId!),
    enabled: visible && audience === 'INVITED' && hasEventId,
    staleTime: 30_000,
  });

  // Fallback: all trainees (only used when recording has no linked event)
  const { data: trainees = [], isLoading: loadingTrainees } = useQuery({
    queryKey: ['trainees', search],
    queryFn: () => getTrainees(search || undefined),
    enabled: visible && audience === 'INVITED' && !hasEventId,
  });

  const eventInvitees: ITraineeOption[] = (eventData?.participants ?? [])
    .filter((p) => p.user)
    .map((p) => ({
      id: p.userId,
      fullNames: p.user!.fullNames,
      email: p.user!.email ?? null,
      photo: '',
    }));

  const allCandidates = hasEventId ? eventInvitees : trainees;

  const filteredCandidates = allCandidates
    .filter((t) => !selectedUsers.some((s) => s.id === t.id))
    .filter((t) =>
      !hasEventId || !search
        ? true
        : t.fullNames.toLowerCase().includes(search.toLowerCase()) ||
          (t.email ?? '').toLowerCase().includes(search.toLowerCase()),
    );

  const loadingCandidates = hasEventId ? loadingEvent : loadingTrainees;

  const toggleUser = (u: ITraineeOption) => {
    setSelectedUsers((prev) =>
      prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u],
    );
  };

  const handleConfirm = () => {
    if (audience === 'INVITED' && selectedUsers.length === 0) {
      Alert.alert('Hitamo abantu', 'Hitamo nibura umuntu umwe.');
      return;
    }
    onConfirm(audience, selectedUsers.map((u) => u.id));
  };

  // Reset on open
  React.useEffect(() => {
    if (visible) {
      setAudience('ALL');
      setSearch('');
      setSelectedUsers([]);
    }
  }, [visible]);

  const bg = isDark ? '#1f2937' : '#fff';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const subColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: borderColor }]}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>Tangaza videyo</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={subColor} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={[styles.sheetLabel, { color: subColor }]}>Uzi gutangazira nde?</Text>

            {AUDIENCE_OPTIONS.map((opt) => {
              const active = audience === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionRow,
                    { borderColor: active ? themeColors.primary : borderColor },
                    active && { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' },
                  ]}
                  onPress={() => setAudience(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radio, { borderColor: active ? themeColors.primary : borderColor }]}>
                    {active && <View style={[styles.radioDot, { backgroundColor: themeColors.primary }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: textColor }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: subColor }]}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* User picker for INVITED */}
            {audience === 'INVITED' && (
              <View style={{ marginTop: 12 }}>
                <View style={[styles.searchRow, { borderColor, backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
                  <Search size={16} color={subColor} />
                  <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder={hasEventId ? 'Shakisha uwatumiwe...' : 'Shakisha umujyanama...'}
                    placeholderTextColor={subColor}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {selectedUsers.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.chip, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                        onPress={() => toggleUser(u)}
                      >
                        <Text style={[styles.chipText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]} numberOfLines={1}>
                          {u.fullNames}
                        </Text>
                        <X size={12} color={isDark ? '#93c5fd' : '#1d4ed8'} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* User list */}
                {loadingCandidates ? (
                  <LoadingSpinner variant="inline" message="" />
                ) : (
                  <View style={[styles.userList, { borderColor }]}>
                    {filteredCandidates.length === 0 ? (
                      <Text style={[styles.emptyText, { color: subColor }]}>
                        {hasEventId ? 'Nta watumiwe wabonetse' : 'Nta mujyanama wabonetse'}
                      </Text>
                    ) : (
                      filteredCandidates.map((u) => {
                        const checked = selectedUsers.some((s) => s.id === u.id);
                        return (
                          <TouchableOpacity
                            key={u.id}
                            style={[styles.userRow, { borderBottomColor: borderColor }]}
                            onPress={() => toggleUser(u)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.checkBox, { borderColor: checked ? themeColors.primary : borderColor, backgroundColor: checked ? themeColors.primary : 'transparent' }]}>
                              {checked && <Check size={12} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.userName, { color: textColor }]}>{u.fullNames}</Text>
                              {u.email && (
                                <Text style={[styles.userEmail, { color: subColor }]}>{u.email}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Tangaza</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Recording Row ─────────────────────────────────────────────────────────────
function RecordingRow({
  recording,
  onPublish,
  onUnpublish,
  onDelete,
  onWatch,
  isDark,
}: {
  recording: IMeetingRecording;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onWatch: () => void;
  isDark: boolean;
}) {
  const title = recording.title ?? recording.event?.title ?? 'Amavideyo';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const subColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <View style={[styles.row, { backgroundColor: isDark ? '#1f2937' : '#fff', borderColor }]}>
      <TouchableOpacity style={styles.rowMain} onPress={onWatch} activeOpacity={0.8}>
        <View style={[styles.rowThumb, { backgroundColor: isDark ? '#111827' : '#f1f5f9' }]}>
          <Video size={22} color={isDark ? '#6b7280' : '#9ca3af'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: textColor }]} numberOfLines={1}>{title}</Text>
          {(recording.event?.description ?? recording.event?.title) && (
            <Text style={[styles.rowSub, { color: subColor }]} numberOfLines={1}>
              {recording.event?.description ?? recording.event?.title}
            </Text>
          )}
          <Text style={[styles.rowDate, { color: subColor }]}>{formatRwDateShort(recording.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.rowStatus}>
        {recording.isPublished ? (
          <AudienceBadge audience={recording.publishedTo} />
        ) : (
          <View style={[styles.badge, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
            <Text style={[styles.badgeText, { color: subColor }]}>Ntabwo yatangazwa</Text>
          </View>
        )}
      </View>

      <View style={styles.rowActions}>
        {recording.isPublished ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={onUnpublish}>
            <EyeOff size={16} color="#92400e" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={onPublish}>
            <Eye size={16} color="#065f46" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={onDelete}>
          <Trash2 size={16} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminRecordingsScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const queryClient = useQueryClient();

  const [publishTarget, setPublishTarget] = useState<IMeetingRecording | null>(null);
  const [watchRecording, setWatchRecording] = useState<IMeetingRecording | null>(null);

  const { data: recordings = [], isLoading, refetch, isRefreshing } = useQuery({
    queryKey: ['allRecordings'],
    queryFn: getAllRecordings,
  }) as any;

  const publishMutation = useMutation({
    mutationFn: ({ id, audience, invitedIds }: { id: string; audience: RecordingAudience; invitedIds: string[] }) =>
      publishRecording(id, audience, invitedIds.length ? invitedIds : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRecordings'] });
      setPublishTarget(null);
    },
    onError: () => Alert.alert('Ikosa', 'Ntibishobotse gutangaza videyo.'),
  });


  const unpublishMutation = useMutation({
    mutationFn: unpublishRecording,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allRecordings'] }),
    onError: () => Alert.alert('Ikosa', 'Ntibishobotse guhagarika videyo.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecording,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allRecordings'] }),
    onError: () => Alert.alert('Ikosa', 'Ntibishobotse gusiba videyo.'),
  });

  const handleDelete = (id: string) => {
    Alert.alert('Siba videyo', 'Urashaka gusiba iyi videyo burundu?', [
      { text: 'Oya', style: 'cancel' },
      { text: 'Yego, Siba', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const bg = isDark ? '#111827' : '#f8fafc';
  const headerBg = isDark ? '#1f2937' : '#fff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
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
          <LoadingSpinner />
        ) : recordings.length === 0 ? (
          <View style={styles.center}>
            <Video size={48} color={isDark ? '#374151' : '#d1d5db'} />
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Nta mavideyo ahari
            </Text>
          </View>
        ) : (
          recordings.map((r: IMeetingRecording) => (
            <RecordingRow
              key={r.id}
              recording={r}
              onPublish={() => setPublishTarget(r)}
              onUnpublish={() => unpublishMutation.mutate(r.id)}
              onDelete={() => handleDelete(r.id)}
              onWatch={() => setWatchRecording(r)}
              isDark={isDark}
            />
          ))
        )}
      </ScrollView>

      {/* Publish Modal */}
      <PublishModal
        visible={!!publishTarget}
        recording={publishTarget}
        onClose={() => setPublishTarget(null)}
        loading={publishMutation.isPending}
        onConfirm={(audience, invitedIds) => {
          if (!publishTarget) return;
          publishMutation.mutate({ id: publishTarget.id, audience, invitedIds });
        }}
      />

      {/* Watch Modal */}
      <Modal visible={!!watchRecording} animationType="slide" onRequestClose={() => setWatchRecording(null)}>
        <SafeAreaView style={styles.watchModal}>
          <View style={styles.watchHeader}>
            <TouchableOpacity onPress={() => setWatchRecording(null)} style={styles.backBtn}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.watchTitle} numberOfLines={1}>
              {watchRecording?.title ?? watchRecording?.event?.title ?? 'Amavideyo'}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.videoWrapper}>
            {watchRecording && <VideoCard uri={buildRecordingUrl(watchRecording.url)} />}
          </View>
          <View style={styles.watchInfo}>
            <Text style={styles.watchInfoTitle}>
              {watchRecording?.title ?? watchRecording?.event?.title ?? 'Amavideyo'}
            </Text>
            {(watchRecording?.event?.description ?? watchRecording?.event?.title) && (
              <Text style={styles.watchInfoSub}>
                {watchRecording!.event!.description ?? watchRecording!.event!.title}
              </Text>
            )}
            {watchRecording?.user?.fullNames && (
              <Text style={styles.watchInfoSub}>Na: {watchRecording.user.fullNames}</Text>
            )}
            <Text style={styles.watchInfoDate}>
              Yakozwe: {formatRwDateShort(watchRecording?.createdAt ?? null)}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  list: { padding: 16, gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  // Row
  row: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  rowThumb: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowDate: { fontSize: 11, marginTop: 2 },
  rowStatus: { paddingHorizontal: 12, paddingBottom: 6 },
  rowActions: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 4 },
  actionBtn: { padding: 8, borderRadius: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  // Publish Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetLabel: { fontSize: 13, marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionDesc: { fontSize: 12, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 6 },
  chipText: { fontSize: 12, fontWeight: '600', maxWidth: 100 },
  userList: { borderWidth: 1, borderRadius: 8, marginTop: 8, maxHeight: 200 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1 },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 13, fontWeight: '600' },
  userEmail: { fontSize: 11 },
  confirmBtn: { marginTop: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Watch modal
  watchModal: { flex: 1, backgroundColor: '#0f172a' },
  watchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  watchTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center', marginHorizontal: 8 },
  videoWrapper: { paddingHorizontal: 20, marginTop: 8 },
  watchInfo: { padding: 20 },
  watchInfoTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 6 },
  watchInfoSub: { fontSize: 14, color: '#9ca3af', marginBottom: 2 },
  watchInfoDate: { fontSize: 13, color: '#6b7280', marginTop: 4 },
});
