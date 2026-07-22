import {
  Body,
  Delete,
  Get,
  Middlewares,
  Path,
  Post,
  Put,
  Query,
  Route,
  Tags,
  Security,
  Request,
} from "tsoa";
import { CreateAttempTestDto } from "../utils/interfaces/common";
import { AttemptTestService } from "../services/attemptTestService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { Request as ExpressRequest } from "express";
import { prisma } from "../utils/client";
import { getCachedOrFetch } from "../utils/requestCache";

@Route("/api/attempts")
@Tags("Attempts")
export class AttemptTestController {
  /**
   * Helper method to get student ID from authenticated user
   * Uses request-scoped cache to prevent N+1 database queries
   */
  private async getStudentId(req: ExpressRequest): Promise<string> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const cacheKey = `student_${userId}`;

    return getCachedOrFetch(req, cacheKey, async () => {
      // Try to get student ID from the user's student relationship first
      let studentId = req.user?.student?.id;

      if (!studentId) {
        // If no direct student relationship, try to find student by userId
        const student = await prisma.student.findUnique({
          where: { userId: userId },
        });

        if (!student) {
          throw new Error("Student record not found for this user");
        }

        studentId = student.id;
      }

      return studentId;
    });
  }

  @Post("/")
  @Security("jwt")
  @Middlewares(checkRole(roles.TRAINEE, roles.TESTER, roles.CEHO))
  public async createAttempt(
    @Body() body: CreateAttempTestDto,
    @Request() req: ExpressRequest,
  ) {
    // Get student ID from logged-in user
    const studentId = await this.getStudentId(req);

    // Add student ID to the request body
    const attemptData = {
      ...body,
      studentId,
    };

    const io = req.app.get("io");
    return AttemptTestService.createAttempt(attemptData, io);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public async getAllAttempts(@Query() searchq?: string) {
    return AttemptTestService.getAllAttempts(searchq);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public async getAttempts(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return AttemptTestService.getAttempts(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public async getAttempt(@Path() id: string) {
    return AttemptTestService.getAttemptById(id);
  }

  @Get("/by-test/{testId}")
  @Middlewares(loggerMiddleware)
  public async getAttemptsByTestId(@Path() testId: string) {
    return AttemptTestService.getAttemptByTestId(testId);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async updateAttempt(
    @Path() id: string,
    @Body() body: CreateAttempTestDto,
    @Request() req: ExpressRequest,
  ) {
    // For updates, we typically don't change the student ID, but if needed for admin operations,
    // we can get it from the logged-in user if not provided
    let attemptData = body;

    // If no studentId provided and user is a student, get it from the logged-in user
    if (
      !body.studentId &&
      req.user?.userRoles?.some(
        (role) => role.name === roles.TRAINEE || role.name === roles.TESTER,
      )
    ) {
      const studentId = await this.getStudentId(req);
      attemptData = {
        ...body,
        studentId,
      };
    }

    return AttemptTestService.updateAttempt(id, attemptData);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async deleteAttempt(@Path() id: string) {
    return AttemptTestService.deleteAttempt(id);
  }
}
