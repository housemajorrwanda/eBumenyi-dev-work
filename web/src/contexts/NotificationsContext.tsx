/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@/types";
import { getSocketBaseURL } from "@/config/api.config";
import { getCookieValue } from "@/utils/jwt";

interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  onlineUserIds: Set<string>;
  lastSeenByUserId: Record<string, string>;
  requestUserStatus: (userIds: string[]) => Promise<UserStatus[]>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Get token from localStorage OR cookie — whichever has it
const getToken = (): string | null => {
  const fromStorage = localStorage.getItem("accessToken");
  if (fromStorage) return fromStorage.replace(/^Bearer\s+/i, "");
  
  const fromCookie = getCookieValue("accessToken");
  if (fromCookie) {
    // Sync to localStorage for future reads
    localStorage.setItem("accessToken", fromCookie);
    return fromCookie.replace(/^Bearer\s+/i, "");
  }
  
  return null;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenByUserId, setLastSeenByUserId] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      console.warn("[NotificationsContext] No token available");
      return;
    }

    // If socket exists and is connected, do nothing
    if (socketRef.current?.connected) return;

    // If socket exists but is disconnected/broken, destroy it first
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log("[NotificationsContext] Connecting socket...");

    const socket = io(getSocketBaseURL(), {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[NotificationsContext] Connected:", socket.id);
      setConnected(true);
      socket.emit("get_notifications");
    });

    socket.on("disconnect", (reason: string) => {
      console.log("[NotificationsContext] Disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (error: any) => {
      console.error("[NotificationsContext] Connection error:", error.message);
      setConnected(false);
    });

    socket.on("connected", (data: any) => {
      console.log("[NotificationsContext] Server confirmed connection:", data);
      setConnected(true);
    });

    socket.on("notifications", (initial: Notification[]) => {
      console.log("[NotificationsContext] Initial notifications:", initial.length);
      setNotifications(initial);
      setUnreadCount(initial.filter((n) => !n.isRead).length);
    });

    socket.on("notification", (notification: Notification) => {
      console.log("[NotificationsContext] New notification:", notification.title);
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
      // OS push notifications are handled exclusively by the FCM service worker
      // (firebase-messaging-sw.js). Showing them here too caused triple-popups
      // because socket events arrive faster than FCM, and multiple tabs each
      // had their own handler racing against the 2-second BroadcastChannel debounce.
    });

    socket.on("unread_count_updated", (data: { unreadCount: number }) => {
      setUnreadCount((prev) => {
        if (data.unreadCount === 0 && prev > 0) return prev;
        return data.unreadCount ?? 0;
      });
    });

    socket.on("notification_marked_read", (data: { notificationId: string }) => {
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === data.notificationId ? { ...n, isRead: true } : n
        );
        setUnreadCount(updated.filter((n) => !n.isRead).length);
        return updated;
      });
    });

    socket.on("all_notifications_marked_read", () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });

    socket.on("notification_deleted", (data: { notificationId: string }) => {
      setNotifications((prev) =>
        prev.filter((n) => n.id !== data.notificationId)
      );
    });

    socket.on("all_notifications_cleared", () => {
      setNotifications([]);
      setUnreadCount(0);
    });

    // Presence — broadcast globally to every connected client on this namespace.
    socket.on("user:online", (data: { userId: string }) => {
      setOnlineUserIds((prev) => new Set(prev).add(data.userId));
    });

    socket.on("user:offline", (data: { userId: string; lastSeen: string }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
      setLastSeenByUserId((prev) => ({ ...prev, [data.userId]: data.lastSeen }));
    });

    // Fired for every new message the user receives, on their personal room, regardless
    // of which page they're on — the one signal that can keep unread badges live without
    // requiring the Messaging page (and its per-conversation sockets) to be mounted.
    socket.on("message:new_unread", () => {
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Initial connection attempt
    connect();

    // Poll every 5 seconds — if not connected and token exists, retry
    const retryInterval = setInterval(() => {
      if (!socketRef.current?.connected && getToken()) {
        console.log("[NotificationsContext] Retry interval: attempting reconnect...");
        connect();
      }
    }, 5000);

    // Listen for storage changes (login sets token in localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "accessToken" && e.newValue && !socketRef.current?.connected) {
        console.log("[NotificationsContext] Token detected in storage, connecting...");
        connect();
      }
    };

    // Listen for custom auth events from authSync
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === "login" && !socketRef.current?.connected) {
        console.log("[NotificationsContext] Auth login event detected, connecting...");
        setTimeout(() => connect(), 100);
      }
      if (customEvent.detail === "logout") {
        console.log("[NotificationsContext] Auth logout event detected, disconnecting...");
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
          setConnected(false);
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth_change", handleAuthChange);

    return () => {
      clearInterval(retryInterval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth_change", handleAuthChange);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      setUnreadCount(updated.filter((n) => !n.isRead).length);
      return updated;
    });
    socketRef.current?.emit("mark_as_read", { notificationId });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    socketRef.current?.emit("mark_all_as_read");
  }, []);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    socketRef.current?.emit("delete_notification", { notificationId });
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    socketRef.current?.emit("clear_all_notifications");
  }, []);

  const requestUserStatus = useCallback((userIds: string[]): Promise<UserStatus[]> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket?.connected || userIds.length === 0) {
        resolve([]);
        return;
      }

      const handleResponse = (statuses: UserStatus[]) => {
        socket.off("user:status_response", handleResponse);
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          statuses.forEach((s) => (s.isOnline ? next.add(s.userId) : next.delete(s.userId)));
          return next;
        });
        setLastSeenByUserId((prev) => {
          const next = { ...prev };
          statuses.forEach((s) => {
            if (s.lastSeen) next[s.userId] = s.lastSeen;
          });
          return next;
        });
        resolve(statuses);
      };

      socket.on("user:status_response", handleResponse);
      socket.emit("user:get_status", { userIds });

      // Don't hang forever if the server never replies.
      setTimeout(() => {
        socket.off("user:status_response", handleResponse);
        resolve([]);
      }, 5000);
    });
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
        onlineUserIds,
        lastSeenByUserId,
        requestUserStatus,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotificationsContext must be used within a NotificationsProvider");
  }
  return context;
};
