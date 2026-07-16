import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { CacheService } from "./cacheService";
import { NotificationHelper } from "../utils/notificationHelper";
import { UserBlockService } from "./userBlockService";

export class DirectChatService {
  /**
   * Get or create a direct chat between two users
   */
  public static async getOrCreateDirectChat(userId1: string, userId2: string) {
    if (await UserBlockService.isBlocked(userId1, userId2)) {
      throw new AppError("Cannot start a chat with this user", 403);
    }

    // Ensure consistent ordering
    const [user1, user2] = [userId1, userId2].sort();

    const chat = await prisma.directChat.findUnique({
      where: {
        userId1_userId2: {
          userId1: user1,
          userId2: user2,
        },
      },
      include: {
        user1: {
          select: { id: true, fullNames: true, photo: true },
        },
        user2: {
          select: { id: true, fullNames: true, photo: true },
        },
        lastMessage: {
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
    });

    if (chat) {
      return chat;
    }

    // Create new direct chat
    return await prisma.directChat.create({
      data: {
        userId1: user1,
        userId2: user2,
      },
      include: {
        user1: {
          select: { id: true, fullNames: true, photo: true },
        },
        user2: {
          select: { id: true, fullNames: true, photo: true },
        },
        lastMessage: {
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
    });
  }

  /**
   * Get all direct chats for a user
   */
  public static async getUserDirectChats(userId: string) {
    const chats = await prisma.directChat.findMany({
      where: {
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      include: {
        user1: {
          select: { id: true, fullNames: true, photo: true },
        },
        user2: {
          select: { id: true, fullNames: true, photo: true },
        },
        lastMessage: {
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
            reads: true, // ✅ FIXED: Correct relation name from schema
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Map to return other user info and format for frontends
    return chats.map((chat) => {
      const otherUser = chat.userId1 === userId ? chat.user2 : chat.user1;
      const lastMessage = chat.lastMessage;

      const unreadCount = lastMessage
        ? lastMessage.senderId !== userId
          ? 1
          : 0
        : 0;

      const lastMessageSender = lastMessage
        ? lastMessage.senderId === userId
          ? "me"
          : "other"
        : null;

      const isDelivered = !!lastMessage;
      const isRead =
        lastMessage && lastMessage.senderId === userId
          ? (lastMessage.reads || []).some((r: any) => r.userId !== userId)
          : false;

      return {
        ...chat,
        displayName: otherUser.fullNames,
        displayPhoto: otherUser.photo,
        otherUserId: otherUser.id,
        unreadCount,
        lastMessageSender,
        isDelivered,
        isRead,
      };
    });
  }

  /**
   * Get a direct chat with messages
   * Tries cache first (Redis), falls back to database
   */
  public static async getDirectChatWithMessages(
    chatId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    const chat = await prisma.directChat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            fullNames: true,
            photo: true,
            email: true,
            phoneNumber: true,
            bio: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            gender: true,
            birthdate: true,
            industry: true,
            hospitalId: true,
            createdAt: true,
            hospital: {
              select: {
                id: true,
                name: true,
              },
            },
            userRoles: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            fullNames: true,
            photo: true,
            email: true,
            phoneNumber: true,
            bio: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            gender: true,
            birthdate: true,
            industry: true,
            hospitalId: true,
            createdAt: true,
            hospital: {
              select: {
                id: true,
                name: true,
              },
            },
            userRoles: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new AppError("Direct chat not found", 404);
    }

    let messages;
    const cache = CacheService.getInstance();

    // Try cache first if no offset (first page)
    if (offset === 0) {
      const cachedMessages = await cache.getMessages(chatId, "direct", limit);
      if (cachedMessages && cachedMessages.length > 0) {
        messages = cachedMessages;
      } else {
        // Cache miss - fetch from database
        const dbMessages = await prisma.directMessage.findMany({
          where: { chatId },
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
            likes: {
              where: { userId },
              select: { id: true },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
          take: limit,
          skip: offset,
        });

        messages = dbMessages.reverse();

        // Populate cache asynchronously (non-blocking)
        for (const msg of dbMessages) {
          await cache
            .cacheMessage(
              chatId,
              {
                id: msg.id,
                senderId: msg.senderId,
                content: msg.content,
                type: msg.type,
                attachments: msg.attachments || undefined,
                readCount: msg.readCount,
                likeCount: msg.likeCount,
                isDeleted: msg.isDeleted,
                editedAt: msg.editedAt ? msg.editedAt.toISOString() : undefined,
                timestamp: msg.timestamp.getTime(),
              },
              "direct",
            )
            .catch((err) => console.error("Cache population error:", err));
        }
      }
    } else {
      // Pagination - fetch older messages from database
      messages = await prisma.directMessage.findMany({
        where: { chatId },
        include: {
          sender: {
            select: { id: true, fullNames: true, photo: true },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        skip: offset,
      });

      messages = messages.reverse();
    }

    const otherUser = chat.userId1 === userId ? chat.user2 : chat.user1;

    return {
      chat: {
        ...chat,
        displayName: otherUser.fullNames,
        displayPhoto: otherUser.photo,
        otherUserId: otherUser.id,
      },
      messages,
    };
  }

  /**
   * Send a direct message
   * Caches message immediately after creation
   */
  public static async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    type: string = "text",
    attachments?: string,
    io?: any,
  ) {
    // Verify sender is participant in chat
    const chat = await prisma.directChat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId1: senderId }, { userId2: senderId }],
      },
    });

    if (!chat) {
      throw new AppError("Unauthorized - not a participant in this chat", 403);
    }

    const recipientForBlockCheck =
      chat.userId1 === senderId ? chat.userId2 : chat.userId1;
    if (await UserBlockService.isBlocked(senderId, recipientForBlockCheck)) {
      throw new AppError("Cannot send messages to this user", 403);
    }

    const message = await prisma.directMessage.create({
      data: {
        chatId,
        senderId,
        content,
        type,
        attachments,
      },
      include: {
        sender: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Notify recipient with per-conversation cooldown (30s)
    const recipientId = chat.userId1 === senderId ? chat.userId2 : chat.userId1;
    if (recipientId && io) {
      NotificationHelper.sendToUser(
        io,
        recipientId,
        "New message",
        content?.slice(0, 120) || "New message",
        "new_message",
        `/chat/${chatId}`,
        "chat",
        chatId,
        { messageId: message.id },
        60_000,
        `chat:msg:${chatId}:${recipientId}`,
      ).catch((err) =>
        console.warn("[DirectChatService] notify recipient failed", err),
      );
    }

    // Notify the other participant for unread thresholds
    const recipients =
      chat.userId1 === senderId ? [chat.userId2] : [chat.userId1];
    const { MessageNotificationService } =
      await import("./messageNotificationService");
    await MessageNotificationService.incrementUnreadForUsers(
      recipients,
      senderId,
      chatId,
      "direct",
      io,
    ).catch((err) =>
      console.warn("[DirectChatService] unread increment failed", err),
    );

    // Update lastMessageId in chat
    await prisma.directChat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(), // Force timestamp update to invalidate cache
      },
    });

    // Cache message asynchronously
    const cache = CacheService.getInstance();
    await cache
      .cacheMessage(
        chatId,
        {
          id: message.id,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          attachments: message.attachments || undefined,
          readCount: message.readCount,
          likeCount: message.likeCount,
          isDeleted: message.isDeleted,
          editedAt: message.editedAt
            ? message.editedAt.toISOString()
            : undefined,
          timestamp: message.timestamp.getTime(),
        },
        "direct",
      )
      .catch((err) => console.error("Cache error on message send:", err));

    // Broadcast message:created to room via /direct namespace
    if (io) {
      try {
        io.of("/direct")
          .to(`direct:${chatId}`)
          .emit("message:created", {
            ...message,
            chatId,
          });
        console.log(
          `[DirectChatService] 📢 Broadcasted message:created to direct:${chatId}`,
        );
      } catch (err) {
        console.warn("[DirectChatService] socket broadcast failed", err);
      }

      // Notify both participants' personal rooms so their conversation lists
      // update in real-time regardless of which screen they're on
      try {
        const conversationUpdatedPayload = {
          type: "direct",
          chatId,
          lastMessage: {
            id: message.id,
            content: message.content,
            type: message.type,
            senderId: message.senderId,
            timestamp: message.timestamp,
            // ✅ ADD: Sender info for preview rendering
            sender: {
              id: message.sender.id,
              fullNames: message.sender.fullNames,
              photo: message.sender.photo,
            },
          },
          updatedAt: new Date(),
        };

        // Emit on main namespace so all connected sockets in user rooms receive it
        // ✅ Send sender-specific data (with "me" indicator and read status)
        io.to(`user:${senderId}`).emit("conversation:updated", {
          ...conversationUpdatedPayload,
          lastMessageSender: "me",
          isDelivered: true,
          isRead: false,
        });

        // ✅ Send recipient-specific data (with "other" indicator)
        io.to(`user:${recipientId}`).emit("conversation:updated", {
          ...conversationUpdatedPayload,
          lastMessageSender: "other",
          isDelivered: true,
          isRead: false,
        });

        console.log(
          `[DirectChatService] 📢 Broadcasted conversation:updated to user:${senderId} and user:${recipientId}`,
        );
      } catch (err) {
        console.warn(
          "[DirectChatService] conversation:updated broadcast failed",
          err,
        );
      }
    }

    return message;
  }

  /**
   * Mark message as read
   * Updates cache with new read count
   */
  public static async markMessageAsRead(messageId: string, userId: string) {
    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const existing = await prisma.directMessageRead.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    await prisma.directMessageRead.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        messageId,
        userId,
      },
    });

    // Update denormalized readCount
    const readCount = await prisma.directMessageRead.count({
      where: { messageId },
    });

    await prisma.directMessage.update({
      where: { id: messageId },
      data: { readCount },
    });

    // Decrement global unread counter only when first time read
    if (!existing) {
      const { MessageNotificationService } =
        await import("./messageNotificationService");
      await MessageNotificationService.decrementUnread(userId).catch((err) =>
        console.warn("[DirectChatService] unread decrement failed", err),
      );
    }

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(message.chatId, messageId, { readCount }, "direct")
      .catch((err) => console.error("Cache update error:", err));

    return { success: true };
  }

  /**
   * Toggle like on a message
   * Updates cache with new like count
   */
  public static async toggleLike(messageId: string, userId: string, io?: any) {
    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const existingLike = await prisma.directMessageLike.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (existingLike) {
      await prisma.directMessageLike.delete({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });
    } else {
      await prisma.directMessageLike.create({
        data: {
          messageId,
          userId,
        },
      });
    }

    // Update denormalized likeCount
    const likeCount = await prisma.directMessageLike.count({
      where: { messageId },
    });

    await prisma.directMessage.update({
      where: { id: messageId },
      data: { likeCount },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(message.chatId, messageId, { likeCount }, "direct")
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:liked to direct chat room
    if (io && message) {
      try {
        io.of("/direct").to(`direct:${message.chatId}`).emit("message:liked", {
          messageId,
          userId,
          liked: !existingLike,
          likeCount,
        });
        console.log(
          `[DirectChatService] 📢 Broadcasted message:liked to direct:${message.chatId}`,
        );
      } catch (err) {
        console.warn("[DirectChatService] message:liked broadcast failed", err);
      }
    }

    return { liked: !existingLike, likeCount };
  }

  /**
   * Edit a message
   * Updates cache with new content and editedAt timestamp
   */
  public static async editMessage(
    messageId: string,
    userId: string,
    content: string,
    io?: any,
  ) {
    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("Unauthorized - can only edit own messages", 403);
    }

    const editedAt = new Date();
    const updatedMessage = await prisma.directMessage.update({
      where: { id: messageId },
      data: {
        content,
        editedAt,
      },
      include: {
        sender: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(
        message.chatId,
        messageId,
        { content, editedAt: editedAt.toISOString() },
        "direct",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:edited to direct chat room
    if (io) {
      try {
        io.of("/direct")
          .to(`direct:${message.chatId}`)
          .emit("message:edited", updatedMessage);
        console.log(
          `[DirectChatService] 📢 Broadcasted message:edited to direct:${message.chatId}`,
        );
      } catch (err) {
        console.warn(
          "[DirectChatService] message:edited broadcast failed",
          err,
        );
      }
    }

    return updatedMessage;
  }

  /**
   * Delete a message
   * Updates cache to mark message as deleted
   */
  public static async deleteMessage(
    messageId: string,
    userId: string,
    io?: any,
  ) {
    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("Unauthorized - can only delete own messages", 403);
    }

    await prisma.directMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, content: "[Deleted]" },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(
        message.chatId,
        messageId,
        { isDeleted: true, content: "[Deleted]" },
        "direct",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:deleted to direct chat room
    if (io) {
      try {
        io.of("/direct")
          .to(`direct:${message.chatId}`)
          .emit("message:deleted", { messageId });
        console.log(
          `[DirectChatService] 📢 Broadcasted message:deleted to direct:${message.chatId}`,
        );
      } catch (err) {
        console.warn(
          "[DirectChatService] message:deleted broadcast failed",
          err,
        );
      }
    }

    return { success: true, messageId };
  }

  /**
   * Get unread message count for all direct chats for a user
   */
  public static async getUnreadCounts(userId: string) {
    const chats = await prisma.directChat.findMany({
      where: {
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      select: {
        id: true,
        messages: {
          where: {
            senderId: {
              not: userId,
            },
            reads: {
              none: {
                userId: userId,
              },
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const result = chats.map((chat) => ({
      chatId: chat.id,
      unreadCount: chat.messages.length,
    }));

    const totalUnread = result.reduce((sum, chat) => sum + chat.unreadCount, 0);

    return {
      total: totalUnread,
      byChat: result,
    };
  }

  /**
   * Get unread messages for a specific direct chat
   */
  public static async getUnreadMessagesInChat(chatId: string, userId: string) {
    const chat = await prisma.directChat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new AppError("Chat not found", 404);
    }

    const isParticipant = chat.userId1 === userId || chat.userId2 === userId;
    if (!isParticipant) {
      throw new AppError("Unauthorized", 403);
    }

    const unreadMessages = await prisma.directMessage.findMany({
      where: {
        chatId,
        senderId: {
          not: userId,
        },
        reads: {
          none: {
            userId: userId,
          },
        },
      },
      include: {
        sender: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    return {
      chatId,
      unreadCount: unreadMessages.length,
      messages: unreadMessages,
    };
  }

  /**
   * Update direct chat (archive status)
   */
  public static async updateDirectChat(
    chatId: string,
    userId: string,
    data: { isArchived?: boolean },
  ) {
    const chat = await prisma.directChat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new AppError("Chat not found", 404);
    }

    const isParticipant = chat.userId1 === userId || chat.userId2 === userId;
    if (!isParticipant) {
      throw new AppError("Unauthorized", 403);
    }

    return await prisma.directChat.update({
      where: { id: chatId },
      data,
      include: {
        user1: {
          select: { id: true, fullNames: true, photo: true },
        },
        user2: {
          select: { id: true, fullNames: true, photo: true },
        },
        lastMessage: {
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
    });
  }

  /**
   * Archive a direct chat
   */
  public static async archiveChat(chatId: string, userId: string) {
    const chat = await prisma.directChat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId1: userId }, { userId2: userId }],
      },
    });

    if (!chat) {
      throw new AppError("Chat not found", 404);
    }

    return await prisma.directChat.update({
      where: { id: chatId },
      data: { isArchived: true },
    });
  }

  /**
   * Get messages from a direct chat with pagination
   */
  public static async getDirectChatMessages(
    chatId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    // Verify user has access to this chat
    const chat = await prisma.directChat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId1: userId }, { userId2: userId }],
      },
    });

    if (!chat) {
      throw new AppError("Direct chat not found or access denied", 404);
    }

    const cache = CacheService.getInstance();

    // Try cache first if no offset (first page)
    if (offset === 0) {
      const cachedMessages = await cache.getMessages(chatId, "direct", limit);
      if (cachedMessages && cachedMessages.length > 0) {
        // Cache hit — but cache has no per-user likes data.
        // Run a lightweight DB query to merge the current user's like state.
        const cached = cachedMessages as { id: string }[];
        const messageIds = cached.map((m) => m.id);
        const userLikes = await prisma.directMessageLike.findMany({
          where: { messageId: { in: messageIds }, userId },
          select: { messageId: true, id: true },
        });
        const likedMap = new Map(userLikes.map((l) => [l.messageId, l.id]));
        const messagesWithLikes = cached.map((m) => ({
          ...m,
          likes: likedMap.has(m.id) ? [{ id: likedMap.get(m.id) }] : [],
        }));
        return {
          data: messagesWithLikes,
          total: messagesWithLikes.length,
        };
      }
    }

    // Fetch from database
    const messages = await prisma.directMessage.findMany({
      where: { chatId },
      include: {
        sender: {
          select: { id: true, fullNames: true, photo: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Populate cache asynchronously
    for (const msg of messages) {
      await cache.cacheMessage(
        chatId,
        {
          id: msg.id,
          senderId: msg.senderId,
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp.getTime(),
          isDeleted: msg.isDeleted,
          likeCount: msg.likeCount,
          readCount: msg.readCount,
        },
        "direct",
      );
    }

    // Mark only unread messages in chat as read asynchronously (non-blocking)
    setTimeout(() => {
      prisma.directMessage
        .findMany({
          where: {
            chatId,
            senderId: { not: userId },
            reads: { none: { userId } },
          },
          select: { id: true },
        })
        .then((unreadMessages) => {
          if (unreadMessages.length === 0) return;
          return prisma.directMessageRead.createMany({
            data: unreadMessages.map((msg) => ({
              messageId: msg.id,
              userId,
              readAt: new Date(),
            })),
            skipDuplicates: true,
          });
        })
        .catch((err) => console.error("Error marking messages as read:", err));
    }, 0);

    return {
      data: messages.reverse(),
      total: messages.length,
    };
  }

  /**
   * Search messages in a direct chat by content, across the full conversation
   * history (not just the most-recently-loaded page).
   */
  public static async searchDirectChatMessages(
    chatId: string,
    userId: string,
    q: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    // Verify user has access to this chat
    const chat = await prisma.directChat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId1: userId }, { userId2: userId }],
      },
    });

    if (!chat) {
      throw new AppError("Direct chat not found or access denied", 404);
    }

    const where = {
      chatId,
      content: { contains: q, mode: "insensitive" as const },
    };

    const [messages, total] = await Promise.all([
      prisma.directMessage.findMany({
        where,
        include: {
          sender: {
            select: { id: true, fullNames: true, photo: true },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
        },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.directMessage.count({ where }),
    ]);

    // For each match, work out its position under the same newest-first ordering
    // used by getDirectChatMessages, so the frontend can jump straight to the
    // page of the normal message list that contains this message.
    const data = await Promise.all(
      messages.map(async (msg) => {
        const offsetInConversation = await prisma.directMessage.count({
          where: { chatId, timestamp: { gt: msg.timestamp } },
        });
        return { ...msg, offsetInConversation };
      }),
    );

    return { data, total };
  }
}
