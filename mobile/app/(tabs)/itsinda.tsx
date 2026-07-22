import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Users,
  Search,
  MapPin,
  Phone,
  UserPlus,
  Activity,
  TrendingUp,
  UserMinus,
  Pencil,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getMyGroup,
  getMyGroupMembers,
  getGroupMonitoring,
  cehoRemoveMyMember,
  cehoUpdateMyGroup,
} from '@/services/cehoGroup.api';
import { ICEHOGroupMember } from '@/types';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

const PLACEHOLDER_AVATAR =
  'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg';

function MemberAvatar({ name, photo }: { name: string; photo: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? '??';
  if (photo && !failed) {
    return (
      <Image
        source={{ uri: photo }}
        style={styles.avatar}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function MetricCard({
  title,
  value,
  icon,
  accentColor,
  bgColor,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: accentColor + '22' }]}>
      <View style={[styles.metricIcon, { backgroundColor: bgColor }]}>{icon}</View>
      <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function ItsindaScreenContent() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const queryClient = useQueryClient();
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceHeader = useTourStepAdvance('itsinda-header');
  const advanceAdd = useTourStepAdvance('itsinda-add');
  const advanceMembers = useTourStepAdvance('itsinda-members');
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

  const [search, setSearch] = useState('');
  const [pendingRemove, setPendingRemove] = useState<ICEHOGroupMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSector, setEditSector] = useState('');

  const {
    data: group,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['ceho-group-mine'],
    queryFn: getMyGroup,
    retry: false,
  });

  const {
    data: members = [],
    isLoading: membersLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['ceho-group-members'],
    queryFn: getMyGroupMembers,
  });

  const { data: monitoring } = useQuery({
    queryKey: ['ceho-group-monitoring'],
    queryFn: getGroupMonitoring,
    retry: false,
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: (studentId: string) => cehoRemoveMyMember(studentId),
    onSuccess: () => {
      setPendingRemove(null);
      queryClient.invalidateQueries({ queryKey: ['ceho-group-members'] });
      queryClient.invalidateQueries({ queryKey: ['ceho-chw-candidates'] });
      Toast.show({ type: 'success', text1: 'Umunyamuryango yakuwe mu itsinda' });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Ntibyakunze gukuraho umunyamuryango.';
      Toast.show({ type: 'error', text1: msg });
    },
  });

  const { mutate: updateGroup, isPending: isUpdating } = useMutation({
    mutationFn: () => {
      const sectors = editSector
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return cehoUpdateMyGroup({
        name: editName.trim() || undefined,
        sectors: sectors.length > 0 ? sectors : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceho-group-mine'] });
      Toast.show({ type: 'success', text1: 'Itsinda ryavuguruwe' });
      setIsEditing(false);
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.message ?? 'Ntibyakunze kuvugurura itsinda.',
      });
    },
  });

  const openEdit = () => {
    setEditName(group?.name ?? '');
    setEditSector((group?.sectors ?? []).join(', '));
    setIsEditing(true);
  };

  // Derived metrics
  const monitoringMembers = monitoring?.members ?? [];
  const memberCount = (group?._count?.members ?? 0) + 1;
  const avgProgress =
    monitoringMembers.length > 0
      ? Math.round(
          monitoringMembers.reduce((s, m) => {
            const a =
              m.courseProgress.length
                ? m.courseProgress.reduce((x, c) => x + c.progress, 0) / m.courseProgress.length
                : 0;
            return s + a;
          }, 0) / monitoringMembers.length,
        )
      : 0;
  const activeCount = monitoringMembers.filter((m) =>
    m.courseProgress.some((c) => c.progress > 0 && !c.isCompleted),
  ).length;

  const filtered = members.filter((m: ICEHOGroupMember) =>
    m.student.user.fullNames.toLowerCase().includes(search.toLowerCase()),
  );
  const ceho = group?.ceho;
  const cehoMatchesSearch =
    !!ceho && (!search || ceho.user.fullNames.toLowerCase().includes(search.toLowerCase()));

  // Theme colours
  const bg = isDark ? '#111827' : '#f8fafc';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const inputBg = isDark ? '#374151' : '#f3f4f6';

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && !isError && group && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.ITSINDA);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, isError, group, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.ITSINDA).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  // ─── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (isError || !group) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.centered}>
          <Users size={48} color={borderColor} />
          <Text style={[styles.emptyTitle, { color: textMuted }]}>Nta tsinda rihari</Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            Watumiwe gutunga itsinda. Baza umuyobozi ngo akuhe itsinda.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── List header (CEHO card + spinner only — CopilotSteps live in the main JSX) ──

  const ListHeader = (
    <View>
      {/* CEHO leader card */}
      {cehoMatchesSearch && ceho && (
        <TouchableOpacity
          style={[styles.memberCard, { backgroundColor: cardBg, borderColor: themeColors.primary + '33', marginHorizontal: 16, marginBottom: 8 }]}
          onPress={() => router.push(`/students/${ceho.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.memberCardInner}>
            <MemberAvatar name={ceho.user.fullNames} photo={ceho.user.photo} />
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
                {ceho.user.fullNames}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: themeColors.primary + '18' }]}>
                <Text style={[styles.roleBadgeText, { color: themeColors.primary }]}>
                  Umuyobozi (CEHO)
                </Text>
              </View>
              {ceho.user.phoneNumber ? (
                <View style={styles.infoRow}>
                  <Phone size={11} color={textMuted} />
                  <Text style={[styles.infoText, { color: textMuted }]}>{ceho.user.phoneNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {membersLoading && <LoadingSpinner variant="inline" message="" />}
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: themeColors.primary }]} edges={['top']}>
      <View style={[styles.flex, { backgroundColor: bg }]}>

        {/* Step 1: the edit button specifically — the tooltip text instructs
            tapping it, so it's the target, not the whole header bar (a wide
            target like the full header anchors the library's arrow to
            whichever edge it measures from, which can land far from the
            pencil itself, and made it un-tappable since taps on the pencil's
            real position fell outside the mask's — wrongly wide — hole). */}
        <View style={[styles.pageHeader, { backgroundColor: themeColors.primary }]}>
          <View style={styles.pageTitleRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                {(group.sectors?.length ?? 0) > 0 && (
                  <View style={styles.sectorRow}>
                    <MapPin size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.sectorText}>{group.sectors!.join(', ')}</Text>
                  </View>
                )}
              </View>
              <CopilotStep
                text="Hano ugaragara izina ry'itsinda ryawe. Kanda kuri ikimenyetso cyo guhindura (✏) guhindura izina n'amakuru y'itsinda."
                order={1}
                name="itsinda-header"
              >
                <WalkthroughableTouchable
                  style={styles.headerIconBtn}
                  onPress={advanceHeader(openEdit)}
                  activeOpacity={0.7}
                >
                  <Pencil size={18} color="#ffffff" />
                </WalkthroughableTouchable>
              </CopilotStep>
            </View>
          </View>
        </View>

        {/* Inline edit form */}
        {isEditing && (
          <View style={[styles.editForm, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.editFormTitle, { color: textPrimary }]}>Hindura itsinda</Text>
            <View style={styles.editFields}>
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: textMuted }]}>Izina *</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Izina ry'itsinda"
                  placeholderTextColor={textMuted}
                />
              </View>
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: textMuted }]}>Akagari</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
                  value={editSector}
                  onChangeText={setEditSector}
                  placeholder="urugero: Nyarugenge"
                  placeholderTextColor={textMuted}
                />
              </View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editCancelBtn, { backgroundColor: inputBg }]}
                onPress={() => setIsEditing(false)}
                disabled={isUpdating}
              >
                <X size={14} color={textMuted} />
                <Text style={[styles.editCancelText, { color: textMuted }]}>Hagarika</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editSaveBtn,
                  { backgroundColor: themeColors.primary },
                  (!editName.trim() || isUpdating) && styles.disabledBtn,
                ]}
                onPress={() => updateGroup()}
                disabled={!editName.trim() || isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={14} color="#ffffff" />
                    <Text style={styles.editSaveText}>Bika</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Stats cards */}
        <CopilotStep
          text="Hano ubona umubare w'abagize itsinda, abiga ndetse nintambwe bagezeho muri rusange."
          order={2}
          name="itsinda-stats"
        >
          <WalkthroughableView style={styles.metricsRow}>
            <MetricCard
              title="Abagize"
              value={memberCount}
              icon={<Users size={16} color={themeColors.primary} />}
              accentColor={themeColors.primary}
              bgColor={themeColors.primary + '18'}
            />
            <MetricCard
              title="Biga"
              value={activeCount}
              icon={<Activity size={16} color="#f59e0b" />}
              accentColor="#f59e0b"
              bgColor="#fef3c7"
            />
            <MetricCard
              title="Intambwe"
              value={`${avgProgress}%`}
              icon={<TrendingUp size={16} color="#8b5cf6" />}
              accentColor="#8b5cf6"
              bgColor="#ede9fe"
            />
          </WalkthroughableView>
        </CopilotStep>

        {/* Step 3: Search + Add */}
        <CopilotStep
          text="Shakisha umunyamuryango hano, cyangwa kanda 'Ongeramo' kongeramo CHW mushya mu itsinda."
          order={3}
          name="itsinda-add"
        >
          <WalkthroughableView style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
            <View style={[styles.searchBar, { backgroundColor: inputBg, flex: 1, marginBottom: 0 }]}>
              <Search size={16} color={textMuted} />
              <TextInput
                style={[styles.searchInput, { color: textPrimary }]}
                placeholder="Shakisha umunyamuryango..."
                placeholderTextColor={textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: themeColors.primary }]}
              onPress={advanceAdd(() => router.push('/ceho-group/invite'))}
              activeOpacity={0.8}
            >
              <UserPlus size={18} color="#ffffff" />
              <Text style={styles.addBtnText}>Ongeramo</Text>
            </TouchableOpacity>
          </WalkthroughableView>
        </CopilotStep>

        {/* Step 4: Member list */}
        <View style={styles.flex}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={{ backgroundColor: bg }}
            ListHeaderComponent={ListHeader}
            renderItem={({ item, index }) => {
              const u = item.student.user;
              const card = (
                <TouchableOpacity
                  style={[
                    styles.memberCard,
                    { backgroundColor: cardBg, borderColor, marginHorizontal: 16, marginBottom: 8 },
                  ]}
                  onPress={advanceMembers(() => router.push(`/students/${item.student.id}`))}
                  activeOpacity={0.8}
                >
                  <View style={styles.memberCardInner}>
                    <MemberAvatar name={u.fullNames} photo={u.photo} />
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
                        {u.fullNames}
                      </Text>
                      <View style={[styles.roleBadge, { backgroundColor: '#d1fae5' }]}>
                        <Text style={[styles.roleBadgeText, { color: '#059669' }]}>Umujyanama(CHW)</Text>
                      </View>
                      {u.phoneNumber ? (
                        <View style={styles.infoRow}>
                          <Phone size={11} color={textMuted} />
                          <Text style={[styles.infoText, { color: textMuted }]}>{u.phoneNumber}</Text>
                        </View>
                      ) : null}
                      {(u.district || u.sector) ? (
                        <View style={styles.infoRow}>
                          <MapPin size={11} color={textMuted} />
                          <Text style={[styles.infoText, { color: textMuted }]} numberOfLines={1}>
                            {[u.district, u.sector].filter(Boolean).join(', ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setPendingRemove(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <UserMinus size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
              // Only the first member is a tour target — spotlighting the
              // whole list left too little room for the tooltip to fit
              // without being clipped.
              if (index === 0) {
                return (
                  <CopilotStep
                    text="Urutonde rw'abagize itsinda ryawe. Kanda ku izina ry'umunyamuryango kureba aho bageze mu masomo (monitoring)."
                    order={4}
                    name="itsinda-members"
                  >
                    <WalkthroughableView>{card}</WalkthroughableView>
                  </CopilotStep>
                );
              }
              return card;
            }}
            ListEmptyComponent={
              !membersLoading ? (
                <View style={styles.centeredInList}>
                  <Users size={36} color={borderColor} />
                  <Text style={[styles.emptyTitle, { color: textMuted, fontSize: 15 }]}>
                    {search ? 'Nta munyamuryango uhuye' : 'Nta bagize itsinda bahari'}
                  </Text>
                  {!search && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: themeColors.primary, marginTop: 12 }]}
                      onPress={() => router.push('/ceho-group/invite')}
                    >
                      <UserPlus size={16} color="#ffffff" />
                      <Text style={styles.actionBtnText}>Ongeramo CHW wa mbere</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={themeColors.primary}
              />
            }
          />
        </View>

      </View>

      {/* Remove confirmation Modal */}
      <Modal
        visible={!!pendingRemove}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <View style={styles.modalIconWrap}>
              <UserMinus size={24} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Gukuraho umunyamuryango</Text>
            <Text style={[styles.modalDesc, { color: textMuted }]}>
              Urashaka gukuraho{' '}
              <Text style={{ fontWeight: '700', color: textPrimary }}>
                {pendingRemove?.student.user.fullNames}
              </Text>{' '}
              mu itsinda? Ushobora kongera kumwongeramo.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor }]}
                onPress={() => setPendingRemove(null)}
                disabled={isRemoving}
              >
                <Text style={[styles.modalCancelText, { color: textMuted }]}>Hagarika</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, isRemoving && styles.disabledBtn]}
                onPress={() => pendingRemove && removeMember(pendingRemove.student.id)}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <UserMinus size={14} color="#ffffff" />
                    <Text style={styles.modalConfirmText}>Kuraho</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function ItsindaScreen() {
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
      <ItsindaScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centeredInList: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Page header
  pageHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  groupName: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectorText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Edit form
  editForm: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  editFormTitle: { fontSize: 14, fontWeight: '700' },
  editFields: { gap: 8 },
  editField: { gap: 4 },
  editLabel: { fontSize: 11, fontWeight: '600' },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  editActions: { flexDirection: 'row', gap: 8 },
  editCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  editCancelText: { fontSize: 13, fontWeight: '600' },
  editSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  editSaveText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  disabledBtn: { opacity: 0.5 },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricTitle: { fontSize: 10, color: '#9ca3af', textAlign: 'center' },

  // Action buttons
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  // Member cards
  listContent: { paddingTop: 0, paddingBottom: 32 },
  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  memberCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF0F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 15, fontWeight: '700', color: '#3363AD' },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { fontSize: 14, fontWeight: '600' },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 11 },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  modalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
