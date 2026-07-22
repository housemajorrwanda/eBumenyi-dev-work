import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import {
  MessageSquare,
  Search,
  MoreVertical,
  Users,
  CheckCheck,
  Heart,
  Share,
  Clock,
  MessageCircle,
  Edit,
  Trash,
  Pencil,
  Plus,
  X,
  Check,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { IConversation, IMessage, ConversationType, ICommentThread, IUser, IAttachment } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import { conversationAvatarColor, realPhoto } from "@/components/messaging/avatarStyles";
import {
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  markDirectMessageRead,
  toggleDirectMessageLike,
  getDirectChatMessages,
  searchDirectChatMessages,
} from "@/services/directChat.service";
import {
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  markGroupMessageRead,
  addGroupParticipant,
  removeGroupParticipant,
  toggleGroupMessageLike,
  deleteGroup,
  getGroupMessages,
  searchGroupMessages,
} from "@/services/groupChat.service";
import {
  togglePostLike,
  addPostComment,
  editCommunityComment,
  deleteCommunityComment,
  addCommunityMember,
  removeCommunityMember,
  createCommunityPost,
  editCommunityPost,
  deleteCommunityPost,
  deleteCommunity,
  ICommunityPostRaw,
  getCommunityPosts,
  searchCommunityPosts,
} from "@/services/community.service";
import { IDirectMessageRaw } from "@/services/directChat.service";
import { normalizeMessage, normalizeCommunityPost, stringifyAttachments } from "@/services/messaging.adapter";
import { getAllUsersNopagination } from "@/services/users.api";
import { ConversationListItem } from "@/components/messaging/ConversationListItem";
import { ChatHeader } from "@/components/messaging/ChatHeader";
import { ContactInfoPanel } from "@/components/messaging/ContactInfoPanel";
import { MessageComposer } from "@/components/messaging/MessageComposer";
import { TypingIndicator } from "@/components/messaging/TypingIndicator";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { CommunityComment } from "@/components/messaging/CommunityComment";
import { MessageMedia } from "@/components/messaging/media/MessageMedia";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { uploadImage } from "@/services/uploader.api";
import {
  useGetConversations,
  useCreateConversation,
  useUpdateConversation,
  useGetMessages,
  useInvalidateConversations,
} from "@/hooks/useConversations";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import {
  initializeNamespaceSockets,
  joinConversationRoom,
  leaveConversationRoom,
  onNewMessage,
  onMessageEdited,
  onMessageDeleted,
  onUserTyping,
  onMessageLiked,
  onCommentAdded,
  emitTyping,
  IRawMessagePayload,
} from "@/hooks/useSocket";
import toast from "react-hot-toast";

export const Messaging: React.FC = () => {
  const { user } = useAuth();
  // Own-message avatars must match the top bar exactly, so pull from the same live-fetched
  // source it uses rather than the possibly-stale JWT-cached user.photo.
  const { photoUrl: ownPhotoUrl } = useProfilePhoto();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Local state first
  const [activeTab, setActiveTab] = useState<ConversationType>("direct");
  const [selectedConversation, setSelectedConversation] =
    useState<IConversation | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{userId: string, userName: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // React Query hooks (after state declaration)
  const { data: conversations = [] } = useGetConversations();
  // No `= []` default here on purpose — that literal is a new array every render while
  // `data` is undefined (loading), which would make the sync effect below re-fire forever
  // once it depends on `messagesData`. `undefined` stays referentially stable instead.
  const { data: messagesData } = useGetMessages(
    selectedConversation?.id || null,
    selectedConversation?.type
  );
  const createConversationMutation = useCreateConversation();
  const updateConversationMutation = useUpdateConversation();
  const { invalidateConversations } = useInvalidateConversations();
  const { data: unreadCounts } = useUnreadCounts();
  const unreadByConversationId = unreadCounts?.unreadByConversationId || {};
  const { onlineUserIds, requestUserStatus } = useNotificationsContext();

  // Explicitly type conversations to ensure filter works
  const typedConversations: IConversation[] = Array.isArray(conversations) ? conversations : [];

  // Sum of unread message counts per tab — same unit as the sidebar nav badge and each
  // conversation's own list-item badge, so all three numbers stay consistent with each other.
  const unreadMessageCountByType = (type: ConversationType): number =>
    typedConversations
      .filter((c) => c.type === type)
      .reduce((sum, c) => sum + (unreadByConversationId[c.id] || 0), 0);

  // Keep the selected conversation's lightweight fields (muted, name, participants) in sync
  // with the live list — e.g. after a mute toggle — without disturbing loaded messages.
  useEffect(() => {
    if (!selectedConversation) return;
    const fresh = typedConversations.find((c) => c.id === selectedConversation.id);
    if (fresh && fresh !== selectedConversation && JSON.stringify(fresh) !== JSON.stringify(selectedConversation)) {
      setSelectedConversation(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedConversations]);

  // Post interaction states
  const [postLikes, setPostLikes] = useState<{[key: string]: boolean}>({});
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentingOn, setCommentingOn] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // Sync messages from React Query whenever the query resolves for the selected conversation.
  // Must depend on messagesData too — otherwise this only fires the instant a conversation is
  // selected (still-empty default), and never again once the query actually resolves.
  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      return;
    }

    const typedMessagesData = Array.isArray(messagesData) ? messagesData : [];
    setMessages(typedMessagesData);
    // Scroll to bottom after state update
    setTimeout(() => scrollToBottom(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, messagesData]);

  // Ask the server for the other participant's live status when opening a direct chat —
  // covers the case where they were already online before this client connected, since
  // the user:online broadcast only fires at the moment a connection happens. Re-poll
  // periodically too, as a resilience net in case a broadcast is ever missed (e.g. a
  // brief socket reconnect) — this way presence self-corrects instead of sticking wrong.
  useEffect(() => {
    if (selectedConversation?.type !== "direct") return;
    const otherUserId = selectedConversation.participants[0]?.userId;
    if (!otherUserId) return;

    requestUserStatus([otherUserId]);
    const interval = setInterval(() => requestUserStatus([otherUserId]), 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, selectedConversation?.type]);

  // Initialize Socket.IO and setup listeners
  useEffect(() => {
    if (!selectedConversation?.id || !selectedConversation.type) return;
    const { id: conversationId, type } = selectedConversation;

    initializeNamespaceSockets();
    joinConversationRoom(type, conversationId);

    const toIMessage = (raw: IRawMessagePayload): IMessage =>
      type === "community"
        ? normalizeCommunityPost(raw as ICommunityPostRaw, conversationId)
        : normalizeMessage(raw as IDirectMessageRaw, conversationId);

    // Setup listeners for messages
    const unsubscribeNewMessage = onNewMessage(type, (raw) => {
      const message = toIMessage(raw);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      scrollToBottom();
      invalidateConversations();
    });

    const unsubscribeMessageEdited = onMessageEdited(type, (raw) => {
      const updatedMessage = toIMessage(raw);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg))
      );
    });

    const unsubscribeMessageDeleted = onMessageDeleted(type, (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    // Setup listener for typing indicators
    const unsubscribeUserTyping = onUserTyping(type, (data) => {
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
    const unsubscribeMessageLiked = onMessageLiked(type, (data: { messageId?: string; postId?: string; likeCount: number; liked?: boolean; userId?: string }) => {
      const id = data.messageId || data.postId;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? { ...msg, likes: data.likeCount, ...(data.userId === user?.id ? { isLikedByMe: data.liked } : {}) }
            : msg
        )
      );
    });

    // Setup listener for comments (group/community only)
    const unsubscribeCommentAdded = onCommentAdded(type, (comment: ICommentThread) => {
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
      leaveConversationRoom(type, conversationId);
    };
  }, [selectedConversation?.id, selectedConversation?.type]);

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
      if (!selectedConversation) return;
      await togglePostLike(selectedConversation.id, postId);
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

  // Recursively insert `newReply` under the comment with id `parentId`, at any depth.
  const insertReplyIntoTree = (
    comments: ICommentThread[],
    parentId: string,
    newReply: ICommentThread,
  ): ICommentThread[] =>
    comments.map((comment) =>
      comment.id === parentId
        ? { ...comment, replies: [...(comment.replies || []), newReply] }
        : comment.replies && comment.replies.length > 0
        ? { ...comment, replies: insertReplyIntoTree(comment.replies, parentId, newReply) }
        : comment,
    );

  // Recursively update the text of the comment with id `commentId`, at any depth.
  const updateCommentInTree = (
    comments: ICommentThread[],
    commentId: string,
    newText: string,
  ): ICommentThread[] =>
    comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, text: newText }
        : comment.replies && comment.replies.length > 0
        ? { ...comment, replies: updateCommentInTree(comment.replies, commentId, newText) }
        : comment,
    );

  // Recursively remove the comment with id `commentId` (and its nested replies), at any depth.
  const removeCommentFromTree = (
    comments: ICommentThread[],
    commentId: string,
  ): ICommentThread[] =>
    comments
      .filter((comment) => comment.id !== commentId)
      .map((comment) =>
        comment.replies && comment.replies.length > 0
          ? { ...comment, replies: removeCommentFromTree(comment.replies, commentId) }
          : comment,
      );

  const handleReplyAdded = (postId: string, parentId: string, newReply: ICommentThread) => {
    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        message.id === postId && message.comments
          ? ({ ...message, comments: insertReplyIntoTree(message.comments, parentId, newReply) } as IMessage)
          : message,
      ),
    );
  };

  const handleAddComment = async (postId: string, commentContent: string) => {
    if (!commentContent.trim() || !selectedConversation) return;

    setCommentingOn(null);
    setNewCommentText('');

    // Send comment via API, then reflect the persisted comment in the UI
    try {
      const created = await addPostComment(postId, { text: commentContent });

      const newComment: ICommentThread = {
        id: created.id,
        messageId: postId,
        userId: created.userId,
        text: created.text,
        timestamp: created.timestamp,
        user: created.user
          ? { id: created.user.id, fullNames: created.user.fullNames, photo: created.user.photo ?? undefined }
          : undefined,
        replies: [],
      };

      setMessages(prevMessages =>
        prevMessages.map(message => {
          if (message.id === postId && message.type === 'blog') {
            return {
              ...message,
              comments: [...(message.comments || []), newComment]
            } as IMessage;
          }
          return message;
        })
      );
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    }
  };

  // Typing indicator handler
  const handleTyping = useCallback((isTyping: boolean = true) => {
    if (!selectedConversation) return;
    
    try {
      emitTyping(selectedConversation.type, selectedConversation.id, isTyping, user?.fullNames);
    } catch (error) {
      console.error("Failed to emit typing:", error);
    }
  }, [selectedConversation, user?.fullNames]);

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

  // Select a conversation — joining its socket room is handled by the effect above
  const handleSelectConversation = useCallback((conversation: IConversation) => {
    setSelectedConversation(conversation);
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
  // New state for unused handlers
  const [showParticipantPanel, setShowParticipantPanel] = useState(false);
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchMessagesQuery, setSearchMessagesQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showDirectChatCreator, setShowDirectChatCreator] = useState(false);
  const [selectedUserForDirectChat, setSelectedUserForDirectChat] = useState<string>("");
  const [newConversationName, setNewConversationName] = useState("");
  const [newConversationPhotoFile, setNewConversationPhotoFile] = useState<File | null>(null);
  const [newConversationPhotoPreview, setNewConversationPhotoPreview] = useState<string>("");
  const [isSavingConversationSettings, setIsSavingConversationSettings] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<IUser[]>([]);
  const [groupPhotoFile, setGroupPhotoFile] = useState<File | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState<string>("");
  const [communityPhotoFile, setCommunityPhotoFile] = useState<File | null>(null);
  const [communityPhotoPreview, setCommunityPhotoPreview] = useState<string>("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  // Communities are blog-style and require a title; derive one from the quick-message text
  // so the plain chat composer can still post into a community.
  const addCommunityPostAsMessage = (communityId: string, content: string, attachments?: string) => {
    const title = content.length > 60 ? `${content.slice(0, 57)}...` : content || "Attachment";
    return createCommunityPost(communityId, { title, content, attachments });
  };

  const handleSendMessage = async (attachments: IAttachment[] = []) => {
    if (!newMessage.trim() && attachments.length === 0) return;
    if (!selectedConversation) return;

    const messageType = attachments.length > 0 ? attachments[0].type : "text";
    const messageText = newMessage;
    const attachmentsJson = stringifyAttachments(attachments);

    const message: IMessage = {
      id: Date.now().toString(),
      senderId: user?.id || "",
      type: messageType,
      content: messageText,
      attachments,
      timestamp: new Date().toISOString(),
      conversationId: selectedConversation.id,
    };

    // Add to UI immediately (optimistic update)
    setMessages([...messages, message]);
    setNewMessage("");

    // Send via API — the REST handler broadcasts message:created itself (received by our
    // own socket too), so replace the optimistic placeholder with the persisted message
    // instead of also relying on the echo, to avoid a visible duplicate.
    try {
      let persisted: IMessage;
      if (selectedConversation.type === "direct") {
        const raw = await sendDirectMessage(selectedConversation.id, {
          type: messageType,
          content: messageText,
          attachments: attachmentsJson,
        });
        persisted = normalizeMessage(raw, selectedConversation.id);
      } else if (selectedConversation.type === "group") {
        const raw = await sendGroupMessage(selectedConversation.id, {
          type: messageType,
          content: messageText,
          attachments: attachmentsJson,
        });
        persisted = normalizeMessage(raw, selectedConversation.id);
      } else {
        const raw = await addCommunityPostAsMessage(selectedConversation.id, messageText, attachmentsJson);
        persisted = normalizeCommunityPost(raw, selectedConversation.id);
      }
      setMessages((prev) => {
        // The socket echo for this same message may have already arrived (and been appended
        // under its real id, but with an incomplete payload — e.g. no joined sender/author)
        // before this REST response resolved. Prefer this REST-derived `persisted` copy (it
        // has the full data) over both the optimistic placeholder and any partial socket copy.
        const withoutDuplicates = prev.filter((msg) => msg.id !== message.id && msg.id !== persisted.id);
        return [...withoutDuplicates, persisted];
      });
      invalidateConversations();
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove the failed message from UI
      setMessages((prev) => prev.filter((msg) => msg.id !== message.id));
      toast.error("Failed to send message");
    }
  };

  // Edit message handler - now integrated with UI
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim() || !selectedConversation) return;

    try {
      if (selectedConversation.type === "direct") {
        await editDirectMessage(selectedConversation.id, messageId, newContent);
      } else if (selectedConversation.type === "group") {
        await editGroupMessage(selectedConversation.id, messageId, newContent);
      } else {
        await editCommunityPost(selectedConversation.id, messageId, {
          title: messages.find((m) => m.id === messageId)?.title || "",
          content: newContent,
        });
      }

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
    if (!selectedConversation) return;

    try {
      if (selectedConversation.type === "direct") {
        await deleteDirectMessage(selectedConversation.id, messageId);
      } else if (selectedConversation.type === "group") {
        await deleteGroupMessage(selectedConversation.id, messageId);
      } else {
        await deleteCommunityPost(selectedConversation.id, messageId);
      }

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  };

  // Toggle like on a regular (direct/group) message — community posts use handlePostLike.
  const handleToggleMessageLike = async (messageId: string) => {
    if (!selectedConversation || selectedConversation.type === "community") return;
    try {
      const result =
        selectedConversation.type === "direct"
          ? await toggleDirectMessageLike(selectedConversation.id, messageId)
          : await toggleGroupMessageLike(selectedConversation.id, messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, likes: result.likeCount, isLikedByMe: result.liked } : msg
        )
      );
    } catch (error) {
      console.error("Failed to toggle like:", error);
      toast.error("Failed to like message");
    }
  };

  // Mark message as read handler
  const handleMarkAsRead = async (messageId: string, skipInvalidate = false) => {
    if (!selectedConversation) return;
    try {
      if (selectedConversation.type === "direct") {
        await markDirectMessageRead(selectedConversation.id, messageId);
      } else if (selectedConversation.type === "group") {
        await markGroupMessageRead(selectedConversation.id, messageId);
      }
      // Communities track reads via visit-tracking, not per-post reads.
      if (!skipInvalidate) invalidateConversations();
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  };

  // Edit comment handler (community post comments only) - updates the comment at any nesting depth
  const handleEditComment = async (postId: string, commentId: string, newText: string) => {
    if (!newText.trim()) return;

    try {
      await editCommunityComment(commentId, newText);
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === postId && message.comments
            ? ({ ...message, comments: updateCommentInTree(message.comments, commentId, newText) } as IMessage)
            : message,
        ),
      );
      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to edit comment:", error);
      toast.error("Failed to edit comment");
    }
  };

  // Delete comment handler (community post comments only) - removes the comment at any nesting depth
  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteCommunityComment(commentId);
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === postId && message.comments
            ? ({ ...message, comments: removeCommentFromTree(message.comments, commentId) } as IMessage)
            : message,
        ),
      );
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
      if (selectedConversation.type === "group") {
        await addGroupParticipant(selectedConversation.id, userId);
      } else if (selectedConversation.type === "community") {
        await addCommunityMember(selectedConversation.id, userId);
      }
      toast.success("Participant added");
    } catch (error) {
      console.error("Failed to add participant:", error);
      toast.error("Failed to add participant");
    }
  };

  // Remove participant handler - now integrated
  const handleRemoveParticipant = async (userId: string) => {
    if (!selectedConversation) return;

    try {
      if (selectedConversation.type === "group") {
        await removeGroupParticipant(selectedConversation.id, userId);
      } else if (selectedConversation.type === "community") {
        await removeCommunityMember(selectedConversation.id, userId);
      }
      toast.success("Participant removed");
    } catch (error) {
      console.error("Failed to remove participant:", error);
      toast.error("Failed to remove participant");
    }
  };

  // Leave a group/community — same self-vs-other-aware endpoint as removing someone
  // else, just called with the current user's own id, then deselect the conversation.
  const handleLeaveConversation = async () => {
    if (!selectedConversation || !user?.id) return;
    try {
      if (selectedConversation.type === "group") {
        await removeGroupParticipant(selectedConversation.id, user.id);
      } else if (selectedConversation.type === "community") {
        await removeCommunityMember(selectedConversation.id, user.id);
      }
      toast.success(`Left ${selectedConversation.type}`);
      setShowParticipantPanel(false);
      setSelectedConversation(null);
      invalidateConversations();
    } catch (error) {
      console.error("Failed to leave conversation:", error);
      toast.error("Failed to leave");
    }
  };

  // Delete a group/community — creator-only, enforced server-side too.
  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    try {
      if (selectedConversation.type === "group") {
        await deleteGroup(selectedConversation.id);
      } else if (selectedConversation.type === "community") {
        await deleteCommunity(selectedConversation.id);
      }
      toast.success(`${selectedConversation.type === "group" ? "Group" : "Community"} deleted`);
      setShowParticipantPanel(false);
      setSelectedConversation(null);
      invalidateConversations();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete");
    }
  };

  // Update conversation handler - now integrated
  const handleUpdateConversation = async (name: string, isPublic?: boolean, photo?: string) => {
    if (!selectedConversation) return;

    try {
      const updatedConversation = await updateConversationMutation.mutateAsync({
        conversationId: selectedConversation.id,
        type: selectedConversation.type,
        name,
        isPublic,
        photo,
      });

      setSelectedConversation(updatedConversation as IConversation);
      toast.success("Conversation updated");
    } catch (error) {
      console.error("Failed to update conversation:", error);
      toast.error("Failed to update conversation");
    }
  };

  // Create group handler
  const handleCreateGroup = async (groupName: string, participantIds: string[], photoFile: File | null) => {
    setIsCreatingConversation(true);
    try {
      let photo: string | undefined;
      if (photoFile) {
        const res = await uploadImage(photoFile);
        if (!res.data) throw new Error("Photo upload failed");
        photo = res.data.url;
      }
      const newConversation = await createConversationMutation.mutateAsync({
        type: "group",
        name: groupName,
        photo,
        participantIds: [user?.id || "", ...participantIds],
      });

      setSelectedConversation(newConversation as IConversation);
      toast.success("Group created");
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  // Create community handler
  const handleCreateCommunity = async (
    communityName: string,
    isPublic: boolean = true,
    participantIds: string[] = [],
    photoFile: File | null = null
  ) => {
    setIsCreatingConversation(true);
    try {
      let photo: string | undefined;
      if (photoFile) {
        const res = await uploadImage(photoFile);
        if (!res.data) throw new Error("Photo upload failed");
        photo = res.data.url;
      }
      const newConversation = await createConversationMutation.mutateAsync({
        type: "community",
        name: communityName,
        isPublic,
        photo,
        participantIds: [user?.id || "", ...participantIds],
      });

      setSelectedConversation(newConversation as IConversation);
      toast.success("Community created");
    } catch (error) {
      console.error("Failed to create community:", error);
      toast.error("Failed to create community");
    } finally {
      setIsCreatingConversation(false);
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

  // Search messages — hits the backend so results cover the conversation's full
  // history, not just whatever page happens to be loaded in `messages`.
  const runSearch = async (query: string) => {
    if (!selectedConversation || !query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const { id, type } = selectedConversation;
      let data: IMessage[] = [];
      if (type === "direct") {
        const res = await searchDirectChatMessages(id, query, 20, 0);
        data = res.data.map((m) => normalizeMessage(m, id));
      } else if (type === "group") {
        const res = await searchGroupMessages(id, query, 20, 0);
        data = res.data.map((m) => normalizeMessage(m, id));
      } else {
        const res = await searchCommunityPosts(id, query, 20, 0);
        data = res.data.map((p) => normalizeCommunityPost(p, id));
      }
      setSearchResults(data);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced as-you-type search; typing triggers this on every keystroke.
  const handleSearchMessages = (query: string) => {
    setSearchMessagesQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runSearch(query), 350);
  };

  // Jump from a search result to its place in the live conversation — fetches the page of
  // the normal message list containing that message (via its offsetInConversation), swaps
  // it into view, then scrolls to and briefly highlights the target bubble.
  const handleJumpToMessage = async (result: IMessage) => {
    if (!selectedConversation) return;
    try {
      const { id, type } = selectedConversation;
      const targetOffset = Math.max(0, (result.offsetInConversation ?? 0) - 20);
      let page: IMessage[] = [];
      if (type === "direct") {
        const res = await getDirectChatMessages(id, 50, targetOffset);
        page = res.data.map((m) => normalizeMessage(m, id));
      } else if (type === "group") {
        const res = await getGroupMessages(id, 50, targetOffset);
        page = res.data.map((m) => normalizeMessage(m, id));
      } else {
        const res = await getCommunityPosts(id, 50, targetOffset);
        page = res.data.map((p) => normalizeCommunityPost(p, id));
      }
      setMessages(page);
      setShowSearchModal(false);
      setSearchMessagesQuery("");
      setSearchResults([]);
      setTimeout(() => {
        document.getElementById(`message-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(result.id);
        setTimeout(() => setHighlightedMessageId(null), 1500);
      }, 100);
    } catch (error) {
      console.error("Failed to jump to message:", error);
      toast.error("Couldn't open that message.");
    }
  };

  // Wraps the substring of `text` matching `query` in a highlighted <mark>, for search results.
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // Search conversations handler
  const handleSearchConversations = (query: string) => {
    setSearchQuery(query);
  };

  // Reset the "already marked read" guard whenever the conversation changes.
  useEffect(() => {
    markedAsReadRef.current = new Set();
  }, [selectedConversation?.id]);

  // Mark unread messages as read as they appear in the thread (initial load, socket
  // updates, etc). Depends on `messages` itself (not just conversation id) so newly
  // arrived messages get marked too — the ref guard prevents re-marking the same ones
  // on every re-render, and invalidation fires once per batch instead of per message.
  useEffect(() => {
    if (!messages || messages.length === 0 || !selectedConversation?.id) return;

    const unreadMessages = messages.filter(
      (msg) =>
        !markedAsReadRef.current.has(msg.id) &&
        (!msg.readBy || (msg.readBy.length === 0 && msg.senderId !== user?.id))
    );

    if (unreadMessages.length === 0) return;
    unreadMessages.forEach((msg) => markedAsReadRef.current.add(msg.id));

    Promise.all(unreadMessages.map((msg) => handleMarkAsRead(msg.id, true))).then(() => {
      invalidateConversations();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedConversation?.id]);

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
    <AudioPlayerProvider>
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] h-[calc(100vh-100px)] bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
          {/* ══════════════ SIDEBAR ══════════════ */}
          <div
            className={`relative overflow-hidden flex-col h-full border-r border-gray-100 bg-white ${selectedConversation ? "hidden lg:flex" : "flex"}`}
          >
            {/* Clean white header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={15} className="text-primary" />
                </div>
                <span className="text-gray-900 font-bold text-base">My Chats</span>
              </div>
              <ProfileAvatar
                name={user?.fullNames || "You"}
                photo={realPhoto(ownPhotoUrl)}
                size="w-8 h-8"
                color="bg-primary text-white"
              />
            </div>

            {/* Search bar */}
            <div className="px-3 py-2.5">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={15} />
                </div>
                <input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearchConversations(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/40 focus:bg-white focus:shadow-sm transition-all duration-200"
                />
              </div>
            </div>

            {/* Underline Tab Navigation - matches template */}
            <div className="flex items-center px-1 border-b border-gray-100">
              {(["direct", "group", "community"] as const).map((tab) => {
                const labels = { direct: "All Chats", group: "Groups", community: "Community" };
                const count = unreadMessageCountByType(tab);
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200 ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {labels[tab]}
                    {count > 0 && (
                      <span className="min-w-[16px] h-4 px-1 bg-primary rounded-full flex items-center justify-center text-[9px] leading-none font-bold text-white">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="overflow-y-auto flex-1 hide-scrollbar">
              {typedConversations
                .filter((conv: IConversation) => conv.type === activeTab && (
                  searchQuery === "" ||
                  conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (conv.type === 'direct' && conv.participants[0]?.user?.fullNames?.toLowerCase().includes(searchQuery.toLowerCase()))
                ))
                .map((conv: IConversation) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isActive={selectedConversation?.id === conv.id}
                    isTyping={conv.type === 'direct' && typingUsers.some((u) => u.userId === conv.participants[0]?.userId)}
                    isOnline={conv.type === 'direct' ? onlineUserIds.has(conv.participants[0]?.userId || '') : undefined}
                    unreadCount={unreadByConversationId[conv.id] || 0}
                    onClick={() => handleSelectConversation(conv)}
                  />
                ))}
              {(() => {
                const tabConversations = typedConversations.filter((conv) => conv.type === activeTab);
                if (tabConversations.length === 0) {
                  return (
                    <div className="p-4 text-center text-gray-400">
                      <p className="text-sm">No {activeTab} conversations yet</p>
                      <p className="text-xs mt-1">Create one to get started</p>
                    </div>
                  );
                }
                const matchesSearch = tabConversations.some(
                  (conv) =>
                    searchQuery === "" ||
                    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (conv.type === "direct" &&
                      conv.participants[0]?.user?.fullNames?.toLowerCase().includes(searchQuery.toLowerCase())),
                );
                if (!matchesSearch) {
                  return (
                    <div className="p-4 text-center text-gray-400">
                      <p className="text-sm">No conversations match &quot;{searchQuery}&quot;</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Tab-aware floating action button */}
            <button
              onClick={() => {
                if (activeTab === "direct") setShowDirectChatCreator(true);
                else if (activeTab === "group") setShowCreateGroup(true);
                else setShowCreateCommunity(true);
              }}
              title={
                activeTab === "direct"
                  ? "New direct message"
                  : activeTab === "group"
                  ? "Create group"
                  : "Create community"
              }
              className="absolute bottom-16 right-4 z-10 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200"
            >
              <Plus size={22} />
            </button>

            {/* Footer - user info */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="relative">
                <ProfileAvatar
                  name={user?.fullNames || "You"}
                  photo={realPhoto(ownPhotoUrl)}
                  size="w-8 h-8"
                  color="bg-primary text-white"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullNames || "You"}</p>
                <p className="text-[10px] text-emerald-500 font-medium">● Active now</p>
              </div>
            </div>
          </div>

          {/* ══════════════ CHAT AREA ══════════════ */}
          <div
            className={`h-full min-h-0 overflow-hidden relative flex-col lg:flex-row ${
              selectedConversation ? "flex" : "hidden lg:flex"
            }`}
          >
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedConversation ? (
              <>
                <ChatHeader
                  conversation={selectedConversation}
                  onBack={() => setSelectedConversation(null)}
                  isOnline={
                    selectedConversation.type === "direct"
                      ? onlineUserIds.has(selectedConversation.participants[0]?.userId || "")
                      : undefined
                  }
                  onToggleSearch={() => setShowSearchModal((prev) => {
                    if (prev) {
                      setSearchMessagesQuery("");
                      setSearchResults([]);
                    }
                    return !prev;
                  })}
                  searchOpen={showSearchModal}
                  onToggleInfo={() => setShowParticipantPanel(!showParticipantPanel)}
                  infoOpen={showParticipantPanel}
                />

                {/* ══ INLINE SEARCH BAR ══ */}
                {showSearchModal && (() => {
                  // Compute match IDs from current loaded messages
                  const q = searchMessagesQuery.trim().toLowerCase();
                  const matchIds = q
                    ? messages
                        .filter((m) => m.type === "text" && m.content?.toLowerCase().includes(q))
                        .map((m) => m.id)
                    : [];
                  const total = matchIds.length;
                  const safeIdx = total > 0 ? Math.min(currentMatchIndex, total - 1) : 0;

                  const navigateTo = (idx: number) => {
                    if (total === 0) return;
                    const clamped = (idx + total) % total;
                    setCurrentMatchIndex(clamped);
                    const el = document.getElementById(`message-${matchIds[clamped]}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  };

                  return (
                    <div className="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-2.5 animate-slide-in-down flex justify-end">
                      <div className="flex items-center gap-2 max-w-xs">
                        {/* Search input */}
                        <div className="flex items-center gap-1">
                          <Search size={15} className="text-gray-400" />
                          <input
                            autoFocus
                            value={searchMessagesQuery}
                            onChange={(e) => {
                              setSearchMessagesQuery(e.target.value);
                              setCurrentMatchIndex(0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setShowSearchModal(false);
                                setSearchMessagesQuery("");
                                setSearchResults([]);
                                setCurrentMatchIndex(0);
                              }
                              if (e.key === "Enter") navigateTo(safeIdx + (e.shiftKey ? -1 : 1));
                              if (e.key === "ArrowDown") { e.preventDefault(); navigateTo(safeIdx + 1); }
                              if (e.key === "ArrowUp") { e.preventDefault(); navigateTo(safeIdx - 1); }
                            }}
                            placeholder="Search in conversation..."
                            className="w-48 pl-2 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/40 focus:bg-white transition-all duration-200"
                          />
                        </div>

                        {/* Match counter */}
                        {searchMessagesQuery.trim() && (
                          <span className={`text-xs whitespace-nowrap font-medium ${
                            total > 0 ? "text-primary" : "text-gray-400"
                          }`}>
                            {total > 0 ? `${safeIdx + 1} / ${total}` : "No matches"}
                          </span>
                        )}

                        {/* Prev */}
                        <button
                          onClick={() => navigateTo(safeIdx - 1)}
                          disabled={total === 0}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
                          title="Previous match (↑)"
                        >
                          <ChevronUp size={15} />
                        </button>

                        {/* Next */}
                        <button
                          onClick={() => navigateTo(safeIdx + 1)}
                          disabled={total === 0}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
                          title="Next match (↓)"
                        >
                          <ChevronDown size={15} />
                        </button>

                        {/* Close */}
                        <button
                          onClick={() => {
                            setShowSearchModal(false);
                            setSearchMessagesQuery("");
                            setSearchResults([]);
                            setCurrentMatchIndex(0);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                          title="Close (Esc)"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Messages */}
                <div className="flex-grow overflow-y-auto bg-[#f7f8fc] hide-scrollbar min-h-0">
                  <div className="p-4 space-y-4">
                    {messages.map((message) => {
                      if (message.type === 'blog') {
                        // Blog post style for communities
                        return (
                          <div
                            key={message.id}
                            id={`message-${message.id}`}
                            className={`bg-white rounded-xl p-6 shadow-sm border transition-shadow duration-200 hover:shadow-md ${
                              highlightedMessageId === message.id ? "ring-4 ring-yellow-300 border-gray-100" : "border-gray-100"
                            }`}
                          >
                            <div className="flex items-start gap-4 mb-4">
                              <ProfileAvatar
                                name={message.sender?.fullNames || 'User'}
                                photo={realPhoto(message.sender?.photo)}
                                size="w-12 h-12"
                                className="text-lg shadow-sm"
                                color="bg-gradient-to-br from-primary to-[#4A7BC7] text-white"
                              />
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
                                            setShowMessageOptions(null);
                                            confirm({
                                              title: "Delete message?",
                                              message: "This action cannot be undone.",
                                              variant: "danger",
                                              confirmLabel: "Delete",
                                              onConfirm: () => handleDeleteMessage(message.id),
                                            });
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

                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mb-4">
                                    <MessageMedia attachment={message.attachments[0]} variant="card" messageId={message.id} />
                                  </div>
                                )}

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
                                        {message.comments.map((comment) => (
                                          <CommunityComment
                                            key={comment.id}
                                            comment={comment}
                                            postId={message.id}
                                            currentUserId={user?.id}
                                            onReplyAdded={(parentId, reply) => handleReplyAdded(message.id, parentId, reply)}
                                            onEdit={(commentId, newText) => handleEditComment(message.id, commentId, newText)}
                                            onDelete={(commentId) => handleDeleteComment(message.id, commentId)}
                                          />
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
                        const senderName = isOwn
                          ? user?.fullNames || 'User'
                          : message.sender?.fullNames || 'User';
                        return (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={isOwn}
                            isGroup={isGroup}
                            isDirect={isDirect}
                            senderName={senderName}
                            ownPhotoUrl={ownPhotoUrl}
                            isEditing={editingMessageId === message.id}
                            editingContent={editingMessageContent}
                            onEditingContentChange={setEditingMessageContent}
                            onStartEdit={() => {
                              setEditingMessageId(message.id);
                              setEditingMessageContent(message.content || '');
                            }}
                            onSaveEdit={() => {
                              handleEditMessage(message.id, editingMessageContent);
                              setEditingMessageId(null);
                              setEditingMessageContent('');
                            }}
                            onCancelEdit={() => {
                              setEditingMessageId(null);
                              setEditingMessageContent('');
                            }}
                            onDelete={() =>
                              confirm({
                                title: "Delete message?",
                                message: "This action cannot be undone.",
                                variant: "danger",
                                confirmLabel: "Delete",
                                onConfirm: () => handleDeleteMessage(message.id),
                              })
                            }
                            onToggleLike={() => handleToggleMessageLike(message.id)}
                            highlighted={highlightedMessageId === message.id}
                            highlightText={showSearchModal && searchMessagesQuery.trim() ? searchMessagesQuery : undefined}
                            isCurrentMatch={(() => {
                              if (!showSearchModal || !searchMessagesQuery.trim()) return false;
                              const q = searchMessagesQuery.trim().toLowerCase();
                              const matchIds = messages
                                .filter((m) => m.type === "text" && m.content?.toLowerCase().includes(q))
                                .map((m) => m.id);
                              const total = matchIds.length;
                              const safeIdx = total > 0 ? Math.min(currentMatchIndex, total - 1) : 0;
                              return matchIds[safeIdx] === message.id;
                            })()}
                          />
                        );
                      }
                    })}
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full min-h-96 text-center py-16">
                        <div className="space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner">
                            <MessageSquare size={28} className="text-primary/50" />
                          </div>
                          <div>
                            <p className="text-gray-600 font-semibold text-base">No messages yet</p>
                            <p className="text-xs text-gray-400 mt-1">Say hello and start the conversation! 👋</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </div>

                <TypingIndicator users={typingUsers} />

                {/* Message Input */}
                <MessageComposer
                  value={newMessage}
                  onChange={handleInputChange}
                  onSend={handleSendMessage}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-inner">
                    <MessageSquare size={36} className="text-primary/40" />
                  </div>
                  <div>
                    <p className="text-gray-700 font-semibold text-lg">Select a conversation</p>
                    <p className="text-sm text-gray-400 mt-1">Choose from your chats to start messaging</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {showParticipantPanel && selectedConversation && (
            <div className="absolute inset-0 z-10 bg-white lg:static lg:inset-auto lg:z-auto">
            <ContactInfoPanel
              conversation={selectedConversation}
              onClose={() => setShowParticipantPanel(false)}
              onSearchInConversation={() => setShowSearchModal(true)}
              onAddParticipant={handleAddParticipant}
              onRemoveParticipant={(userId) =>
                confirm({
                  title: "Remove participant?",
                  message: "This action cannot be undone.",
                  variant: "danger",
                  confirmLabel: "Remove",
                  onConfirm: () => handleRemoveParticipant(userId),
                })
              }
              onEditConversation={() => setShowConversationSettings(true)}
              onLeaveConversation={handleLeaveConversation}
              onDeleteConversation={handleDeleteConversation}
              availableUsers={availableUsers}
            />
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md !rounded-2xl overflow-hidden" padding={false}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users size={20} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Create New Group</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName("");
                  setGroupDescription("");
                  setSelectedGroupMembers([]);
                  setGroupPhotoFile(null);
                  setGroupPhotoPreview("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 space-y-4">
              <div className="flex justify-center">
                <label className="relative cursor-pointer group">
                  <ProfileAvatar
                    name={groupName || "Group"}
                    photo={groupPhotoPreview || undefined}
                    size="w-20 h-20"
                    color="bg-green-500 text-white"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Pencil size={18} className="text-white" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setGroupPhotoFile(file);
                      setGroupPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Group Name
                </label>
                <Input
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description (Optional)
                </label>
                <Input
                  placeholder="Enter group description"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Add Members
                </label>
                <div className="border border-gray-200 rounded-xl p-2 max-h-64 overflow-y-auto hide-scrollbar">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No users available</p>
                  ) : (
                    <div className="space-y-1">
                      {availableUsers.map((user) => {
                        const checked = selectedGroupMembers.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-colors ${
                              checked ? "bg-primary/10" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGroupMembers([...selectedGroupMembers, user.id]);
                                } else {
                                  setSelectedGroupMembers(selectedGroupMembers.filter((m) => m !== user.id));
                                }
                              }}
                            />
                            <ProfileAvatar name={user.fullNames} size="w-8 h-8" color="bg-gray-300 text-gray-700" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{user.fullNames}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            {checked && <Check size={16} className="text-primary flex-shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName("");
                  setGroupDescription("");
                  setSelectedGroupMembers([]);
                  setGroupPhotoFile(null);
                  setGroupPhotoPreview("");
                }}
              >
                Cancel
              </Button>
              <Button
                isLoading={isCreatingConversation}
                onClick={async () => {
                  if (!groupName.trim()) {
                    toast.error("Please enter a group name");
                    return;
                  }
                  await handleCreateGroup(groupName, selectedGroupMembers, groupPhotoFile);
                  setShowCreateGroup(false);
                  setGroupName("");
                  setGroupDescription("");
                  setSelectedGroupMembers([]);
                  setGroupPhotoFile(null);
                  setGroupPhotoPreview("");
                }}
              >
                Create Group
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md !rounded-2xl overflow-hidden" padding={false}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FontAwesomeIcon icon={faUsers} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Create New Community</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateCommunity(false);
                  setCommunitName("");
                  setCommunitDescription("");
                  setCommunitCategory("");
                  setSelectedModerators([]);
                  setIsCommunityPublic(true);
                  setCommunityPhotoFile(null);
                  setCommunityPhotoPreview("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 space-y-4">
              <div className="flex justify-center">
                <label className="relative cursor-pointer group">
                  <ProfileAvatar
                    name={communityName || "Community"}
                    photo={communityPhotoPreview || undefined}
                    size="w-20 h-20"
                    color="bg-purple-500 text-white"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Pencil size={18} className="text-white" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCommunityPhotoFile(file);
                      setCommunityPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Community Name
                </label>
                <Input
                  placeholder="Enter community name"
                  value={communityName}
                  onChange={(e) => setCommunitName(e.target.value)}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description (Optional)
                </label>
                <Input
                  placeholder="Enter community description"
                  value={communityDescription}
                  onChange={(e) => setCommunitDescription(e.target.value)}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Category
                </label>
                <Input
                  placeholder="e.g., Training, Support, General"
                  value={communityCategory}
                  onChange={(e) => setCommunitCategory(e.target.value)}
                  className="bg-gray-50 border-gray-200 rounded-xl"
                />
              </div>
              <label className="flex items-center justify-between cursor-pointer border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Public Community</span>
                <input
                  type="checkbox"
                  checked={isCommunityPublic}
                  onChange={(e) => setIsCommunityPublic(e.target.checked)}
                  className="hidden"
                />
                <span
                  className={`w-10 h-6 rounded-full relative transition-colors ${isCommunityPublic ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isCommunityPublic ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </label>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Add Moderators
                </label>
                <div className="border border-gray-200 rounded-xl p-2 max-h-64 overflow-y-auto hide-scrollbar">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No users available</p>
                  ) : (
                    <div className="space-y-1">
                      {availableUsers.map((user) => {
                        const checked = selectedModerators.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-colors ${
                              checked ? "bg-primary/10" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedModerators([...selectedModerators, user.id]);
                                } else {
                                  setSelectedModerators(selectedModerators.filter((m) => m !== user.id));
                                }
                              }}
                            />
                            <ProfileAvatar name={user.fullNames} size="w-8 h-8" color="bg-gray-300 text-gray-700" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{user.fullNames}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            {checked && <Check size={16} className="text-primary flex-shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateCommunity(false);
                  setCommunitName("");
                  setCommunitDescription("");
                  setCommunitCategory("");
                  setSelectedModerators([]);
                  setIsCommunityPublic(true);
                  setCommunityPhotoFile(null);
                  setCommunityPhotoPreview("");
                }}
              >
                Cancel
              </Button>
              <Button
                isLoading={isCreatingConversation}
                onClick={async () => {
                  if (!communityName.trim()) {
                    toast.error("Please enter a community name");
                    return;
                  }
                  await handleCreateCommunity(communityName, isCommunityPublic, selectedModerators, communityPhotoFile);
                  setShowCreateCommunity(false);
                  setCommunitName("");
                  setCommunitDescription("");
                  setCommunitCategory("");
                  setCommunityPhotoFile(null);
                  setCommunityPhotoPreview("");
                  setSelectedModerators([]);
                  setIsCommunityPublic(true);
                }}
              >
                Create Community
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Participant Panel */}
      {/* Conversation Settings */}
      {showConversationSettings && selectedConversation && selectedConversation.type !== 'direct' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Conversation Settings</h3>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <label className="relative cursor-pointer group">
                    <ProfileAvatar
                      name={selectedConversation.name || "Unnamed"}
                      photo={newConversationPhotoPreview || realPhoto(selectedConversation.photo)}
                      size="w-20 h-20"
                      color={conversationAvatarColor[selectedConversation.type]}
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Pencil size={18} className="text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setNewConversationPhotoFile(file);
                        setNewConversationPhotoPreview(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                </div>
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
                    setNewConversationPhotoFile(null);
                    setNewConversationPhotoPreview("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  isLoading={isSavingConversationSettings}
                  onClick={async () => {
                    const name = newConversationName || selectedConversation.name || "";
                    if (!name) return;
                    setIsSavingConversationSettings(true);
                    try {
                      let photoUrl: string | undefined;
                      if (newConversationPhotoFile) {
                        const res = await uploadImage(newConversationPhotoFile);
                        if (!res.data) throw new Error("Upload failed");
                        photoUrl = res.data.url;
                      }
                      await handleUpdateConversation(name, undefined, photoUrl);
                      setShowConversationSettings(false);
                      setNewConversationName("");
                      setNewConversationPhotoFile(null);
                      setNewConversationPhotoPreview("");
                    } catch (error) {
                      console.error("Failed to save conversation settings:", error);
                      toast.error("Failed to upload photo");
                    } finally {
                      setIsSavingConversationSettings(false);
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


      {/* Create Direct Chat Modal */}
      {showDirectChatCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md !rounded-2xl overflow-hidden" padding={false}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare size={20} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Start Direct Chat</h3>
              </div>
              <button
                onClick={() => {
                  setShowDirectChatCreator(false);
                  setSelectedUserForDirectChat("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Select User
              </label>
              <div className="border border-gray-200 rounded-xl p-2 max-h-64 overflow-y-auto hide-scrollbar">
                {availableUsers.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">No users available</div>
                ) : (
                  <div className="space-y-1">
                    {availableUsers.map((user) => {
                      const selected = selectedUserForDirectChat === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserForDirectChat(user.id)}
                          className={`w-full text-left p-2 rounded-lg transition-colors ${
                            selected ? "bg-primary/10" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ProfileAvatar name={user.fullNames} size="w-9 h-9" color="bg-primary text-white" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{user.fullNames}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            {selected && <Check size={16} className="text-primary flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5">
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
          </Card>
        </div>
      )}
      {confirmDialog}
    </AudioPlayerProvider>
  );
};
