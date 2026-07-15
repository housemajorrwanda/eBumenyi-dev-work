import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { INotification } from '@/types';
import { SocketService } from '@/services/socket.service';
import { useAuth } from '@/hooks/useAuth';

interface NotificationsContextType {
  notifications: INotification[];
  unreadCount: number;
  connected: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  handleNotificationTap: (notification: INotification) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

/**
 * Navigate user to appropriate screen based on notification type and action URL
 */
const navigateFromNotification = (router: any, notification: INotification) => {
  const actionUrl = (notification.actionUrl || '').trim();
  if (!actionUrl) return;

  const entityType = notification.entityType || '';
  console.log(`[NotificationDeepLink] Navigating from notification: ${entityType} → ${actionUrl}`);

  try {
    // /certificate has no ID segment — handle before the generic regex
    if (actionUrl === '/certificate') {
      router.push('/certificate');
      return;
    }

    // Extract ID from action URL (format: /calendar/123, /chat/456, etc.)
    const match = actionUrl.match(/^\/([a-z_]+)\/(.+?)(?:\?|$)/i);
    if (!match) {
      console.warn('[NotificationDeepLink] Could not parse action URL:', actionUrl);
      return;
    }

    const [, resourceType, resourceId] = match;

    switch (resourceType.toLowerCase()) {
      case 'calendar':
      case 'event':
        router.push(`/calendar/${resourceId}`);
        break;

      case 'chat':
      case 'conversation':
        router.push(`/chat/${resourceId}`);
        break;

      case 'group':
        router.push(`/group/${resourceId}`);
        break;

      case 'course':
      case 'courses':
        router.push(`/courses/${resourceId}`);
        break;

      case 'chapter':
      case 'attempt':
        router.push(`/courses/${resourceId}`);
        break;

      case 'community':
        router.push(`/community/${resourceId}`);
        break;

      case 'announcement':
        router.push(`/announcements/${resourceId}`);
        break;

      default:
        console.warn(`[NotificationDeepLink] Unknown resource type: ${resourceType}`);
    }
  } catch (error) {
    console.error('[NotificationDeepLink] Error during navigation:', error);
  }
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const listenersSetupRef = useRef(false);

  // Initialize socket connection and setup listeners once
  useEffect(() => {
    if (!user) {
      // Reset so listeners can be set up again on next login
      listenersSetupRef.current = false;
      return;
    }
    
    if (listenersSetupRef.current) {
      return;
    }

    console.log('📢 [NotificationsContext] Setting up global notification listeners');

    const setupListeners = async () => {
      try {
        const socket = await SocketService.initialize();
        if (!socket) {
          console.warn('📢 [NotificationsContext] Socket initialization failed (returned null)');
          return;
        }

        const handleConnect = () => {
          console.log('📢 [NotificationsContext] Socket connected');
          setConnected(true);
          console.log('📢 [NotificationsContext] Emitting get_notifications event');
          socket.emit('get_notifications');
        };

        const handleDisconnect = () => {
          console.log('📢 [NotificationsContext] Socket disconnected');
          setConnected(false);
        };

        const handleNotifications = (initial: INotification[]) => {
          console.log('📬 [NotificationsContext] Received notifications:', initial?.length || 0);
          if (initial && initial.length > 0) {
            console.log('📬 [NotificationsContext] First notification:', initial[0]?.title);
          }
          setNotifications(initial || []);
          const unread = (initial || []).filter(n => !n.isRead).length;
          setUnreadCount(unread);
        };

        const handleNewNotification = (notification: INotification) => {
          console.log('🔔 [NotificationsContext] New notification received:', notification?.title);
          setNotifications(prev => [notification, ...prev]);
          if (!notification.isRead) {
            setUnreadCount(prev => prev + 1);
          }

        };

        const handleNotificationMarkedRead = (data: { notificationId: string }) => {
          setNotifications(prev => {
            const updated = prev.map(n =>
              n.id === data.notificationId ? { ...n, isRead: true } : n
            );
            const unread = updated.filter(n => !n.isRead).length;
            setUnreadCount(unread);
            return updated;
          });
        };

        const handleAllNotificationsMarkedRead = () => {
          setNotifications(prev =>
            prev.map(n => ({ ...n, isRead: true }))
          );
          setUnreadCount(0);
        };

        const handleNotificationDeleted = (data: { notificationId: string }) => {
          setNotifications(prev =>
            prev.filter(n => n.id !== data.notificationId)
          );
        };

        const handleAllNotificationsCleared = () => {
          setNotifications([]);
          setUnreadCount(0);
        };

        const handleUnreadCountUpdated = (data: { unreadCount: number }) => {
          console.log('Unread count updated:', data.unreadCount);
          setUnreadCount(prev => {
            if (data.unreadCount === 0 && prev > 0) {
              return prev;
            }
            return data.unreadCount ?? 0;
          });
        };

        // Register all listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('notifications', handleNotifications);
        socket.on('notification', handleNewNotification);
        socket.on('notification_marked_read', handleNotificationMarkedRead);
        socket.on('all_notifications_marked_read', handleAllNotificationsMarkedRead);
        socket.on('notification_deleted', handleNotificationDeleted);
        socket.on('all_notifications_cleared', handleAllNotificationsCleared);
        socket.on('unread_count_updated', handleUnreadCountUpdated);

        // Add error handlers
        socket.on('connect_error', (error) => {
          console.error('📢 [NotificationsContext] Socket connection error:', error.message);
        });

        socket.on('error', (error) => {
          console.error('📢 [NotificationsContext] Socket error:', error);
        });

        listenersSetupRef.current = true;

        // Request initial notifications if already connected
        // If already connected, fire immediately
        if (socket.connected) {
          setConnected(true);
          console.log('📢 [NotificationsContext] Socket already connected, requesting notifications');
          socket.emit('get_notifications');
        } else {
          console.log('📢 [NotificationsContext] Socket not yet connected, waiting...');
          // Not yet connected — wait up to 5 seconds then request anyway
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            console.log(`📢 [NotificationsContext] Polling attempt ${attempts}/10`);
            if (socket.connected) {
              clearInterval(poll);
              setConnected(true);
              console.log('📢 [NotificationsContext] Socket connected after poll, requesting notifications');
              socket.emit('get_notifications');
            } else if (attempts >= 10) {
              clearInterval(poll);
              console.warn('📢 [NotificationsContext] Socket did not connect within 5s');
              console.warn('📢 [NotificationsContext] Socket state:', {
                connected: socket.connected,
                disconnected: socket.disconnected,
              });
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to setup notifications listeners:', error);
      }
    };

    setupListeners();
  }, [user]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );

    const socket = SocketService.getInstance();
    if (socket?.connected) {
      socket.emit('mark_as_read', { notificationId });
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );
    setUnreadCount(0);

    const socket = SocketService.getInstance();
    if (socket?.connected) {
      socket.emit('mark_all_as_read');
    }
  }, []);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );

    const socket = SocketService.getInstance();
    if (socket?.connected) {
      socket.emit('delete_notification', { notificationId });
    }
  }, []);

  const handleNotificationTap = useCallback((notification: INotification) => {
    console.log(`[NotificationTap] User tapped notification: ${notification.id}`);

    // Mark as read
    markAsRead(notification.id);

    // Navigate to appropriate screen
    navigateFromNotification(router, notification);
  }, [router, markAsRead]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);

    const socket = SocketService.getInstance();
    if (socket?.connected) {
      socket.emit('clear_all_notifications');
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        connected,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        handleNotificationTap,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within NotificationsProvider');
  }
  return context;
}
