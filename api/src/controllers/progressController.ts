import {
  Body,
  Get,
  Middlewares,
  Post,
  Query,
  Route,
  Tags,
  Security,
  Request,
  Path,
} from "tsoa";
import {
  CreateSlideProgressDto,
  CreateChapterProgressDto,
  CreateCourseProgressDto,
  TStudentStatisticsResponse,
} from "../utils/interfaces/common";
import { ProgressService } from "../services/progressService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { Request as ExpressRequest } from "express";
import { prisma } from "../utils/client";
import { getCachedOrFetch } from "../utils/requestCache";

function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}

@Route("/api/progress")
@Tags("Progress")
export class ProgressController {
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
  @Post("/slide/complete")
  @Security("jwt")
  public async markSlideCompleted(
    @Body() body: CreateSlideProgressDto,
    @Request() req: ExpressRequest,
  ) {
    const studentId = await this.getStudentId(req);
    const io = getIOInstance(req);
    return ProgressService.markSlideCompleted(studentId, body.slideId, io);
  }

  @Get("/student")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getProgressByStudent(@Request() req: ExpressRequest) {
    const studentId = await this.getStudentId(req);
    return ProgressService.getProgressByStudent(studentId);
  }

  @Get("/student/statistics")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getStudentStatistics(@Request() req: ExpressRequest): Promise<{
    message: string;
    statusCode: number;
    data: TStudentStatisticsResponse;
  }> {
    const studentId = await this.getStudentId(req);
    return ProgressService.getStudentStatistics(studentId);
  }

  @Post("/enroll/{courseId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async enrollInCourse(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const studentId = await this.getStudentId(req);
    const io = getIOInstance(req);
    return ProgressService.enrollStudentInCourse(studentId, courseId, io);
  }

  // Helpers: recompute progress for a specific chapter (can be used internally or for admin)
  @Post("/chapter/recompute")
  @Security("jwt")
  public async recomputeChapterProgress(
    @Body() body: CreateChapterProgressDto,
    @Request() req: ExpressRequest,
  ) {
    const io = getIOInstance(req);
    return ProgressService.recomputeChapterProgressForStudent(
      body.studentId,
      body.chapterId,
      io,
    );
  }

  // Helpers: recompute progress for a specific course
  @Post("/course/recompute")
  @Security("jwt")
  public async recomputeCourseProgress(
    @Body() body: CreateCourseProgressDto,
    @Request() req: ExpressRequest,
  ) {
    const io = getIOInstance(req);
    return ProgressService.recomputeCourseProgressForStudent(
      body.studentId,
      body.courseId,
      io,
    );
  }

  @Get("/student/course/{courseId}/recommendations")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getPostCourseRecommendations(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const studentId = await this.getStudentId(req);
    return ProgressService.getPostCourseRecommendations(studentId, courseId);
  }

  @Get("/student/course/{courseId}/workspace")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getCourseWorkspace(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
    @Query() chapterId?: string,
  ) {
    const studentId = await this.getStudentId(req);
    return ProgressService.getCourseWorkspace(studentId, courseId, chapterId);
  }

  @Get("/student/course/{courseId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getProgressByStudentAndCourse(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const studentId = await this.getStudentId(req);
    return ProgressService.getProgressByStudentAndCourse(studentId, courseId);
  }
}
