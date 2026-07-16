import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { CopilotProvider, CopilotStep, useCopilot } from 'react-native-copilot';
import { WalkthroughableView, WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { PlusCircle, Check, CheckCheck, Users, MessageSquare, Globe, ImageIcon, Film, Mic, FileText, Paperclip } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import { IConversation } from '@/types';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuth } from '@/hooks/useAuth';
import { SocketService } from '@/services/socket.service';
import * as MessagingAPI from '@/services/messaging.api';

type MediaPreview = { Icon: React.ComponentType<any>; text: string };

const isFileUrl = (s?: string) =>
  !!s && (s.startsWith('http://') || s.startsWith('https://'));

function getMediaInfo(msgType: string, content?: string): MediaPreview | null {
  if (msgType === 'image') return { Icon: ImageIcon, text: 'Ifoto' };
  if (msgType === 'video') return { Icon: Film, text: 'Video' };
  if (msgType === 'audio') return { Icon: Mic, text: "Ubutumwa bw'ijwi" };
  if (msgType === 'file') return { Icon: FileText, text: 'Inyandiko' };

  if (content) {
    const lower = content.toLowerCase();
    if (lower.match(/\.(m4a|mp3|wav|ogg|aac|flac)(\?|$)/)) return { Icon: Mic, text: "Ubutumwa bw'ijwi" };
    if (lower.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/)) return { Icon: Film, text: 'Video' };
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/)) return { Icon: ImageIcon, text: 'Ifoto' };
    if (lower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?|$)/)) return { Icon: FileText, text: 'Inyandiko' };
    if (isFileUrl(content)) return { Icon: Paperclip, text: 'Dosiye' };
  }
  return null;
}

