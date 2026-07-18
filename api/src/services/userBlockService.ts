import { prisma } from "../utils/client";
import AppError from "../utils/error";

export class UserBlockService {
  /**
   * Block a user
   */
  public static async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new AppError("You cannot block yourself", 400);
    }

    return await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
      update: {},
      create: { blockerId, blockedId },
    });
  }

  /**
   * Unblock a user
   */
  public static async unblockUser(blockerId: string, blockedId: string) {
    await prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });

    return { blockerId, blockedId, blocked: false };
  }

  /**
   * Get the list of users blocked by a user
   */
  public static async getBlockedUsers(blockerId: string) {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: { id: true, fullNames: true, photo: true, phoneNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return blocks.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      user: b.blocked,
    }));
  }

  /**
   * Check whether either user has blocked the other
   */
  public static async isBlocked(
    userId1: string,
    userId2: string,
  ): Promise<boolean> {
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId1, blockedId: userId2 },
          { blockerId: userId2, blockedId: userId1 },
        ],
      },
    });

    return !!block;
  }
}
