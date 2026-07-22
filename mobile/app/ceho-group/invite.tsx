import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { ChevronLeft, Search, UserPlus, MapPin } from 'lucide-react-native';
import { searchCHWCandidates, cehoDirectlyAddMember } from '@/services/cehoGroup.api';
import { IStudentSearchResult } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

const PLACEHOLDER_AVATAR =
  'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg';

function InviteScreenContent() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceInviteList = useTourStepAdvance('invite-list');
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

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['chw-candidates', search],
    queryFn: () => searchCHWCandidates(search),
    enabled: true,
  });

  const { mutate: addMember, isPending } = useMutation({
    mutationFn: (studentId: string) => cehoDirectlyAddMember(studentId),
    onSuccess: (_, studentId) => {
      setInvitedIds((prev) => new Set([...prev, studentId]));
      queryClient.invalidateQueries({ queryKey: ['ceho-group-members'] });
      queryClient.invalidateQueries({ queryKey: ['ceho-chw-candidates'] });
      Toast.show({ type: 'success', text1: 'Byongewe mu itsinda' });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Habaye ikosa mu kongera umunyamuryango.';
      Toast.show({ type: 'error', text1: msg });
    },
  });

  const handleAdd = (student: IStudentSearchResult) => {
    if (invitedIds.has(student.id) || student.groupMembership) return;
    addMember(student.id);
  };

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.INVITE_CHW);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.INVITE_CHW).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const bgColor = isDark ? '#111827' : '#f8fafc';
  const inputBg = isDark ? '#374151' : '#f3f4f6';

  const renderStudent = ({ item, index }: { item: IStudentSearchResult; index: number }) => {
    const alreadyInGroup = !!item.groupMembership;
    const alreadyAdded = invitedIds.has(item.id);
    const disabled = alreadyInGroup || alreadyAdded || isPending;

    const inviteButtonContent = isPending ? (
      <ActivityIndicator size="small" color="#ffffff" />
    ) : alreadyAdded ? (
      <Text style={[styles.inviteBtnText, { color: '#059669' }]}>Wongewe</Text>
    ) : alreadyInGroup ? (
      <Text style={[styles.inviteBtnText, { color: '#9ca3af' }]}>Afite itsinda</Text>
    ) : (
      <>
        <UserPlus size={14} color="#ffffff" />
        <Text style={[styles.inviteBtnText, { color: '#ffffff' }]}>Ongeramo</Text>
      </>
    );
    const inviteButtonStyle = [
      styles.inviteBtn,
      {
        backgroundColor: alreadyAdded
          ? '#D1FAE5'
          : disabled
          ? '#e5e7eb'
          : themeColors.primary,
      },
    ];
    // The tooltip text instructs tapping 'Ongeramo' specifically — target
    // that button directly instead of the whole card (a wide target
    // containing an unrelated avatar/name/location too, which isn't even
    // itself tappable, anchors the library's pointer away from the button
    // and can make the button un-tappable).
    const inviteButton = index === 0 ? (
      <CopilotStep
        text="Hano ugaragara urutonde rw'abagize. Kanda kuri 'Ongeramo' kongeramo CHW mushya mu itsinda."
        order={2}
        name="invite-list"
      >
        <WalkthroughableTouchable
          style={inviteButtonStyle}
          onPress={advanceInviteList(() => handleAdd(item))}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {inviteButtonContent}
        </WalkthroughableTouchable>
      </CopilotStep>
    ) : (
      <TouchableOpacity
        style={inviteButtonStyle}
        onPress={() => handleAdd(item)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {inviteButtonContent}
      </TouchableOpacity>
    );

    return (
      <View style={[styles.studentCard, { backgroundColor: cardBg }]}>
        <Image
          source={{ uri: item.user.photo ?? PLACEHOLDER_AVATAR }}
          style={styles.avatar}
        />
        <View style={styles.studentInfo}>
          <Text style={[styles.studentName, { color: textPrimary }]}>{item.user.fullNames}</Text>
          {item.user.phoneNumber && (
            <Text style={[styles.phone, { color: textMuted }]}>{item.user.phoneNumber}</Text>
          )}
          {(item.user.district || item.user.sector) && (
            <View style={styles.locationRow}>
              <MapPin size={11} color={textMuted} />
              <Text style={[styles.locationText, { color: textMuted }]}>
                {[item.user.district, item.user.sector].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          {alreadyInGroup && (
            <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: '#DC2626' }]}>Afite itsinda</Text>
            </View>
          )}
        </View>
        {inviteButton}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.primary }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ongeramo CHW mu itsinda</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <CopilotStep
          text="Shakisha CHW ushaka kongeramo mu itsinda ryawe."
          order={1}
          name="invite-search"
        >
          <WalkthroughableView style={[styles.searchWrapper, { backgroundColor: bgColor }]}>
            <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
              <Search size={16} color={textMuted} />
              <TextInput
                style={[styles.searchInput, { color: textPrimary }]}
                placeholder="Shakisha amazina cyangwa telefone..."
                placeholderTextColor={textMuted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
            </View>
            <Text style={[styles.hintText, { color: textMuted }]}>
              Shakisha CHW utarimo itsinda mu karere kawe, hanyuma umwongere.
            </Text>
          </WalkthroughableView>
        </CopilotStep>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={students}
              keyExtractor={(item) => item.id}
              renderItem={renderStudent}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={[styles.emptyText, { color: textMuted }]}>
                    {search ? 'Nta muturage uhuye n\'ubushakashatsi' : 'Andika izina cg telefone kugira ngo ushakishe'}
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function InviteScreen() {
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
      <InviteScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  searchWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  hintText: { fontSize: 11, marginTop: 6, marginBottom: 4, paddingHorizontal: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  phone: { fontSize: 12, marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 11 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  inviteBtnText: { fontSize: 12, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
