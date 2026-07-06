import { BaseService } from "./Service";
import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { MeetingRecordingService } from "./meetingRecordingService";

const ATTENDANCE_SELECT_USER = {
  id: true,
  fullNames: true,
  email: true,
  photo: true,
  gender: true,
  district: true,
  sector: true,
  cell: true,
  village: true,
  userRoles: { select: { name: true } },
};

const ATTENDANCE_SELECT_EVENT = {
  id: true,
  title: true,
  startAt: true,
  createdById: true,
};

export class MeetingAttendanceService extends BaseService {
  /**
   * Record a participant joining a meeting.
   * Returns the created attendance record id (needed for the leave call).
   */
  public static async recordJoin(data: {
    streamRoomId: string;
    userId?: string;
    guestName?: string;
  }) {
    try {
      const { streamRoomId, userId, guestName } = data;

      const eventId =
        await MeetingRecordingService.resolveCalendarEventId(streamRoomId);

      const record = await prisma.meetingAttendance.create({
        data: {
          streamRoomId,
          eventId,
          userId: userId ?? null,
          guestName: guestName ?? null,
        },
      });

      return {
        message: "Attendance join recorded",
        statusCode: 201,
        data: { attendanceId: record.id },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Record a participant leaving — fills leftAt and computes durationSec.
   */
  public static async recordLeave(data: {
    attendanceId?: string;
    streamRoomId?: string;
    userId?: string;
  }) {
    try {
      const { attendanceId, streamRoomId, userId } = data;

      let record = attendanceId
        ? await prisma.meetingAttendance.findUnique({ where: { id: attendanceId } })
        : null;

      // Fallback: find the latest open record for this user/room
      if (!record && streamRoomId) {
        record = await prisma.meetingAttendance.findFirst({
          where: {
            streamRoomId,
            ...(userId ? { userId } : {}),
            leftAt: null,
          },
          orderBy: { joinedAt: "desc" },
        });
      }

      if (!record) return { message: "Attendance record not found", statusCode: 404 };

      const leftAt = new Date();
      const durationSec = Math.round(
        (leftAt.getTime() - record.joinedAt.getTime()) / 1000,
      );

      const updated = await prisma.meetingAttendance.update({
        where: { id: record.id },
        data: { leftAt, durationSec },
      });

      return {
        message: "Attendance leave recorded",
        statusCode: 200,
        data: updated,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Return all attendance records for a calendar event, resolved from either
   * the direct eventId or the streamRoomId.
   */
  public static async getEventAttendance(eventIdOrRoomId: string) {
    try {
      // Try direct eventId first, then streamRoomId lookup
      let eventId =
        await MeetingRecordingService.resolveCalendarEventId(eventIdOrRoomId);
      if (!eventId) eventId = eventIdOrRoomId;

      const records = await prisma.meetingAttendance.findMany({
        where: {
          OR: [{ eventId }, { streamRoomId: eventIdOrRoomId }],
        },
        include: {
          user: { select: ATTENDANCE_SELECT_USER },
          event: { select: ATTENDANCE_SELECT_EVENT },
        },
        orderBy: { joinedAt: "asc" },
      });

      return {
        message: "Attendance fetched successfully",
        statusCode: 200,
        data: records,
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Return all EBUMENYI_MEETING events with attendance counts and aggregate stats.
   */
  public static async getMeetingsList() {
    try {
      const now = new Date();

      const events = await prisma.calendarEvent.findMany({
        where: { meetingType: "EBUMENYI_MEETING" },
        include: {
          createdBy: { select: { id: true, fullNames: true, email: true } },
        },
        orderBy: { startAt: "desc" },
      });

      // Per-event duration aggregates
      const durationAggs = await prisma.meetingAttendance.groupBy({
        by: ["eventId"],
        _sum: { durationSec: true },
        _count: { id: true },
      });
      const durationMap = new Map(durationAggs.map((a) => [a.eventId, a]));

      // Count UNIQUE participants per event (same logic as the attendance detail page).
      // Group registered users by userId and guests by guestName so that rejoins
      // are not double-counted.
      const [registeredGroups, guestGroups] = await Promise.all([
        prisma.meetingAttendance.groupBy({
          by: ["eventId", "userId"],
          where: { userId: { not: null } },
        }),
        prisma.meetingAttendance.groupBy({
          by: ["eventId", "guestName"],
          where: { userId: null },
        }),
      ]);

      const uniqueCountMap = new Map<string, number>();
      for (const g of registeredGroups) {
        if (!g.eventId) continue;
        uniqueCountMap.set(g.eventId, (uniqueCountMap.get(g.eventId) ?? 0) + 1);
      }
      for (const g of guestGroups) {
        if (!g.eventId) continue;
        uniqueCountMap.set(g.eventId, (uniqueCountMap.get(g.eventId) ?? 0) + 1);
      }

      const rows = events.map((e) => {
        const agg = e.id ? durationMap.get(e.id) : undefined;
        const status = e.isCancelled
          ? "CANCELLED"
          : e.startAt > now
          ? "UPCOMING"
          : "COMPLETED";
        return {
          id: e.id,
          title: e.title,
          meetingType: e.meetingType,
          host: e.createdBy,
          startAt: e.startAt,
          endAt: e.endAt,
          status,
          participantCount: uniqueCountMap.get(e.id) ?? 0,
          totalDurationSec: agg?._sum?.durationSec ?? 0,
        };
      });

      const totalParticipants = rows.reduce((s, r) => s + r.participantCount, 0);
      const allDurations = rows.filter((r) => r.participantCount > 0);
      const avgDurationSec =
        allDurations.length > 0
          ? Math.round(
              allDurations.reduce((s, r) => s + (r.totalDurationSec / (r.participantCount || 1)), 0) /
                allDurations.length,
            )
          : 0;

      return {
        message: "Meetings fetched",
        statusCode: 200,
        data: {
          meetings: rows,
          stats: {
            total: rows.length,
            upcoming: rows.filter((r) => r.status === "UPCOMING").length,
            completed: rows.filter((r) => r.status === "COMPLETED").length,
            cancelled: rows.filter((r) => r.status === "CANCELLED").length,
            totalParticipants,
            avgDurationSec,
          },
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Export attendance for an event as a CSV string.
   */
  public static async exportEventAttendanceCsv(
    eventIdOrRoomId: string,
  ): Promise<string> {
    const { data: records } = await this.getEventAttendance(eventIdOrRoomId);

    // Group by user (sum duration for repeat joins)
    const grouped = new Map<string, any>();
    for (const r of records as any[]) {
      const key = r.userId ?? `guest:${r.guestName ?? "unknown"}`;
      if (!grouped.has(key)) {
        grouped.set(key, { ...r, totalDurationSec: r.durationSec ?? 0 });
      } else {
        grouped.get(key).totalDurationSec += r.durationSec ?? 0;
      }
    }

    const header = "Name,Email,Role,Gender,District,Sector,Cell,Village,Type,Duration (min)\n";
    const now = Date.now();
    const rows = [...grouped.values()]
      .map((r) => {
        const name = r.user?.fullNames ?? r.guestName ?? "Unknown";
        const email = r.user?.email ?? "—";
        const role = r.user?.userRoles?.[0]?.name ?? "—";
        const gender = r.user?.gender ?? "—";
        const district = r.user?.district ?? "—";
        const sector = r.user?.sector ?? "—";
        const cell = r.user?.cell ?? "—";
        const village = r.user?.village ?? "—";
        const type = r.userId ? "Registered" : "Guest";
        const totalSec = r.totalDurationSec || Math.round((now - new Date(r.joinedAt).getTime()) / 1000);
        const durMin = (totalSec / 60).toFixed(1);
        return `"${name}","${email}","${role}","${gender}","${district}","${sector}","${cell}","${village}","${type}","${durMin}"`;
      })
      .join("\n");

    return header + rows;
  }
}
