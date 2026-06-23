import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import {
  MessageSquare,
  Send,
  Search,
  Video,
  Phone,
  MoreVertical,
  Users,
  Settings,
  CheckCheck,
  Heart,
  Share,
  Clock,
  MessageCircle,
  FileText,
  Edit,
  Trash,
} from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { IConversation, IMessage, ConversationType, ICommentThread, IUser, IConversationParticipant } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  toggleLikeMessage,
  searchMessages,
  addComment,
  editComment,
  deleteComment,
  addParticipant,
  removeParticipant,
  getUnreadCount,
} from "@/services/messaging.service";
import { getAllUsersNopagination } from "@/services/users.api";
import {
  useGetConversations,
  useCreateConversation,
  useUpdateConversation,
  useGetMessages,
} from "@/hooks/useConversations";
import {
  initializeSocket,
  joinConversation,
  leaveConversation,
  onNewMessage,
  onMessageEdited,
  onMessageDeleted,
  onUserTyping,
  onMessageLiked,
  onCommentAdded,
  emitSendMessage,
  emitTyping,
  emitMarkMessageRead,
  emitLikeMessage,
  emitAddComment,
  emitEditMessage,
  emitDeleteMessage,
  emitAddParticipant,
} from "@/hooks/useSocket";
import toast from "react-hot-toast";

