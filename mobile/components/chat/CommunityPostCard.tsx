import { useState, useRef, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Share,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Edit2, Trash2, Send, ChevronDown, ChevronUp, FileText, FileSpreadsheet, Presentation, File, Paperclip, Share2, Repeat2, BarChart2, Bookmark } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { getMe } from '@/services/auth';
import * as MessagingAPI from '@/services/messaging.api';
import { IMessage } from '@/types';
import { WhatsAppVideoMessage } from './WhatsAppVideoMessage';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { SocketService } from '@/services/socket.service';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface CommunityPostCardProps {
  post: IMessage & Record<string, any>;
  communityId: string;
  onEdit: (post: IMessage) => void;
  onDelete: (postId: string) => void;
  onLike: (postId: string) => Promise<void> | void;
  onCommentOpen?: () => void;
  onCommentInputFocus?: () => void;
  scrollViewRef?: React.RefObject<any>;
  onReplyModeChange?: (isReplying: boolean) => void;
  onCommentsVisibilityChange?: (isOpen: boolean) => void;
}

interface IComment {
  id: string;
  text: string;
  userId: string;
  postId: string;
  timestamp: string;
  parentId?: string | null;
  user?: { id: string; fullNames: string; photo?: string };
  replies?: IComment[];
}

// ─── Parse attachment from post ──────────────────────────────────────────────
function parseAttachment(post: IMessage & Record<string, any>) {
  let attachments = post.attachments;
  if (typeof attachments === 'string') {
    try { attachments = JSON.parse(attachments); } catch { attachments = null; }
  }
  const first = Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : null;
  if (!first) return null;

  const url: string = first.url || '';
  const name: string = first.name || first.url?.split('/').pop() || '';
  const rawType: string = first.type || '';

  const isAudio = rawType === 'audio' || /\.(m4a|mp3|wav|ogg)$/i.test(url);
  const isVideo = rawType === 'video' || /\.(mp4|mov|avi|mkv)$/i.test(url);
  const isImage = rawType === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  return { url, name, rawType, isAudio, isVideo, isImage };
}

