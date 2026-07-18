import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { CacheService } from "./cacheService";
import { RedisCounterService } from "./redisCounterService";
import { NotificationHelper } from "../utils/notificationHelper";

export class GroupChatService {
  /**
   * Create a new group chat
   */
  public static async createGroup(
    name: string,
    createdById: string,
    participantIds: string[],
    description?: string,
    photo?: string,
  ) {
    // Ensure creator is included
    const allParticipants = Array.from(
      new Set([createdById, ...participantIds]),
    );

    const group = await prisma.groupChat.create({
      data: {
        name,
        description,
        photo,
        createdById,
        participants: {
          create: allParticipants.map((userId) => ({
            userId,
            role: userId === createdById ? "admin" : "member",
          })),
        },
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
    });

    return group;
  }

  /**
   * Get all groups for a user
   */
  public static async getUserGroups(userId: string) {
    const groups = await prisma.groupChat.findMany({
      where: {
        participants: {
          some: { userId },
        },
        isArchived: false, // Filter out archived/deleted groups
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
        lastMessage: {
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return groups.map((group) => {
      return {
        ...group,
      };
    });
  }

  /**
   * Get group with messages
   * Tries cache first (Redis), falls back to database
   */
  public static async getGroupWithMessages(
    groupId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    const group = await prisma.groupChat.findFirst({
      where: {
        id: groupId,
        isArchived: false, // Don't allow access to archived groups
        participants: {
          some: { userId },
        },
      },
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!group) {
      throw new AppError("Group not found or access denied", 404);
    }

    let messages;
    const cache = CacheService.getInstance();

    // Try cache first if no offset (first page)
    if (offset === 0) {
      const cachedMessages = await cache.getMessages(groupId, "group", limit);
      if (cachedMessages && cachedMessages.length > 0) {
        // Cache hit — but cache has no per-user likes data.
        // Run a lightweight DB query to merge the current user's like state.
        const cached = cachedMessages as { id: string }[];
        const messageIds = cached.map((m) => m.id);
        const userLikes = await prisma.groupMessageLike.findMany({
          where: { messageId: { in: messageIds }, userId },
          select: { messageId: true, id: true },
        });
        const likedMap = new Map(userLikes.map((l) => [l.messageId, l.id]));
        messages = cached.map((m) => ({
          ...m,
          likes: likedMap.has(m.id) ? [{ id: likedMap.get(m.id) }] : [],
        }));
      } else {
        // Cache miss - fetch from database
        const dbMessages = await prisma.groupMessage.findMany({
          where: { groupId },
          include: {
            sender: {
              select: { id: true, fullNames: true, photo: true },
            },
            likes: {
              where: { userId },
              select: { id: true },
            },
            comments: {
              include: {
                user: {
                  select: { id: true, fullNames: true, photo: true },
                },
                replies: {
                  include: {
                    user: {
                      select: { id: true, fullNames: true, photo: true },
                    },
                  },
                },
              },
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
              groupId,
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
              "group",
            )
            .catch((err) => console.error("Cache population error:", err));
        }
      }
    } else {
      // Pagination - fetch older messages from database
      messages = await prisma.groupMessage.findMany({
        where: { groupId },
        include: {
          sender: {
            select: { id: true, fullNames: true, photo: true },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
          comments: {
            include: {
              user: {
                select: { id: true, fullNames: true, photo: true },
              },
              replies: {
                include: {
                  user: {
                    select: { id: true, fullNames: true, photo: true },
                  },
                },
              },
            },
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

    return {
      group,
      messages,
    };
  }

  /**
   * Send a group message
   * Caches message immediately after creation
   */
  public static async sendMessage(
    groupId: string,
    senderId: string,
    content: string,
    type: string = "text",
    attachments?: string,
    io?: any,
  ) {
    // Verify sender is participant
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupId,
        userId: senderId,
      },
    });

    if (!participant) {
      throw new AppError("Unauthorized - not a participant in this group", 403);
    }

    const message = await prisma.groupMessage.create({
      data: {
        groupId,
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

    // Notify participants (excluding sender) for unread thresholds
    const participants = await prisma.groupChatParticipant.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const recipientIds = participants
      .map((p) => p.userId)
      .filter((id) => id !== senderId);
    const { MessageNotificationService } =
      await import("./messageNotificationService");
    await MessageNotificationService.incrementUnreadForUsers(
      recipientIds,
      senderId,
      groupId,
      "group",
      io,
    ).catch((err) =>
      console.warn("[GroupChatService] unread increment failed", err),
    );

    // Update lastMessageId in group chat
    await prisma.groupChat.update({
      where: { id: groupId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(), // Force timestamp update to invalidate cache
      },
    });

    // Burst-collapsed per-message notification (30s cooldown per user/group)
    if (io && recipientIds.length) {
      NotificationHelper.sendToUsers(
        io,
        recipientIds,
        "New group message",
        content?.slice(0, 120) || "New message",
        "new_message",
        `/group/${groupId}`,
        "group_chat",
        groupId,
        { messageId: message.id },
        60_000,
        `group:msg:${groupId}`,
      ).catch((err) =>
        console.warn("[GroupChatService] burst notify failed", err),
      );
    }

    // Cache message asynchronously
    const cache = CacheService.getInstance();
    await cache
      .cacheMessage(
        groupId,
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
        "group",
      )
      .catch((err) => console.error("Cache error on message send:", err));

    // Broadcast message:created to group room
    if (io) {
      try {
        io.of("/group").to(`group:${groupId}`).emit("message:created", message);
        console.log(
          `[GroupChatService] 📢 Broadcasted message:created to group:${groupId}`,
        );
      } catch (err) {
        console.warn(
          "[GroupChatService] message:created broadcast failed",
          err,
        );
      }

      // Notify every participant's personal room so their conversation lists
      // update in real-time regardless of which screen they're on
      try {
        const allParticipantIds = [senderId, ...recipientIds];
        const conversationUpdatedPayload = {
          type: "group",
          chatId: groupId,
          lastMessage: {
            id: message.id,
            content: message.content,
            type: message.type,
            senderId: message.senderId,
            timestamp: message.timestamp,
          },
          updatedAt: new Date(),
        };
        allParticipantIds.forEach((uid) => {
          io.to(`user:${uid}`).emit("conversation:updated", conversationUpdatedPayload);
        });
        console.log(
          `[GroupChatService] 📢 Broadcasted conversation:updated to ${allParticipantIds.length} participants`,
        );
      } catch (err) {
        console.warn("[GroupChatService] conversation:updated broadcast failed", err);
      }
    }

    return message;
  }

  /**
   * Add participant to group
   */
  public static async addParticipant(
    groupId: string,
    userIdToAdd: string,
    addedById: string,
    io?: any,
  ) {
    const group = await prisma.groupChat.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Check if requester is admin
    const adder = await prisma.groupChatParticipant.findFirst({
      where: {
        groupId,
        userId: addedById,
      },
    });

    if (!adder || adder.role !== "admin") {
      throw new AppError(
        "Unauthorized - only admins can add participants",
        403,
      );
    }

    // Check if user already a participant
    const existing = await prisma.groupChatParticipant.findFirst({
      where: {
        groupId,
        userId: userIdToAdd,
      },
    });

    if (existing) {
      throw new AppError("User already in group", 400);
    }

    const participant = await prisma.groupChatParticipant.create({
      data: {
        groupId,
        userId: userIdToAdd,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    if (io) {
      const adminIds = await prisma.groupChatParticipant.findMany({
        where: { groupId, role: "admin" },
        select: { userId: true },
      });
      const targets = Array.from(
        new Set([userIdToAdd, ...adminIds.map((a) => a.userId)]).values(),
      ).filter((id) => id !== addedById);

      NotificationHelper.sendToUsers(
        io,
        targets,
        "Group membership update",
        `${participant.user?.fullNames || "A user"} was added to the group.`,
        "info",
        `/group/${groupId}`,
        "group",
        groupId,
        { addedUserId: userIdToAdd },
        30_000,
        `group:member:${groupId}`,
      ).catch((err) =>
        console.warn("[GroupChatService] member add notification failed", err),
      );
    }

    return participant;
  }

  /**
   * Remove participant from group
   */
  public static async removeParticipant(
    groupId: string,
    userIdToRemove: string,
    removedById: string,
    io?: any,
  ) {
    const group = await prisma.groupChat.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Check if requester is admin OR if they're removing themselves (leaving)
    const remover = await prisma.groupChatParticipant.findFirst({
      where: {
        groupId,
        userId: removedById,
      },
    });

    const isSelfRemoval = removedById === userIdToRemove;

    if (!remover) {
      throw new AppError("You are not a participant of this group", 403);
    }

    // Prevent creator from leaving - they should delete the group instead
    if (isSelfRemoval && group.createdById === userIdToRemove) {
      throw new AppError(
        "Creator cannot leave group. Delete the group instead.",
        403,
      );
    }

    if (!isSelfRemoval && remover.role !== "admin") {
      throw new AppError(
        "Unauthorized - only admins can remove other participants",
        403,
      );
    }

    await prisma.groupChatParticipant.deleteMany({
      where: {
        groupId,
        userId: userIdToRemove,
      },
    });

    if (io) {
      const adminIds = await prisma.groupChatParticipant.findMany({
        where: { groupId, role: "admin" },
        select: { userId: true },
      });
      const targets = Array.from(
        new Set([userIdToRemove, ...adminIds.map((a) => a.userId)]).values(),
      ).filter((id) => id !== removedById);

      NotificationHelper.sendToUsers(
        io,
        targets,
        "Group membership update",
        `A member was removed from the group.`,
        "warning",
        `/group/${groupId}`,
        "group",
        groupId,
        { removedUserId: userIdToRemove },
        30_000,
        `group:member:${groupId}`,
      ).catch((err) =>
        console.warn(
          "[GroupChatService] member removal notification failed",
          err,
        ),
      );
    }

    return { success: true, userId: userIdToRemove };
  }

  /**
   * Mark message as read
   * Mark message as read
   * Uses Redis INCR for fast async counting
   */
  public static async markMessageAsRead(messageId: string, userId: string) {
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const existing = await prisma.groupMessageRead.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    await prisma.groupMessageRead.upsert({
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

    // ✅ Increment counter in Redis (non-blocking, async)
    const counterService = RedisCounterService.getInstance();
    await counterService
      .incrementReadCount(messageId, "group", 1)
      .catch((err) => console.error("Counter increment error:", err));

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(message.groupId, messageId, {}, "group")
      .catch((err) => console.error("Cache update error:", err));

    // Decrement global unread counter only when first time read
    if (!existing) {
      const { MessageNotificationService } =
        await import("./messageNotificationService");
      await MessageNotificationService.decrementUnread(userId).catch((err) =>
        console.warn("[GroupChatService] unread decrement failed", err),
      );
    }

    return { success: true };
  }

  /**
   * Toggle like on a message
   * Uses Redis INCR for fast async counting
   * Actual like is stored in database, count is updated asynchronously
   */
  public static async toggleLike(messageId: string, userId: string, io?: any) {
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const existingLike = await prisma.groupMessageLike.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (existingLike) {
      await prisma.groupMessageLike.delete({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });
    } else {
      await prisma.groupMessageLike.create({
        data: {
          messageId,
          userId,
        },
      });
    }

    // Use a fresh DB count — authoritative, survives Redis restarts and syncs
    const likeCount = await prisma.groupMessageLike.count({
      where: { messageId },
    });

    // Write back to DB so subsequent fetches return the correct count
    await prisma.groupMessage.update({
      where: { id: messageId },
      data: { likeCount },
    });

    // Update Redis cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(message.groupId, messageId, { likeCount }, "group")
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:liked to group room
    if (io && message) {
      try {
        io.of("/group").to(`group:${message.groupId}`).emit("message:liked", {
          messageId,
          userId,
          liked: !existingLike,
          likeCount,
        });
        console.log(
          `[GroupChatService] 📢 Broadcasted message:liked to group:${message.groupId}`,
        );
      } catch (err) {
        console.warn("[GroupChatService] message:liked broadcast failed", err);
      }
    }

    return { liked: !existingLike, likeCount };
  }

  /**
   * Add comment to a message
   */
  public static async addComment(
    messageId: string,
    userId: string,
    text: string,
    parentId?: string,
    io?: any,
  ) {
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (parentId) {
      const parent = await prisma.groupComment.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new AppError("Parent comment not found", 404);
      }
    }

    const comment = await prisma.groupComment.create({
      data: {
        messageId,
        userId,
        text,
        parentId,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Update denormalized commentCount
    const commentCount = await prisma.groupComment.count({
      where: {
        messageId,
        parentId: null, // Only count top-level comments
      },
    });

    await prisma.groupMessage.update({
      where: { id: messageId },
      data: { commentCount },
    });

    // Broadcast comment:created to group room
    if (io && message) {
      try {
        io.of("/group")
          .to(`group:${message.groupId}`)
          .emit("comment:created", comment);
        console.log(
          `[GroupChatService] 📢 Broadcasted comment:created to group:${message.groupId}`,
        );
      } catch (err) {
        console.warn(
          "[GroupChatService] comment:created broadcast failed",
          err,
        );
      }
    }

    return comment;
  }

  /**
   * Get comments for a message with pagination
   */
  public static async getComments(
    messageId: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const comments = await prisma.groupComment.findMany({
      where: {
        messageId,
        parentId: null, // Only get top-level comments
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.groupComment.count({
      where: { messageId, parentId: null },
    });

    return {
      comments,
      total,
      limit,
      offset,
    };
  }

  /**
   * Edit a comment
   */
  public static async editComment(
    commentId: string,
    userId: string,
    text: string,
    io?: any,
  ) {
    const comment = await prisma.groupComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.userId !== userId) {
      throw new AppError("Unauthorized - only comment author can edit", 403);
    }

    const updated = await prisma.groupComment.update({
      where: { id: commentId },
      data: {
        text,
      },
      include: {
        user: {
          select: { id: true, fullNames: true, photo: true },
        },
      },
    });

    // Broadcast comment:edited to group room
    if (io) {
      try {
        const parentMessage = await prisma.groupMessage.findUnique({
          where: { id: comment.messageId },
          select: { groupId: true },
        });
        if (parentMessage) {
          io.of("/group")
            .to(`group:${parentMessage.groupId}`)
            .emit("comment:edited", updated);
          console.log(
            `[GroupChatService] 📢 Broadcasted comment:edited to group:${parentMessage.groupId}`,
          );
        }
      } catch (err) {
        console.warn("[GroupChatService] comment:edited broadcast failed", err);
      }
    }

    return updated;
  }

  /**
   * Delete a comment
   */
  public static async deleteComment(
    commentId: string,
    userId: string,
    io?: any,
  ) {
    const comment = await prisma.groupComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.userId !== userId) {
      throw new AppError("Unauthorized - only comment author can delete", 403);
    }

    await prisma.groupComment.delete({
      where: { id: commentId },
    });

    // Update denormalized commentCount
    const commentCount = await prisma.groupComment.count({
      where: {
        messageId: comment.messageId,
        parentId: null,
      },
    });

    await prisma.groupMessage.update({
      where: { id: comment.messageId },
      data: { commentCount },
    });

    // Broadcast comment:deleted to group room
    if (io) {
      try {
        const parentMessage = await prisma.groupMessage.findUnique({
          where: { id: comment.messageId },
          select: { groupId: true },
        });
        if (parentMessage) {
          io.of("/group")
            .to(`group:${parentMessage.groupId}`)
            .emit("comment:deleted", { commentId });
          console.log(
            `[GroupChatService] 📢 Broadcasted comment:deleted to group:${parentMessage.groupId}`,
          );
        }
      } catch (err) {
        console.warn(
          "[GroupChatService] comment:deleted broadcast failed",
          err,
        );
      }
    }

    return { success: true, commentId };
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
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("Unauthorized - can only edit own messages", 403);
    }

    const editedAt = new Date();
    const updatedMessage = await prisma.groupMessage.update({
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
        message.groupId,
        messageId,
        { content, editedAt: editedAt.toISOString() },
        "group",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:edited to group room
    if (io) {
      try {
        io.of("/group")
          .to(`group:${message.groupId}`)
          .emit("message:edited", updatedMessage);
        console.log(
          `[GroupChatService] 📢 Broadcasted message:edited to group:${message.groupId}`,
        );
      } catch (err) {
        console.warn("[GroupChatService] message:edited broadcast failed", err);
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
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("Unauthorized - can only delete own messages", 403);
    }

    await prisma.groupMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, content: "[Deleted]" },
    });

    // Update cache asynchronously
    const cache = CacheService.getInstance();
    await cache
      .updateMessage(
        message.groupId,
        messageId,
        { isDeleted: true, content: "[Deleted]" },
        "group",
      )
      .catch((err) => console.error("Cache update error:", err));

    // Broadcast message:deleted to group room
    if (io) {
      try {
        io.of("/group")
          .to(`group:${message.groupId}`)
          .emit("message:deleted", { messageId });
        console.log(
          `[GroupChatService] 📢 Broadcasted message:deleted to group:${message.groupId}`,
        );
      } catch (err) {
        console.warn(
          "[GroupChatService] message:deleted broadcast failed",
          err,
        );
      }
    }

    return { success: true, messageId };
  }

  /**
   * Update group chat info (name, description, photo)
   */
  public static async updateGroup(
    groupId: string,
    userId: string,
    data: { name?: string; description?: string; photo?: string },
  ) {
    const group = await prisma.groupChat.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Only creator can update group info
    if (group.createdById !== userId) {
      throw new AppError("Only creator can update group", 403);
    }

    return await prisma.groupChat.update({
      where: { id: groupId },
      data,
      include: {
        creator: {
          select: { id: true, fullNames: true, photo: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
    });
  }

  /**
   * Delete group chat
   */
  public static async deleteGroup(groupId: string, userId: string) {
    const group = await prisma.groupChat.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError("Group not found", 404);
    }

    // Only creator can delete group
    if (group.createdById !== userId) {
      throw new AppError("Only creator can delete group", 403);
    }

    // Soft delete - mark as archived
    return await prisma.groupChat.update({
      where: { id: groupId },
      data: { isArchived: true },
    });
  }

  /**
   * Get unread message count for all groups for a user
   */
  public static async getUnreadCounts(userId: string) {
    const groups = await prisma.groupChat.findMany({
      where: {
        isArchived: false, // Don't count unread from archived groups
        participants: {
          some: { userId },
        },
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

    const result = groups.map((group) => ({
      groupId: group.id,
      unreadCount: group.messages.length,
    }));

    const totalUnread = result.reduce(
      (sum, group) => sum + group.unreadCount,
      0,
    );

    return {
      total: totalUnread,
      byGroup: result,
    };
  }

  /**
   * Get unread messages for a specific group
   */
  public static async getUnreadMessagesInGroup(
    groupId: string,
    userId: string,
  ) {
    const group = await prisma.groupChat.findFirst({
      where: {
        id: groupId,
        isArchived: false, // Don't allow access to archived groups
        participants: {
          some: { userId },
        },
      },
    });

    if (!group) {
      throw new AppError("Group not found or unauthorized", 404);
    }

    const unreadMessages = await prisma.groupMessage.findMany({
      where: {
        groupId,
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
      groupId,
      unreadCount: unreadMessages.length,
      messages: unreadMessages,
    };
  }

  /**
   * Get messages from a group chat with pagination
   */
  public static async getGroupMessages(
    groupId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    // Verify user is a participant
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!participant) {
      throw new AppError("User is not a member of this group", 403);
    }

    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      include: {
        sender: {
          select: { id: true, fullNames: true, photo: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, fullNames: true, photo: true },
            },
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Mark only unread messages in group as read asynchronously (non-blocking)
    setTimeout(() => {
      prisma.groupMessage
        .findMany({
          where: {
            groupId,
            senderId: { not: userId },
            reads: { none: { userId } },
          },
          select: { id: true },
        })
        .then((unreadMessages) => {
          if (unreadMessages.length === 0) return;
          return prisma.groupMessageRead.createMany({
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
   * Search messages in a group chat by content, across the full conversation
   * history (not just the most-recently-loaded page).
   */
  public static async searchGroupMessages(
    groupId: string,
    userId: string,
    q: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    // Verify user is a participant
    const participant = await prisma.groupChatParticipant.findFirst({
      where: { groupId, userId },
    });

    if (!participant) {
      throw new AppError("User is not a member of this group", 403);
    }

    const where = {
      groupId,
      content: { contains: q, mode: "insensitive" as const },
    };

    const [messages, total] = await Promise.all([
      prisma.groupMessage.findMany({
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
      prisma.groupMessage.count({ where }),
    ]);

    const data = await Promise.all(
      messages.map(async (msg) => {
        const offsetInConversation = await prisma.groupMessage.count({
          where: { groupId, timestamp: { gt: msg.timestamp } },
        });
        return { ...msg, offsetInConversation };
      }),
    );

    return { data, total };
  }
}
