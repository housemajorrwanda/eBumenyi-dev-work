/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Middlewares,
  Post,
  Get,
  Route,
  Security,
  Tags,
  Request,
  Query,
  Path,
  Put,
  Delete,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { AnnouncementService } from "../services/announcementService";
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementResponse,
} from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import AppError from "../utils/error";

function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/announcements")
@Tags("Announcements")
export class AnnouncementController {
  @Get("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getAnnouncements(
    @Request() req: ExpressRequest,
    @Query() limit?: number,
    @Query() offset?: number,
  ) {
    try {
      const userId = req.user?.id as string;
      const announcements = await AnnouncementService.getUserAnnouncements(
        userId,
        limit || 50,
        offset || 0,
      );
      return {
        statusCode: 200,
        message: "Announcements retrieved successfully",
        data: announcements,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementController] Error getting announcements:",
        error,
      );
      throw new AppError("Failed to retrieve announcements", 500);
    }
  }

  @Get("/{announcementId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getAnnouncement(@Path() announcementId: string) {
    try {
      const announcement = await AnnouncementService.getById(announcementId);
      return {
        statusCode: 200,
        message: "Announcement retrieved successfully",
        data: announcement,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementController] Error getting announcement:",
        error,
      );
      throw new AppError("Failed to retrieve announcement", 500);
    }
  }

  @Post("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF))
  public async publish(
    @Request() req: ExpressRequest,
    @Body() body: CreateAnnouncementDto,
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const io = getIOInstance(req);
      const data = await AnnouncementService.publish(userId, body, io);
      return {
        statusCode: 201,
        message: "Announcement created successfully",
        data,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementController] Error creating announcement:",
        error,
      );
      throw new AppError("Failed to create announcement", 500);
    }
  }

  @Put("/{announcementId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF))
  public async updateAnnouncement(
    @Path() announcementId: string,
    @Body() body: UpdateAnnouncementDto,
  ): Promise<any> {
    try {
      const data = await AnnouncementService.update(announcementId, body);
      return {
        statusCode: 200,
        message: "Announcement updated successfully",
        data,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementController] Error updating announcement:",
        error,
      );
      throw new AppError("Failed to update announcement", 500);
    }
  }

  @Delete("/{announcementId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF))
  public async deleteAnnouncement(@Path() announcementId: string) {
    try {
      await AnnouncementService.delete(announcementId);
      return {
        statusCode: 200,
        message: "Announcement deleted successfully",
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementController] Error deleting announcement:",
        error,
      );
      throw new AppError("Failed to delete announcement", 500);
    }
  }
}
