/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Delete,
  Get,
  Middlewares,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { CalendarEventService } from "../services/calendarEventService";
import { NotificationService } from "../services/NotificationService";
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from "../utils/interfaces/common";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

// Helper to get io instance from express app
function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/calendar")
@Tags("Calendar Events")
export class CalendarController {
  @Post("/events")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
    ),
  )
  public createEvent(
    @Request() req: ExpressRequest,
    @Body() body: CreateCalendarEventDto,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CalendarEventService.createEvent(userId, body, io);
  }

  @Get("/events/admin")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public getAllEvents(
    @Request() req: ExpressRequest,
    @Query() start?: string,
    @Query() end?: string,
  ) {
    const userId = req.user?.id as string;
    return CalendarEventService.getEvents(userId, { start, end });
  }

  @Get("/events/{eventId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
    ),
  )
  public getEventById(@Request() req: ExpressRequest, @Path() eventId: string) {
    const userId = req.user?.id as string;
    return CalendarEventService.getEventById(userId, eventId);
  }

  @Put("/events/{eventId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
    ),
  )
  public updateEvent(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
    @Body() body: UpdateCalendarEventDto,
  ) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CalendarEventService.updateEvent(eventId, userId, body, io);
  }

  @Delete("/events/{eventId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
    ),
  )
  public deleteEvent(@Request() req: ExpressRequest, @Path() eventId: string) {
    const userId = req.user?.id as string;
    const io = getIOInstance(req);
    return CalendarEventService.deleteEvent(userId, eventId, io);
  }

  // Occurrence-level management endpoints
  @Put("/events/{eventId}/occurrence")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public updateOccurrence(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
    @Query() mode: "single" | "all" | "future" = "single",
    @Body() body: UpdateCalendarEventDto,
  ) {
    const userId = req.user?.id as string;
    return CalendarEventService.updateOccurrence(userId, eventId, body, mode);
  }

  @Delete("/events/{eventId}/occurrence")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public cancelOccurrence(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
    @Query() mode: "single" | "all" | "future" = "single",
  ) {
    const userId = req.user?.id as string;
    return CalendarEventService.cancelOccurrence(userId, eventId, mode);
  }

  // User (Trainee) endpoints - can only view events they're invited to
  @Get("/events")
  @Security("jwt")
  public getUserEvents(
    @Request() req: ExpressRequest,
    @Query() start?: string,
    @Query() end?: string,
  ) {
    const userId = req.user?.id as string;
    return CalendarEventService.getEvents(userId, { start, end });
  }

  @Get("/events/{eventId}/view")
  @Security("jwt")
  public getUserEventById(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
  ) {
    const userId = req.user?.id as string;
    return CalendarEventService.getEventById(userId, eventId);
  }

  // Notification endpoints for all authenticated users
  @Get("/notifications")
  @Security("jwt")
  public async getUserNotifications(
    @Request() req: ExpressRequest,
    @Query() limit?: number,
    @Query() offset?: number,
  ) {
    const userId = req.user?.id as string;
    const notifications = await NotificationService.getUserNotifications(
      userId,
      limit || 50,
      offset || 0,
    );
    return {
      statusCode: 200,
      message: "Notifications retrieved successfully",
      data: notifications,
    };
  }

  @Get("/notifications/unread-count")
  @Security("jwt")
  public async getUnreadCount(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    const count = await NotificationService.getUnreadCount(userId);
    return {
      statusCode: 200,
      message: "Unread count retrieved successfully",
      data: { unreadCount: count },
    };
  }

  @Put("/notifications/{notificationId}/read")
  @Security("jwt")
  public async markAsRead(
    @Request() req: ExpressRequest,
    @Path() notificationId: string,
  ) {
    const userId = req.user?.id as string;
    const success = await NotificationService.markAsRead(
      notificationId,
      userId,
    );
    return {
      statusCode: success ? 200 : 404,
      message: success
        ? "Notification marked as read"
        : "Notification not found or access denied",
    };
  }

  @Put("/notifications/mark-all-read")
  @Security("jwt")
  public async markAllAsRead(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    const count = await NotificationService.markAllAsRead(userId);
    return {
      statusCode: 200,
      message: "All notifications marked as read",
      data: { markedCount: count },
    };
  }

  @Delete("/notifications/{notificationId}")
  @Security("jwt")
  public async deleteNotification(
    @Request() req: ExpressRequest,
    @Path() notificationId: string,
  ) {
    const userId = req.user?.id as string;
    const success = await NotificationService.deleteNotification(
      notificationId,
      userId,
    );
    return {
      statusCode: success ? 200 : 404,
      message: success
        ? "Notification deleted successfully"
        : "Notification not found or access denied",
    };
  }

  @Delete("/notifications/clear-all")
  @Security("jwt")
  public async clearAllNotifications(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;
    const count = await NotificationService.clearAllNotifications(userId);
    return {
      statusCode: 200,
      message: "All notifications cleared",
      data: { clearedCount: count },
    };
  }
}
