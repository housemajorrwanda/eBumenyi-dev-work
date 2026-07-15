import { prisma } from "../utils/client";

export class OnboardingService {
  static async getCompletedTours(userId: string): Promise<string[]> {
    const records = await prisma.onboardingProgress.findMany({
      where: { userId },
      select: { tourKey: true },
    });
    return records.map((r) => r.tourKey);
  }

  static async completeTour(userId: string, tourKey: string): Promise<void> {
    await prisma.onboardingProgress.upsert({
      where: { userId_tourKey: { userId, tourKey } },
      create: { userId, tourKey },
      update: {},
    });
  }
}
