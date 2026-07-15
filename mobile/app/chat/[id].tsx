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

export default function ChatRoom() {
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

  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

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

  // Track keyboard height on Android so only the input bar lifts — not the whole screen.
  // (edgeToEdgeEnabled causes adjustPan which scrolls the whole window; we counter that by
  // manually padding only the input bar up by the keyboard height.)
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);


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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* iOS: KeyboardAvoidingView handles it cleanly.
          Android: edgeToEdgeEnabled causes adjustPan (whole screen scrolls).
          Instead we track keyboard height manually and only lift the input bar. */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        <View style={Platform.OS === 'android' ? { paddingBottom: androidKeyboardHeight } : undefined}>
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
          />
        </View>
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
