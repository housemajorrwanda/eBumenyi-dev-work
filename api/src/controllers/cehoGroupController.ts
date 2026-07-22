/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Delete,
  Get,
  Middlewares,
  Patch,
  Path,
  Post,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { CEHOGroupService } from "../services/cehoGroupService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import AppError from "../utils/error";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

@Route("/api/ceho-groups")
@Tags("CEHO Groups")
export class CEHOGroupController {
  // ─── Admin: check for a hospital conflict before promoting ────────────────────
  @Get("/promote/:userId/conflict")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async checkHospitalConflict(@Path() userId: string): Promise<any> {
    try {
      const result = await CEHOGroupService.checkHospitalConflict(userId);
      return { statusCode: 200, message: "Checked", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to check hospital conflict", 500);
    }
  }

  // ─── Admin: promote a CHW user to CEHO (auto-creates their group) ─────────────
  @Patch("/promote/:userId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async promoteToCEHO(
    @Path() userId: string,
    @Body() body?: { confirmReplace?: boolean },
  ): Promise<any> {
    try {
      const result = await CEHOGroupService.promoteToCEHO(userId, body?.confirmReplace ?? false);
      const message = (result as any).conflict
        ? "This hospital already has a CEHO"
        : "User promoted to CEHO successfully";
      return { statusCode: 200, message, data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to promote user to CEHO", 500);
    }
  }

  // ─── Admin: demote a CEHO back to CHW, transfer group to new CEHO ─────────────
  @Patch("/demote/:userId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async demoteToCHW(
    @Path() userId: string,
    @Body() body: { newCehoStudentId: string },
  ): Promise<any> {
    try {
      const result = await CEHOGroupService.demoteToCHW(userId, body.newCehoStudentId);
      return { statusCode: 200, message: "CEHO demoted to CHW and group transferred successfully", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to demote CEHO", 500);
    }
  }

  // ─── Admin: create a group and assign a CEHO ──────────────────────────────────
  @Post("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async createGroup(
    @Body()
    body: {
      cehoStudentId: string;
      sectors?: string[];
      cells?: string[];
      villages?: string[];
      description?: string;
    },
  ): Promise<any> {
    try {
      const group = await CEHOGroupService.createGroup(body);
      return { statusCode: 201, message: "CEHO group created successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to create CEHO group", 500);
    }
  }

  // ─── Admin: list all groups ──────────────────────────────────────────────────
  @Get("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF))
  public async getAllGroups(
    @Query() limit?: number,
    @Query() offset?: number,
  ): Promise<any> {
    try {
      const result = await CEHOGroupService.getAllGroups(limit ?? 20, offset ?? 0);
      return { statusCode: 200, message: "CEHO groups retrieved successfully", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve CEHO groups", 500);
    }
  }

  // ─── CEHO: update own group ────────────────────────────────────────────────────
  @Patch("/mine")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async updateMyGroup(
    @Request() req: ExpressRequest,
    @Body() body: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string },
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const group = await CEHOGroupService.updateMyGroup(userId, body);
      return { statusCode: 200, message: "Group updated successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update group", 500);
    }
  }

  // ─── CEHO: get own group ───────────────────────────────────────────────────────
  @Get("/mine")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async getMyGroup(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const group = await CEHOGroupService.getMyGroup(userId);
      return { statusCode: 200, message: "Group retrieved successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve group", 500);
    }
  }

  // ─── CEHO: list own group members ─────────────────────────────────────────────
  @Get("/mine/members")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async getMyGroupMembers(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const members = await CEHOGroupService.getMyGroupMembers(userId);
      return { statusCode: 200, message: "Members retrieved successfully", data: members };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve members", 500);
    }
  }

  // ─── CEHO: directly add a CHW to their group (no invitation) ─────────────────
  @Post("/mine/members")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async addMyMember(
    @Request() req: ExpressRequest,
    @Body() body: { targetStudentId: string },
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const member = await CEHOGroupService.directlyAddMember(userId, body.targetStudentId);
      return { statusCode: 201, message: "Member added successfully", data: member };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to add member", 500);
    }
  }

  // ─── CEHO: remove a member from own group ─────────────────────────────────────
  @Delete("/mine/members/:studentId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async removeMyMember(
    @Request() req: ExpressRequest,
    @Path() studentId: string,
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      await CEHOGroupService.removeMyMember(userId, studentId);
      return { statusCode: 200, message: "Member removed successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to remove member", 500);
    }
  }

  // ─── CEHO: monitoring — progress & scores of all members ──────────────────────
  @Get("/mine/monitoring")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async getGroupMonitoring(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const data = await CEHOGroupService.getGroupMonitoring(userId);
      return { statusCode: 200, message: "Monitoring data retrieved successfully", data };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve monitoring data", 500);
    }
  }

  // ─── CEHO: search CHW candidates in same area (max 10) ────────────────────────
  @Get("/mine/chw-candidates")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CEHO))
  public async searchCHWCandidates(
    @Request() req: ExpressRequest,
    @Query() search?: string,
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const candidates = await CEHOGroupService.searchCHWCandidates(userId, search);
      return { statusCode: 200, message: "Candidates retrieved successfully", data: candidates };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve candidates", 500);
    }
  }

  // ─── Admin: update a group ───────────────────────────────────────────────────
  @Patch("/{groupId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async updateGroup(
    @Path() groupId: string,
    @Body() body: { name?: string; district?: string; sectors?: string[]; cells?: string[]; villages?: string[]; cell?: string; village?: string; description?: string },
  ): Promise<any> {
    try {
      const group = await CEHOGroupService.updateGroup(groupId, body);
      return { statusCode: 200, message: "Group updated successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update group", 500);
    }
  }

  // ─── Admin: delete a group ────────────────────────────────────────────────────
  @Delete("/{groupId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async deleteGroup(@Path() groupId: string): Promise<any> {
    try {
      await CEHOGroupService.deleteGroup(groupId);
      return { statusCode: 200, message: "Group deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to delete group", 500);
    }
  }

  // ─── Admin: get a specific group by ID ───────────────────────────────────────
  @Get("/{groupId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF, roles.CEHO))
  public async getGroupById(@Path() groupId: string): Promise<any> {
    try {
      const group = await CEHOGroupService.getGroupById(groupId);
      return { statusCode: 200, message: "Group retrieved successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve group", 500);
    }
  }

  // ─── Admin: add a CHW directly to a group ────────────────────────────────────
  @Post("/{groupId}/members")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async addMember(
    @Path() groupId: string,
    @Body() body: { studentId: string },
  ): Promise<any> {
    try {
      const member = await CEHOGroupService.addMemberByAdmin(groupId, body.studentId);
      return { statusCode: 201, message: "Member added successfully", data: member };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to add member", 500);
    }
  }

  // ─── Admin: remove a CHW from a group ────────────────────────────────────────
  @Delete("/{groupId}/members/{studentId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async removeMember(
    @Path() groupId: string,
    @Path() studentId: string,
  ): Promise<any> {
    try {
      await CEHOGroupService.removeMember(groupId, studentId);
      return { statusCode: 200, message: "Member removed successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to remove member", 500);
    }
  }
}
