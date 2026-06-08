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
import { CHOGroupService } from "../services/choGroupService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import AppError from "../utils/error";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

@Route("/api/cho-groups")
@Tags("CHO Groups")
export class CHOGroupController {
  // ─── Admin: promote a CHW user to CHO (auto-creates their group) ─────────────
  @Patch("/promote/:userId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async promoteToCHO(
    @Path() userId: string,
    @Body() body: { groupName?: string },
  ): Promise<any> {
    try {
      const result = await CHOGroupService.promoteToCHO(userId, body.groupName);
      return { statusCode: 200, message: "User promoted to CHO successfully", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to promote user to CHO", 500);
    }
  }

  // ─── Admin: demote a CHO back to CHW, transfer group to new CHO ─────────────
  @Patch("/demote/:userId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async demoteToCHW(
    @Path() userId: string,
    @Body() body: { newChoStudentId: string },
  ): Promise<any> {
    try {
      const result = await CHOGroupService.demoteToCHW(userId, body.newChoStudentId);
      return { statusCode: 200, message: "CHO demoted to CHW and group transferred successfully", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to demote CHO", 500);
    }
  }

  // ─── Admin: create a group and assign a CHO ──────────────────────────────────
  @Post("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN))
  public async createGroup(
    @Body()
    body: {
      name: string;
      choStudentId: string;
      sector?: string;
      description?: string;
    },
  ): Promise<any> {
    try {
      const group = await CHOGroupService.createGroup(body);
      return { statusCode: 201, message: "CHO group created successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to create CHO group", 500);
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
      const result = await CHOGroupService.getAllGroups(limit ?? 20, offset ?? 0);
      return { statusCode: 200, message: "CHO groups retrieved successfully", data: result };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve CHO groups", 500);
    }
  }

  // ─── CHO: update own group ────────────────────────────────────────────────────
  @Patch("/mine")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async updateMyGroup(
    @Request() req: ExpressRequest,
    @Body() body: { name?: string; sector?: string; description?: string },
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const group = await CHOGroupService.updateMyGroup(userId, body);
      return { statusCode: 200, message: "Group updated successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update group", 500);
    }
  }

  // ─── CHO: get own group ───────────────────────────────────────────────────────
  @Get("/mine")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async getMyGroup(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const group = await CHOGroupService.getMyGroup(userId);
      return { statusCode: 200, message: "Group retrieved successfully", data: group };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve group", 500);
    }
  }

  // ─── CHO: list own group members ─────────────────────────────────────────────
  @Get("/mine/members")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async getMyGroupMembers(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const members = await CHOGroupService.getMyGroupMembers(userId);
      return { statusCode: 200, message: "Members retrieved successfully", data: members };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve members", 500);
    }
  }

  // ─── CHO: directly add a CHW to their group (no invitation) ─────────────────
  @Post("/mine/members")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async addMyMember(
    @Request() req: ExpressRequest,
    @Body() body: { targetStudentId: string },
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const member = await CHOGroupService.directlyAddMember(userId, body.targetStudentId);
      return { statusCode: 201, message: "Member added successfully", data: member };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to add member", 500);
    }
  }

  // ─── CHO: remove a member from own group ─────────────────────────────────────
  @Delete("/mine/members/:studentId")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async removeMyMember(
    @Request() req: ExpressRequest,
    @Path() studentId: string,
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      await CHOGroupService.removeMyMember(userId, studentId);
      return { statusCode: 200, message: "Member removed successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to remove member", 500);
    }
  }

  // ─── CHO: monitoring — progress & scores of all members ──────────────────────
  @Get("/mine/monitoring")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async getGroupMonitoring(@Request() req: ExpressRequest): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const data = await CHOGroupService.getGroupMonitoring(userId);
      return { statusCode: 200, message: "Monitoring data retrieved successfully", data };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to retrieve monitoring data", 500);
    }
  }

  // ─── CHO: search CHW candidates in same area (max 10) ────────────────────────
  @Get("/mine/chw-candidates")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.CHO))
  public async searchCHWCandidates(
    @Request() req: ExpressRequest,
    @Query() search?: string,
  ): Promise<any> {
    try {
      const userId = req.user?.id as string;
      const candidates = await CHOGroupService.searchCHWCandidates(userId, search);
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
    @Body() body: { name?: string; sector?: string; description?: string },
  ): Promise<any> {
    try {
      const group = await CHOGroupService.updateGroup(groupId, body);
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
      await CHOGroupService.deleteGroup(groupId);
      return { statusCode: 200, message: "Group deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to delete group", 500);
    }
  }

  // ─── Admin: get a specific group by ID ───────────────────────────────────────
  @Get("/{groupId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.ADMIN, roles.STAFF, roles.CHO))
  public async getGroupById(@Path() groupId: string): Promise<any> {
    try {
      const group = await CHOGroupService.getGroupById(groupId);
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
      const member = await CHOGroupService.addMemberByAdmin(groupId, body.studentId);
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
      await CHOGroupService.removeMember(groupId, studentId);
      return { statusCode: 200, message: "Member removed successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to remove member", 500);
    }
  }
}
