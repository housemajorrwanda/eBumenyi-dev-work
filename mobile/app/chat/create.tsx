import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ChevronLeft, Search } from 'lucide-react-native';
import { getAllUsersNopagination } from '@/services/users.api';
import { IUser } from '@/types';
import * as MessagingAPI from '@/services/messaging.api';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';
import { useOnboarding } from '@/contexts/OnboardingContext';

const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    TRAINER: 'Umwigisha',
    TRAINEE: 'Umujyanama',
    TESTER: 'Umujyanama',
    ADMIN: 'Umuyobozi',
    DEVELOPER: 'Umutekenisiye',
  };
  return roleMap[role.toUpperCase()] || role;
};

function CreateChatScreenContent() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const advanceChatList = useTourStepAdvance('create-chat-list');
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
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const {
    data: usersResponse,
    isLoading: isUsersLoading,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => getAllUsersNopagination(),
  });

  const handleStartChat = async (participantId: string) => {
    setLoadingUserId(participantId);
    try {
      // Create or get direct chat conversation
      const response = await MessagingAPI.createDirectChat(participantId);

      const chatId = response?.id || participantId;

      // Navigate to the chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.log('Error starting chat:', error);
      setLoadingUserId(null);
      alert('Gufungura uruganiriro byanze');
    }
  };

  const users: IUser[] = usersResponse?.data || [];
  const filteredMembers = users.filter((user) =>
    user.fullNames.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderMemberItem = ({ item, index }: { item: IUser; index: number }) => {
    const row = (
      <TouchableOpacity
        style={[styles.memberItem, loadingUserId === item.id && { opacity: 0.5 }]}
        onPress={advanceChatList(() => handleStartChat(item.id))}
        disabled={loadingUserId === item.id}
      >
        <Image
          source={{ uri: item.photo || 'https://i.pravatar.cc/150?img=1' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullNames}</Text>
          <Text style={styles.onlineText}>
            {item.userRoles && item.userRoles.length > 0
              ? getRoleDisplayName(item.userRoles[0].name)
              : 'Umujyanama'}
          </Text>
        </View>
        {loadingUserId === item.id && (
          <ActivityIndicator size="small" color="#4D81D2" />
        )}
      </TouchableOpacity>
    );
    // Only the first member is a tour target — spotlighting the whole list
    // left too little room for the tooltip to fit without being clipped.
    if (index === 0) {
      return (
        <CopilotStep
          text="Kanda ku izina ry'umunyamuryango kugira ngo utangire ibiganiro nawe."
          order={2}
          name="create-chat-list"
        >
          <WalkthroughableView>{row}</WalkthroughableView>
        </CopilotStep>
      );
    }
    return row;
  };

  const responsiveStyles = {
    padding: width < 400 ? 10 : 12,
    fontSize: width < 400 ? 12 : 14,
    itemPadding: width < 400 ? 8 : 10,
  };

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isUsersLoading && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.CREATE_CHAT);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isUsersLoading, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.CREATE_CHAT).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={20} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Uruganiriro rushya</Text>
        <View style={{ width: 20 }} />
      </View>

      <CopilotStep text="Shakisha umunyamuryango ushaka." order={1} name="create-chat-search">
        <WalkthroughableView
          style={[
            styles.searchContainer,
            {
              paddingHorizontal: responsiveStyles.padding,
              marginHorizontal: responsiveStyles.padding,
            },
          ]}
        >
          <Search size={16} color="#666c77ff" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Shakisha umunyamuryango..."
            placeholderTextColor="#666c77ff"
            style={[styles.searchInput, { fontSize: responsiveStyles.fontSize }]}
          />
        </WalkthroughableView>
      </CopilotStep>

      <View style={styles.content}>
        {isUsersLoading ? (
          <View style={styles.emptyState}>
          <LoadingSpinner />
          </View>
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              kuzana abanyamuryango byanze
            </Text>
          </View>
        ) : filteredMembers.length > 0 ? (
          <>
            <Text
              style={[
                styles.resultText,
                { paddingHorizontal: responsiveStyles.padding },
              ]}
            >
              {filteredMembers.length}
            </Text>
            <FlatList
              data={filteredMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.membersList,
                { paddingHorizontal: responsiveStyles.padding },
              ]}
              scrollEnabled={true}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>ntabwo abashije kuboneka</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function CreateChatScreen() {
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
      <CreateChatScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    marginLeft: 8,
    color: '#111827',
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  resultText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  membersList: {
    gap: 6,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    color: '#6b7280',
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
