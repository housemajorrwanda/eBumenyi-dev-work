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
  Image,
  TextInput,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getAllUsersNopagination } from '@/services/users.api';
import { IMessage, IUser } from '@/types';
import { CommunityPostCard } from '@/components/chat/CommunityPostCard';
import { ChatInput } from '@/components/chat/ChatInput';
import { CommunityHeader } from '@/components/chat/CommunityHeader';
import { MessageSearch } from '@/components/chat/MessageSearch';
import { TypingBubble } from '@/components/chat/TypingBubble';
import { getMe } from '@/services/auth';
import { Search, X } from 'lucide-react-native';
import { useChat } from '@/hooks/useChat';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import * as MessagingAPI from '@/services/messaging.api';

export default function CommunityRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const { markConversationRead } = useUnreadCount();
  const { setActiveConversation, clearActiveConversation } = useActiveConversation();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => getMe(),
    staleTime: Infinity,
  });

  // Fetch community details
  const { data: fetchedCommunity } = useQuery({
    queryKey: ['community', id],
    queryFn: () => MessagingAPI.getCommunityById(id || ''),
    enabled: !!id,
  });

  const { messages, isLoading, sendMessage, sendAttachment, editMessage, deleteMessage, isSending, toggleLike, hasNextPage, fetchNextPage, isFetchingNextPage } = useChat({
    chatId: id ?? null,
    type: 'community',
    senderId: currentUser?.id,
  });

  const { typingUsers, startTyping, stopTyping } = useTypingIndicators({
    chatId: id || '',
    currentUserId: currentUser?.id || '',
    type: 'community',
    currentUserName: currentUser?.fullNames,
    currentUserPhoto: currentUser?.photo,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCommunitySettings, setShowCommunitySettings] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReplyingToComment, setIsReplyingToComment] = useState(false);
  const [hasOpenComments, setHasOpenComments] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Extract community from API response structure
  // API returns the community object directly, not wrapped
  const conversation = (fetchedCommunity as any)?.community || (fetchedCommunity as any)?.data || (fetchedCommunity as any);

  // Feed style: newest first (index 0 = top), no inversion needed
  const postMessages = messages.filter((m): m is IMessage => !!m);

  // Fetch users for adding members
  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => getAllUsersNopagination(),
  });

  const users: IUser[] = usersResponse?.data || [];

  // Handle keyboard show/hide
  useEffect(() => {
    const keyboardShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardHide = Keyboard.addListener('keyboardDidHide', () => {
      setHasOpenComments(false);
      setKeyboardHeight(0);
      setRefreshKey(prev => prev + 1);
    });
    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, []);

  // Mark community as visited when user opens it (for unread tracking)
  useEffect(() => {
    if (id && currentUser?.id) {
      // Mark as visited in backend
      MessagingAPI.markCommunityAsVisited(id).catch(() => {
        // Silently fail - not critical
      });
      
      // Also mark as read in local cache
      markConversationRead(id, 'community');
    }
  }, [id, currentUser?.id, markConversationRead]);

  // 🎯 Set this community as active to prevent unread count increments (WhatsApp-style)
  useEffect(() => {
    if (id) {
      setActiveConversation(id, 'community');
      return () => clearActiveConversation();
    }
  }, [id, setActiveConversation, clearActiveConversation]);

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

  const handleOpenCommunitySettings = () => {
    if (conversation) {
      setCommunityName(conversation.name || '');
    }
    setShowCommunitySettings(true);
  };

  // Get members excluding those already in the community
  const currentMemberIds = conversation?.participants?.map((p: any) => p.userId) || [];
  const availableUsers = users.filter(u => !currentMemberIds.includes(u.id));
  const filteredUsers = availableUsers.filter(user =>
    user.fullNames.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-scroll when editing message
  useEffect(() => {
    if (editingMessage) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [editingMessage]);

  // Show loading while messages are being fetched
   if (isLoading || !conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner message="Gufungura amakuru..." />
      </SafeAreaView>
    );
  }

   if (!isLoading&&!conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Kominote ntiyabonetse</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} key={refreshKey}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <CommunityHeader 
          community={conversation} 
          router={router} 
          communityId={id || ''} 
          memberCount={conversation?.members?.length ?? conversation?.participants?.length ?? 0}
          onSettingsPress={handleOpenCommunitySettings} 
        />

        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nta butumwa. tangira wohereze!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={postMessages}
              style={{ flex: 1, backgroundColor: '#ffffff' }}
              keyExtractor={(item) => item?.id || Math.random().toString()}
              renderItem={({ item, index }) => (
                <View style={{ backgroundColor: '#ffffff' }}>
                  <CommunityPostCard
                    post={item}
                    communityId={id || ''}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onLike={(postId) => toggleLike?.(postId)}
                    onCommentOpen={() => {
                      // Scroll card into view when comments section opens
                      setTimeout(() => {
                        try {
                          flatListRef.current?.scrollToIndex({
                            index,
                            animated: true,
                            viewPosition: 0.8, // Show near bottom of visible area
                          });
                        } catch {
                          flatListRef.current?.scrollToEnd({ animated: true });
                        }
                      }, 150);
                    }}
                    onCommentInputFocus={() => {
                      // Scroll the card so its bottom sits just above the keyboard
                      setTimeout(() => {
                        try {
                          flatListRef.current?.scrollToIndex({
                            index,
                            animated: true,
                            viewPosition: 1, // Align bottom of card to bottom of visible area
                            viewOffset: -(keyboardHeight + 16), // Push above keyboard
                          });
                        } catch {
                          // Fallback: scroll to end if index fails
                          flatListRef.current?.scrollToEnd({ animated: true });
                        }
                      }, 350);
                    }}
                    onReplyModeChange={(isReplying) => setIsReplyingToComment(isReplying)}
                    onCommentsVisibilityChange={(isOpen) => setHasOpenComments(isOpen)}
                  />
                </View>
              )}
              contentContainerStyle={[styles.messagesList, { flexGrow: 1, backgroundColor: '#ffffff' }]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              // 📜 INFINITE SCROLL - Load more when user scrolls near top
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
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

        {/* Typing indicator — sits just above the input, visible regardless of scroll position */}
        {typingUsers.length > 0 && (
          <TypingBubble typingUsers={typingUsers} showNames />
        )}

        {/* Only show ChatInput when NO comments section is open */}
        {!hasOpenComments && (
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
        )}

        {/* Community Settings Modal */}
        {showCommunitySettings && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.settingsTitle}>Utwa</Text>
                <TouchableOpacity onPress={() => setShowCommunitySettings(false)}>
                  <X size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsContent}>
                <Text style={styles.sectionTitle}>Izina ry utwa</Text>
                <TextInput
                  style={styles.input}
                  value={communityName}
                  onChangeText={setCommunityName}
                  placeholder="Izina ry utwa"
                  placeholderTextColor="#9ca3af"
                />

                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Kubika</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.primaryButton, { marginTop: 12 }]}
                  onPress={() => {
                    setShowCommunitySettings(false);
                    setShowManageMembers(true);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Kurinda abagize utwa</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Manage Members Modal */}
        {showManageMembers && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.settingsTitle}>Kurinda abagize utwa</Text>
                <TouchableOpacity onPress={() => setShowManageMembers(false)}>
                  <X size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsContent}>
                <View style={styles.searchContainer}>
                  <Search size={18} color="#9ca3af" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Sagisha abagize utwa"
                    placeholderTextColor="#9ca3af"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <Text style={styles.sectionTitle}>Abagize utwa</Text>
                <View style={styles.membersList}>
                  {conversation?.participants?.map((p: any) => (
                    <View key={p.userId} style={styles.userItem}>
                      {p.user?.profileImage && (
                        <Image source={{ uri: p.user.profileImage }} style={styles.userAvatar} />
                      )}
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{p.user?.fullNames || 'Unknown'}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Ongeraho abagize utwa</Text>
                <View style={styles.availableMembersList}>
                  {filteredUsers.map((user) => (
                    <TouchableOpacity key={user.id} style={styles.userItem}>
                      {user.photo && (
                        <Image source={{ uri: user.photo }} style={styles.userAvatar} />
                      )}
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.fullNames}</Text>
                      </View>
                      <TouchableOpacity style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <MessageSearch
        chatId={id || ''}
        isVisible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectMessage={(message: IMessage) => {
          flatListRef.current?.scrollToIndex({
            index: postMessages.findIndex(m => m.id === message.id),
            animated: true,
          });
        }}
        chatType="community"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '##ffffff',
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
    flexGrow: 1,
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
    borderBottomColor: '#ffffff',
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
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
    borderColor: '#ffffff',
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
  membersList: {
    marginBottom: 16,
  },
  availableMembersList: {
    maxHeight: 200,
  },
});
