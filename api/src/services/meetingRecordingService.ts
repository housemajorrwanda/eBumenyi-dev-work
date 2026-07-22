import { BaseService } from "./Service";
import { prisma } from "../utils/client";
import AppError from "../utils/error";
import axios from "axios";
import path from "path";
import fs from "fs";

const RECORDING_SELECT_EVENT = {
  id: true,
  title: true,
  description: true,
  startAt: true,
};

const RECORDING_SELECT_USER = {
  id: true,
  fullNames: true,
  email: true,
  photo: true,
};

type RecordingRow = {
  id: string;
  eventId: string | null;
  userId: string;
  url: string;
  title: string | null;
  isPublished: boolean;
  publishedTo: "ALL" | "TRAINEES" | "INVITED";
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  event?: { id: string; title: string; description?: string | null; startAt: Date } | null;
  user?: {
    id: string;
    fullNames: string;
    email: string | null;
    photo: string | null;
  };
};

export class MeetingRecordingService extends BaseService {
  private static extractRoomSlugFromRecordingUrl(
    url: string,
  ): string | undefined {
    return url.match(/\/Recordings\/([^/]+)\//)?.[1];
  }

  /**
   * Resolve a Stream room id or calendar UUID to a CalendarEvent id.
   */
  public static async resolveCalendarEventId(
    roomOrEventId?: string,
  ): Promise<string | undefined> {
    if (!roomOrEventId || roomOrEventId === "unknown") {
      return undefined;
    }

    const slug = roomOrEventId.replace(/\/$/, "").trim();

    const direct = await prisma.calendarEvent.findUnique({
      where: { id: slug },
      select: { id: true },
    });
    if (direct) {
      return direct.id;
    }

    const byStreamRoom = await prisma.calendarEvent.findFirst({
      where: { streamRoomId: slug },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (byStreamRoom) {
      return byStreamRoom.id;
    }

    const byLocation = await prisma.calendarEvent.findFirst({
      where: {
        location: { contains: slug, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (byLocation) {
      return byLocation.id;
    }

    const byMeetingPath = await prisma.calendarEvent.findFirst({
      where: {
        location: { contains: `meeting/${slug}`, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return byMeetingPath?.id;
  }

  private static async resolveEventIdForRecording(
    eventId?: string,
    recordingUrl?: string,
  ): Promise<string | undefined> {
    const fromParam = eventId
      ? await this.resolveCalendarEventId(eventId)
      : undefined;
    if (fromParam) {
      return fromParam;
    }

    if (!recordingUrl) {
      return undefined;
    }

    const slug = this.extractRoomSlugFromRecordingUrl(recordingUrl);
    if (!slug) {
      return undefined;
    }

    return this.resolveCalendarEventId(slug);
  }

  private static async hydrateRecording<T extends RecordingRow>(
    recording: T,
  ): Promise<T> {
    if (recording.event?.title) {
      return recording;
    }

    const eventId =
      recording.eventId ??
      (await this.resolveEventIdForRecording(undefined, recording.url));

    if (!eventId) {
      return recording;
    }

    if (!recording.eventId) {
      await prisma.meetingRecording
        .update({
          where: { id: recording.id },
          data: { eventId },
        })
        .catch(() => undefined);
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: RECORDING_SELECT_EVENT,
    });

    return {
      ...recording,
      eventId,
      event: event ?? null,
    };
  }

  private static async hydrateRecordings<T extends RecordingRow>(
    recordings: T[],
  ): Promise<T[]> {
    return Promise.all(recordings.map((r) => this.hydrateRecording(r)));
  }

  /** Backfill eventId on recordings stored under legacy Stream room folders. */
  public static async relinkOrphanedRecordings(): Promise<number> {
    const orphans = await prisma.meetingRecording.findMany({
      where: { eventId: null },
      select: { id: true, url: true },
    });

    let linked = 0;
    for (const recording of orphans) {
      const resolved = await this.resolveEventIdForRecording(
        undefined,
        recording.url,
      );
      if (!resolved) continue;

      await prisma.meetingRecording.update({
        where: { id: recording.id },
        data: { eventId: resolved },
      });
      linked++;
    }

    if (linked > 0) {
      console.log(
        `[Recordings] Relinked ${linked} orphaned recording(s) to calendar events`,
      );
    }
    return linked;
  }

  public static async createRecording(data: {
    eventId?: string;
    userId: string;
    url: string;
    title?: string;
  }) {
    try {
      const { userId, url, title } = data;
      const eventId = await this.resolveEventIdForRecording(data.eventId, url);

      const recording = await prisma.meetingRecording.create({
        data: {
          eventId,
          userId,
          url,
          title,
        },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
          user: { select: RECORDING_SELECT_USER },
        },
      });

      const hydrated = await this.hydrateRecording(recording);

      return {
        message: "Recording stored successfully",
        statusCode: 201,
        data: hydrated,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error, 500);
    }
  }

  public static async syncRecordingFromUrl(data: {
    eventId?: string;
    userId: string;
    recordingUrl: string;
    title?: string;
  }) {
    try {
      const { userId, recordingUrl, title } = data;
      const resolvedEventId = await this.resolveEventIdForRecording(
        data.eventId,
        undefined,
      );
      const storageKey = data.eventId || resolvedEventId || "unknown";
      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        "Recordings",
        storageKey,
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${userId}-${Date.now()}.mp4`;
      const localPath = path.join(uploadDir, filename);
      const urlPath = `/uploads/Recordings/${storageKey}/${filename}`;

      console.log(`📥 Downloading recording from Stream: ${recordingUrl}`);
      const response = await axios({
        method: "GET",
        url: recordingUrl,
        responseType: "stream",
      });

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`✅ Recording saved locally to: ${localPath}`);

      const eventId = await this.resolveEventIdForRecording(
        data.eventId,
        urlPath,
      );

      const recording = await prisma.meetingRecording.create({
        data: {
          eventId,
          userId,
          url: urlPath,
          title,
        },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
        },
      });

      const hydrated = await this.hydrateRecording(recording);

      return {
        message: "Recording synced and stored successfully",
        statusCode: 201,
        data: hydrated,
      };
    } catch (error) {
      console.error("❌ Failed to sync recording:", error);
      throw new AppError(error, 500);
    }
  }

  public static async publishRecording(
    id: string,
    publishedTo: "ALL" | "TRAINEES" | "INVITED",
    invitedUserIds?: string[],
  ) {
    try {
      const recording = await prisma.meetingRecording.findUnique({
        where: { id },
      });

      if (!recording) {
        throw new AppError("Recording not found", 404);
      }

      const updated = await prisma.meetingRecording.update({
        where: { id },
        data: {
          isPublished: true,
          publishedTo,
          publishedAt: new Date(),
        },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
          user: { select: RECORDING_SELECT_USER },
        },
      });

      // Manage invite list when audience is INVITED
      if (publishedTo === "INVITED" && invitedUserIds?.length) {
        // Remove existing invites then re-create
        await prisma.meetingRecordingInvite.deleteMany({
          where: { recordingId: id },
        });
        await prisma.meetingRecordingInvite.createMany({
          data: invitedUserIds.map((userId) => ({ recordingId: id, userId })),
          skipDuplicates: true,
        });
      } else if (publishedTo !== "INVITED") {
        // Clear any leftover invites if switching away from INVITED
        await prisma.meetingRecordingInvite.deleteMany({
          where: { recordingId: id },
        });
      }

      return {
        message: "Recording published successfully",
        statusCode: 200,
        data: await this.hydrateRecording(updated),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error, 500);
    }
  }

  public static async unpublishRecording(id: string) {
    try {
      const recording = await prisma.meetingRecording.findUnique({
        where: { id },
      });

      if (!recording) {
        throw new AppError("Recording not found", 404);
      }

      const updated = await prisma.meetingRecording.update({
        where: { id },
        data: {
          isPublished: false,
          publishedAt: null,
        },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
          user: { select: RECORDING_SELECT_USER },
        },
      });

      return {
        message: "Recording unpublished successfully",
        statusCode: 200,
        data: await this.hydrateRecording(updated),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error, 500);
    }
  }

  public static async deleteRecording(id: string) {
    try {
      const recording = await prisma.meetingRecording.findUnique({
        where: { id },
      });

      if (!recording) {
        throw new AppError("Recording not found", 404);
      }

      if (recording.url.startsWith("/uploads/")) {
        const localPath = path.join(process.cwd(), recording.url);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }

      await prisma.meetingRecording.delete({ where: { id } });

      return {
        message: "Recording deleted successfully",
        statusCode: 200,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error, 500);
    }
  }

  /**
   * Returns published recordings visible to the requesting user:
   *  - ALL      → everyone
   *  - TRAINEES → only users with TRAINEE or CEHO role
   *  - INVITED  → only users listed in MeetingRecordingInvite
   */
  public static async getPublishedRecordings(
    userId: string,
    userRoles: string[],
  ) {
    try {
      await this.relinkOrphanedRecordings();

      const isTrainee = userRoles.some((r) =>
        ["TRAINEE", "CEHO"].includes(r),
      );

      const recordings = await prisma.meetingRecording.findMany({
        where: {
          isPublished: true,
          OR: [
            { publishedTo: "ALL" },
            ...(isTrainee ? [{ publishedTo: "TRAINEES" as const }] : []),
            {
              publishedTo: "INVITED",
              invites: { some: { userId } },
            },
          ],
        },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
          user: { select: RECORDING_SELECT_USER },
        },
        orderBy: { publishedAt: "desc" },
      });

      return {
        message: "Published recordings fetched successfully",
        statusCode: 200,
        data: await this.hydrateRecordings(recordings),
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getRecordingsByEvent(eventId: string) {
    try {
      const recordings = await prisma.meetingRecording.findMany({
        where: { eventId },
        include: {
          user: { select: RECORDING_SELECT_USER },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        message: "Recordings fetched successfully",
        statusCode: 200,
        data: recordings,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getMyRecordings(userId: string) {
    try {
      await this.relinkOrphanedRecordings();

      const recordings = await prisma.meetingRecording.findMany({
        where: { userId },
        include: {
          event: { select: RECORDING_SELECT_EVENT },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        message: "Your recordings fetched successfully",
        statusCode: 200,
        data: await this.hydrateRecordings(recordings),
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  public static async getAllRecordings() {
    try {
      await this.relinkOrphanedRecordings();

      const recordings = await prisma.meetingRecording.findMany({
        include: {
          event: { select: RECORDING_SELECT_EVENT },
          user: { select: RECORDING_SELECT_USER },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        message: "All recordings fetched successfully",
        statusCode: 200,
        data: await this.hydrateRecordings(recordings),
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }
}
