import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Briefcase,
  Building2,
  Calendar,
  Archive,
  // MoreVertical, // Removed - not used
} from 'lucide-react-native';
import * as MessagingAPI from '@/services/messaging.api';
import { getUserById } from '@/services/users.api';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function DirectChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const [isArchiving, setIsArchiving] = useState(false);

  // Fetch direct chat data
  const {
    data: fetchedChat,
    isLoading: chatLoading,
    error: chatError,
  } = useQuery({
    queryKey: ['directChat', id],
    queryFn: () => MessagingAPI.getDirectChatById(id || ''),
    enabled: !!id,
  });

  // Extract chat and otherUserId
  const chat =
    (fetchedChat as any)?.chat ||
    (fetchedChat as any)?.data ||
    (fetchedChat as any);
  const otherUserId = chat?.otherUserId;

  // Try to get user from chat response first (user1/user2)
  const userFromChat = chat?.user1?.id === user?.id ? chat?.user2 : chat?.user1;

  // Debug logging
  console.log('Direct Chat Info Debug:', {
    chatId: id,
    chatExists: !!chat,
    otherUserId,
    userFromChatExists: !!userFromChat,
    userFromChatData: userFromChat
      ? {
          id: userFromChat.id,
          fullNames: userFromChat.fullNames,
          hasEmail: !!userFromChat.email,
          hasPhone: !!userFromChat.phoneNumber,
          hasRoles: !!userFromChat.userRoles,
        }
      : null,
  });

  // Fetch other user's full profile (fallback to userFromChat if API fails)
  const {
    data: fetchedUserData,
    isLoading: userLoading,
    error: userError,
  } = useQuery({
    queryKey: ['user', otherUserId],
    queryFn: () => getUserById(otherUserId!),
    enabled: !!otherUserId,
  });

  // Use fetched user data if available, otherwise use user from chat
  const otherUser = fetchedUserData || userFromChat;

  console.log('Other User Data:', {
    hasFetchedData: !!fetchedUserData,
    hasUserFromChat: !!userFromChat,
    finalUserExists: !!otherUser,
    userError: userError?.message,
  });

  // Get online status
  const { isOnline, lastSeen } = useOnlineStatus(otherUserId || '');

  // Calculate statistics
  const messages = (fetchedChat as any)?.messages || chat?.messages || [];
  const messageCount = messages.length;
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const firstMessage = sortedMessages[0];
  const firstMessageDate = firstMessage?.timestamp;
  const chatCreatedDate = chat?.createdAt;

  // Get responsive styles
  const responsiveStyles = getResponsiveStyles(width);

  // Handlers
  const handleArchiveChat = () => {
    Alert.alert('Kubika ikiganiro', 'Urashaka kubika iki kiganiro?', [
      { text: 'Oya', style: 'cancel' },
      {
        text: 'Yego',
        style: 'destructive',
        onPress: async () => {
          setIsArchiving(true);
          try {
            await MessagingAPI.updateDirectChat(id!, {
              isArchived: true,
            } as any);
            queryClient.invalidateQueries({ queryKey: ['directChats'] });
            router.back();
          } catch {
            Alert.alert('Ikosa', 'Kubika ikiganiro byanze');
          } finally {
            setIsArchiving(false);
          }
        },
      },
    ]);
  };

  const handleCall = () => {
    if (otherUser?.phoneNumber) {
      Linking.openURL(`tel:${otherUser.phoneNumber}`);
    }
  };

  const handleEmail = () => {
    if (otherUser?.email) {
      Linking.openURL(`mailto:${otherUser.email}`);
    }
  };

  // Loading state - only show loading if we don't have basic user data yet
  if (chatLoading || (userLoading && !userFromChat)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4D81D2" />
          <Text style={styles.loadingText}>Gufungura amakuru...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Chat not found
  if (!chatLoading && !chat) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Amakuru y'umukoresha</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ikiganiro ntikiboneka</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Subira inyuma</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // User not found
  if (!userLoading && !otherUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Amakuru y'umukoresha</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Umukoresha ntaboneka</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Subira inyuma</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Check what data is available
  const hasContactInfo = !!(otherUser?.email || otherUser?.phoneNumber);
  const hasProfessionalInfo = !!(
    otherUser?.industry ||
    otherUser?.hospitalId ||
    otherUser?.userRoles?.length
  );
  const hasLocation = !!(
    otherUser?.district ||
    otherUser?.sector ||
    otherUser?.cell ||
    otherUser?.village
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with gradient background */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        {/* Removed MoreVertical button - no functionality needed for now */}
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Avatar, Name, Phone, Bio */}
        <View style={styles.heroSection}>
          {/* Large Avatar */}
          <View style={styles.avatarContainer}>
            {otherUser?.photo ? (
              <Image
                source={{ uri: otherUser.photo }}
                style={styles.largeAvatar}
              />
            ) : (
              <View style={[styles.largeAvatar, styles.avatarFallback]}>
                <User size={60} color="#ffffff" />
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.userName}>
            {otherUser?.fullNames || 'Unknown'}
          </Text>

          {/* Phone Number */}
          {otherUser?.phoneNumber && (
            <Text style={styles.userPhone}>{otherUser.phoneNumber}</Text>
          )}

          {/* Bio/Status */}
          {otherUser?.bio && (
            <Text style={styles.userBio}>{otherUser.bio}</Text>
          )}

          {/* Online Status */}
          <Text style={styles.userStatus}>
            {getStatusText(isOnline, lastSeen ?? null)}
          </Text>
        </View>

        {/* Action Buttons Row (WhatsApp style) */}
        <View style={styles.actionsRow}>
          {otherUser?.phoneNumber && (
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <View style={styles.actionIconContainer}>
                <Phone size={24} color="#4D81D2" />
              </View>
              <Text style={styles.actionLabel}>Hamagara</Text>
            </TouchableOpacity>
          )}
          {otherUser?.email && (
            <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
              <View style={styles.actionIconContainer}>
                <Mail size={24} color="#4D81D2" />
              </View>
              <Text style={styles.actionLabel}>Andikira</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.back()}
          >
            <View style={styles.actionIconContainer}>
              <MessageSquare size={24} color="#4D81D2" />
            </View>
            <Text style={styles.actionLabel}>Ikiganiro</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Section (WhatsApp "Media, links, and docs" style) */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.listItem}>
            <MessageSquare size={22} color="#6b7280" />
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>Ubutumwa</Text>
              <Text style={styles.listItemSubtitle}>
                {messageCount} messages
              </Text>
            </View>
            <Text style={styles.listItemValue}>{messageCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Information List */}
        <View style={styles.section}>
          {/* Location */}
          {hasLocation && (
            <TouchableOpacity style={styles.listItem}>
              <MapPin size={22} color="#6b7280" />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>Aho atuye</Text>
                <Text style={styles.listItemSubtitle}>
                  {[
                    otherUser?.district,
                    otherUser?.sector,
                    otherUser?.cell,
                    otherUser?.village,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Professional Info */}
          {hasProfessionalInfo && (
            <TouchableOpacity style={styles.listItem}>
              <Briefcase size={22} color="#6b7280" />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>Amakuru y'akazi</Text>
                <Text style={styles.listItemSubtitle}>
                  {otherUser?.industry && translateIndustry(otherUser.industry)}
                  {otherUser?.hospital && ` • ${otherUser.hospital.name}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Hospital */}
          {otherUser?.hospital && (
            <TouchableOpacity style={styles.listItem}>
              <Building2 size={22} color="#6b7280" />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>Ivuriro</Text>
                <Text style={styles.listItemSubtitle}>
                  {otherUser.hospital.name}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Date Joined */}
          {chatCreatedDate && (
            <TouchableOpacity style={styles.listItem}>
              <Calendar size={22} color="#6b7280" />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>Ikiganiro cyatangiye</Text>
                <Text style={styles.listItemSubtitle}>
                  {formatDate(chatCreatedDate)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Archive Chat */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.listItem}
            onPress={handleArchiveChat}
            disabled={isArchiving}
          >
            <Archive size={22} color="#6b7280" />
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>Kubika ikiganiro</Text>
            </View>
            {isArchiving && <ActivityIndicator size="small" color="#6b7280" />}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper Functions
function getStatusText(isOnline: boolean, lastSeen: string | null): string {
  if (isOnline) return 'Arakora';
  if (lastSeen) return formatLastSeen(lastSeen);
  return 'Ntarakora';
}

function formatLastSeen(lastSeenDate: string): string {
  const now = new Date();
  const lastSeen = new Date(lastSeenDate);

  if (isNaN(lastSeen.getTime())) return '';

  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vuba aha';
  if (diffMins < 60) return `Iminota ${diffMins} irashize`;
  if (diffHours < 24) return `Amasaha ${diffHours} arashize`;
  if (diffDays === 1) return 'Ejo';
  if (diffDays < 7) return `Iminsi ${diffDays} irashize`;

  return lastSeen.toLocaleDateString('rw-RW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('rw-RW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function translateRole(role: string): string {
  const translations: Record<string, string> = {
    ADMIN: 'Umuyobozi',
    TRAINER: 'Umwarimu',
    CHO: 'Umugenzuzi',
    TRAINEE: 'Umujyanama',
    TESTER: 'Umusuzumyi',
    STAFF: 'Umukozi',
    DEVELOPER: 'Umutekenisiye',
    ADMINISTRATOR: 'Umuyobozi',
  };
  return translations[role] || role;
}

function translateIndustry(industry: string): string {
  const translations: Record<string, string> = {
    WELTEL: 'WelTel',
    RBC: 'RBC (Rwanda Biomedical Center)',
    SFH: 'SFH (Society for Family Health)',
    CIIC_HIN: 'CIIC HIN',
  };
  return translations[industry] || industry;
}

function getBadgeStyle(role: string) {
  switch (role) {
    case 'ADMIN':
    case 'ADMINISTRATOR':
      return { backgroundColor: '#d1fae5', color: '#059669' };
    case 'TRAINER':
      return { backgroundColor: '#dbeafe', color: '#2563eb' };
    case 'CHO':
      return { backgroundColor: '#fef3c7', color: '#d97706' };
    case 'TRAINEE':
    case 'TESTER':
      return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    case 'STAFF':
      return { backgroundColor: '#e0e7ff', color: '#4f46e5' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#6b7280' };
  }
}

function getResponsiveStyles(width: number) {
  const isSmallScreen = width < 400;
  const isLargeScreen = width > 768;

  return {
    avatarSize: isSmallScreen ? 64 : isLargeScreen ? 96 : 80,
    nameSize: isSmallScreen ? 18 : isLargeScreen ? 22 : 20,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4D81D2',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#4D81D2',
    borderRadius: 8,
  },
  errorButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  // Header with gradient background (WhatsApp style)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4D81D2',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
  moreButton: { padding: 4 },

  scroll: { flex: 1 },

  // Hero Section (WhatsApp style - centered avatar, name, phone, bio)
  heroSection: {
    alignItems: 'center',
    backgroundColor: '#4D81D2',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E9EDEF',
  },
  avatarFallback: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  userPhone: {
    fontSize: 16,
    color: '#D1F4CC',
    marginBottom: 8,
    textAlign: 'center',
  },
  userBio: {
    fontSize: 14,
    color: '#D1F4CC',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  userStatus: {
    fontSize: 13,
    color: '#D1F4CC',
    textAlign: 'center',
  },

  // Action Buttons Row (WhatsApp style - 3 buttons with icons and labels)
  actionsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f4fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Section (WhatsApp style - white background with dividers)
  section: {
    backgroundColor: '#ffffff',
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },

  // List Item (WhatsApp style - icon on left, content in middle, value on right)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listItemContent: {
    flex: 1,
    marginLeft: 16,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  listItemValue: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
});
