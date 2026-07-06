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
  Tags,
  Security,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { CourseService } from "../services/courseService";
import { ProgressService } from "../services/progressService";
import {
  CreateCourseDto,
  CreateSuperCourseDto,
  NotifyCourseUsersDto,
  UpdateSuperCourseDto,
} from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { appendCoverIconPhoto, checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import upload from "../utils/cloudinary";
import { prisma } from "../utils/client";
import { getCachedOrFetch } from "../utils/requestCache";

function getIOInstance(req: ExpressRequest): any {
  return (req as any).app?.get?.("io");
}
@Route("/api/courses")
@Tags("Courses")
export class CourseController {
  /**
   * Helper method to get student ID from authenticated user
   * Uses request-scoped cache to prevent N+1 database queries
   */
  private async getStudentId(req: ExpressRequest): Promise<string> {
    // Use request cache to store student ID per request
    // Key: `student_${userId}` to differentiate if multiple users per request
    const userId = req.user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const cacheKey = `student_${userId}`;

    return getCachedOrFetch(req, cacheKey, async () => {
      // Try to get student ID from the user's student relationship first
      let studentId = req.user?.student?.id;

      if (!studentId) {
        // If no direct student relationship, find student by userId
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
  @Middlewares(
    upload.single("coverIcon"),
    appendCoverIconPhoto,
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public async createCourse(
    @Body() body: CreateCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const creatorId = req.user?.staff?.id as string;
    if (!creatorId) {
      return {
        statusCode: 400,
        message:
          "Staff ID (creatorId) is required. Make sure you are authenticated as staff.",
      };
    }
    const io = getIOInstance(req);
    return CourseService.createCourse(body, creatorId, io);
  }

  @Get("/myall")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getMyAllCourses(
    @Request() req: ExpressRequest,
    @Query() searchq?: string,
  ) {
    const studentId = await this.getStudentId(req);
    return CourseService.getMyAllCourses(studentId, searchq);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllCourses(@Query() searchq?: string) {
    return CourseService.getAllCourses(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    upload.single("coverIcon"),
    appendCoverIconPhoto,
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public updateCourse(
    @Path() id: string,
    @Body() body: CreateCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const io = getIOInstance(req);
    return CourseService.updateCourse(id, body, io);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public deleteCourse(@Path() id: string, @Request() req: ExpressRequest) {
    const io = getIOInstance(req);
    return CourseService.deleteCourse(id, io);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getCourses(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
    @Query() isPublished?: boolean,
  ) {
    return CourseService.getCourses(searchq, limit, page, isPublished);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getCourse(@Path() id: string) {
    return CourseService.getCourseById(id);
  }

  @Post("/super")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public async createSuperCourse(
    @Body() body: CreateSuperCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const creatorId = req.user?.staff?.id as string;
    if (!creatorId) {
      return {
        statusCode: 400,
        message:
          "Staff ID (creatorId) is required. Make sure you are authenticated as staff.",
      };
    }
    const io = req.app.get("io");
    return CourseService.createSuperCourse(body, creatorId, io);
  }

  @Put("/super/{courseId}")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public async updateSuperCourse(
    @Path() courseId: string,
    @Body() body: CreateSuperCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const creatorId = req.user?.staff?.id as string;
    const updateData: UpdateSuperCourseDto = { ...body, courseId };
    const io = req.app.get("io");
    return CourseService.updateSuperCourse(updateData, creatorId, io);
  }

  @Post("/{id}/notify-users")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public notifyCourseUsers(
    @Path() id: string,
    @Body() body: NotifyCourseUsersDto,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user!.id;
    const io = getIOInstance(req);
    return CourseService.releaseCourseNotification(
      id,
      userId,
      io,
      body?.roles,
    );
  }

  @Get("/dashboard/statistics")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.TRAINEE,
      roles.TESTER,
      roles.DEVELOPER,
    ),
  )
  public getDashboardStatistics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getDashboardStatistics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/recommendations-insights")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public getRecommendationInsights() {
    return ProgressService.getRecommendationInsights();
  }

  /**
   * Create course with large payload in chunked manner
   * Useful for courses with many sections, chapters, and slides
   * POST /api/courses/large/create
   */
  @Post("/large/create")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public async createLargeCourse(
    @Body() body: CreateSuperCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const creatorId = req.user?.staff?.id as string;
    if (!creatorId) {
      return {
        statusCode: 400,
        message:
          "Staff ID (creatorId) is required. Make sure you are authenticated as staff.",
      };
    }

    try {
      // First create the basic course structure
      const staff = await prisma.staff.findUnique({
        where: { id: creatorId },
      });
      if (!staff) {
        throw new Error("Creator (staff) not found");
      }

      // Create base course
      const course = await prisma.course.create({
        data: {
          creatorId: creatorId,
          title: body.title,
          coverIcon: body.coverIcon,
          description: body.description ?? null,
          isPublished: body.isPublished ?? true,
        },
      });

      // Create course intro, tests, etc in single transaction
      await prisma.$transaction(
        async (tx) => {
          if (body.courseIntro) {
            await tx.courseIntro.create({
              data: {
                courseId: course.id,
                title: body.courseIntro.title,
                summary: body.courseIntro.summary,
                bannerImage: body.courseIntro.bannerImage ?? null,
                thumbnail: body.courseIntro.thumbnail,
              },
            });
          }

          if (body.preTest) {
            await tx.preTest.create({
              data: {
                courseId: course.id,
                questionToBeAnswered: body.preTest.questionToBeAnswered,
                marksToPass: body.preTest.marksToPass,
                description: body.preTest.description,
                isPublished: body.preTest.isPublished ?? true,
              },
            });
          }

          if (body.finalTest) {
            await tx.finalTest.create({
              data: {
                courseId: course.id,
                questionToBeAnswered: body.finalTest.questionToBeAnswered,
                marksToPass: body.finalTest.marksToPass,
                description: body.finalTest.description,
                isPublished: body.finalTest.isPublished ?? true,
              },
            });
          }

          if (body.finalExam) {
            await tx.finalExam.create({
              data: {
                courseId: course.id,
                questionToBeAnswered: body.finalExam.questionToBeAnswered,
                marksToPass: body.finalExam.marksToPass,
                description: body.finalExam.description,
                isPublished: body.finalExam.isPublished ?? true,
              },
            });
          }

          // Create question bank if provided
          if (body.questionBank && body.questionBank.length > 0) {
            for (const questionData of body.questionBank) {
              const questionnaire = await tx.questionnaire.create({
                data: {
                  question: questionData.question,
                  questionImage: questionData.questionImage ?? null,
                  feedbackStatement: questionData.feedbackStatement ?? null,
                  allowMultiple: questionData.allowMultiple,
                  courseId: course.id,
                },
              });

              if (questionData.options && questionData.options.length > 0) {
                await Promise.all(
                  questionData.options.map((opt) =>
                    tx.option.create({
                      data: {
                        label: opt.label,
                        image: opt.image ?? null,
                        questionnaireId: questionnaire.id,
                      },
                    }),
                  ),
                );
              }

              if (questionData.correctAnswer) {
                await tx.answer.create({
                  data: {
                    label: questionData.correctAnswer.label,
                    image: questionData.correctAnswer.image ?? null,
                    questionnaireId: questionnaire.id,
                  },
                });
              }
            }
          }
        },
        { timeout: 120000, maxWait: 30000 },
      );

      // Then create sections in chunks (prevents timeout)
      const chunkedResult = await CourseService.createSectionsInChunks(
        course.id,
        body.sections || [],
      );

      return {
        statusCode: 201,
        message: "Large course created successfully",
        data: {
          course,
          sectionsCreated: chunkedResult.successful,
          sectionsFailed: chunkedResult.failed,
          errors:
            chunkedResult.errors.length > 0 ? chunkedResult.errors : undefined,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        statusCode: 500,
        message: "Error creating large course",
        error: message,
      };
    }
  }

  /**
   * Update course with large payload in chunked manner
   * Useful for courses with many sections, chapters, and slides
   * PUT /api/courses/large/{courseId}
   */
  @Put("/large/{courseId}")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public async updateLargeCourse(
    @Path() courseId: string,
    @Body() body: UpdateSuperCourseDto,
    @Request() req: ExpressRequest,
  ) {
    const creatorId = req.user?.staff?.id as string;
    if (!creatorId) {
      return {
        statusCode: 400,
        message:
          "Staff ID (creatorId) is required. Make sure you are authenticated as staff.",
      };
    }

    try {
      const data: UpdateSuperCourseDto = { ...body, courseId };
      const io = req.app.get("io");
      const result = await CourseService.updateSuperCourse(data, creatorId, io);

      return {
        ...result,
        message: "Large course updated successfully",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        statusCode: 500,
        message: "Error updating large course",
        error: message,
      };
    }
  }

  /**
   * Update specific section in a course
   * Useful for partial updates
   * PUT /api/courses/{courseId}/sections
   */
  @Put("/{courseId}/sections")
  @Security("jwt")
  @Middlewares(checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN))
  public async updateSection(
    @Path() courseId: string,
    @Body() sectionData: any,
  ) {
    try {
      const result = await CourseService.updateSectionInCourse(
        courseId,
        sectionData,
      );

      return {
        statusCode: 200,
        message: "Section updated successfully",
        data: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        statusCode:
          error instanceof Error && message.includes("not found") ? 404 : 500,
        message: "Error updating section",
        error: message,
      };
    }
  }

  /**
   * OPTIMIZED: Get course basic info only (no nested data)
   * Response time: ~50ms
   */
  @Get("/{id}/basic")
  @Middlewares(loggerMiddleware)
  public getCourseBasic(@Path() id: string) {
    return CourseService.getCourseBasic(id);
  }

  /**
   * OPTIMIZED: Get course with sections and chapters (no slides/tests)
   * Response time: ~150ms
   */
  @Get("/{id}/sections")
  @Middlewares(loggerMiddleware)
  public getCourseSections(@Path() id: string) {
    return CourseService.getCourseSections(id);
  }

  /**
   * OPTIMIZED: Get chapter with slides only
   * Response time: ~100ms
   */
  @Get("/chapters/{chapterId}/slides")
  @Middlewares(loggerMiddleware)
  public getChapterWithSlides(@Path() chapterId: string) {
    return CourseService.getChapterWithSlides(chapterId);
  }

  /**
   * OPTIMIZED: Get chapter midTest with questions
   * Response time: ~80ms
   */
  @Get("/chapters/{chapterId}/midtest")
  @Middlewares(loggerMiddleware)
  public getChapterMidTest(@Path() chapterId: string) {
    return CourseService.getChapterMidTest(chapterId);
  }

  /**
   * OPTIMIZED: Get course tests only (pre, final, exam)
   * Response time: ~80ms
   */
  @Get("/{courseId}/tests")
  @Middlewares(loggerMiddleware)
  public getCourseTests(@Path() courseId: string) {
    return CourseService.getCourseTests(courseId);
  }

  /**
   * OPTIMIZED: Get course progress summary
   * Response time: ~100ms
   */
  @Get("/{courseId}/progress-summary")
  @Middlewares(loggerMiddleware)
  public getCourseProgressSummary(@Path() courseId: string) {
    return CourseService.getCourseProgressSummary(courseId);
  }

  /**
   * OPTIMIZED: Get all courses basic info (for lists)
   * Response time: ~200ms (vs 3000ms+ for full data)
   */
  @Get("/list/all-basic")
  @Middlewares(loggerMiddleware)
  public getAllCoursesBasic(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return CourseService.getAllCoursesBasic(searchq, limit, page);
  }

  /**
   * OPTIMIZED: Get my courses basic info
   * Response time: ~200ms (vs 3000ms+ for full data)
   */
  @Get("/list/my-basic")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getMyAllCoursesBasic(
    @Request() req: ExpressRequest,
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    const studentId = await this.getStudentId(req);
    return CourseService.getMyAllCoursesBasic(studentId, searchq, limit, page);
  }
}
