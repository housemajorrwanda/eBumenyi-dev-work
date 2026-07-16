import { prisma } from "../utils/client";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // a session ends after 15 min of no heartbeat

export class ActivityService {
  /**
   * Fire-and-forget session heartbeat. Bumps an existing open session
   * (same user + courseId context, last seen within the idle window) or
   * starts a new one. Never throws — the caller treats this as best-effort
   * telemetry, not a critical operation.
   */
  public static async heartbeat(
    userId: string,
    courseId?: string,
  ): Promise<void> {
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - IDLE_TIMEOUT_MS);

    const openSession = await prisma.userSession.findFirst({
      where: {
        userId,
        courseId: courseId ?? null,
        lastSeenAt: { gte: idleCutoff },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    if (openSession) {
      await prisma.userSession.update({
        where: { id: openSession.id },
        data: { lastSeenAt: now },
      });
    } else {
      await prisma.userSession.create({
        data: { userId, courseId: courseId ?? null, startedAt: now, lastSeenAt: now },
      });
    }
  }
}
