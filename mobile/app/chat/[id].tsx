import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { IMessage, IConversation } from '@/types';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageSearch } from '@/components/chat/MessageSearch';
import { TypingBubble } from '@/components/chat/TypingBubble';
import { useChat } from '@/hooks/useChat';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { useAuth } from '@/hooks/useAuth';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import * as MessagingAPI from '@/services/messaging.api';
import { CopilotProvider, useCopilot } from 'react-native-copilot';
import MascotTooltip from '@/components/onboarding/MascotTooltip';
import { TOUR_KEYS, onboardingService, scheduleTourStart } from '@/services/onboarding.service';
import { useOnboarding } from '@/contexts/OnboardingContext';

function ChatRoomContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();
  const { setActiveConversation, clearActiveConversation } = useActiveConversation();

  const {
    messages,
    isLoading,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    toggleLike,
    markMessagesRead,
    isSending,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useChat({
    chatId: id ?? null,
    type: 'direct',
    senderId: user?.id,
  });

  // Fetch conversation details
  const { data: fetchedConversation } = useQuery({
    queryKey: ['directChat', id],
    queryFn: () => MessagingAPI.getDirectChatById(id || ''),
    enabled: !!id,
  });

  const { typingUsers, startTyping, stopTyping } = useTypingIndicators({
    chatId: id || '',
    currentUserId: user?.id || '',
    type: 'direct',
    currentUserName: user?.fullNames,
    currentUserPhoto: user?.photo,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const { start, copilotEvents, stop, visible } = useCopilot();
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

  // Extract conversation from API response { chat, messages }
  // Inject type:'direct' because the directChat DB model has no type column
  const rawChat =
    (fetchedConversation as any)?.chat ||
    (fetchedConversation as any)?.data ||
    (fetchedConversation as any);
  const conversation: IConversation = rawChat ? { ...rawChat, type: 'direct' as const } : rawChat;

  // Filter out undefined messages and reverse for inverted FlatList
  // Use messages from useChat hook, not from fetchedConversation
  const reversedMessages = messages.filter((m): m is IMessage => !!m).reverse();

  // Send message handler
  const handleSendMessage = (text: string) => {
    if (!text.trim()) {
      alert('Ntabutumwa wanditse');
      return;
    }

    if (editingMessage) {
      // Edit existing message
      editMessage(editingMessage.id, text);
      setEditingMessage(null);
      setEditText('');
      return;
    }

    // Send new message
    sendMessage(text);
  };

  const handleSendAttachment = (
    url: string,
    type: 'image' | 'file' | 'audio' | 'video',
    fileName: string,
  ) => {
    sendAttachment(url, type, fileName);
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };

  const handleEditMessage = (message: IMessage) => {
    setEditingMessage(message);
    setEditText(message.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // Mark other user's messages as read when chat opens
  useEffect(() => {
    if (id && user?.id) {
      markMessagesRead?.();
    }
  }, [id, user?.id, markMessagesRead]);

  // 🎯 Set this chat as active to prevent unread count increments (WhatsApp-style)
  useEffect(() => {
    if (id) {
      setActiveConversation(id, 'direct');
      return () => clearActiveConversation();
    }
  }, [id, setActiveConversation, clearActiveConversation]);

  // Handle keyboard hide
  useEffect(() => {
    const keyboardHide = Keyboard.addListener('keyboardDidHide', () => {
      setRefreshKey(prev => prev + 1);
    });
    return () => keyboardHide.remove();
  }, []);


  useEffect(() => {
    let cancelSchedule: (() => void) | null = null;
    let cancelled = false;
    if (!isLoading && conversation && isFocused && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      void (async () => {
        const done = await onboardingService.hasCompleted(TOUR_KEYS.DIRECT_CHAT);
        if (cancelled) return;
        if (!done) { cancelSchedule = scheduleTourStart(() => startRef.current()); }
      })();
    }
    return () => { cancelled = true; cancelSchedule?.(); };
  }, [isLoading, conversation, isFocused]);

  useEffect(() => {
    const handleStop = () => { markComplete(TOUR_KEYS.DIRECT_CHAT).catch(() => {}); };
    copilotEvents.on('stop', handleStop);
    return () => { copilotEvents.off('stop', handleStop); };
  }, [copilotEvents, markComplete]);

  if (isLoading || !conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner message="Gufungura ubutumwa..." />
      </SafeAreaView>
    );
  }

  if (!isLoading && !conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Ntabutumwa bwabonetse</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} key={refreshKey}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ChatHeader chat={conversation} router={router} />

        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                ntabutumwa bwoherejwe. tangira wohereze!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={reversedMessages}
              keyExtractor={(item, index) =>
                item?.id ? `${item.id}_${index}` : `msg_${index}`
              }
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onLike={(messageId) => toggleLike?.(messageId)}
                />
              )}
              contentContainerStyle={styles.messagesList}
              inverted={true}
              showsVerticalScrollIndicator={true}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                typingUsers.length > 0
                  ? <TypingBubble typingUsers={typingUsers} />
                  : null
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <LoadingSpinner variant="inline" message="" />
                ) : null
              }
            />
          )}
        </View>

        <ChatInput
          onSendMessage={handleSendMessage}
          onSendAttachment={handleSendAttachment}
          disabled={isSending}
          initialMessage={editText}
          isEditing={!!editingMessage}
          onEditCancel={handleCancelEdit}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
          onEmojiPickerToggle={setEmojiPickerOpen}
          tourEnabled
        />
      </KeyboardAvoidingView>

      <MessageSearch
        chatId={id || ''}
        isVisible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectMessage={(message: IMessage) => {
          flatListRef.current?.scrollToIndex({
            index: reversedMessages.findIndex(
              (m: IMessage) => m.id === message.id,
            ),
            animated: true,
          });
        }}
        chatType="direct"
      />
    </SafeAreaView>
  );
}

export default function ChatRoom() {
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
      <ChatRoomContent />
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4D81D2',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