function CommunityScreenContent() {
  const [activeTab, setActiveTab] = useState<'messages' | 'community' | 'group'>('messages');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { start, copilotEvents, stop, visible } = useCopilot();
  // start()'s identity is not stable across CopilotProvider re-renders (the
  // library doesn't memoize its internal visibility setter, which start
  // depends on) — reading it through a ref means a re-render before the
  // scheduled tour fires doesn't cancel it via the effect's cleanup.
  const startRef = useRef(start);
  startRef.current = start;
  const { markComplete } = useOnboarding();
  const advanceFab = useTourStepAdvance('community-fab');
  const advanceTabs = useTourStepAdvance('community-tabs');
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
  const [lastPreviews, setLastPreviews] = useState<Record<string, { Icon: React.ComponentType<any> | null; text: string; time?: string }>>({});
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { getConversationUnread, markConversationRead, refreshCounts, totalDirect, totalGroups, totalCommunities } = useUnreadCount();

  // Fetch direct chats
  const { data: directChats = [], refetch: refetchDirect } = useQuery({
    queryKey: ['directChats'],
    queryFn: async () => {
      console.log('🔄 [ConversationList] Fetching direct chats...');
      const chats = await MessagingAPI.getDirectChats().catch(() => []);
      console.log('✅ [ConversationList] Direct chats fetched:', chats.length, 'chats');
      return chats.map((chat: any) => ({ ...chat, type: 'direct' }));
    },
  });

  // Fetch group chats
  const { data: groupChats = [], refetch: refetchGroups } = useQuery({
    queryKey: ['groupChats'],
    queryFn: async () => {
      const chats = await MessagingAPI.getGroupChats().catch(() => []);
      return chats.map((chat: any) => ({ ...chat, type: 'group' }));
    },
  });

  // Fetch communities
  const { data: communities = [], refetch: refetchCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const comms = await MessagingAPI.getCommunities().catch(() => []);
      return comms.map((comm: any) => ({ ...comm, type: 'community' }));
    },
  });

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchDirect(), refetchGroups(), refetchCommunities()]);
      refreshCounts();
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Clear stale cached previews so the freshly-refetched lastMessage is used
      setLastPreviews({});
      refetchDirect();
      refetchGroups();
      refetchCommunities();
    }, [refetchDirect, refetchGroups, refetchCommunities])
  );

  // 🔄 Real-time conversation list updates (WhatsApp-style)
  // Listen for conversation:updated on the main socket — the backend emits this
  // to user:${userId} personal rooms after every message/post creation.
  // This works for both sender and recipient regardless of which screen they're on.
  useEffect(() => {
    let mainSocket = SocketService.getInstance();

    const handleConversationUpdated = (data: any) => {
      console.log('📬 [ConversationList] conversation:updated received:', data);

      // Clear the cached preview for this conversation so it re-renders fresh
      const chatId = data.chatId;
      if (chatId) {
        setLastPreviews(prev => {
          const updated = { ...prev };
          delete updated[chatId];
          return updated;
        });
      }

      // Invalidate the relevant list query — React Query will refetch
      if (data.type === 'direct') {
        queryClient.invalidateQueries({ queryKey: ['directChats'] });
      } else if (data.type === 'group') {
        queryClient.invalidateQueries({ queryKey: ['groupChats'] });
      } else if (data.type === 'community') {
        queryClient.invalidateQueries({ queryKey: ['communities'] });
      } else {
        // Unknown type — invalidate all to be safe
        queryClient.invalidateQueries({ queryKey: ['directChats'] });
        queryClient.invalidateQueries({ queryKey: ['groupChats'] });
        queryClient.invalidateQueries({ queryKey: ['communities'] });
      }

      refreshCounts();
    };

    const setup = async () => {
      if (!mainSocket?.connected) {
        mainSocket = await SocketService.initialize();
      }
      if (!mainSocket) return;
      mainSocket.on('conversation:updated', handleConversationUpdated);
    };

    setup();

    return () => {
      mainSocket?.off('conversation:updated', handleConversationUpdated);
    };
  }, [queryClient, refreshCounts]);

  // Safely extract a human-readable last message preview with icon
  // 🎯 WhatsApp-style: Show "Wowe: " prefix for current user's messages in ALL chat types
  const getLastMessagePreview = (conversation: IConversation): { Icon: React.ComponentType<any> | null; text: string } => {
    // Debug: Log the conversation object to see what data we're getting
    if (__DEV__) {
      console.log('[getLastMessagePreview] Conversation:', {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        lastMessage: (conversation as any)?.lastMessage,
        lastMessageContent: (conversation as any)?.lastMessageContent,
        lastMessageText: (conversation as any)?.lastMessageText,
        messages: (conversation as any)?.messages,
        updatedAt: conversation.updatedAt,
      });
    }

    const raw =
      (conversation as any)?.lastMessage ??
      (conversation as any)?.lastMessageContent ??
      (conversation as any)?.lastMessageText ??
      (() => {
        const messages = (conversation as any)?.messages;
        if (Array.isArray(messages) && messages.length > 0) {
          return messages[0] || messages[messages.length - 1];
        }
        return null;
      })();

    if (!raw) {
      console.log('[getLastMessagePreview] No message found for conversation:', conversation.id);
      return { Icon: null, text: 'ntabutumwa buroherezwa...' };
    }
    if (typeof raw === 'string') return { Icon: null, text: raw };

    // ─── Hide deleted messages from preview ───
    if (raw.isDeleted === true) {
      return { Icon: null, text: 'ntabutumwa buroherezwa...' };
    }

    // Extract sender info
    const senderId = raw.senderId || raw.userId || raw.createdById;
    const senderName = raw.sender?.fullNames || raw.user?.fullNames || raw.creator?.fullNames;
    const isCurrentUser = senderId === user?.id;
    
    console.log('[getLastMessagePreview] Message found:', {
      messageId: raw.id,
      senderId,
      senderName,
      isCurrentUser,
      content: raw.content?.substring(0, 50),
    });
    
    // 🎯 WhatsApp behavior:
    // - Direct chats: Show "Wowe: " for your own messages only
    // - Groups/Communities: Show "Wowe: " for you, "FirstName: " for others
    let senderPrefix = '';
    if (isCurrentUser) {
      // Always show "Wowe: " for current user's messages (all chat types)
      senderPrefix = 'Wowe: ';
    } else if (conversation.type === 'group' || conversation.type === 'community') {
      // Show sender name only in groups/communities
      senderPrefix = senderName ? `${senderName.split(' ')[0]}: ` : '';
    }
    // Direct chats from other user: no prefix

    const media = getMediaInfo(raw.type || '', raw.content || raw.text || '');
    if (media) {
      // For media, show sender + media type (e.g., "John: 📷 Photo" or "Wowe: 🎤 Voice")
      return { Icon: media.Icon, text: `${senderPrefix}${media.text}` };
    }

    const text =
      (!isFileUrl(raw.content) ? raw.content : null) ||
      (!isFileUrl(raw.text) ? raw.text : null) ||
      (!isFileUrl(raw.message) ? raw.message : null) ||
      (!isFileUrl(raw.title) ? raw.title : null) ||
      (!isFileUrl(raw.body) ? raw.body : null) ||
      raw.message?.content ||
      raw.data?.content ||
      raw.content?.text;

    if (text) return { Icon: null, text: `${senderPrefix}${text}` };

    const fallback = getMediaInfo(raw.type || '', '');
    return fallback ? { Icon: fallback.Icon, text: `${senderPrefix}${fallback.text}` } : { Icon: null, text: 'ntabutumwa buroherezwa...' };
  };

  // Sort by most recent message/activity first
  const sortByRecency = (items: IConversation[]) => {
    return [...items].sort((a, b) => {
      const getTime = (item: IConversation) => {
        const raw =
          (item as any)?.lastMessage?.timestamp ||
          (item as any)?.lastMessage?.createdAt ||
          (item as any)?.lastMessageAt ||
          item.updatedAt ||
          item.createdAt;
        return raw ? new Date(raw).getTime() : 0;
      };
      return getTime(b) - getTime(a);
    });
  };

  // Filter by search query
  const filterBySearch = (items: IConversation[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(conv => {
      const name = (conv.name || conv.displayName || 'Unknown').toLowerCase();
      const { text } = getLastMessagePreview(conv);
      return name.includes(query) || text.toLowerCase().includes(query);
    });
  };

  const filteredDirectChats = sortByRecency(filterBySearch(directChats));
  const filteredGroupChats = sortByRecency(filterBySearch(groupChats));
  const filteredCommunities = sortByRecency(filterBySearch(communities));

  // Effective tab badge counts — exclude conversations where the current user
  // sent the last message so we never badge your own outgoing messages.
  const effectiveDirectUnread = useMemo(() =>
    directChats.reduce((sum: number, chat: any) =>
      chat.lastMessageSender === 'me' ? sum : sum + getConversationUnread(chat.id), 0),
    [directChats, getConversationUnread]);

  const effectiveGroupUnread = useMemo(() =>
    groupChats.reduce((sum: number, chat: any) =>
      chat.lastMessageSender === 'me' ? sum : sum + getConversationUnread(chat.id), 0),
    [groupChats, getConversationUnread]);

  const effectiveCommunityUnread = useMemo(() =>
    communities.reduce((sum: number, comm: any) =>
      comm.lastMessageSender === 'me' ? sum : sum + getConversationUnread(comm.id), 0),
    [communities, getConversationUnread]);

  // Track online status for all direct chat participants
  const directParticipantIds = useMemo(() => {
    return directChats
      .map((chat: any) => chat.otherUserId)
      .filter(Boolean) as string[];
  }, [directChats]);

  const { isUserOnline } = useOnlineStatus(directParticipantIds);

  const formatPreviewFromMessage = (msg: any, conversationType?: 'direct' | 'group' | 'community'): { Icon: React.ComponentType<any> | null; text: string; time?: string } => {
    if (!msg) return { Icon: null, text: 'ntabutumwa buroherezwa...' };

    // ─── Hide deleted messages from preview ───
    if (msg.isDeleted === true) {
      return { Icon: null, text: 'ntabutumwa buroherezwa...' };
    }

    // Extract sender info
    const senderId = msg.senderId || msg.userId || msg.createdById;
    const senderName = msg.sender?.fullNames || msg.user?.fullNames || msg.creator?.fullNames;
    const isCurrentUser = senderId === user?.id;
    
    // 🎯 WhatsApp behavior:
    // - Direct chats: Show "Wowe: " for your own messages only
    // - Groups/Communities: Show "Wowe: " for you, "FirstName: " for others
    let senderPrefix = '';
    if (isCurrentUser) {
      // Always show "Wowe: " for current user's messages (all chat types)
      senderPrefix = 'Wowe: ';
    } else if (conversationType === 'group' || conversationType === 'community') {
      // Show sender name only in groups/communities
      senderPrefix = senderName ? `${senderName.split(' ')[0]}: ` : '';
    }
    // Direct chats from other user: no prefix

    let icon: React.ComponentType<any> | null = null;
    let textDesc = '';

    const media = getMediaInfo(msg.type || '', msg.content || msg.text || '');
    if (media) {
      icon = media.Icon;
      textDesc = `${senderPrefix}${media.text}`;
    } else {
      const rawText =
        (!isFileUrl(msg.content) ? msg.content : null) ||
        (!isFileUrl(msg.text) ? msg.text : null) ||
        (!isFileUrl(msg.message) ? msg.message : null) ||
        (!isFileUrl(msg.title) ? msg.title : null) ||
        (!isFileUrl(msg.body) ? msg.body : null) ||
        msg?.message?.content ||
        msg?.data?.content ||
        msg?.content?.text ||
        'ntabutumwa buroherezwa...';
      textDesc = `${senderPrefix}${rawText}`;
    }

    const time = msg.timestamp || msg.createdAt || msg.updatedAt;
    return { Icon: icon, text: textDesc, time };
  };

  // Fetch last message for group & community items that don't include it
  const loadMissingPreviews = useCallback(async () => {
    const missing = [...directChats, ...groupChats, ...communities].filter(
      (c) => !lastPreviews[c.id]
    );
    if (missing.length === 0) return;

    const results = await Promise.all(
      missing.map(async (conv) => {
        try {
          if (conv.type === 'direct') {
            const res = await MessagingAPI.getDirectChatMessages(conv.id, 1, 0);
            const msg = (res as any)?.data?.[0] || (res as any)?.data?.data?.[0];
            return { id: conv.id, preview: formatPreviewFromMessage(msg, 'direct') };
          }
          if (conv.type === 'group') {
            const res = await MessagingAPI.getGroupMessages(conv.id, 1, 0);
            const msg = (res as any)?.data?.[0] || (res as any)?.data?.data?.[0];
            return { id: conv.id, preview: formatPreviewFromMessage(msg, 'group') };
          }
          if (conv.type === 'community') {
            const res = await MessagingAPI.getCommunityPosts(conv.id, 1, 0);
            const msg = (res as any)?.data?.[0] || (res as any)?.data?.data?.[0];
            return { id: conv.id, preview: formatPreviewFromMessage(msg, 'community') };
          }
        } catch (err) {
          // Silently fail
        }
        return { id: conv.id, preview: { Icon: null, text: 'ntabutumwa buroherezwa...' } };
      })
    );

    const next = { ...lastPreviews };
    results.forEach((r) => {
      if (r) next[r.id] = r.preview;
    });
    setLastPreviews(next);
  }, [directChats, groupChats, communities, lastPreviews, user?.id]);

  useEffect(() => {
    loadMissingPreviews();
  }, [loadMissingPreviews]);

  // Consolidated render function for all conversation types
  const renderConversationItem = ({ item }: { item: IConversation }) => {
    const name = item.name || item.displayName || 'Unknown';
    const photo = item.photo || item.displayPhoto || item.participants?.[0]?.user?.photo || 'https://res.cloudinary.com/dpwbmqutn/image/upload/v1762488954/chw/91a10fa7-f5e9-4a0e-ae5b-5d64902548e7.png';
    const participantUserId = item.type === 'direct'
      ? (item as any).otherUserId
      : undefined;
    const isOnline = participantUserId ? isUserOnline(participantUserId) : false;
    
    const cachedPreview = lastPreviews[item.id];
    const preview = cachedPreview || getLastMessagePreview(item);
    const lastMessage = preview.text;
    const PreviewIcon = preview.Icon;
    const lastMessageTime =
      cachedPreview?.time ||
      (item as any)?.lastMessage?.timestamp ||
      (item as any)?.lastMessage?.createdAt ||
      item.updatedAt ||
      item.createdAt;

    const unreadCount = getConversationUnread(item.id);
    const lastMessageSender = (item as any).lastMessageSender;
    // Never show an unread badge for a message the current user sent — the
    // backend can emit new_unread to the sender too, which is incorrect.
    const hasUnread = unreadCount > 0 && lastMessageSender !== 'me';
    const isDelivered = (item as any).isDelivered;
    const isRead = (item as any).isRead;

    const getRoute = () => {
      if (item.type === 'direct') return `/chat/${item.id}`;
      if (item.type === 'group') return `/group/${item.id}`;
      if (item.type === 'community') return `/community/${item.id}`;
      return `/group/${item.id}`;
    };

    const handlePress = () => {
      if (hasUnread) {
        markConversationRead(item.id, item.type as 'direct' | 'group' | 'community');
      }
      router.push(getRoute());
    };

    return (
      <TouchableOpacity style={styles.groupItemMessage} onPress={handlePress}>
        <View style={styles.groupInfo}>
          <View style={styles.groupLeftAvatar}>
            <Image source={{ uri: photo }} style={styles.groupAvatar} />
            {item.type === 'direct' && isOnline && (
              <View style={styles.onlineIndicator} />
            )}
          </View>
          <View style={styles.groupMeta}>
            <View style={styles.nameTimeRow}>
              <Text style={[styles.groupName, hasUnread && styles.unreadConvName]}>{name}</Text>
              <View style={styles.timeContainer}>
                <Text style={[styles.messageTime, hasUnread && styles.unreadConvTime]}>
                  {lastMessageTime ? formatTime(new Date(lastMessageTime)) : ''}
                </Text>
              </View>
            </View>
            <View style={styles.messageRow}>
              {PreviewIcon && (
                <View style={{ marginRight: 4, marginTop: 1 }}>
                  <PreviewIcon size={14} color={hasUnread ? '#374151' : '#9ca3af'} />
                </View>
              )}
              <Text style={[styles.messageText, hasUnread && styles.unreadConvMessage]} numberOfLines={1}>
                {lastMessage}
              </Text>
              {lastMessageSender === 'me' && (
                <View style={styles.statusIcon}>
                  {isRead ? (
                    <CheckCheck size={14} color="#3b82f6" strokeWidth={2.5} />
                  ) : isDelivered ? (
                    <CheckCheck size={14} color="#9ca3af" strokeWidth={2.5} />
                  ) : (
                    <Check size={14} color="#9ca3af" strokeWidth={2.5} />
                  )}
                </View>
              )}
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.floor(days / 365);
    return `${years}y`;
  };

  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.COMMUNITY);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.COMMUNITY).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  return (
    <View style={styles.container}>
      <Header />

      <CopilotStep
        text="Hano uhitamo uburyo bw'ibiganiro: Amatsinda, Ubutumwa cyangwa Kominote."
        order={1}
        name="community-tabs"
      >
        <WalkthroughableView style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'group' && styles.activeTab]}
          onPress={advanceTabs(() => setActiveTab('group'))}>
          <View style={[styles.tabContent, activeTab === 'group' && styles.activeTabContent]}>
            <View style={{ position: 'relative' }}>
              <Users size={20} color={activeTab === 'group' ? '#4D81D2' : '#6b7280'} strokeWidth={2} />
              {effectiveGroupUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{effectiveGroupUnread > 99 ? '99+' : effectiveGroupUnread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>
              Amatsinda
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={advanceTabs(() => setActiveTab('messages'))}>
          <View style={[styles.tabContent, activeTab === 'messages' && styles.activeTabContent]}>
            <View style={{ position: 'relative' }}>
              <MessageSquare size={20} color={activeTab === 'messages' ? '#4D81D2' : '#6b7280'} strokeWidth={2} />
              {effectiveDirectUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{effectiveDirectUnread > 99 ? '99+' : effectiveDirectUnread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
              Ubutumwa
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'community' && styles.activeTab]}
          onPress={advanceTabs(() => setActiveTab('community'))}>
          <View style={[styles.tabContent, activeTab === 'community' && styles.activeTabContent]}>
            <View style={{ position: 'relative' }}>
              <Globe size={20} color={activeTab === 'community' ? '#4D81D2' : '#6b7280'} strokeWidth={2} />
              {effectiveCommunityUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{effectiveCommunityUnread > 99 ? '99+' : effectiveCommunityUnread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabText, activeTab === 'community' && styles.activeTabText]}>
              Kominote
            </Text>
          </View>
        </TouchableOpacity>
        </WalkthroughableView>
      </CopilotStep>

      {/* Search bar */}
      <CopilotStep
        text="Andika hano kugira ngo ushake ibiganiro, amatsinda cyangwa kominote."
        order={2}
        name="community-search"
      >
        <WalkthroughableView>
          <TextInput
            placeholder="Shakira hano..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </WalkthroughableView>
      </CopilotStep>

      {/* Tab content */}
      {activeTab === 'messages' ? (
        filteredDirectChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{searchQuery ? 'Ntagisubizo kibonetse' : 'Ntabutumwa buraboneka'}</Text>
            <Text style={styles.emptySubtitle}>{searchQuery ? 'Ongera ushakishe' : 'Tangiza ikiganiro'}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredDirectChats}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#3363AD"
                title="Gufungura amakuru..."
                titleColor="#3363AD"
              />
            }
          />
        )
      ) : activeTab === 'group' ? (
        filteredGroupChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Ntamatsinda abonetse</Text>
            <Text style={styles.emptySubtitle}>Fungura cg winjire mumatsinda abasha kuboneka</Text>
          </View>
        ) : (
          <FlatList
            data={filteredGroupChats}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#3363AD"
                title="Gufungura amakuru..."
                titleColor="#3363AD"
              />
            }
          />
        )
      ) : (
        filteredCommunities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nta kominote zibonetse</Text>
            <Text style={styles.emptySubtitle}>Fungura cg winjire muri kominote zibasha kuboneka</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCommunities}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#3363AD"
                title="Gufungura amakuru..."
                titleColor="#3363AD"
              />
            }
          />
        )
      )}

      {activeTab === 'messages' ? (
        <CopilotStep text="Kanda hano kugira ngo utangire ikiganiro gishya, itsinda, cyangwa kominote." order={3} name="community-fab">
          <WalkthroughableTouchable
            style={styles.fab}
            onPress={advanceFab(() => router.push('/chat/create'))}
            accessibilityRole="button"
            accessibilityLabel="Tangira ikiganiro">
            <PlusCircle size={22} color="#fff" />
          </WalkthroughableTouchable>
        </CopilotStep>
      ) : activeTab === 'group' ? (
        <CopilotStep text="Kanda hano kugira ngo utangire ikiganiro gishya, itsinda, cyangwa kominote." order={3} name="community-fab">
          <WalkthroughableTouchable
            style={styles.fab}
            onPress={advanceFab(() => router.push('/group/create'))}
            accessibilityRole="button"
            accessibilityLabel="Fungura itsinda">
            <PlusCircle size={22} color="#fff" />
          </WalkthroughableTouchable>
        </CopilotStep>
      ) : activeTab === 'community' ? (
        <CopilotStep text="Kanda hano kugira ngo utangire ikiganiro gishya, itsinda, cyangwa kominote." order={3} name="community-fab">
          <WalkthroughableTouchable
            style={styles.fab}
            onPress={advanceFab(() => router.push('/community/create'))}
            accessibilityRole="button"
            accessibilityLabel="Fungura kominote">
            <PlusCircle size={22} color="#fff" />
          </WalkthroughableTouchable>
        </CopilotStep>
      ) : null}


    </View>
  );
}

