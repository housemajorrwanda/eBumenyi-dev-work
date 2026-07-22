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
  hospital: { select: { name: true } },
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

      // Invited-vs-attended: only internally-invited (registered) participants
      // are counted, matched by exact userId. Guests are never part of this ratio,
      // and are never considered "absent" since there's no reliable way to match
      // an externally-invited email to a guest's typed join-name.
      const attendedUserIds = new Set(
        records.filter((r) => r.userId).map((r) => r.userId as string),
      );
      const invitedParticipants = eventId
        ? await prisma.calendarEventParticipant.findMany({
            where: { eventId },
            select: { userId: true, user: { select: ATTENDANCE_SELECT_USER } },
          })
        : [];
      const invitedTotal = invitedParticipants.length;
      const attendedInvited = invitedParticipants.filter((p) =>
        attendedUserIds.has(p.userId),
      );
      const absentees = invitedParticipants
        .filter((p) => !attendedUserIds.has(p.userId))
        .map((p) => p.user);

      return {
        message: "Attendance fetched successfully",
        statusCode: 200,
        data: records,
        invited: {
          total: invitedTotal,
          attended: attendedInvited.length,
          pct: invitedTotal > 0 ? Math.round((attendedInvited.length / invitedTotal) * 100) : null,
          absentees,
        },
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
      const [registeredGroups, guestGroups, invitedParticipants] = await Promise.all([
        prisma.meetingAttendance.groupBy({
          by: ["eventId", "userId"],
          where: { userId: { not: null } },
        }),
        prisma.meetingAttendance.groupBy({
          by: ["eventId", "guestName"],
          where: { userId: null },
        }),
        prisma.calendarEventParticipant.findMany({
          select: { eventId: true, userId: true },
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

      // Invited-vs-attended per event: only internally-invited (registered)
      // participants are counted, matched by exact userId. Guests are excluded.
      const invitedByEvent = new Map<string, Set<string>>();
      for (const p of invitedParticipants) {
        if (!invitedByEvent.has(p.eventId)) invitedByEvent.set(p.eventId, new Set());
        invitedByEvent.get(p.eventId)!.add(p.userId);
      }
      const attendedInvitedMap = new Map<string, number>();
      for (const g of registeredGroups) {
        if (!g.eventId || !g.userId) continue;
        if (invitedByEvent.get(g.eventId)?.has(g.userId)) {
          attendedInvitedMap.set(g.eventId, (attendedInvitedMap.get(g.eventId) ?? 0) + 1);
        }
      }

      const rows = events.map((e) => {
        const agg = e.id ? durationMap.get(e.id) : undefined;
        const status = e.isCancelled
          ? "CANCELLED"
          : e.startAt > now
          ? "UPCOMING"
          : "COMPLETED";
        const invitedCount = invitedByEvent.get(e.id)?.size ?? 0;
        const attendedInvitedCount = attendedInvitedMap.get(e.id) ?? 0;
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
          invitedCount,
          attendedInvitedCount,
          attendancePct:
            invitedCount > 0 ? Math.round((attendedInvitedCount / invitedCount) * 100) : null,
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

      const totalInvited = rows.reduce((s, r) => s + r.invitedCount, 0);
      const totalAttendedInvited = rows.reduce((s, r) => s + r.attendedInvitedCount, 0);
      const overallAttendancePct =
        totalInvited > 0 ? Math.round((totalAttendedInvited / totalInvited) * 100) : null;

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
            overallAttendancePct,
          },
        },
      };
    } catch (error) {
      throw new AppError(error, 500);
    }
  }

  /**
   * Submit (or update) a post-meeting survey for an attendance record.
   * Public — guests have no auth token. Every field is optional; upserts by
   * attendanceId so re-submitting just overwrites the previous answer.
   */
  public static async submitSurvey(
    attendanceId: string,
    body: {
      rating?: number;
      comment?: string;
      name?: string;
      phoneNumber?: string;
      hospital?: string;
      gender?: string;
      district?: string;
      sector?: string;
      cell?: string;
      village?: string;
    },
  ) {
    try {
      const attendance = await prisma.meetingAttendance.findUnique({
        where: { id: attendanceId },
      });
      if (!attendance) {
        return { message: "Attendance record not found", statusCode: 404 };
      }

      if (
        body.rating !== undefined &&
        (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
      ) {
        return { message: "rating must be an integer between 1 and 5", statusCode: 400 };
      }

      const data = {
        rating: body.rating,
        comment: body.comment?.trim() || undefined,
        name: body.name?.trim() || undefined,
        phoneNumber: body.phoneNumber?.trim() || undefined,
        hospital: body.hospital?.trim() || undefined,
        gender: body.gender?.trim() || undefined,
        district: body.district?.trim() || undefined,
        sector: body.sector?.trim() || undefined,
        cell: body.cell?.trim() || undefined,
        village: body.village?.trim() || undefined,
      };

      const survey = await prisma.meetingSurvey.upsert({
        where: { attendanceId },
        create: { attendanceId, ...data },
        update: data,
      });

      return {
        message: "Survey submitted successfully",
        statusCode: 201,
        data: survey,
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
