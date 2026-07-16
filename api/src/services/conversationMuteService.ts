import { prisma } from "../utils/client";

export class ConversationMuteService {
  /**
   * Mute or unmute a conversation for a user
   */
  public static async setMute(
    userId: string,
    conversationType: "direct" | "group" | "community",
    conversationId: string,
    muted: boolean,
  ) {
    if (muted) {
      return await prisma.conversationMute.upsert({
        where: {
          userId_conversationType_conversationId: {
            userId,
            conversationType,
            conversationId,
          },
        },
        update: {},
        create: {
          userId,
          conversationType,
          conversationId,
        },
      });
    }

    await prisma.conversationMute.deleteMany({
      where: { userId, conversationType, conversationId },
    });

    return { userId, conversationType, conversationId, muted: false };
  }

  /**
   * Get the set of conversation ids of a given type muted by a user
   */
  public static async getMutedConversationIds(
    userId: string,
    conversationType: "direct" | "group" | "community",
  ): Promise<string[]> {
    const mutes = await prisma.conversationMute.findMany({
      where: { userId, conversationType },
      select: { conversationId: true },
    });

    return mutes.map((m) => m.conversationId);
  }

  /**
   * Check if a single conversation is muted by a user
   */
  public static async isMuted(
    userId: string,
    conversationType: "direct" | "group" | "community",
    conversationId: string,
  ): Promise<boolean> {
    const mute = await prisma.conversationMute.findUnique({
      where: {
        userId_conversationType_conversationId: {
          userId,
          conversationType,
          conversationId,
        },
      },
    });

    return !!mute;
  }
}
