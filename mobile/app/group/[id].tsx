import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { IMessage, IConversation } from '@/types';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { GroupMessageBubble } from '@/components/chat/GroupMessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { GroupHeader } from '@/components/chat/GroupHeader';
import { MessageSearch } from '@/components/chat/MessageSearch';
import { TypingBubble } from '@/components/chat/TypingBubble';
import { useChat } from '@/hooks/useChat';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { useAuth } from '@/hooks/useAuth';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import * as MessagingAPI from '@/services/messaging.api';

export default function GroupRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();
  const { setActiveConversation, clearActiveConversation } = useActiveConversation();
  const { messages, isLoading, sendMessage, sendAttachment, editMessage, deleteMessage, toggleLike, markMessagesRead, isSending, hasNextPage, fetchNextPage, isFetchingNextPage } = useChat({
    chatId: id ?? null,
    type: 'group',
    senderId: user?.id,
  });

  // Fetch group details
  const { data: fetchedGroup } = useQuery({
    queryKey: ['group', id],
    queryFn: () => MessagingAPI.getGroupById(id || ''),
    enabled: !!id,
  });

  const { typingUsers, startTyping, stopTyping } = useTypingIndicators({
    chatId: id || '',
    currentUserId: user?.id || '',
    type: 'group',
    currentUserName: user?.fullNames,
    currentUserPhoto: user?.photo,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Extract group from API response
  // Try nested structure first, then direct object
  const conversation: IConversation = (fetchedGroup as any)?.group || (fetchedGroup as any)?.data || (fetchedGroup as any);

  // Filter out undefined messages and reverse for inverted FlatList
  const reversedMessages = messages.filter((m): m is IMessage => !!m).reverse();

  // Mark other members' messages as read when chat opens
  useEffect(() => {
    if (id && user?.id) {
      markMessagesRead?.();
    }
  }, [id, user?.id]);

  // 🎯 Set this group as active to prevent unread count increments (WhatsApp-style)
  useEffect(() => {
    if (id) {
      setActiveConversation(id, 'group');
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

  const handleEditMessage = (message: IMessage) => {
    setEditingMessage(message);
    setEditText(message.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) {
      alert('Ntabutumwa wanditse');
      return;
    }
    if (editingMessage) {
      editMessage(editingMessage.id, text);
      setEditingMessage(null);
      setEditText('');
    } else {
      sendMessage(text);
    }
  };

  // Show loading while messages are being fetched
 if (isLoading || !conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner message="Gufungura ubutumwa..." />
      </SafeAreaView>
    );
  }

    if (!isLoading&&!conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>itsinda ntiryabonetse</Text>
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
        <GroupHeader group={conversation} router={router} groupId={id || ''} />

        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>ntabutumwa bwoherejwe. tangira wohereze!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={reversedMessages}
              keyExtractor={(item, index) => item?.id ? `${item.id}_${index}` : `msg_${index}`}
              renderItem={({ item, index }) => {
                // WhatsApp-style: Show avatar only for first message in a sequence from same sender
                const prevMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
                const showAvatar = !prevMessage || prevMessage.senderId !== item.senderId;
                
                return (
                  <GroupMessageBubble
                    message={item}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onLike={(messageId) => toggleLike?.(messageId)}
                    showAvatar={showAvatar}
                  />
                );
              }}
              contentContainerStyle={styles.messagesList}
              inverted={true}
              showsVerticalScrollIndicator={true}
              // 📜 INFINITE SCROLL - Load more when user scrolls near top
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                typingUsers.length > 0
                  ? <TypingBubble typingUsers={typingUsers} showNames />
                  : null
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={styles.loadingMoreContainer}>
                  <LoadingSpinner variant="inline" message="" />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        <ChatInput
          onSendMessage={handleSendMessage}
          onSendAttachment={(url, type, fileName) => sendAttachment(url, type, fileName)}
          disabled={isSending}
          initialMessage={editText}
          isEditing={!!editingMessage}
          onEditCancel={handleCancelEdit}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
        />

      </KeyboardAvoidingView>

      <MessageSearch
        chatId={id || ''}
        isVisible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectMessage={(message: IMessage) => {
          flatListRef.current?.scrollToIndex({
            index: reversedMessages.findIndex(m => m.id === message.id),
            animated: true,
          });
        }}
        chatType="group"
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
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  settingsContent: {
    padding: 12,
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  primaryButton: {
    backgroundColor: '#4D81D2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4D81D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  participantsList: {
    marginBottom: 16,
    maxHeight: 180,
  },
  availableUsersList: {
    maxHeight: 200,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  avatarFallback: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
