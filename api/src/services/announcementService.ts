/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../utils/client";
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementResponse,
} from "../utils/interfaces/common";
import { NotificationHelper } from "../utils/notificationHelper";
import { UserService } from "./userService";
import { RoleType } from "@prisma/client";
import { Server as SocketIOServer } from "socket.io";
import AppError from "../utils/error";

export class AnnouncementService {
  static async getById(announcementId: string): Promise<any> {
    try {
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
        include: {
          createdBy: {
            select: {
              id: true,
              fullNames: true,
              photo: true,
            },
          },
        },
      });

      if (!announcement) {
        throw new AppError("Announcement not found", 404);
      }

      return announcement;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[ AnnouncementService] Error getting announcement:",
        error,
      );
      throw new AppError(
        "Failed to retrieve announcement. Please try again.",
        500,
      );
    }
  }

  static async getUserAnnouncements(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<any[]> {
    try {
      if (!userId) {
        throw new AppError("User ID is required", 400);
      }

      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        select: { name: true },
      });

      const roleNames = userRoles.map((ur) => ur.name.toUpperCase());

      // Get announcements that are:
      // 1. Not expired
      // 2. For "all" segment OR user's role
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        where: {
          publishAt: {
            lte: now,
          },
          OR: [
            { validUntil: null },
            {
              validUntil: {
                gte: now,
              },
            },
          ],
          AND: [
            {
              OR: [
                {
                  segment: "all",
                },
                {
                  segment: {
                    in: roleNames,
                  },
                },
              ],
            },
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullNames: true,
              photo: true,
            },
          },
        },
        orderBy: {
          publishAt: "desc",
        },
        skip: offset,
        take: limit,
      });

      return announcements;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementService] Error getting user announcements:",
        error,
      );
      throw new AppError(
        "Failed to retrieve announcements. Please try again.",
        500,
      );
    }
  }

  static async publish(
    creatorId: string,
    payload: CreateAnnouncementDto,
    io: SocketIOServer,
  ): Promise<AnnouncementResponse> {
    try {
      // Validate required fields
      if (!payload.title || payload.title.trim() === "") {
        throw new AppError("Announcement title is required", 400);
      }
      if (!payload.body || payload.body.trim() === "") {
        throw new AppError("Announcement body is required", 400);
      }
      if (!payload.segment) {
        throw new AppError("Announcement segment is required", 400);
      }
      if (!creatorId) {
        throw new AppError("Creator ID is required", 400);
      }

      // Validate dates
      const publishAt = payload.publishAt
        ? new Date(payload.publishAt)
        : new Date();
      const validUntil = payload.validUntil
        ? new Date(payload.validUntil)
        : null;

      if (isNaN(publishAt.getTime())) {
        throw new AppError("Invalid publish date format", 400);
      }
      if (validUntil && isNaN(validUntil.getTime())) {
        throw new AppError("Invalid expiration date format", 400);
      }
      if (validUntil && validUntil < publishAt) {
        throw new AppError("Expiration date must be after publish date", 400);
      }

      const announcement = await prisma.announcement.create({
        data: {
          title: payload.title.trim(),
          body: payload.body.trim(),
          segment: payload.segment,
          category: payload.category || "",
          priority: payload.priority || "medium",
          status: payload.status || "draft",
          publishAt,
          validUntil,
          createdById: creatorId,
        },
      });

      // Only send notifications when the announcement is published, not for drafts
      if (announcement.status === "published") {
        const targetUserIds = await this.resolveTargetUsers(payload.segment);

        const actionUrl = `/announcements/${announcement.id}`;
        const metadata = {
          announcementId: announcement.id,
          segment: payload.segment,
        };

        // Send notifications asynchronously (non-blocking)
        // Don't await - let them process in background
        Promise.all(
          targetUserIds.map((userId) =>
            NotificationHelper.sendToUser(
              io,
              userId,
              announcement.title,
              announcement.body,
              "info",
              actionUrl,
              "announcement",
              announcement.id,
              metadata,
              300_000, // 5 minutes cooldown
              `announcement:${announcement.id}:${userId}`,
            ).catch((err) =>
              console.error(
                `[AnnouncementService] failed to notify ${userId} for announcement ${announcement.id}:`,
                err,
              ),
            ),
          ),
        ).catch((err) =>
          console.error(
            "[AnnouncementService] Error sending bulk notifications:",
            err,
          ),
        );
      }

      return {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        segment: announcement.segment,
        category: announcement.category,
        priority: announcement.priority,
        status: announcement.status,
        publishAt: announcement.publishAt.toISOString(),
        validUntil: announcement.validUntil
          ? announcement.validUntil.toISOString()
          : null,
        createdById: announcement.createdById,
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementService] Error creating announcement:",
        error,
      );
      throw new AppError(
        "Failed to create announcement. Please try again.",
        500,
      );
    }
  }

  private static async resolveTargetUsers(segment: string): Promise<string[]> {
    try {
      if (segment.toLowerCase() === "all") {
        const users = await prisma.user.findMany({ select: { id: true } });
        return users.map((u) => u.id);
      }

      const role = segment.toUpperCase() as RoleType;
      try {
        return await UserService.getUserIdsByRole(role);
      } catch (error) {
        console.error(
          `[AnnouncementService] Error resolving users for role ${role}:`,
          error,
        );
        return [];
      }
    } catch (error) {
      console.error(
        "[AnnouncementService] Error resolving target users:",
        error,
      );
      return [];
    }
  }

  static async update(
    announcementId: string,
    payload: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponse> {
    try {
      if (!announcementId || announcementId.trim() === "") {
        throw new AppError("Announcement ID is required", 400);
      }

      // Verify announcement exists
      const existing = await prisma.announcement.findUnique({
        where: { id: announcementId },
      });
      if (!existing) {
        throw new AppError("Announcement not found", 404);
      }

      const updateData: any = {};

      // Validate and trim text fields
      if (payload.title !== undefined) {
        if (payload.title && payload.title.trim() === "") {
          throw new AppError("Announcement title cannot be empty", 400);
        }
        updateData.title = payload.title?.trim();
      }

      if (payload.body !== undefined) {
        if (payload.body && payload.body.trim() === "") {
          throw new AppError("Announcement body cannot be empty", 400);
        }
        updateData.body = payload.body?.trim();
      }

      if (payload.segment) updateData.segment = payload.segment;
      if (payload.category !== undefined) updateData.category = payload.category;
      if (payload.priority) updateData.priority = payload.priority;
      if (payload.status) updateData.status = payload.status;

      if (payload.publishAt) {
        const publishDate = new Date(payload.publishAt);
        if (isNaN(publishDate.getTime())) {
          throw new AppError("Invalid publish date format", 400);
        }
        updateData.publishAt = publishDate;
      }

      if (payload.validUntil !== undefined) {
        if (payload.validUntil) {
          const validDate = new Date(payload.validUntil);
          if (isNaN(validDate.getTime())) {
            throw new AppError("Invalid expiration date format", 400);
          }
          updateData.validUntil = validDate;
        } else {
          updateData.validUntil = null;
        }
      }

      // Validate date logic if both dates are provided
      const publishDate = updateData.publishAt || existing.publishAt;
      // Use 'in' check so explicit null (clearing the field) is respected over existing value
      const validDate = "validUntil" in updateData ? updateData.validUntil : existing.validUntil;
      if (validDate && validDate < publishDate) {
        throw new AppError("Expiration date must be after publish date", 400);
      }

      // Prevent empty updates
      if (Object.keys(updateData).length === 0) {
        throw new AppError(
          "No fields to update. Please provide at least one field.",
          400,
        );
      }

      const announcement = await prisma.announcement.update({
        where: { id: announcementId },
        data: updateData,
      });

      return {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        segment: announcement.segment,
        category: announcement.category,
        priority: announcement.priority,
        status: announcement.status,
        publishAt: announcement.publishAt.toISOString(),
        validUntil: announcement.validUntil
          ? announcement.validUntil.toISOString()
          : null,
        createdById: announcement.createdById,
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementService] Error updating announcement:",
        error,
      );
      throw new AppError(
        "Failed to update announcement. Please try again.",
        500,
      );
    }
  }

  static async delete(announcementId: string): Promise<void> {
    try {
      if (!announcementId || announcementId.trim() === "") {
        throw new AppError("Announcement ID is required", 400);
      }

      // Verify announcement exists before deleting
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
      });

      if (!announcement) {
        throw new AppError("Announcement not found", 404);
      }

      await prisma.announcement.delete({
        where: { id: announcementId },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(
        "[AnnouncementService] Error deleting announcement:",
        error,
      );
      throw new AppError(
        "Failed to delete announcement. Please try again.",
        500,
      );
    }
  }
}