export const Messaging: React.FC = () => {
  const { user } = useAuth();
  
  // Local state first
  const [activeTab, setActiveTab] = useState<ConversationType>("direct");
  const [selectedConversation, setSelectedConversation] =
    useState<IConversation | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{userId: string, userName: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Comment interaction states
  const [commentLikes, setCommentLikes] = useState<{[key: string]: boolean}>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');

  // React Query hooks (after state declaration)
  const { data: conversations = [] } = useGetConversations();
  const { data: messagesData = [] } = useGetMessages(
    selectedConversation?.id || null
  );
  const createConversationMutation = useCreateConversation();
  const updateConversationMutation = useUpdateConversation();
console.log("here messages:",messagesData)
  // Explicitly type conversations to ensure filter works
  const typedConversations: IConversation[] = Array.isArray(conversations) ? conversations : [];

  // Post interaction states
  const [postLikes, setPostLikes] = useState<{[key: string]: boolean}>({});
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentingOn, setCommentingOn] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // Sync messages from React Query on conversation change only
  // This prevents infinite loops from React Query refetches
  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      return;
    }
    
    const typedMessagesData = Array.isArray(messagesData) ? messagesData : [];
    console.log(`Syncing ${typedMessagesData.length} messages for conversation ${selectedConversation.id}`);
    setMessages(typedMessagesData);
    // Scroll to bottom after state update
    setTimeout(() => scrollToBottom(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]); // Only trigger on conversation change

  // Initialize Socket.IO and setup listeners
  useEffect(() => {
    if (!selectedConversation?.id) return;
    
    // Join the conversation room
    joinConversation(selectedConversation.id);
    initializeSocket();
    
    // Setup listeners for messages
    const unsubscribeNewMessage = onNewMessage((message: IMessage) => {
      if (message.conversationId === selectedConversation?.id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
    });

    const unsubscribeMessageEdited = onMessageEdited((updatedMessage: IMessage) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
      );
    });

    const unsubscribeMessageDeleted = onMessageDeleted((messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    // Setup listener for typing indicators
    const unsubscribeUserTyping = onUserTyping((data) => {
      console.log(`User ${data.userId} is ${data.isTyping ? 'typing' : 'stopped typing'}`);
      // Update typing users state
      if (data.isTyping) {
        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.userId === data.userId);
          if (!exists) {
            return [...prev, { userId: data.userId, userName: data.userName }];
          }
          return prev;
        });
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    });

    // Setup listener for message likes
    const unsubscribeMessageLiked = onMessageLiked((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, likes: data.likeCount }
            : msg
        )
      );
    });

    // Setup listener for comments
    const unsubscribeCommentAdded = onCommentAdded((comment) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === comment.messageId
            ? {
                ...msg,
                comments: [...(msg.comments || []), comment],
              }
            : msg
        )
      );
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageEdited();
      unsubscribeMessageDeleted();
      unsubscribeUserTyping();
      unsubscribeMessageLiked();
      unsubscribeCommentAdded();
      
      // Leave conversation when unmounting
      if (selectedConversation?.id) {
        leaveConversation(selectedConversation.id);
      }
    };
  }, [selectedConversation?.id]);

  // Post interaction handlers
  const handlePostLike = async (postId: string) => {
    setPostLikes(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));

    // Update the message likes count
    setMessages(prevMessages =>
      prevMessages.map(message => {
        if (message.id === postId && message.type === 'blog') {
          const currentLikes = message.likes || 0;
          return {
            ...message,
            likes: postLikes[postId] ? currentLikes - 1 : currentLikes + 1
          };
        }
        return message;
      })
    );

    // Send like via API in background
    try {
      await toggleLikeMessage(postId);
      emitLikeMessage(postId);
    } catch (error) {
      console.error("Failed to like message:", error);
      toast.error("Failed to like message");
    }
  };

  const handlePostShare = async (postId: string) => {
    try {
      const shareLink = `${window.location.origin}/messages/${postId}`;
      await navigator.clipboard.writeText(shareLink);
      toast.success("Share link copied to clipboard!");
    } catch (error) {
      console.error("Failed to share post:", error);
      toast.error("Failed to share post");
    }
  };

  // Comment interaction handlers
  const handleCommentLike = (commentId: string) => {
    setCommentLikes(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const handleReply = (commentId: string, replyContent: string) => {
    if (!replyContent.trim()) return;

    setMessages(prevMessages =>
      prevMessages.map(message => {
        if (message.type === 'blog' && message.comments) {
          return {
            ...message,
            comments: message.comments.map(comment => {
              if (comment.id === commentId) {
                const newReply: ICommentThread = {
                  id: `reply_${Date.now()}`,
                  messageId: comment.messageId,
                  userId: user?.id || '',
                  text: replyContent,
                  timestamp: new Date().toISOString(),
                  parentId: commentId,
                  user: user ? { id: user.id, fullNames: user.fullNames } : undefined,
                  replies: []
                };

                return {
                  ...comment,
                  replies: [...(comment.replies || []), newReply]
                };
              }
              return comment;
            })
          } as IMessage;
        }
        return message;
      })
    );

    setReplyingTo(null);
    setReplyText('');
  };

  const handleCommentShare = async (commentId: string) => {
    try {
      const shareLink = `${window.location.origin}/messages/comment/${commentId}`;
      await navigator.clipboard.writeText(shareLink);
      toast.success("Comment link copied to clipboard!");
      if (navigator.share) {
        await navigator.share({
          title: "Check out this comment",
          text: "I found an interesting comment",
          url: shareLink,
        });
      }
    } catch (error) {
      console.error("Failed to share comment:", error);
      toast.error("Failed to share comment");
    }
  };

  const handleAddComment = async (postId: string, commentContent: string) => {
    if (!commentContent.trim()) return;

    setMessages(prevMessages =>
      prevMessages.map(message => {
        if (message.id === postId && message.type === 'blog') {
          const newComment: ICommentThread = {
            id: `comment_${Date.now()}`,
            messageId: postId,
            userId: user?.id || '',
            text: commentContent,
            timestamp: new Date().toISOString(),
            user: user ? { id: user.id, fullNames: user.fullNames } : undefined,
            replies: []
          };

          return {
            ...message,
            comments: [...(message.comments || []), newComment]
          } as IMessage;
        }
        return message;
      })
    );

    setCommentingOn(null);
    setNewCommentText('');

    // Send comment via API in background
    try {
      await addComment(postId, { text: commentContent });
      emitAddComment({ messageId: postId, text: commentContent });
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    }
  };

  // Typing indicator handler
  const handleTyping = useCallback((isTyping: boolean = true) => {
    if (!selectedConversation) return;
    
    try {
      emitTyping(selectedConversation.id, isTyping);
    } catch (error) {
      console.error("Failed to emit typing:", error);
    }
  }, [selectedConversation]);

  // Debounced typing handler
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const handleInputChange = (text: string) => {
    setNewMessage(text);
    
    // Emit typing indicator
    handleTyping(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      handleTyping(false);
    }, 1000);
  };

  // Load messages for conversation
  const handleSelectConversation = useCallback(async (conversation: IConversation) => {
    try {
      setSelectedConversation(conversation);
      
      // Join conversation via Socket.IO
      joinConversation(conversation.id);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    }
  }, []);

  // Get full conversation details (handled via settings panel now)
  // const handleGetConversationDetails = useCallback(async (conversationId: string) => {
  //   try {
  //     const response = await getConversationById(conversationId);
  //     if (response.data) {
  //       setSelectedConversation(response.data);
  //     }
  //   } catch (error) {
  //     console.error("Failed to get conversation details:", error);
  //     toast.error("Failed to load conversation details");
  //   }
  // }, []);

  const [newMessage, setNewMessage] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [communityName, setCommunitName] = useState("");
  const [communityDescription, setCommunitDescription] = useState("");
  const [communityCategory, setCommunitCategory] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [selectedModerators, setSelectedModerators] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCommunityPublic, setIsCommunityPublic] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [showMessageOptions, setShowMessageOptions] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  
  // New state for unused handlers
  const [showParticipantPanel, setShowParticipantPanel] = useState(false);
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchMessagesQuery, setSearchMessagesQuery] = useState("");
  const [showDirectChatCreator, setShowDirectChatCreator] = useState(false);
  const [selectedUserForDirectChat, setSelectedUserForDirectChat] = useState<string>("");
  const [newConversationName, setNewConversationName] = useState("");
  const [availableUsers, setAvailableUsers] = useState<IUser[]>([]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const message: IMessage = {
      id: Date.now().toString(),
      senderId: user?.id || "",
      type: 'text',
      content: newMessage,
      timestamp: new Date().toISOString(),
      conversationId: selectedConversation.id,
    };

    // Add to UI immediately (optimistic update)
    setMessages([...messages, message]);
    setNewMessage("");

    // Send via API in background
    try {
      await sendMessage(selectedConversation.id, {
        type: 'text',
        content: newMessage,
      });
      emitSendMessage({
        conversationId: selectedConversation.id,
        type: 'text',
        content: newMessage,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove the failed message from UI
      setMessages((prev) => prev.filter((msg) => msg.id !== message.id));
      toast.error("Failed to send message");
    }
  };

  // Edit message handler - now integrated with UI
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    
    try {
      await editMessage(messageId, { content: newContent });
      emitEditMessage({ messageId, content: newContent });
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: newContent, isEdited: true } : msg
        )
      );
      toast.success("Message updated");
    } catch (error) {
      console.error("Failed to edit message:", error);
      toast.error("Failed to edit message");
    }
  };

  // Delete message handler - now integrated with UI
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    
    try {
      await deleteMessage(messageId);
      emitDeleteMessage(messageId);
      
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  };

  // Mark message as read handler
  const handleMarkAsRead = async (messageId: string) => {
    try {
      await markMessageAsRead(messageId);
      emitMarkMessageRead(messageId);
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  };

  // Edit comment handler - now integrated
  const handleEditComment = async (commentId: string, newText: string) => {
    if (!newText.trim()) return;
    
    try {
      await editComment(commentId, { text: newText });
      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to edit comment:", error);
      toast.error("Failed to edit comment");
    }
  };

  // Delete comment handler - now integrated
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    
    try {
      await deleteComment(commentId);
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Add participant handler - now integrated
  const handleAddParticipant = async (userId: string) => {
    if (!selectedConversation) return;
    
    try {
      await addParticipant(selectedConversation.id, { userId });
      emitAddParticipant(selectedConversation.id, userId);
      toast.success("Participant added");
    } catch (error) {
      console.error("Failed to add participant:", error);
      toast.error("Failed to add participant");
    }
  };

  // Remove participant handler - now integrated
  const handleRemoveParticipant = async (userId: string) => {
    if (!selectedConversation) return;
    if (!window.confirm("Remove this participant?")) return;
    
    try {
      await removeParticipant(selectedConversation.id, userId);
      toast.success("Participant removed");
    } catch (error) {
      console.error("Failed to remove participant:", error);
      toast.error("Failed to remove participant");
    }
  };

  // Update conversation handler - now integrated
  const handleUpdateConversation = async (name: string, isPublic?: boolean) => {
    if (!selectedConversation) return;
    
    try {
      const updatedConversation = await updateConversationMutation.mutateAsync({
        conversationId: selectedConversation.id,
        name,
        isPublic,
      });
      
      setSelectedConversation(updatedConversation as IConversation);
      toast.success("Conversation updated");
    } catch (error) {
      console.error("Failed to update conversation:", error);
      toast.error("Failed to update conversation");
    }
  };

  // Create group handler
  const handleCreateGroup = async (groupName: string, participantIds: string[]) => {
    try {
      const newConversation = await createConversationMutation.mutateAsync({
        type: "group",
        name: groupName,
        participantIds: [user?.id || "", ...participantIds],
      });
      
      setSelectedConversation(newConversation as IConversation);
      toast.success("Group created");
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group");
    }
  };

  // Create community handler
  const handleCreateCommunity = async (
    communityName: string,
    isPublic: boolean = true,
    participantIds: string[] = []
  ) => {
    try {
      const newConversation = await createConversationMutation.mutateAsync({
        type: "community",
        name: communityName,
        isPublic,
        participantIds: [user?.id || "", ...participantIds],
      });
      
      setSelectedConversation(newConversation as IConversation);
      toast.success("Community created");
    } catch (error) {
      console.error("Failed to create community:", error);
      toast.error("Failed to create community");
    }
  };

  // Create direct chat handler - now integrated
  const handleCreateDirectChat = async (userId: string) => {
    try {
      const newConversation = await createConversationMutation.mutateAsync({
        type: "direct",
        participantIds: [userId],
      });
      
      setSelectedConversation(newConversation as IConversation);
      toast.success("Direct chat created");
    } catch (error) {
      console.error("Failed to create direct chat:", error);
      toast.error("Failed to create direct chat");
    }
  };

  // Search messages handler - now integrated
  const handleSearchMessages = async (query: string, conversationId?: string) => {
    try {
      if (!query.trim()) {
        setSearchQuery("");
        return;
      }
      const response = await searchMessages(query, conversationId, 20, 0);
      if (response.data && response.data.messages) {
        setMessages(response.data.messages);
        toast.success(`Found ${response.data.messages.length} results`);
      }
    } catch (error) {
      console.error("Failed to search messages:", error);
      toast.error("Failed to search messages");
    }
  };

  // Search conversations handler
  const handleSearchConversations = (query: string) => {
    setSearchQuery(query);
  };

  // Mark unread messages as read when viewed
  useEffect(() => {
    if (!messages || messages.length === 0 || !selectedConversation?.id) return;
    
    console.log(`Marking unread messages as read for conversation ${selectedConversation.id}`);
    
    const unreadMessages = messages.filter(
      (msg) => !msg.readBy || (msg.readBy.length === 0 && msg.senderId !== user?.id)
    );
    
    if (unreadMessages.length > 0) {
      console.log(`Found ${unreadMessages.length} unread messages`);
      unreadMessages.forEach((msg) => {
        handleMarkAsRead(msg.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]); // Only trigger on conversation change

  // Load unread counts
  useEffect(() => {
    const loadUnreadCounts = async () => {
      try {
        await getUnreadCount();
      } catch (error) {
        console.error("Failed to load unread counts:", error);
      }
    };
    
    loadUnreadCounts();
  }, []);

  // Load all users for selection in modals
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const response = await getAllUsersNopagination();
        if (response.data) {
          // Filter out current user from the list
          setAvailableUsers((response.data as IUser[]).filter((u: IUser) => u.id !== user?.id));
        }
      } catch (error) {
        console.error("Failed to load users:", error);
      }
    };
    
    loadAllUsers();
  }, [user?.id]);

  return (
    <>
      <div className="space-y-6">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold text-[#333333]">
                    Messaging
                  </h2>
                  <p className="text-gray-600">Chat with trainers, CHWs, and staff in groups and communities</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
            onClick={() => setShowDirectChatCreator(true)}
            className="flex items-center gap-2"
          >
            <MessageSquare size={20} />
            Direct Message
          </Button>
          <Button
            onClick={() => setShowCreateGroup(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Users size={20} />
            Create Group
          </Button>
          <Button
            onClick={() => setShowCreateCommunity(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faUsers} size="lg" />
            Create Community
          </Button>
                </div>
              </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List */}
          <Card padding={false} className="overflow-hidden flex flex-col h-full">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("direct")}
                className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "direct"
                    ? "text-[#3363AD] border-b-2 border-[#3363AD] bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare size={16} />
                  Chats ({typedConversations.filter((c: IConversation) => c.type === "direct").length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab("group")}
                className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "group"
                    ? "text-[#3363AD] border-b-2 border-[#3363AD] bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users size={16} />
                  Groups ({typedConversations.filter((c: IConversation) => c.type === "group").length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab("community")}
                className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "community"
                    ? "text-[#3363AD] border-b-2 border-[#3363AD] bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faUsers} size="1x" />
                  Communities ({typedConversations.filter((c: IConversation) => c.type === "community").length})
                </div>
              </button>
            </div>
            <div className="p-4 border-1 border-gray-200">
              <Input
                placeholder="Search conversations..."
                icon={<Search size={20} />}
                value={searchQuery}
                onChange={(e) => handleSearchConversations(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 hide-scrollbar">
              {typedConversations
                .filter((conv: IConversation) => conv.type === activeTab && (
                  searchQuery === "" || 
                  conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (conv.type === 'direct' && conv.participants[0]?.user?.fullNames?.toLowerCase().includes(searchQuery.toLowerCase()))
                ))
                .map((conv: IConversation) => {
                const isDirect = conv.type === 'direct';
                const isGroup = conv.type === 'group';
                const isCommunity = conv.type === 'community';
                
                const displayName = isDirect 
                  ? (conv.participants[0]?.user?.fullNames || 'User')
                  : conv.name || 'Unnamed';
                
                const avatarText = isDirect 
                  ? (conv.participants[0]?.user?.fullNames || 'U').split(" ").map((n: string) => n[0]).join("")
                  : isGroup 
                    ? 'G' 
                    : '#';
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conv.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium ${
                          isDirect 
                            ? 'bg-[#3363AD] text-white'
                            : isGroup 
                              ? 'bg-green-500 text-white'
                              : 'bg-purple-500 text-white'
                        }`}>
                          {avatarText}
                        </div>
                        {isDirect && typingUsers.some((u) => u.userId === conv.participants[0]?.userId) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                        {isGroup && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                            <Users size={8} className="text-white" />
                          </div>
                        )}
                        {isCommunity && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-purple-500 border-2 border-white rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faUsers} style={{fontSize: '8px'}} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {displayName}
                            </p>
                            {isGroup && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full whitespace-nowrap">
                                Group ({conv.participants.length})
                              </span>
                            )}
                            {isCommunity && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full whitespace-nowrap">
                                Community ({conv.participants.length})
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage ? (
                          <p className="text-xs text-gray-600 truncate mb-2">
                            {isDirect 
                              ? conv.lastMessage.content
                              : `${conv.lastMessage.sender?.fullNames || 'User'}: ${conv.lastMessage.content}`}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic mb-2">No messages yet</p>
                        )}
                        {!isDirect && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {conv.participants.slice(0, 3).map((p: IConversationParticipant) => (
                              <div
                                key={p.userId}
                                className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-white border border-white"
                                title={p.user?.fullNames}
                              >
                                {p.user?.fullNames?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                              </div>
                            ))}
                            {conv.participants.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs font-bold text-white border border-white">
                                +{conv.participants.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Unread count badge removed - now based on readBy array */}
                    </div>
                  </div>
                );
              })}
              {typedConversations.filter((conv) => conv.type === activeTab).length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">No {activeTab} conversations yet</p>
                  <p className="text-xs mt-1">Create one to get started</p>
                </div>
              )}
            </div>
          </Card>

          {/* Chat Area */}
          <Card padding={false} className="lg:col-span-2 flex flex-col h-full min-h-0">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 min-h-[80px]">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      selectedConversation.type === 'direct'
                        ? 'bg-[#3363AD] text-white'
                        : selectedConversation.type === 'group'
                          ? 'bg-green-500 text-white'
                          : 'bg-purple-500 text-white'
                    }`}>
                      {selectedConversation.type === 'direct'
                        ? (selectedConversation.participants[0]?.user?.fullNames || 'U').split(" ").map((n: string) => n[0]).join("")
                        : selectedConversation.type === 'group'
                          ? 'G'
                          : '#'
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {selectedConversation.type === 'direct'
                            ? selectedConversation.participants[0].user?.fullNames || 'User'
                            : selectedConversation.name
                          }
                        </p>
                        {selectedConversation.type === 'group' && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Group
                          </span>
                        )}
                        {selectedConversation.type === 'community' && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                            Community
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.type === 'direct'
                          ? "Direct message"
                          : `${selectedConversation.participants.length} members`
                        }
                      </p>
                      {selectedConversation.type === 'group' && (
                        <p className="text-xs text-gray-400 mt-1">
                          Manage group settings and members
                        </p>
                      )}
                      {selectedConversation.type === 'community' && (
                        <p className="text-xs text-gray-400 mt-1">
                          Community chat for all members
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Phone size={20} />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Video size={20} />
                    </Button>
                    {selectedConversation.type !== 'direct' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowConversationSettings(true)}
                      >
                        <Settings size={20} />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowParticipantPanel(!showParticipantPanel)}
                    >
                      <MoreVertical size={20} />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto bg-gray-50 hide-scrollbar min-h-0">
                  <div className="p-4 space-y-4">
                    {messages.map((message) => {
                      if (message.type === 'blog') {
                        // Blog post style for communities
                        return (
                          <div key={message.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-start gap-4 mb-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-[#3363AD] to-[#4A7BC7] text-white rounded-full flex items-center justify-center font-semibold text-lg shadow-sm">
                                {(message.sender?.fullNames || 'U').split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-900 text-base">{message.sender?.fullNames || 'Unknown'}</p>
                                    <div className="flex items-center gap-1 text-gray-500">
                                      <Clock size={12} />
                                      <span className="text-xs">
                                        {new Date(message.timestamp).toLocaleDateString()} at {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowMessageOptions(showMessageOptions === message.id ? null : message.id)}
                                      className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                                    >
                                      <MoreVertical size={16} className="text-gray-600" />
                                    </button>
                                    {showMessageOptions === message.id && (
                                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                        <button
                                          onClick={() => {
                                            setEditingMessageId(message.id);
                                            setEditingMessageContent(message.content || '');
                                            setShowMessageOptions(null);
                                          }}
                                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 first:rounded-t-lg"
                                        >
                                          <Edit size={14} />
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm('Delete this message? This action cannot be undone.')) {
                                              handleDeleteMessage(message.id);
                                              setShowMessageOptions(null);
                                            }
                                          }}
                                          className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2 last:rounded-b-lg"
                                        >
                                          <Trash size={14} />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-800 mb-4 leading-relaxed text-sm">{message.content}</p>

                                {/* Edit Mode */}
                                {editingMessageId === message.id && (
                                  <div className="mb-4 space-y-2">
                                    <textarea
                                      value={editingMessageContent}
                                      onChange={(e) => setEditingMessageContent(e.target.value)}
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      rows={3}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          handleEditMessage(message.id, editingMessageContent);
                                          setEditingMessageId(null);
                                          setEditingMessageContent('');
                                        }}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingMessageId(null);
                                          setEditingMessageContent('');
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Engagement Actions */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                  <div className="flex items-center gap-6">
                                    <button
                                      onClick={() => handlePostLike(message.id)}
                                      className={`flex items-center gap-2 transition-colors group ${
                                        postLikes[message.id]
                                          ? 'text-red-500'
                                          : 'text-gray-600 hover:text-red-500'
                                      }`}
                                    >
                                      <Heart size={18} className={`group-hover:fill-red-500 ${postLikes[message.id] ? 'fill-current' : ''}`} />
                                      <span className="font-medium">{message.likes || 0}</span>
                                      <span className="text-sm hidden sm:inline">likes</span>
                                    </button>
                                    <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors group">
                                      <MessageCircle size={18} />
                                      <span className="font-medium">{message.comments?.length || 0}</span>
                                      <span className="text-sm hidden sm:inline">comments</span>
                                    </button>
                                    <button
                                      onClick={() => handlePostShare(message.id)}
                                      className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors group"
                                    >
                                      <Share size={18} />
                                      <span className="font-medium">0</span>
                                      <span className="text-sm hidden sm:inline">shares</span>
                                    </button>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {message.readBy && message.readBy.length > 0 ? (
                                      <div className="flex items-center gap-1">
                                        <CheckCheck size={14} className="text-green-500" />
                                        <span>Read by {message.readBy.length}</span>
                                      </div>
                                    ) : (
                                      <span>Not read</span>
                                    )}
                                  </div>
                                </div>

                                {/* Add Comment Section */}
                                <div className="mt-6 pt-4 border-t border-gray-100">
                                  {commentingOn === message.id ? (
                                    <div className="space-y-3">
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Write a comment..."
                                          value={newCommentText}
                                          onChange={(e) => setNewCommentText(e.target.value)}
                                          onKeyPress={(e) => {
                                            if (e.key === "Enter") {
                                              handleAddComment(message.id, newCommentText);
                                            }
                                          }}
                                          className="flex-1"
                                        />
                                        <Button
                                          onClick={() => handleAddComment(message.id, newCommentText)}
                                          size="sm"
                                        >
                                          Comment
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            setCommentingOn(null);
                                            setNewCommentText('');
                                          }}
                                          size="sm"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setCommentingOn(message.id)}
                                      className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors"
                                    >
                                      <MessageCircle size={16} />
                                      <span className="text-sm font-medium">Add a comment</span>
                                    </button>
                                  )}

                                  {/* Comments Section */}
                                  {message.comments && message.comments.length > 0 && (
                                    <>
                                      <h4 className="font-semibold text-gray-900 mb-4 mt-6 flex items-center gap-2">
                                        <MessageCircle size={16} />
                                        Comments ({message.comments.length})
                                      </h4>
                                    <div className="space-y-4">
                                      {message.comments.map(comment => (
                                        <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:bg-gray-100 transition-colors group">
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                                              {(comment.user?.fullNames || 'U').split(' ').map((n: string) => n[0]).join('')}
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{comment.user?.fullNames || 'Unknown User'}</span>
                                                <span className="text-sm text-gray-500">
                                                  {new Date(comment.timestamp).toLocaleDateString()} at {new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="relative">
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                  // Toggle options menu
                                                }}
                                              >
                                                <MoreVertical size={14} />
                                              </Button>
                                              <div className="hidden group-hover:block absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                                <button
                                                  onClick={() => {
                                                    setEditingCommentId(comment.id);
                                                    setEditingCommentContent(comment.text || '');
                                                  }}
                                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-2 rounded-t-lg"
                                                >
                                                  <Edit size={12} />
                                                  Edit
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    if (window.confirm('Delete this comment?')) {
                                                      handleDeleteComment(comment.id);
                                                    }
                                                  }}
                                                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs text-red-600 flex items-center gap-2 rounded-b-lg"
                                                >
                                                  <Trash size={12} />
                                                  Delete
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          <p className="text-gray-700 leading-relaxed">{comment.text}</p>

                                          {/* Comment Edit Mode */}
                                          {editingCommentId === comment.id && (
                                            <div className="mb-3 space-y-2">
                                              <textarea
                                                value={editingCommentContent}
                                                onChange={(e) => setEditingCommentContent(e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                rows={2}
                                              />
                                              <div className="flex gap-2">
                                                <Button
                                                  size="sm"
                                                  onClick={() => {
                                                    handleEditComment(comment.id, editingCommentContent);
                                                    setEditingCommentId(null);
                                                    setEditingCommentContent('');
                                                  }}
                                                >
                                                  Save
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setEditingCommentId(null);
                                                    setEditingCommentContent('');
                                                  }}
                                                >
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Comment Actions */}
                                          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
                                            <button
                                              onClick={() => handleCommentLike(comment.id)}
                                              className={`flex items-center gap-1 text-sm transition-colors ${
                                                commentLikes[comment.id]
                                                  ? 'text-red-500'
                                                  : 'text-gray-500 hover:text-red-500'
                                              }`}
                                            >
                                              <Heart size={14} className={commentLikes[comment.id] ? 'fill-current' : ''} />
                                              <span>Like</span>
                                            </button>
                                            <button
                                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
                                            >
                                              <MessageCircle size={14} />
                                              <span>Reply</span>
                                            </button>
                                            <button
                                              onClick={() => handleCommentShare(comment.id)}
                                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-500 transition-colors"
                                            >
                                              <Share size={14} />
                                              <span>Share</span>
                                            </button>
                                          </div>

                                          {/* Reply Input */}
                                          {replyingTo === comment.id && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                              <div className="flex gap-2">
                                                <Input
                                                  placeholder="Write a reply..."
                                                  value={replyText}
                                                  onChange={(e) => setReplyText(e.target.value)}
                                                  onKeyPress={(e) => {
                                                    if (e.key === "Enter") {
                                                      handleReply(comment.id, replyText);
                                                    }
                                                  }}
                                                  className="flex-1"
                                                />
                                                <Button
                                                  onClick={() => handleReply(comment.id, replyText)}
                                                  size="sm"
                                                >
                                                  Reply
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  onClick={() => {
                                                    setReplyingTo(null);
                                                    setReplyText('');
                                                  }}
                                                  size="sm"
                                                >
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Replies */}
                                          {comment.replies && comment.replies.length > 0 && (
                                            <div className="mt-4 ml-8 space-y-3">
                                              {comment.replies.map(reply => (
                                                <div key={reply.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                                  <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                                      {(reply.user?.fullNames || 'U').split(' ').map((n: string) => n[0]).join('')}
                                                    </div>
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900 text-sm">{reply.user?.fullNames || 'Unknown'}</span>
                                                        <span className="text-sm text-gray-500">
                                                          {new Date(reply.timestamp).toLocaleDateString()} at {new Date(reply.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <p className="text-sm text-gray-700 leading-relaxed">{reply.text}</p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Regular message
                        const isOwn = message.senderId === user?.id;
                        const isGroup = selectedConversation?.type === 'group';
                        const isDirect = selectedConversation?.type === 'direct';
                        return (
                          <div
                            key={message.id}
                            className={`flex items-end gap-2 ${
                              isOwn ? "justify-end" : "justify-start"
                            }`}
                          >
                            {!isOwn && !isDirect && (
                              <div className="w-8 h-8 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {message.sender?.fullNames?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                              </div>
                            )}
                            <div className="flex flex-col max-w-xs lg:max-w-md">
                              {!isOwn && isGroup && (
                                <span className="text-xs text-gray-500 mb-1 ml-1">
                                  {message.sender?.fullNames || 'User'}
                                </span>
                              )}
                              <div
                                className={`px-4 py-3 rounded-2xl shadow-sm max-w-xs lg:max-w-md ${
                                  isOwn
                                    ? "bg-[#3363AD] text-white rounded-br-md"
                                    : "bg-white text-gray-900 rounded-bl-md border border-gray-200"
                                }`}
                              >
                                {message.type === 'text' && <p className="text-sm leading-relaxed">{message.content}</p>}
                                {message.type === 'image' && message.attachments && message.attachments.length > 0 && (
                                  <div className="rounded-lg overflow-hidden border border-gray-200">
                                    <img src={message.attachments[0].url} alt="Shared image" className="max-w-full h-auto" />
                                    {message.content && <p className="text-sm mt-2 p-2 bg-gray-50 rounded">{message.content}</p>}
                                  </div>
                                )}
                                {message.type === 'video' && message.attachments && message.attachments.length > 0 && (
                                  <div className="rounded-lg overflow-hidden border border-gray-200">
                                    <video controls className="max-w-full h-auto">
                                      <source src={message.attachments[0].url} type="video/mp4" />
                                    </video>
                                    {message.content && <p className="text-sm mt-2 p-2 bg-gray-50 rounded">{message.content}</p>}
                                  </div>
                                )}
                                {message.type === 'audio' && message.attachments && message.attachments.length > 0 && (
                                  <div className="rounded-lg overflow-hidden border border-gray-200 p-3 bg-gray-50">
                                    <audio controls className="w-full">
                                      <source src={message.attachments[0].url} type="audio/mpeg" />
                                    </audio>
                                    {message.content && <p className="text-sm mt-2">{message.content}</p>}
                                  </div>
                                )}
                                {message.type === 'file' && message.attachments && message.attachments.length > 0 && (
                                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                                    <FileText size={20} className="text-gray-600" />
                                    <a href={message.attachments[0].url} className="text-blue-600 hover:text-blue-800 font-medium underline" target="_blank" rel="noopener noreferrer">
                                      {message.title || 'File'}
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center justify-end mt-2">
                                  <span
                                    className={`text-xs flex items-center gap-1 ${
                                      isOwn ? "text-blue-200" : "text-gray-500"
                                    }`}
                                  >
                                    {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                    {isOwn && <CheckCheck size={12} className="text-blue-200" />}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {isOwn && !isDirect && (
                              <div className="w-8 h-8 bg-[#3363AD] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {user?.fullNames?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                              </div>
                            )}
                          </div>
                        );
                      }
                    })}
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full min-h-96 text-center">
                        <div className="space-y-2">
                          <MessageSquare size={48} className="mx-auto text-gray-300" />
                          <p className="text-gray-500 font-medium">No messages yet</p>
                          <p className="text-xs text-gray-400">Start a conversation by sending a message</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleSendMessage();
                      }}
                    />
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSearchModal(true)}
                      title="Search messages"
                    >
                      <Search size={20} />
                    </Button>
                    <Button onClick={handleSendMessage}>
                      <Send size={20} />
                    </Button>
                  </div>
                  {typingUsers.length > 0 && (
                    <div className="text-xs text-gray-500 italic">
                      {typingUsers.map((u) => u.userName || u.userId).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Group</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <Input 
                    placeholder="Enter group name" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <Input 
                    placeholder="Enter group description" 
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Members
                  </label>
                  <div className="border rounded-md p-2 max-h-64 overflow-y-auto hide-scrollbar">
                    {availableUsers.length === 0 ? (
                      <p className="text-sm text-gray-500">No users available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableUsers.map((user) => (
                          <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input 
                              type="checkbox" 
                              className="rounded"
                              checked={selectedGroupMembers.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGroupMembers([...selectedGroupMembers, user.id]);
                                } else {
                                  setSelectedGroupMembers(selectedGroupMembers.filter(m => m !== user.id));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{user.fullNames}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateGroup(false);
                    setGroupName("");
                    setGroupDescription("");
                    setSelectedGroupMembers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    if (!groupName.trim()) {
                      toast.error("Please enter a group name");
                      return;
                    }
                    await handleCreateGroup(groupName, selectedGroupMembers);
                    setShowCreateGroup(false);
                    setGroupName("");
                    setGroupDescription("");
                    setSelectedGroupMembers([]);
                  }}
                >
                  Create Group
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Community</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Community Name
                  </label>
                  <Input 
                    placeholder="Enter community name" 
                    value={communityName}
                    onChange={(e) => setCommunitName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <Input 
                    placeholder="Enter community description" 
                    value={communityDescription}
                    onChange={(e) => setCommunitDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <Input 
                    placeholder="e.g., Training, Support, General" 
                    value={communityCategory}
                    onChange={(e) => setCommunitCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isCommunityPublic}
                      onChange={(e) => setIsCommunityPublic(e.target.checked)}
                      className="rounded" 
                    />
                    <span className="text-sm font-medium text-gray-700">Public Community</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Moderators
                  </label>
                  <div className="border rounded-md p-2 max-h-64 overflow-y-auto hide-scrollbar">
                    {availableUsers.length === 0 ? (
                      <p className="text-sm text-gray-500">No users available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableUsers.map((user) => (
                          <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input 
                              type="checkbox" 
                              className="rounded"
                              checked={selectedModerators.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedModerators([...selectedModerators, user.id]);
                                } else {
                                  setSelectedModerators(selectedModerators.filter(m => m !== user.id));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{user.fullNames}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateCommunity(false);
                    setCommunitName("");
                    setCommunitDescription("");
                    setCommunitCategory("");
                    setSelectedModerators([]);
                    setIsCommunityPublic(true);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    if (!communityName.trim()) {
                      toast.error("Please enter a community name");
                      return;
                    }
                    await handleCreateCommunity(communityName, isCommunityPublic, selectedModerators);
                    setShowCreateCommunity(false);
                    setCommunitName("");
                    setCommunitDescription("");
                    setCommunitCategory("");
                    setSelectedModerators([]);
                    setIsCommunityPublic(true);
                  }}
                >
                  Create Community
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Participant Panel */}
      {showParticipantPanel && selectedConversation && selectedConversation.type !== 'direct' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Participants ({selectedConversation.participants.length})</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {selectedConversation.participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#3363AD] text-white rounded-full flex items-center justify-center text-xs font-medium">
                        {participant.user?.fullNames?.split(" ")[0]?.[0] || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{participant.user?.fullNames || "Unknown"}</p>
                        <p className="text-xs text-gray-500">{participant.user?.phoneNumber || "No phone"}</p>
                      </div>
                    </div>
                    {participant.userId !== user?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleRemoveParticipant(participant.userId);
                          setShowParticipantPanel(false);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Input
                  placeholder="Enter user ID to add..."
                  value={selectedUserForDirectChat}
                  onChange={(e) => setSelectedUserForDirectChat(e.target.value)}
                />
                <Button
                  onClick={() => {
                    if (selectedUserForDirectChat.trim()) {
                      handleAddParticipant(selectedUserForDirectChat);
                      setSelectedUserForDirectChat("");
                      toast.success("Participant added");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowParticipantPanel(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Conversation Settings */}
      {showConversationSettings && selectedConversation && selectedConversation.type !== 'direct' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Conversation Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversation Name
                  </label>
                  <Input 
                    value={newConversationName || selectedConversation.name || ""}
                    onChange={(e) => setNewConversationName(e.target.value)}
                    placeholder="Enter new name"
                  />
                </div>
                {selectedConversation.type === 'community' && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedConversation.isPublic}
                        className="rounded" 
                        disabled
                      />
                      <span className="text-sm font-medium text-gray-700">Public Community</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowConversationSettings(false);
                    setNewConversationName("");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (newConversationName) {
                      handleUpdateConversation(newConversationName);
                      setShowConversationSettings(false);
                      setNewConversationName("");
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search Messages Modal */}
      {showSearchModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Search Messages</h3>
              <div className="space-y-4">
                <Input
                  placeholder="Search in conversation..."
                  icon={<Search size={20} />}
                  value={searchMessagesQuery}
                  onChange={(e) => setSearchMessagesQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearchMessages(searchMessagesQuery, selectedConversation.id);
                    }
                  }}
                />
                <Button
                  className="w-full"
                  onClick={() => {
                    handleSearchMessages(searchMessagesQuery, selectedConversation.id);
                  }}
                >
                  Search
                </Button>
                {messages.length > 0 && (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    <p className="text-sm text-gray-600">Found {messages.length} results</p>
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-3 border rounded-lg hover:bg-gray-50">
                        <p className="text-sm font-medium">{msg.sender?.fullNames || "Unknown"}</p>
                        <p className="text-sm text-gray-600 truncate">{msg.content}</p>
                        <p className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowSearchModal(false);
                    setSearchMessagesQuery("");
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Direct Chat Modal */}
      {showDirectChatCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Start Direct Chat</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select User
                  </label>
                  <div className="border rounded-md max-h-64 overflow-y-auto hide-scrollbar">
                    {availableUsers.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center">No users available</div>
                    ) : (
                      <div className="divide-y">
                        {availableUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => setSelectedUserForDirectChat(user.id)}
                            className={`w-full text-left p-3 hover:bg-blue-50 transition-colors ${
                              selectedUserForDirectChat === user.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#3363AD] text-white rounded-full flex items-center justify-center font-medium text-sm">
                                {user.fullNames?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{user.fullNames}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDirectChatCreator(false);
                    setSelectedUserForDirectChat("");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    if (selectedUserForDirectChat.trim()) {
                      await handleCreateDirectChat(selectedUserForDirectChat);
                      setShowDirectChatCreator(false);
                      setSelectedUserForDirectChat("");
                    } else {
                      toast.error("Please select a user");
                    }
                  }}
                >
                  Create Chat
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};
