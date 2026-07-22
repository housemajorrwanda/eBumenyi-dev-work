/* eslint-disable @typescript-eslint/no-explicit-any */
import { Post, Get, Route, Tags, Security, Request, Path } from "tsoa";
import { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { MeetingAttendanceService } from "../services/meetingAttendanceService";

@Route("/api/attendance")
@Tags("Meeting Attendance")
export class MeetingAttendanceController {
  /**
   * Record a participant joining a meeting
   * @summary Record join event
   */
  @Post("/join")
  public async recordJoin(@Request() req: ExpressRequest): Promise<any> {
    const { streamRoomId, userId, guestName } = req.body;
    if (!streamRoomId) {
      return { statusCode: 400, message: "streamRoomId is required" };
    }
    return MeetingAttendanceService.recordJoin({ streamRoomId, userId, guestName });
  }

  /**
   * Record a participant leaving a meeting
   * @summary Record leave event
   */
  @Post("/leave")
  public async recordLeave(@Request() req: ExpressRequest): Promise<any> {
    const { attendanceId, streamRoomId, userId } = req.body;
    return MeetingAttendanceService.recordLeave({
      attendanceId,
      streamRoomId,
      userId,
    });
  }

  /**
   * Submit (or update) a post-meeting survey for an attendance record.
   * No auth — guests submitting from the meeting app have no JWT.
   * @summary Submit meeting survey
   */
  @Post("/:attendanceId/survey")
  public async submitSurvey(
    @Path() attendanceId: string,
    @Request() req: ExpressRequest,
  ): Promise<any> {
    return MeetingAttendanceService.submitSurvey(attendanceId, req.body);
  }

  /**
   * Get all attendance records for an event (by event id or stream room id)
   * @summary Get event attendance
   */
  @Get("/event/:eventId")
  @Security("jwt")
  public async getEventAttendance(@Path() eventId: string): Promise<any> {
    return MeetingAttendanceService.getEventAttendance(eventId);
  }

  /**
   * Get all EBUMENYI meetings with participant counts and stats
   * @summary List all meetings
   */
  @Get("/meetings")
  @Security("jwt")
  public async getMeetingsList(): Promise<any> {
    return MeetingAttendanceService.getMeetingsList();
  }

  /**
   * Export attendance for an event as CSV
   * @summary Export attendance CSV
   */
  @Get("/event/:eventId/export")
  @Security("jwt")
  public async exportAttendanceCsv(
    @Path() eventId: string,
    @Request() req: ExpressRequest,
  ): Promise<any> {
    const res = (req as any).res as ExpressResponse;
    const csv = await MeetingAttendanceService.exportEventAttendanceCsv(eventId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${eventId}.csv"`,
    );
    res.send(csv);
  }
}
