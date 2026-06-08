import { prisma } from "../utils/client";
import { NotificationService } from "./NotificationService";
import { pushService } from "./pushService";
import { Server as SocketIOServer } from "socket.io";

export type ConversationKind = "direct" | "group" | "community";

const THRESHOLD_STEP = 5;

export class MessageNotificationService {
  /**
   * Increment total unread counter for given users and emit threshold notifications (5/10/15...)
   */
  static async incrementUnreadForUsers(
    userIds: string[],
    actorId: string,
    conversationId: string,
    kind: ConversationKind,
    io?: SocketIOServer,
  ) {
    for (const userId of userIds) {
      if (userId === actorId) continue; // never notify sender
      const counter = await prisma.messageUnreadCounter.upsert({
        where: { userId },
        update: { totalUnread: { increment: 1 } },
        create: { userId, totalUnread: 1 },
      });

      // Emit real-time per-conversation unread increment to user's personal room
      if (io) {
        io.to(`user:${userId}`).emit("message:new_unread", {
          conversationId,
          kind,
        });
      }

      const newTotal = counter.totalUnread;
      if (newTotal % THRESHOLD_STEP === 0) {
        await this.sendThresholdNotification(
          userId,
          conversationId,
          kind,
          newTotal,
          io,
        );
      }
    }
  }

  /**
   * Decrement total unread counter (no lower than zero)
   */
  static async decrementUnread(userId: string, delta = 1) {
    await prisma.messageUnreadCounter.upsert({
      where: { userId },
      update: {
        totalUnread: {
          decrement: delta,
        },
      },
      create: { userId, totalUnread: 0 },
    });
    const counter = await prisma.messageUnreadCounter.findUnique({
      where: { userId },
      select: { totalUnread: true },
    });
    if (counter && counter.totalUnread < 0) {
      await prisma.messageUnreadCounter.update({
        where: { userId },
        data: { totalUnread: 0 },
      });
    }
  }

  private static async sendThresholdNotification(
    userId: string,
    conversationId: string,
    kind: ConversationKind,
    totalUnread: number,
    io?: SocketIOServer,
  ) {
    const title = "Ubutumwa bushya";
    const message = `Ufite ${totalUnread} ubutumwa butasomwe`;
    const actionUrl = `/chat/${conversationId}`;
    const entityType = kind === "direct" ? "direct_chat" : "group_chat";
    const dedupKey = `chat:${conversationId}:${userId}`;
    const cooldownMs = 60_000; // 60s burst window

    const notification = await NotificationService.createNotification(
      userId,
      title,
      message,
      "new_message",
      actionUrl,
      entityType,
      conversationId,
      { totalUnread },
      { cooldownMs, dedupKey },
    );

    if (io) {
      const room = `user:${userId}`;
      // OPTIMIZATION: Only emit unread count instead of full notification object
      // Reduces bandwidth by ~90% (200-500 bytes per notification)
      const unreadCount = await NotificationService.getUnreadCount(userId);
      io.to(room).emit("unread_count_updated", { unreadCount });
    }

    await pushService
      .sendToUser(userId, {
        title,
        body: message,
        type: "new_message",
        entityId: conversationId,
        deepLink: actionUrl,
        data: {
          entityType,
          actionUrl,
          totalUnread: totalUnread.toString(),
        },
      })
      .catch((err) =>
        console.warn("[MessageNotificationService] push send failed", err),
      );
  }
}