export default function CommunityScreen() {
  return (
    <CopilotProvider
      tooltipComponent={MascotTooltip}
      overlay="view"
      backdropColor="rgba(0, 0, 0, 0.65)"
      animationDuration={300}
      stepNumberComponent={() => null}
      arrowSize={10}
      androidStatusBarVisible
      labels={{
        finish: 'Rangiza',
        next: 'Ibikurikiraho',
        previous: 'Inyuma',
        skip: 'Simbuka',
      }}
    >
      <CommunityScreenContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  avatarScroll: {
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 60,
  },
  avatarContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4D81D2',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
  },
  activeTabContent: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4D81D2',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  messageAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  messageMeta: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  messageText: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
  },
  statusIcon: {
    marginLeft: 6,
    marginRight: 4,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  groupPost: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    padding: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  groupAuthorInfo: {
    flex: 1,
  },
  groupAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  groupTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  groupContent: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  groupImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  groupActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  groupAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  groupActionText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  memberCountText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#4D81D2',
    marginLeft: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberName: {
    fontSize: 16,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupItemMessage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupLeftAvatar: {
    marginRight: 12,
    position: 'relative',
  },
  groupMeta: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  groupDesc: {
    color: '#6b7280',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  unreadConvName: {
    fontWeight: '700',
    color: '#111827',
  },
  unreadConvTime: {
    color: '#4D81D2',
    fontWeight: '600',
  },
  unreadConvMessage: {
    fontWeight: '600',
    color: '#374151',
  },
});
