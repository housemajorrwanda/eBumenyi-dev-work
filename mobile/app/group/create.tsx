import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Button from '@/components/Button';
import { ChevronLeft, Upload, Search, Camera } from 'lucide-react-native';
import { getAllUsersNopagination } from '@/services/users.api';
import { createConversation } from '@/services/messaging.api';
import { IUser } from '@/types';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

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

function CreateGroupScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { start, copilotEvents, stop, visible } = useCopilot();
  const advanceName = useTourStepAdvance('create-group-name');
  const advanceMembers = useTourStepAdvance('create-group-members');
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
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: usersResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => getAllUsersNopagination(),
  });

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('shyiramo izina ry itsinda');
      return;
    }

    if (selectedMembers.length === 0) {
      alert('Hitamo nibura umunyamuryango umwe');
      return;
    }

    setIsCreating(true);
    try {
      let photoUrl: string | undefined;

      // Upload photo if selected (only if groupPhoto is a valid URI)
      if (groupPhoto && groupPhoto.startsWith('file://')) {
        try {
          const formData = new FormData();
          formData.append('image', {
            uri: groupPhoto,
            type: 'image/jpeg',
            name: 'group-photo.jpg',
          } as any);

          const httpClient = await import('@/services/httpClient');
          const uploadResponse = await httpClient.default.post<any>(
            '/upload/image',
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 30000,
            },
          );

          photoUrl = uploadResponse.data?.data?.url || uploadResponse.data?.url;
        } catch (uploadError: any) {
          console.error('Photo upload failed:', uploadError);

          const continueWithoutPhoto = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Ikosa ryo kohereza ifoto',
              'Ifoto ntiyashobotse koherezwa. Urashaka gukomeza utarifoto?',
              [
                { text: 'Oya', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Yego', onPress: () => resolve(true) },
              ],
            );
          });

          if (!continueWithoutPhoto) {
            setIsCreating(false);
            return;
          }
        }
      }

      const conversation = await createConversation({
        type: 'group',
        name: groupName.trim(),
        participantIds: selectedMembers,
        photo: photoUrl,
      });

      if (conversation?.id) {
        router.push(`/group/${conversation.id}`);
      } else {
        setIsCreating(false);
        alert('Gufungura itsinda byanze');
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      setIsCreating(false);
      alert(
        'Gufungura itsinda byanze: ' +
          (error.response?.data?.message || error.message),
      );
    }
  };

  const users: IUser[] = usersResponse?.data || [];

  const handlePhotoUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setGroupPhoto(result.assets[0].uri);
    }
  };

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const filteredMembers = users.filter((user) =>
    user.fullNames.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderMemberItem = ({ item, index }: { item: IUser; index: number }) => {
    const row = (
      <TouchableOpacity
        style={[
          styles.memberItem,
          selectedMembers.includes(item.id) && styles.memberItemSelected,
        ]}
        onPress={advanceMembers(() => toggleMember(item.id))}
      >
        <Image
          source={{ uri: item.photo || 'https://i.pravatar.cc/150?img=1' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullNames}</Text>
          <Text style={styles.memberStatus}>
            {item.userRoles && item.userRoles.length > 0
              ? getRoleDisplayName(item.userRoles[0].name)
              : 'Umujyanama'}
          </Text>
        </View>
        {selectedMembers.includes(item.id) && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
    // Only the first member is a tour target — spotlighting the whole list
    // left too little room for the tooltip to fit without being clipped.
    if (index === 0) {
      return (
        <CopilotStep
          text="Hitamo abanyamuryango ushaka kongera, hanyuma ukande 'Andika' kugira ngo urangize iki gikorwa."
          order={2}
          name="create-group-members"
        >
          <WalkthroughableView>{row}</WalkthroughableView>
        </CopilotStep>
      );
    }
    return row;
  };

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.CREATE_GROUP);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.CREATE_GROUP).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={20} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>andikisha itsinda</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <CopilotStep text="Injiza izina ry'itsinda hano kandi wakongeraho ifoto niba ushaka." order={1} name="create-group-name">
        <WalkthroughableView style={styles.topRow}>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={advanceName(handlePhotoUpload)}
          >
            {groupPhoto ? (
              <Image source={{ uri: groupPhoto }} style={styles.photoSmall} />
            ) : (
              <View style={[styles.photoSmall, styles.photoPlaceholder]}>
                <Camera size={24} color="#9ca3af" />
              </View>
            )}
            <Upload size={14} color="#fff" style={styles.uploadIcon} />
          </TouchableOpacity>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Izina ry'itsinda"
            placeholderTextColor="#d1d5db"
            style={styles.nameInput}
          />
        </WalkthroughableView>
        </CopilotStep>

        <View style={styles.searchContainer}>
          <Search size={16} color="#6b7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Shakisha umunyamuryango..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.selectionSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          ) : isError ? (
            <Text style={styles.errorText}>kuzana abanyamuryango byanze</Text>
          ) : (
            <FlatList
              data={filteredMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.membersList}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>oya</Text>
        </TouchableOpacity>
        <View style={styles.buttonWrapper}>
          <Button
            title="andika"
            onPress={handleCreateGroup}
            disabled={
              !groupName.trim() || selectedMembers.length === 0 || isCreating
            }
          />
          {isCreating && (
            <ActivityIndicator
              size="small"
              color="#4D81D2"
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function CreateGroupScreen() {
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
      <CreateGroupScreenContent />
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
  content: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  photoButton: {
    position: 'relative',
    width: 50,
    height: 50,
  },
  photoSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoPlaceholder: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#4D81D2',
    borderRadius: 12,
    padding: 4,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 10,
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
  selectionSection: {
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    padding: 12,
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
  memberItemSelected: {
    borderColor: '#4D81D2',
    backgroundColor: '#eff6ff',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  memberStatus: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
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
  selectedSection: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  selectedMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  selectedName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  removeX: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  buttonWrapper: {
    flex: 1,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
});