function formatTime(timestamp: string | number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}min`;
  if (hours < 24) return `${hours}hr`;
  if (days < 7) return `${days}d`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}mo`;
  }
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export function CommunityPostCard({
  post,
  communityId,
  onEdit,
  onDelete,
  onLike,
  onCommentOpen,
  onCommentInputFocus,
  scrollViewRef,
  onReplyModeChange,
  onCommentsVisibilityChange,
}: CommunityPostCardProps) {
  // If post is deleted, render nothing
  if ((post as any).isDeleted === true) {
    return null;
  }
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<IComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [visibleRepliesCount, setVisibleRepliesCount] = useState<Record<string, number>>({});
  const [expandedNestedReplies, setExpandedNestedReplies] = useState<Record<string, boolean>>({}); // Track which replies have their nested replies expanded
  const REPLIES_PREVIEW_LIMIT = 2;
  const REPLIES_LOAD_MORE_BATCH = 5; // Load 5 more replies at a time
  const commentInputRef = useRef<TextInput>(null);
  const commentInputContainerRef = useRef<View>(null);
  const keyboardListenerRef = useRef<any>(null);
  const [isSaved, setIsSaved] = useState(
    Array.isArray((post as any).savedBy) && (post as any).savedBy.length > 0,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync with parent prop so unsaving from the profile screen reflects here
  const savedByPresent = Array.isArray((post as any).savedBy) && (post as any).savedBy.length > 0;
  useEffect(() => {
    setIsSaved(savedByPresent);
  }, [savedByPresent]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => getMe(),
    staleTime: Infinity,
  });

  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => MessagingAPI.getCommunityPostComments(post.id),
    enabled: showComments,
  });

  // Listen for real-time comment updates via Socket.io
  useEffect(() => {
    if (!showComments) return;

    const communitySocket = SocketService.getCommunitySocket();
    if (!communitySocket) return;

    const handleCommentCreated = (comment: IComment) => {
      console.log('[CommunityPostCard] 📨 comment:created received:', comment);
      if (comment.postId === post.id) {
        // Invalidate comments query to refetch with new comment
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      }
    };

    const handleCommentDeleted = (data: { commentId: string }) => {
      console.log('[CommunityPostCard] 🗑️ comment:deleted received:', data);
      // Invalidate comments query to refetch without deleted comment
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    };

    const handleCommentEdited = (comment: IComment) => {
      console.log('[CommunityPostCard] ✏️ comment:edited received:', comment);
      if (comment.postId === post.id) {
        // Invalidate comments query to refetch with edited comment
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      }
    };

    communitySocket.on('comment:created', handleCommentCreated);
    communitySocket.on('comment:deleted', handleCommentDeleted);
    communitySocket.on('comment:edited', handleCommentEdited);

    return () => {
      communitySocket.off('comment:created', handleCommentCreated);
      communitySocket.off('comment:deleted', handleCommentDeleted);
      communitySocket.off('comment:edited', handleCommentEdited);
    };
  }, [showComments, post.id, queryClient]);

  // When comments section opens, listen for keyboard dismiss to auto-close
  useEffect(() => {
    if (showComments) {
      keyboardListenerRef.current = Keyboard.addListener('keyboardDidHide', () => {
        // Auto-close comments section when keyboard dismisses
        // so ChatInput is restored at the bottom
        setShowComments(false);
        onCommentsVisibilityChange?.(false);
      });
    } else {
      keyboardListenerRef.current?.remove();
      keyboardListenerRef.current = null;
    }
    return () => {
      keyboardListenerRef.current?.remove();
      keyboardListenerRef.current = null;
    };
  }, [showComments]);

  useEffect(() => {
    if (post.id && communityId) {
      MessagingAPI.markPostAsVisited(communityId, post.id).catch(() => {});
    }
  }, []);

  const rawComments = (commentsData as any)?.data
    ?? (commentsData as any)?.comments
    ?? (commentsData as any)?.items
    ?? commentsData;
  const comments: IComment[] = Array.isArray(rawComments) ? rawComments : [];

  const isAuthor = post.authorId === currentUser?.id ||
    post.senderId === currentUser?.id;
  // likeCount comes from the denormalized counter on the post
  const likeCount = (post as any).likeCount ?? 0;
  const commentCount = (post as any).commentCount ?? 0;
  // isLiked: DB returns likes:[{id}] for current user's like, [] if not liked
  // After optimistic update, likes array is set to [{id:'server'}] or []
  const isLiked = Array.isArray((post as any).likes) && (post as any).likes.length > 0;

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !communityId) return;
    setIsSubmitting(true);
    try {
      const parentId = replyingTo?.id;
      
      await MessagingAPI.addCommunityPostComment(communityId, post.id, { 
        content: newComment.trim(),
        parentId
      });
      setNewComment('');
      setReplyingTo(null);
      onReplyModeChange?.(false);
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      // Optimistically bump commentCount in the posts cache
      queryClient.setQueriesData(
        { queryKey: ['chat', communityId, 'community'] },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data?.map((msg: any) => {
                if (msg.id !== post.id) return msg;
                return { ...msg, commentCount: (msg.commentCount ?? 0) + 1 };
              }),
            })),
          };
        }
      );
    } catch {
      Alert.alert('Ikosa', 'Ohereza igitekerezo byanze');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToComment = (comment: IComment) => {
    setReplyingTo(comment);
    onReplyModeChange?.(true); // Notify parent that we're in reply mode
    // Focus the input after a short delay to ensure keyboard opens
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  // Handle when comment input gets focus - scroll it into view
  const handleCommentInputFocus = () => {
    onCommentInputFocus?.(); // Notify parent to scroll
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Siba igitekerezo',
      'Urashaka gusiba iki gitekerezo?',
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego',
          style: 'destructive',
          onPress: async () => {
            try {
              await MessagingAPI.deleteComment(commentId, 'community');
              queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
              // Optimistically decrement commentCount in the posts cache
              queryClient.setQueriesData(
                { queryKey: ['chat', communityId, 'community'] },
                (old: any) => {
                  if (!old?.pages) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      data: page.data?.map((msg: any) => {
                        if (msg.id !== post.id) return msg;
                        return { ...msg, commentCount: Math.max(0, (msg.commentCount ?? 1) - 1) };
                      }),
                    })),
                  };
                }
              );
            } catch {
              Alert.alert('Ikosa', 'Gusiba igitekerezo byanze');
            }
          },
        },
      ]
    );
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Siba ubutumwa',
      'Urashaka gusiba ubu butumwa?',
      [
        { text: 'Oya', style: 'cancel' },
        { text: 'Yego', style: 'destructive', onPress: () => onDelete(post.id) },
      ]
    );
  };

  const handleShare = async () => {
    try {
      // Build share message
      const shareMessage = [
        `${authorName} yatanze igitekerezo:`,
        '',
        post.title ? `"${post.title}"` : '',
        post.content && post.content.length > 200 
          ? post.content.substring(0, 200) + '...' 
          : post.content || '',
        '',
        'Reba kuri eBumenyi CHW Platform',
      ].filter(Boolean).join('\n');
      
      const result = await Share.share({
        message: shareMessage,
        title: post.title || 'Igitekerezo',
      });
      
      if (result.action === Share.sharedAction) {
        Toast.show({
          type: 'success',
          text1: 'byongewe gushyirwaho',
          text2: 'Ubu butumwa bwagabanyijwe neza',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Ikosa', 'Kugabana byanze. Gerageza ukundi.');
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    // Patch the React Query cache so savedBy reflects the new state
    // even after the component remounts (same pattern as commentCount updates)
    const patchCache = (saved: boolean) => {
      queryClient.setQueriesData(
        { queryKey: ['chat', communityId, 'community'] },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data?.map((msg: any) => {
                if (msg.id !== post.id) return msg;
                return { ...msg, savedBy: saved ? [{ id: 'optimistic' }] : [] };
              }),
            })),
          };
        },
      );
    };

    patchCache(nextSaved);

    try {
      await MessagingAPI.toggleSaveCommunityPost(communityId, post.id);
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      Toast.show({
        type: 'success',
        text1: nextSaved ? 'Bitswe' : 'Gukurwa mu bibitso',
        text2: nextSaved ? 'Ubu butumwa bubitswe mu bibitso byawe' : 'Ubu butumwa buvanywe mu bibitso',
        visibilityTime: 2000,
      });
    } catch {
      setIsSaved(!nextSaved);
      patchCache(!nextSaved);
      Toast.show({
        type: 'error',
        text1: 'Ikosa',
        text2: 'Kubika ubu butumwa byanze. Gerageza ukundi.',
        visibilityTime: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReshare = async () => {
    Alert.alert(
      'Sangira ubu butumwa',
      'Urashaka kongera gutangaza ubu butumwa mu kominote?',
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego, Sangira',
          onPress: async () => {
            try {
              await MessagingAPI.resharePost(communityId, post.id);
              queryClient.invalidateQueries({ queryKey: ['chat', communityId, 'community'] });
              Toast.show({
                type: 'success',
                text1: 'byongewe gushyirwaho',
                text2: 'Ubu butumwa busangiriwe neza mu kominote',
                visibilityTime: 2500,
              });
            } catch {
              Toast.show({
                type: 'error',
                text1: 'Ikosa',
                text2: 'Gusangira byanze. Gerageza ukundi.',
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
    );
  };

  const authorName = post.sender?.fullNames || post.author?.fullNames || 'Unknown';
  const authorPhoto = post.sender?.photo || post.author?.photo;

  return (
    <View style={styles.card}>
      {(post as any).resharedFromId && (
        <View style={styles.reshareLabel}>
          <Repeat2 size={12} color="#536471" />
          <Text style={styles.reshareLabelText}>byongewe gushyirwaho</Text>
        </View>
      )}
      {/* ── Twitter/X-style layout: avatar column + content column ── */}
      <View style={styles.tweetRow}>
        {/* Left column: avatar */}
        <View style={styles.avatarColumn}>
          {authorPhoto ? (
            <Image source={{ uri: authorPhoto }} style={styles.authorAvatar} />
          ) : (
            <View style={[styles.authorAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(authorName[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Right column: header + content + media + actions */}
        <View style={styles.contentColumn}>
          {/* Header row: name · time · menu */}
          <View style={styles.tweetHeader}>
            <View style={styles.tweetMeta}>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.postTime}>
                {post.timestamp ? formatTime(post.timestamp) : ''}
              </Text>
              {post.editedAt ? <Text style={styles.editedBadge}> · byavuguruwe</Text> : null}
            </View>

            {/* ··· menu — author only */}
            {isAuthor && (
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.actionsButton}
                  onPress={() => setShowActions(!showActions)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.actionsButtonText}>···</Text>
                </TouchableOpacity>
                {showActions && (
                  <View style={styles.actionsMenu}>
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => {
                        setShowActions(false);
                        onEdit(post as IMessage);
                      }}>
                      <Edit2 size={14} color="#4D81D2" />
                      <Text style={styles.actionMenuText}>Vugurura</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => {
                        setShowActions(false);
                        handleDeletePost();
                      }}>
                      <Trash2 size={14} color="#ef4444" />
                      <Text style={[styles.actionMenuText, styles.deleteText]}>Siba</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Post title */}
          {post.title && post.title !== post.content && !/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|m4a|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i.test(post.title) && !post.title.startsWith('http') && (
            <Text style={styles.postTitle}>{post.title}</Text>
          )}

          {/* Post text */}
          {(() => {
            const isReshared = !!(post as any).resharedFromId;
            const resharedFrom = (post as any).resharedFrom;
            const attachment = parseAttachment(post);
            const contentIsFilename = attachment && post.content === attachment.name;
            // For reshares, the content field is blank; show original post text from resharedFrom
            const displayContent = isReshared
              ? (resharedFrom?.content || resharedFrom?.title || '')
              : post.content;
            const contentIsUrl = displayContent?.startsWith('http');
            const contentLooksLikeFilename = displayContent && /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|m4a|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(displayContent);
            const shouldHideContent = contentIsFilename || contentIsUrl || contentLooksLikeFilename;

            return !shouldHideContent && displayContent ? (
              <Text style={styles.postContent}>{displayContent}</Text>
            ) : null;
          })()}

          {/* ── Media / Attachment ── */}
          {(() => {
            const isReshared = !!(post as any).resharedFromId;
            const resharedFrom = (post as any).resharedFrom;

            // For reshared posts, use original post's media as source of truth
            const mediaPost = isReshared && resharedFrom ? resharedFrom : post;
            const attachment = parseAttachment(mediaPost);

            if (!attachment) {
              // Check if content is a direct media URL (common for reshared posts)
              const contentUrl = mediaPost.content || mediaPost.photo || '';
              const isContentUrl = contentUrl.startsWith('http');
              const isContentImage = isContentUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(contentUrl);
              const isContentVideo = isContentUrl && /\.(mp4|mov|avi|mkv)$/i.test(contentUrl);
              const isContentAudio = isContentUrl && /\.(m4a|mp3|wav|ogg)$/i.test(contentUrl);
              const isCloudinaryImage = isContentUrl && contentUrl.includes('cloudinary.com') && !isContentVideo && !isContentAudio;

              if (mediaPost.photo) {
                return (
                  <>
                    <TouchableOpacity
                      onPress={() => { setImageViewerUrl(mediaPost.photo); setImageViewerVisible(true); }}
                      activeOpacity={0.9}
                      style={styles.mediaWrapper}>
                      <Image source={{ uri: mediaPost.photo }} style={styles.postImage} resizeMode="cover" />
                    </TouchableOpacity>
                    <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
                      <View style={styles.imageViewerBg}>
                        <TouchableOpacity onPress={() => setImageViewerVisible(false)} style={styles.imageViewerClose}>
                          <Text style={styles.imageViewerCloseText}>✕</Text>
                        </TouchableOpacity>
                        <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImg} resizeMode="contain" />
                        <TouchableOpacity onPress={() => Linking.openURL(imageViewerUrl)} style={styles.imageViewerOpenBtn}>
                          <Text style={styles.imageViewerOpenText}>Fungura mu browser</Text>
                        </TouchableOpacity>
                      </View>
                    </Modal>
                  </>
                );
              }

              // Reshared post with media URL in content
              if (isContentImage || isCloudinaryImage) {
                return (
                  <>
                    <TouchableOpacity
                      onPress={() => { setImageViewerUrl(contentUrl); setImageViewerVisible(true); }}
                      activeOpacity={0.9}
                      style={styles.mediaWrapper}>
                      <Image source={{ uri: contentUrl }} style={styles.postImage} resizeMode="cover" />
                    </TouchableOpacity>
                    <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
                      <View style={styles.imageViewerBg}>
                        <TouchableOpacity onPress={() => setImageViewerVisible(false)} style={styles.imageViewerClose}>
                          <Text style={styles.imageViewerCloseText}>✕</Text>
                        </TouchableOpacity>
                        <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImg} resizeMode="contain" />
                        <TouchableOpacity onPress={() => Linking.openURL(imageViewerUrl)} style={styles.imageViewerOpenBtn}>
                          <Text style={styles.imageViewerOpenText}>Fungura mu browser</Text>
                        </TouchableOpacity>
                      </View>
                    </Modal>
                  </>
                );
              }

              if (isContentAudio) {
                return (
                  <View style={styles.audioWrapper}>
                    <AudioMessagePlayer url={contentUrl} messageId={post.id} isSent={false} timestamp={post.timestamp} containerStyle={styles.audioPlayerFill} />
                  </View>
                );
              }

              if (isContentVideo) {
                return (
                  <View style={styles.mediaWrapper}>
                    <WhatsAppVideoMessage
                      uri={contentUrl}
                      bubbleWidth={SCREEN_WIDTH - 80}
                      bubbleHeight={220}
                      onError={() => {
                        console.error('[CommunityPostCard] Video error:', contentUrl);
                        // WhatsAppVideoMessage shows built-in retry UI — do not redirect to browser.
                      }}
                    />
                  </View>
                );
              }

              return null;
            }

            if (attachment.isImage) {
              return (
                <>
                  <TouchableOpacity
                    onPress={() => { setImageViewerUrl(attachment.url); setImageViewerVisible(true); }}
                    activeOpacity={0.9}
                    style={styles.mediaWrapper}>
                    <Image source={{ uri: attachment.url }} style={styles.postImage} resizeMode="cover" />
                  </TouchableOpacity>
                  <Modal visible={imageViewerVisible} transparent animationType="fade" onRequestClose={() => setImageViewerVisible(false)} statusBarTranslucent>
                    <View style={styles.imageViewerBg}>
                      <TouchableOpacity onPress={() => setImageViewerVisible(false)} style={styles.imageViewerClose}>
                        <Text style={styles.imageViewerCloseText}>✕</Text>
                      </TouchableOpacity>
                      <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImg} resizeMode="contain" />
                      <TouchableOpacity onPress={() => Linking.openURL(imageViewerUrl)} style={styles.imageViewerOpenBtn}>
                        <Text style={styles.imageViewerOpenText}>Fungura mu browser</Text>
                      </TouchableOpacity>
                    </View>
                  </Modal>
                </>
              );
            }

            if (attachment.isAudio) {
              return (
                <View style={styles.audioWrapper}>
                  <AudioMessagePlayer url={attachment.url} messageId={`${post.id}-att`} isSent={false} timestamp={post.timestamp} containerStyle={styles.audioPlayerFill} />
                </View>
              );
            }

            if (attachment.isVideo) {
              return (
                <View style={styles.mediaWrapper}>
                  <WhatsAppVideoMessage
                    uri={attachment.url}
                    bubbleWidth={SCREEN_WIDTH - 80}
                    bubbleHeight={220}
                    onError={() => {
                      console.error('[CommunityPostCard] Video error (attachment):', attachment.url);
                      // WhatsAppVideoMessage shows built-in retry UI — do not redirect to browser.
                    }}
                  />
                </View>
              );
            }

            // Generic file attachment
            const ext = attachment.name.split('.').pop()?.toUpperCase() || 'FILE';
            const getFileIcon = (e: string) => {
              const el = e.toLowerCase();
              if (el === 'pdf') return { icon: FileText, color: '#ef4444' };
              if (['doc', 'docx'].includes(el)) return { icon: FileText, color: '#2563eb' };
              if (['xls', 'xlsx'].includes(el)) return { icon: FileSpreadsheet, color: '#16a34a' };
              if (['ppt', 'pptx'].includes(el)) return { icon: Presentation, color: '#ea580c' };
              if (['txt', 'csv'].includes(el)) return { icon: File, color: '#6b7280' };
              return { icon: Paperclip, color: '#6b7280' };
            };
            const fi = getFileIcon(ext);
            const FileIcon = fi.icon;
            return (
              <TouchableOpacity
                onPress={() => Linking.openURL(attachment.url)}
                activeOpacity={0.75}
                style={styles.fileAttachment}>
                <View style={[styles.fileIconWrap, { backgroundColor: `${fi.color}18` }]}>
                  <FileIcon size={24} color={fi.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentName} numberOfLines={2}>{attachment.name}</Text>
                  <View style={styles.attachmentMeta}>
                    <View style={[styles.extBadge, { backgroundColor: fi.color }]}>
                      <Text style={styles.extBadgeText}>{ext}</Text>
                    </View>
                    <Text style={styles.attachmentHint}>Kanda gufungura</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* ── Twitter/X-style action bar ── */}
          <View style={styles.tweetActions}>

            {/* Like */}
            <TouchableOpacity
              style={styles.tweetActionBtn}
              onPress={async () => {
                if (isLiking) return;
                setIsLiking(true);
                try { await onLike(post.id); }
                finally { setTimeout(() => setIsLiking(false), 1000); }
              }}
              disabled={isLiking}
              accessibilityLabel="Kunda ubu butumwa">
              <Heart
                size={18}
                color={isLiked ? '#f91880' : '#536471'}
                fill={isLiked ? '#f91880' : 'none'}
              />
              {likeCount > 0 && (
                <Text style={[styles.tweetActionCount, isLiked && { color: '#f91880' }]}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>
            {/* Reply / Comments */}
            <TouchableOpacity
              style={styles.tweetActionBtn}
              onPress={() => {
                const opening = !showComments;
                setShowComments(opening);
                onCommentsVisibilityChange?.(opening);
                if (opening) {
                  onCommentOpen?.();
                  setTimeout(() => commentInputRef.current?.focus(), 200);
                }
              }}
              accessibilityLabel="Reba ibitekerezo">
              <MessageCircle size={18} color={showComments ? '#4D81D2' : '#536471'} />
              {commentCount > 0 && (
                <Text style={[styles.tweetActionCount, showComments && { color: '#4D81D2' }]}>
                  {commentCount}
                </Text>
              )}
            </TouchableOpacity>

            {/* Reshare */}
            <TouchableOpacity
              style={styles.tweetActionBtn}
              onPress={handleReshare}
              accessibilityLabel="Sangira ubu butumwa">
              <Repeat2 size={18} color="#536471" />
            </TouchableOpacity>
            {(post as any).reshareCount > 0 && (
              <Text style={styles.tweetActionCount}>{(post as any).reshareCount}</Text>
            )}


            {/* Views */}
            <View style={styles.tweetActionBtn}>
              <BarChart2 size={18} color="#536471" />
              {(post as any).viewCount > 0 && (
                <Text style={styles.tweetActionCount}>{(post as any).viewCount}</Text>
              )}
            </View>

            {/* Bookmark + Share pushed to the right */}
            <View style={styles.tweetActionsRight}>
              <TouchableOpacity
                style={styles.tweetActionBtn}
                onPress={handleSave}
                disabled={isSaving}
                accessibilityLabel="Bika ubu butumwa">
                <Bookmark
                  size={18}
                  color={isSaved ? '#4D81D2' : '#536471'}
                  fill={isSaved ? '#4D81D2' : 'none'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tweetActionBtn}
                onPress={handleShare}
                accessibilityLabel="Ohereza">
                <Share2 size={18} color="#536471" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* ── Comments Section (full-width, below the tweet row) ── */}
      {showComments && (
        <View style={styles.commentsSection}>
          {/* Comments Header - TikTok style */}
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsHeaderText}>
              {commentCount} {commentCount === 1 ? 'igitekerezo' : 'ibitekerezo'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowComments(false);
                setReplyingTo(null); // Clear reply state when closing comments
                onReplyModeChange?.(false); // Notify parent
                onCommentsVisibilityChange?.(false); // Notify parent comments are closed
              }}
              style={styles.closeCommentsButton}>
              <Text style={styles.closeCommentsText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loadingComments ? (
            <LoadingSpinner variant="inline" message="" />
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>Nta gitekerezo. Uba uwa mbere!</Text>
          ) : (
            comments.map((comment, index) => (
              <View key={comment.id}>
                {/* Top-level comment */}
                <View style={styles.commentItem}>
                  {comment.user?.photo ? (
                    <Image source={{ uri: comment.user.photo }} style={styles.commentAvatar} />
                  ) : (
                    <View style={[styles.commentAvatar, styles.avatarFallback]}>
                      <Text style={[styles.avatarInitial, { fontSize: 11 }]}>
                        {(comment.user?.fullNames?.[0] || 'U').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUsername}>
                      {comment.user?.fullNames || 'Unknown'}
                    </Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                    {/* First comment badge */}
                    {index === 0 && (
                      <View style={styles.firstCommentBadge}>
                        <Text style={styles.firstCommentText}>Igitekerezo cya mbere</Text>
                      </View>
                    )}
                    {/* Comment actions */}
                    <View style={styles.commentActions}>
                      <Text style={styles.commentTime}>{formatTime(comment.timestamp)}</Text>
                      <TouchableOpacity onPress={() => handleReplyToComment(comment)}>
                        <Text style={styles.commentReplyButton}>Subiza</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {comment.userId === currentUser?.id && (
                    <TouchableOpacity
                      style={styles.deleteCommentIcon}
                      onPress={() => handleDeleteComment(comment.id)}>
                      <Trash2 size={14} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Nested replies with vertical line */}
                {comment.replies && comment.replies.length > 0 && (() => {
                  // Organize replies into hierarchy
                  const directReplies = comment.replies.filter(r => r.parentId === comment.id);
                  const nestedReplies = comment.replies.filter(r => r.parentId !== comment.id);
                  
                  // Build a map of replies by their parentId for quick lookup
                  const repliesByParent = new Map<string, IComment[]>();
                  nestedReplies.forEach(reply => {
                    if (!repliesByParent.has(reply.parentId!)) {
                      repliesByParent.set(reply.parentId!, []);
                    }
                    repliesByParent.get(reply.parentId!)!.push(reply);
                  });
                  
                  // Determine how many direct replies to show
                  const currentVisible = visibleRepliesCount[comment.id] || REPLIES_PREVIEW_LIMIT;
                  const repliesToShow = directReplies.slice(0, currentVisible);
                  const hasMore = directReplies.length > currentVisible;
                  
                  // Recursive component to render reply with its nested replies
                  const renderReplyWithNesting = (reply: IComment, depth: number = 0) => {
                    const childReplies = repliesByParent.get(reply.id) || [];
                    const isNested = depth > 0;
                    const hasChildren = childReplies.length > 0;
                    
                    // Track if this reply's nested replies are expanded
                    const nestedKey = `${comment.id}-${reply.id}`;
                    const isExpanded = expandedNestedReplies[nestedKey] || false;
                    
                    // Track visible nested replies for this reply (only if expanded)
                    const currentNestedVisible = visibleRepliesCount[nestedKey] || REPLIES_PREVIEW_LIMIT;
                    const nestedRepliesToShow = isExpanded ? childReplies.slice(0, currentNestedVisible) : [];
                    const hasMoreNested = childReplies.length > currentNestedVisible;
                    
                    return (
                      <View key={reply.id}>
                        <View style={[
                          styles.replyItem,
                          isNested && { marginLeft: 20 } // Indent nested replies
                        ]}>
                          {reply.user?.photo ? (
                            <Image source={{ uri: reply.user.photo }} style={styles.replyAvatar} />
                          ) : (
                            <View style={[styles.replyAvatar, styles.avatarFallback]}>
                              <Text style={[styles.avatarInitial, { fontSize: 10 }]}>
                                {(reply.user?.fullNames?.[0] || 'U').toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.replyContent}>
                            <Text style={styles.replyUsername}>
                              {reply.user?.fullNames || 'Unknown'}
                              {reply.parentId !== comment.id && (
                                <>
                                  <Text style={styles.replyArrow}> ▸ </Text>
                                  <Text style={styles.replyParentName}>
                                    {comment.replies?.find(r => r.id === reply.parentId)?.user?.fullNames || 'Unknown'}
                                  </Text>
                                </>
                              )}
                            </Text>
                            <Text style={styles.replyText}>{reply.text}</Text>
                            {/* Reply actions */}
                            <View style={styles.replyActions}>
                              <Text style={styles.replyTime}>{formatTime(reply.timestamp)}</Text>
                              <TouchableOpacity onPress={() => handleReplyToComment(reply)}>
                                <Text style={styles.replyReplyButton}>Subiza</Text>
                              </TouchableOpacity>
                              
                              {/* Show "View replies" button if this reply has children and they're not expanded */}
                              {hasChildren && !isExpanded && (
                                <TouchableOpacity 
                                  onPress={() => {
                                    setExpandedNestedReplies(prev => ({
                                      ...prev,
                                      [nestedKey]: true
                                    }));
                                  }}>
                                  <Text style={styles.viewRepliesButton}>
                                    Reba ibisubizo ({childReplies.length})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          {reply.userId === currentUser?.id && (
                            <TouchableOpacity
                              style={styles.deleteReplyIcon}
                              onPress={() => handleDeleteComment(reply.id)}>
                              <Trash2 size={13} color="#9ca3af" />
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        {/* Render nested replies recursively with pagination (only if expanded) */}
                        {isExpanded && childReplies.length > 0 && (
                          <View style={{ marginLeft: isNested ? 0 : 0 }}>
                            {nestedRepliesToShow.map(childReply => renderReplyWithNesting(childReply, depth + 1))}
                            
                            {/* Load more nested replies button */}
                            {hasMoreNested && (
                              <View style={[styles.loadMoreReplies, { marginLeft: 20 }]}>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={() => {
                                    setVisibleRepliesCount(prev => ({
                                      ...prev,
                                      [nestedKey]: (prev[nestedKey] || REPLIES_PREVIEW_LIMIT) + REPLIES_LOAD_MORE_BATCH
                                    }));
                                  }}>
                                  <ChevronDown size={14} color="#6b7280" />
                                  <Text style={styles.loadMoreRepliesText}>
                                    Reba ibisubizo {Math.min(REPLIES_LOAD_MORE_BATCH, childReplies.length - currentNestedVisible)} byandi
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            
                            {/* Collapse nested replies button */}
                            {currentNestedVisible > REPLIES_PREVIEW_LIMIT && childReplies.length > REPLIES_PREVIEW_LIMIT && (
                              <View style={[styles.loadMoreReplies, { marginLeft: 20 }]}>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={() => {
                                    setVisibleRepliesCount(prev => ({
                                      ...prev,
                                      [nestedKey]: REPLIES_PREVIEW_LIMIT
                                    }));
                                  }}>
                                  <ChevronUp size={14} color="#6b7280" />
                                  <Text style={styles.loadMoreRepliesText}>Hisha ibisubizo</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            
                            {/* Hide nested replies button */}
                            <View style={[styles.loadMoreReplies, { marginLeft: 20 }]}>
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                onPress={() => {
                                  setExpandedNestedReplies(prev => ({
                                    ...prev,
                                    [nestedKey]: false
                                  }));
                                  // Reset visible count when hiding
                                  setVisibleRepliesCount(prev => ({
                                    ...prev,
                                    [nestedKey]: REPLIES_PREVIEW_LIMIT
                                  }));
                                }}>
                                <ChevronUp size={14} color="#6b7280" />
                                <Text style={styles.loadMoreRepliesText}>Hisha ibisubizo</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  };
                  
                  return (
                    <View style={styles.repliesWrapper}>
                      <View style={styles.replyLine} />
                      <View style={styles.repliesList}>
                        {/* Render direct replies with their nested children */}
                        {repliesToShow.map(reply => renderReplyWithNesting(reply, 0))}
                        
                        {/* Load more direct replies button */}
                        {hasMore && (
                          <TouchableOpacity
                            style={styles.loadMoreReplies}
                            onPress={() => {
                              setVisibleRepliesCount(prev => ({
                                ...prev,
                                [comment.id]: (prev[comment.id] || REPLIES_PREVIEW_LIMIT) + REPLIES_LOAD_MORE_BATCH
                              }));
                            }}>
                            <ChevronDown size={14} color="#6b7280" />
                            <Text style={styles.loadMoreRepliesText}>
                              Reba ibisubizo {Math.min(REPLIES_LOAD_MORE_BATCH, directReplies.length - currentVisible)} byandi
                            </Text>
                          </TouchableOpacity>
                        )}
                        
                        {/* Collapse direct replies button */}
                        {currentVisible > REPLIES_PREVIEW_LIMIT && (
                          <TouchableOpacity
                            style={styles.loadMoreReplies}
                            onPress={() => {
                              setVisibleRepliesCount(prev => ({
                                ...prev,
                                [comment.id]: REPLIES_PREVIEW_LIMIT
                              }));
                            }}>
                            <ChevronUp size={14} color="#6b7280" />
                            <Text style={styles.loadMoreRepliesText}>Hisha ibisubizo</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })()}
              </View>
            ))
          )}

          {/* Add Comment Input - TikTok style */}
          <View ref={commentInputContainerRef} style={styles.commentInputContainer}>
            {replyingTo && (
              <View style={styles.replyingIndicator}>
                <Text style={styles.replyingText}>
                  Gusubiza @{replyingTo.user?.fullNames || 'Unknown'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo(null);
                    onReplyModeChange?.(false); // Notify parent that we're exiting reply mode
                  }}
                  style={styles.cancelReplyBtn}>
                  <Text style={styles.cancelReplyText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInputRow}>
              {currentUser?.photo ? (
                <Image source={{ uri: currentUser.photo }} style={styles.inputAvatar} />
              ) : (
                <View style={[styles.inputAvatar, styles.avatarFallback]}>
                  <Text style={[styles.avatarInitial, { fontSize: 11 }]}>
                    {(currentUser?.fullNames?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Andika igitekerezo..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={500}
                onFocus={handleCommentInputFocus}
              />
              <TouchableOpacity
                style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Send size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Card shell ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    // borderRadius: 16,
    marginHorizontal: 5,
    marginVertical: 5,
    paddingTop: 10,
    paddingBottom: 4,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.06,
    // shadowRadius: 4,
    // elevation: 2,
    overflow: 'hidden',
  },

  // ── Tweet two-column layout ──────────────────────────────────────────────────
  tweetRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  avatarColumn: {
    width: 44,
    alignItems: 'center',
    marginRight: 10,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 4,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  tweetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5563',
  },
  authorName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f1419',
  },
  dotSeparator: {
    fontSize: 14,
    color: '#536471',
  },
  postTime: {
    fontSize: 10,
    color: '#536471',
  },
  editedBadge: {
    fontSize: 10,
    color: '#536471',
    fontStyle: 'italic',
  },

  // ── Author actions menu ──────────────────────────────────────────────────────
  actionsContainer: { position: 'relative' },
  actionsButton: { padding: 4 },
  actionsButtonText: { fontSize: 14, color: '#536471', letterSpacing: 2, lineHeight: 16 },
  actionsMenu: {
    position: 'absolute',
    right: 0,
    top: 28,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 140,
    zIndex: 100,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e7e7e8', marginHorizontal: 8 },
  actionMenuText: { fontSize: 10, fontWeight: '500', color: '#0f1419' },
  deleteText: { color: '#ef4444' },

  // ── Post body ────────────────────────────────────────────────────────────────
  postTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f1419',
    marginBottom: 4,
  },
  postContent: {
    fontSize: 12,
    color: '#0f1419',
    lineHeight: 16,
    marginBottom: 8,
  },

  // ── Media ────────────────────────────────────────────────────────────────────
  mediaWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cfd9de',
  },
  postImage: {
    width: '100%',
    height: 240,
  },

  audioWrapper: {
    marginBottom: 10,
  },
  audioPlayerFill: {
    alignSelf: 'stretch',
    minWidth: undefined,
    maxWidth: undefined,
  },

  // ── File attachment ──────────────────────────────────────────────────────────
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cfd9de',
    padding: 12,
    marginBottom: 10,
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  attachmentName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0f1419',
    lineHeight: 18,
  },
  attachmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  extBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  extBadgeText: {
    fontSize: 6,
    color: '#fff',
    fontWeight: '700',
  },
  attachmentHint: {
    fontSize: 8,
    color: '#536471',
  },

  // ── Twitter/X action bar ─────────────────────────────────────────────────────
  tweetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    gap: 2,
  },
  tweetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  tweetActionCount: {
    fontSize: 13,
    color: '#536471',
    fontWeight: '400',
  },
  tweetActionsRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reshareLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  reshareLabelText: {
    fontSize: 12,
    color: '#536471',
  },

  // ── Image viewer modal ───────────────────────────────────────────────────────
  imageViewerBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  imageViewerImg: { width: '100%', height: '80%' },
  imageViewerOpenBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  imageViewerOpenText: { color: '#fff', fontSize: 13 },

  // ── Comments section ─────────────────────────────────────────────────────────
  commentsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e7e7e8',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e7e7e8',
  },
  commentsHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f1419',
  },
  closeCommentsButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eff3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCommentsText: {
    fontSize: 10,
    color: '#536471',
    fontWeight: '600',
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentContent: { flex: 1 },
  commentUsername: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f1419',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 10,
    color: '#0f1419',
    lineHeight: 14,
    marginBottom: 2,
  },
  firstCommentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff3f4',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  firstCommentText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#536471',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  commentTime: {
    fontSize: 10,
    color: '#536471',
  },
  commentReplyButton: {
    fontSize: 10,
    fontWeight: '700',
    color: '#536471',
  },
  deleteCommentIcon: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  repliesWrapper: {
    flexDirection: 'row',
    marginLeft: 44,
  },
  replyLine: {
    width: 2,
    backgroundColor: '#cfd9de',
    marginRight: 10,
    borderRadius: 1,
  },
  repliesList: { flex: 1 },
  replyItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyContent: { flex: 1 },
  replyUsername: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f1419',
    marginBottom: 2,
  },
  replyArrow: { fontSize: 8, color: '#536471' },
  replyParentName: { fontSize: 8, fontWeight: '500', color: '#536471' },
  replyText: {
    fontSize: 10,
    color: '#0f1419',
    lineHeight: 16,
    marginBottom: 4,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  replyTime: { fontSize: 8, color: '#536471' },
  replyReplyButton: { fontSize: 8, fontWeight: '700', color: '#536471' },
  viewRepliesButton: { fontSize: 8, fontWeight: '700', color: '#1d9bf0' },
  deleteReplyIcon: { padding: 4, alignSelf: 'flex-start' },
  loadMoreReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loadMoreRepliesText: { fontSize: 8, fontWeight: '600', color: '#536471' },

  // ── Comment input ────────────────────────────────────────────────────────────
  commentInputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e7e7e8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  replyingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  replyingText: { fontSize: 10, color: '#1d4ed8', fontWeight: '600', flex: 1 },
  cancelReplyBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelReplyText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentInput: {
    flex: 1,
    backgroundColor: '#eff3f4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f1419',
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1d9bf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#d1d5db' },
  noComments: {
    fontSize: 10,
    color: '#536471',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
