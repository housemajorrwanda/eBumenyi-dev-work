/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../utils/client";
import AppError from "../utils/error";
import {
  CreateCourseDto,
  TCourseResponse,
  CreateSuperCourseDto,
  UpdateSuperCourseDto,
  SuperCourseOptionDto,
} from "../utils/interfaces/common";
import { Prisma } from "@prisma/client";
import {
  SuperCourseCourseIntroDto,
  SuperCourseSectionDto,
  SuperCourseAnswerDto,
} from "../utils/interfaces/common";
import { BatchOperationExecutor } from "../utils/batchOperations";
import { NotificationHelper } from "../utils/notificationHelper";
import { NotificationService } from "./NotificationService";
import { pushService } from "./pushService";
import { roles } from "../utils/roles";

export const PROVINCE_DISTRICTS: Record<string, string[]> = {
  "Kigali City": ["Gasabo", "Kicukiro", "Nyarugenge"],
  Eastern: [
    "Bugesera",
    "Gatsibo",
    "Kayonza",
    "Kirehe",
    "Ngoma",
    "Nyagatare",
    "Rwamagana",
  ],
  Northern: ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
  Southern: [
    "Gisagara",
    "Huye",
    "Kamonyi",
    "Muhanga",
    "Nyamagabe",
    "Nyanza",
    "Nyaruguru",
    "Ruhango",
  ],
  Western: [
    "Karongi",
    "Ngororero",
    "Nyabihu",
    "Nyamasheke",
    "Rubavu",
    "Rusizi",
    "Rutsiro",
  ],
};

export interface AnalyticsFilters {
  district?: string;
  province?: string;
  gender?: string;
  year?: string;
  role?: string;
  month?: string;
  hospitalId?: string;
}

export class CourseService {
  private static readonly DEFAULT_COURSE_NOTIFY_ROLES = [
    roles.TRAINEE,
    roles.TESTER,
    roles.CHO,
  ];

  private static resolveAnalyticsDistrictList(
    filters?: AnalyticsFilters,
  ): string[] {
    if (filters?.district) return [filters.district];
    if (filters?.province) return PROVINCE_DISTRICTS[filters.province] ?? [];
    return [];
  }

  /** Student-scoped filters for dashboard analytics (role uses Student.role, not UserRole). */
  private static buildAnalyticsStudentScope(filters?: AnalyticsFilters) {
    const districtList = CourseService.resolveAnalyticsDistrictList(filters);

    const userFilter: Record<string, unknown> = {};
    if (districtList.length > 0) userFilter.district = { in: districtList };
    if (filters?.gender) userFilter.gender = filters.gender;
    if (filters?.hospitalId) userFilter.hospitalId = filters.hospitalId;

    const studentWhere: Record<string, unknown> = {};
    if (Object.keys(userFilter).length > 0) studentWhere.user = userFilter;
    if (filters?.role) studentWhere.role = filters.role;

    const progressWhere =
      Object.keys(studentWhere).length > 0 ? { student: studentWhere } : {};

    return { studentWhere, progressWhere, userFilter, districtList };
  }

  private static async markCoursePendingNotification(
    tx: Prisma.TransactionClient | typeof prisma,
    courseId: string,
  ): Promise<void> {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { lastNotifiedAt: true, pendingNotificationType: true },
    });
    if (!course) return;

    const pendingType = course.lastNotifiedAt
      ? "updated"
      : (course.pendingNotificationType ?? "created");

    await tx.course.update({
      where: { id: courseId },
      data: { pendingNotificationType: pendingType },
    });
  }

  private static async notifyCourseAudience(
    courseId: string,
    courseTitle: string,
    eventType: "created" | "updated",
    io?: any,
    roleFilter?: string[],
  ): Promise<number> {
    const targetRoles = (
      roleFilter?.length
        ? roleFilter
        : CourseService.DEFAULT_COURSE_NOTIFY_ROLES
    ) as Array<(typeof roles)[keyof typeof roles]>;

    const users = await prisma.user.findMany({
      where: {
        userRoles: { some: { name: { in: targetRoles as never } } },
        OR: [
          { student: { is: { status: "ACTIVE" } } },
          { student: { is: null } },
        ],
      },
      select: { id: true },
    });

    if (!users.length) return 0;

    const title =
      eventType === "created" ? "Isomo rishya ryongeweho" : "Isomo ryavuguruwe";
    const message =
      eventType === "created"
        ? `Isomo rishya "${courseTitle}" ryongeweho. Reba usome!`
        : `Isomo "${courseTitle}" ryavuguruwe. Reba impinduka!`;
    const actionUrl = `/course/${courseId}`;

    await Promise.allSettled(
      users.map(async (user) => {
        await NotificationService.createNotification(
          user.id,
          title,
          message,
          "info",
          actionUrl,
          "course",
          courseId,
          { courseTitle, eventType },
          {
            cooldownMs: 60_000,
            dedupKey: `course:${courseId}:${eventType}:${user.id}`,
          },
        );
        await pushService
          .sendToUser(user.id, {
            title,
            body: message,
            type: "info",
            entityId: courseId,
            deepLink: actionUrl,
            data: { entityType: "course", actionUrl, courseTitle, eventType },
          })
          .catch((err) =>
            console.warn(`[CourseService] Push failed for ${user.id}:`, err),
          );
        if (io) {
          io.to(`user:${user.id}`).emit("notification", {
            title,
            message,
            type: "info",
            actionUrl,
            entityType: "course",
            entityId: courseId,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        }
      }),
    );

    console.log(
      `[CourseService] Notified ${users.length} users (${targetRoles.join(", ")}): course ${eventType}`,
    );
    return users.length;
  }

  public static async releaseCourseNotification(
    courseId: string,
    requesterUserId: string,
    io?: any,
    roleFilter?: string[],
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        staff: { select: { userId: true } },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    const requesterRoles = await prisma.userRole.findMany({
      where: { userId: requesterUserId },
      select: { name: true },
    });
    const roleNames = requesterRoles.map((r) => r.name);
    const isCreator = course.staff?.userId === requesterUserId;
    const canNotify =
      isCreator ||
      roleNames.includes(roles.ADMIN as never) ||
      roleNames.includes(roles.TRAINER as never) ||
      roleNames.includes(roles.STAFF as never) ||
      roleNames.includes(roles.CHO as never);

    if (!canNotify) {
      throw new AppError(
        "You are not allowed to notify users for this course",
        403,
      );
    }

    if (!course.pendingNotificationType) {
      throw new AppError("No new changes to notify users about", 400);
    }

    if (!course.isPublished) {
      throw new AppError("Publish the course before notifying users", 400);
    }

    const eventType = course.pendingNotificationType as "created" | "updated";
    const notifiedCount = await CourseService.notifyCourseAudience(
      courseId,
      course.title,
      eventType,
      io,
      roleFilter,
    );

    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        pendingNotificationType: null,
        lastNotifiedAt: new Date(),
      },
    });

    return {
      message: `Notification sent to ${notifiedCount} user(s)`,
      statusCode: 200,
      data: {
        course: updated,
        notifiedCount,
        eventType,
      },
    };
  }
  public static async createCourse(
    data: CreateCourseDto,
    creatorId: string,
    io?: any,
  ) {
    // ensure creator (staff) exists
    const staff = await prisma.staff.findUnique({
      where: { userId: creatorId },
    });
    if (!staff) {
      throw new AppError("Creator (staff) not found", 404);
    }

    const course = await prisma.course.create({
      data: {
        creatorId: creatorId,
        title: data.title,
        coverIcon: data.coverIcon,
        description: data.description ?? null,
        pendingNotificationType: "created",
      },
    });

    return {
      message: "Course created successfully",
      statusCode: 201,
      data: course,
    } as { message: string; statusCode: number; data: TCourseResponse };
  }

  public static async getCourseById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            user: true,
          },
        },

        sections: {
          orderBy: { sectionNumber: "asc" },
          include: {
            chapters: {
              orderBy: { chapterNumber: "asc" },
              include: {
                slides: {
                  orderBy: { slideNumber: "asc" },
                },
                midTest: {
                  include: {
                    questionnaires: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        options: true,
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        intro: true,
        preTests: {
          orderBy: { createdAt: "asc" },
        },
        finalTest: {
          orderBy: { createdAt: "asc" },
        },
        finalExam: {
          orderBy: { createdAt: "asc" },
        },
        progresses: {
          orderBy: { createdAt: "asc" },
        },
        questionnaires: {
          orderBy: { createdAt: "asc" },
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    // Transform rating to ensure proper precision
    const transformedCourse = {
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
    };

    return {
      message: "Course fetched successfully",
      statusCode: 200,
      data: transformedCourse,
    };
  }

  public static async updateCourse(
    id: string,
    data: CreateCourseDto,
    io?: any,
  ) {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new AppError("Course not found", 404);

    // If creatorId changed, ensure staff exists
    if (data.creatorId) {
      const staff = await prisma.staff.findUnique({
        where: { id: data.creatorId },
      });
      if (!staff) throw new AppError("Creator (staff) not found", 404);
    }

    const updated = await prisma.course.update({
      where: { id },
      data: {
        creatorId: data.creatorId,
        title: data.title,
        coverIcon: data.coverIcon,
        description: data.description ?? null,
        isPublished: data.isPublished ?? true,
      },
    });

    await CourseService.markCoursePendingNotification(prisma, id);

    return {
      message: "Course updated successfully",
      statusCode: 200,
      data: updated,
    } as { message: string; statusCode: number; data: TCourseResponse };
  }

  public static async deleteCourse(id: string, io?: any) {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new AppError("Course not found", 404);
    const audience = await this.getCourseAudienceUserIds(
      id,
      existing.creatorId,
    );

    // Use transaction to ensure data consistency during deletion
    await prisma.$transaction(async (tx) => {
      // 1. Delete all course-related progress records
      await tx.courseProgress.deleteMany({
        where: { courseId: id },
      });

      // Delete documents on slides
      await tx.documentOnSlide.deleteMany({
        where: { courseId: id },
      });
      // 2. Get all sections for this course
      const sections = await tx.section.findMany({
        where: { courseId: id },
        include: {
          chapters: {
            include: {
              slides: true,
              midTest: {
                include: {
                  questionnaires: {
                    include: {
                      options: true,
                      answers: true,
                      attemptAnswers: true,
                    },
                  },
                  attempts: true,
                },
              },
            },
          },
        },
      });

      // 3. Delete all nested records for each section
      for (const section of sections) {
        // Delete chapter related data
        for (const chapter of section.chapters) {
          // Delete chapter progress
          await tx.chapterProgress.deleteMany({
            where: { chapterId: chapter.id },
          });
          // Delete chapter reviews
          await tx.chapterReview.deleteMany({
            where: { chapterId: chapter.id },
          });

          // Delete slide related data
          for (const slide of chapter.slides) {
            // Delete FAQs on slides
            await tx.fAQOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            // Delete feedbacks on slides
            await tx.feedbackOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            // Delete student on slides
            await tx.studentOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            // Delete slide progress
            await tx.slideProgress.deleteMany({
              where: { slideId: slide.id },
            });
          }
          // Delete slides
          await tx.slide.deleteMany({
            where: { chapterId: chapter.id },
          });

          // Delete midTest related data
          if (chapter.midTest) {
            for (const questionnaire of chapter.midTest.questionnaires) {
              await tx.attemptAnswer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.option.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.answer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
            }
            await tx.questionnaire.deleteMany({
              where: { midTestId: chapter.midTest.id },
            });
            await tx.attempTest.deleteMany({
              where: { midTestId: chapter.midTest.id },
            });
            await tx.midTest.delete({
              where: { id: chapter.midTest.id },
            });
          }
        }

        // Delete chapters
        await tx.chapter.deleteMany({
          where: { sectionId: section.id },
        });
      }

      // 4. Delete sections
      await tx.section.deleteMany({
        where: { courseId: id },
      });

      // 5. Delete course intro
      await tx.courseIntro.deleteMany({
        where: { courseId: id },
      });

      // 6. Finally delete the course
      await tx.course.delete({
        where: { id },
      });
    });

    // Notify audience about deletion
    if (audience.length && io) {
      await NotificationHelper.sendToUsers(
        io,
        audience,
        "Course deleted",
        `${existing.title} has been removed.`,
        "warning",
        `/courses/${id}`,
        "course",
        id,
        { action: "deleted" },
        30_000,
        `course:${id}:deleted`,
      ).catch((err) =>
        console.warn("[CourseService] course deletion notify failed", err),
      );
    }

    return { message: "Course deleted successfully", statusCode: 200 };
  }

  private static async getCourseAudienceUserIds(
    courseId: string,
    creatorStaffId?: string | null,
  ): Promise<string[]> {
    const progresses = await prisma.courseProgress.findMany({
      where: { courseId },
      include: {
        student: {
          select: { userId: true },
        },
      },
    });
    const studentUserIds = progresses
      .map((p) => p.student?.userId)
      .filter((id): id is string => !!id);

    let staffUserId: string | undefined;
    if (creatorStaffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: creatorStaffId },
        select: { userId: true },
      });
      staffUserId = staff?.userId;
    }

    return Array.from(
      new Set([...studentUserIds, ...(staffUserId ? [staffUserId] : [])]),
    );
  }

  public static async getCourses(
    searchq?: string,
    limit?: number,
    currentPage?: number,
    isPublished?: boolean,
  ) {
    const where: Prisma.CourseWhereInput = {};
    if (searchq) {
      where.OR = [
        { title: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const take = limit ?? 15;
    const skip = currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

    const courses = await prisma.course.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
        finalTest: true,
        finalExam: true,
        preTests: true,
        sections: {
          orderBy: { sectionNumber: "asc" },
          include: {
            chapters: {
              orderBy: { chapterNumber: "asc" },
              include: {
                slides: {
                  orderBy: { slideNumber: "asc" },
                },
                midTest: {
                  include: {
                    questionnaires: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        options: true,
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        intro: true,
        progresses: {
          orderBy: { createdAt: "asc" },
        },
        questionnaires: {
          orderBy: { createdAt: "asc" },
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });

    const totalItems = await prisma.course.count({ where });

    // Transform ratings to ensure proper precision
    const transformedCourses = courses.map((course) => ({
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
    }));

    return {
      message: "Courses fetched successfully",
      statusCode: 200,
      data: transformedCourses,
      totalItems,
      currentPage: currentPage || 1,
      itemsPerPage: take,
    };
  }

  public static async getAllCourses(searchq?: string) {
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
    };
    if (searchq) {
      where.OR = [
        { title: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        staff: {
          include: {
            user: true,
          },
        },

        sections: {
          orderBy: { sectionNumber: "asc" },
          include: {
            chapters: {
              orderBy: { chapterNumber: "asc" },
              include: {
                slides: {
                  orderBy: { slideNumber: "asc" },
                },
                midTest: {
                  include: {
                    questionnaires: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        options: true,
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        intro: true,
        preTests: {
          orderBy: { createdAt: "asc" },
        },
        finalTest: {
          orderBy: { createdAt: "asc" },
        },
        finalExam: {
          orderBy: { createdAt: "asc" },
        },
        progresses: {
          orderBy: { createdAt: "asc" },
        },
        questionnaires: {
          orderBy: { createdAt: "asc" },
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });

    // Transform ratings to ensure proper precision
    const transformedCourses = courses.map((course) => ({
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
    }));

    return {
      message: "Courses fetched successfully",
      statusCode: 200,
      data: transformedCourses,
    };
  }

  public static async getMyAllCourses(studentId: string, searchq?: string) {
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
    };
    if (searchq) {
      where.OR = [
        { title: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
        sections: {
          orderBy: { sectionNumber: "asc" },
          include: {
            chapters: {
              orderBy: { chapterNumber: "asc" },
              include: {
                slides: {
                  orderBy: { slideNumber: "asc" },
                },
                midTest: {
                  include: {
                    questionnaires: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        options: true,
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        intro: true,
        preTests: {
          orderBy: { createdAt: "asc" },
        },
        finalTest: {
          orderBy: { createdAt: "asc" },
        },
        finalExam: {
          orderBy: { createdAt: "asc" },
        },
        progresses: {
          where: { studentId },
          orderBy: { createdAt: "asc" },
        },
        questionnaires: {
          orderBy: { createdAt: "asc" },
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });

    // Transform ratings to ensure proper precision
    const transformedCourses = courses.map((course) => ({
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
    }));

    return {
      message: "Courses fetched successfully",
      statusCode: 200,
      data: transformedCourses,
    };
  }

  // Helper 1: Create base course
  private static async createCourseBase(
    tx: Prisma.TransactionClient,
    data: CreateSuperCourseDto,
    creatorId: string,
  ) {
    return await tx.course.create({
      data: {
        creatorId: creatorId,
        title: data.title,
        coverIcon: data.coverIcon,
        description: data.description ?? null,
        isPublished: data.isPublished ?? true,
        pendingNotificationType: "created",
      },
    });
  }

  // Helper 2: Create course intro
  private static async createCourseIntro(
    tx: Prisma.TransactionClient,
    courseId: string,
    courseIntro: SuperCourseCourseIntroDto | undefined,
  ) {
    if (!courseIntro) return;
    await tx.courseIntro.create({
      data: {
        courseId,
        title: courseIntro.title,
        summary: courseIntro.summary,
        bannerImage: courseIntro.bannerImage ?? null,
        thumbnail: courseIntro.thumbnail,
      },
    });
  }

  // Helper 3: Create course-level PreTest
  private static async createCoursePreTest(
    tx: Prisma.TransactionClient,
    courseId: string,
    preTest: CreateSuperCourseDto["preTest"] | undefined,
  ) {
    if (!preTest) return;
    await tx.preTest.create({
      data: {
        courseId,
        questionToBeAnswered: preTest.questionToBeAnswered,
        marksToPass: preTest.marksToPass,
        description: preTest.description,
        isPublished: preTest.isPublished ?? true,
      },
    });
  }

  // Helper 4: Create course-level FinalTest
  private static async createCourseFinalTest(
    tx: Prisma.TransactionClient,
    courseId: string,
    finalTest: CreateSuperCourseDto["finalTest"] | undefined,
  ) {
    if (!finalTest) return;
    await tx.finalTest.create({
      data: {
        courseId,
        questionToBeAnswered: finalTest.questionToBeAnswered,
        marksToPass: finalTest.marksToPass,
        description: finalTest.description,
        isPublished: finalTest.isPublished ?? true,
      },
    });
  }

  // Helper 4b: Create course-level FinalExam (mirror of finalTest)
  private static async createCourseFinalExam(
    tx: Prisma.TransactionClient,
    courseId: string,
    finalExam: CreateSuperCourseDto["finalExam"] | undefined,
  ) {
    if (!finalExam) return;
    await tx.finalExam.create({
      data: {
        courseId,
        questionToBeAnswered: finalExam.questionToBeAnswered,
        marksToPass: finalExam.marksToPass,
        description: finalExam.description,
        isPublished: finalExam.isPublished ?? true,
      },
    });
  }

  // Helper 5: Create course-level Questionnaires (questionBank)
  private static async createCourseQuestionBank(
    tx: Prisma.TransactionClient,
    courseId: string,
    questionBank: NonNullable<CreateSuperCourseDto["questionBank"]>,
  ) {
    if (!Array.isArray(questionBank)) return;
    for (const questionData of questionBank) {
      const questionnaire = await tx.questionnaire.create({
        data: {
          question: questionData.question,
          questionImage: questionData.questionImage ?? null,
          feedbackStatement: questionData.feedbackStatement ?? null,
          allowMultiple: questionData.allowMultiple,
          courseId,
        },
      });
      if (questionData.options && questionData.options.length > 0) {
        await CourseService.batchCreateOptions(
          tx,
          questionData.options,
          questionnaire.id,
          CourseService.BATCH_SIZE,
        );
      }
      const answers: SuperCourseAnswerDto[] = [];
      if (questionData.correctAnswer) {
        answers.push(questionData.correctAnswer);
      }
      if (
        questionData.correctAnswers &&
        questionData.correctAnswers.length > 0
      ) {
        for (const correctIndex of questionData.correctAnswers) {
          const correctOption = questionData.options[correctIndex];
          if (correctOption) {
            answers.push(correctOption);
          }
        }
      }
      if (answers.length > 0) {
        await CourseService.batchCreateAnswers(
          tx,
          answers,
          questionnaire.id,
          CourseService.BATCH_SIZE,
        );
      }
    }
  }

  // Helper 6: Create sections and chapters (with nested logic)
  private static async createSectionsAndChapters(
    tx: Prisma.TransactionClient,
    courseId: string,
    sectionsData: SuperCourseSectionDto[],
  ) {
    const sections = [];
    for (const [si, sectionData] of (sectionsData || []).entries()) {
      const section = await tx.section.create({
        data: {
          courseId,
          title: sectionData.title,
          description: sectionData.description ?? null,
          sectionNumber: sectionData.sectionNumber ?? si + 1,
        },
      });
      for (const chapterData of sectionData.chapters || []) {
        const chapter = await tx.chapter.create({
          data: {
            sectionId: section.id,
            title: chapterData.title,
            description: chapterData.description ?? null,
            chapterNumber: chapterData.chapterNumber ?? 1,
            activityAt: chapterData.activityAt ?? null,
            lessonDuration: chapterData.lessonDuration ?? 5,
            isPublished: chapterData.isPublished ?? true,
          },
        });
        if (chapterData.midTest) {
          const midTest = await tx.midTest.create({
            data: {
              chapterId: chapter.id,
              questionToBeAnswered: chapterData.midTest.questionToBeAnswered,
              marksToPass: chapterData.midTest.marksToPass,
              description: chapterData.midTest.description,
            },
          });

          // Batch create questionnaires with their options and answers
          await Promise.all(
            (chapterData.midTest.questionnaires || []).map(async (q) => {
              const questionnaire = await tx.questionnaire.create({
                data: {
                  question: q.question,
                  questionImage: q.questionImage ?? null,
                  feedbackStatement: q.feedbackStatement ?? null,
                  allowMultiple: q.allowMultiple,
                  midTestId: midTest.id,
                },
              });

              // Batch create options
              if (q.options && q.options.length > 0) {
                await Promise.all(
                  q.options.map((optionData) =>
                    tx.option.create({
                      data: {
                        label: optionData.label,
                        image: optionData.image ?? null,
                        questionnaireId: questionnaire.id,
                      },
                    }),
                  ),
                );
              }

              // Batch create answers
              if (q.answers && q.answers.length > 0) {
                await Promise.all(
                  q.answers.map((answerData) =>
                    tx.answer.create({
                      data: {
                        label: answerData.label,
                        image: answerData.image ?? null,
                        questionnaireId: questionnaire.id,
                      },
                    }),
                  ),
                );
              }
            }),
          );
        }
        for (const slideData of chapterData.slides || []) {
          await tx.slide.create({
            data: {
              chapterId: chapter.id,
              note: slideData.note ?? null,
              description: slideData.description ?? null,
              slideNumber: slideData.slideNumber,
              file: slideData.file ?? null,
              isPublished: slideData.isPublished ?? true,
            },
          });
        }
      }
      sections.push(section);
    }
    return sections;
  }

  // Super Course Creation Method
  public static async createSuperCourse(
    data: CreateSuperCourseDto,
    creatorId: string,
    io?: any,
  ) {
    // ensure creator (staff) exists
    const staff = await prisma.staff.findUnique({
      where: { id: creatorId },
    });
    if (!staff) {
      throw new AppError("Creator (staff) not found", 404);
    }
    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(
      async (tx) => {
        const course = await CourseService.createCourseBase(
          tx,
          data,
          creatorId,
        );
        await CourseService.createCourseIntro(tx, course.id, data.courseIntro);
        await CourseService.createCoursePreTest(tx, course.id, data.preTest);
        await CourseService.createCourseFinalTest(
          tx,
          course.id,
          data.finalTest,
        );
        // Also create course-level FinalExam if provided
        await CourseService.createCourseFinalExam(
          tx,
          course.id,
          data.finalExam,
        );
        await CourseService.createCourseQuestionBank(
          tx,
          course.id,
          data.questionBank ?? [],
        );
        const sections = await CourseService.createSectionsAndChapters(
          tx,
          course.id,
          data.sections,
        );
        return {
          course,
          sections,
        };
      },
      {
        maxWait: CourseService.MAX_WAIT, // 1 minute
        timeout: CourseService.TRANSACTION_TIMEOUT, // 2 minutes
      },
    );
    // Mark pending notification — creator releases manually from the web UI
    await CourseService.markCoursePendingNotification(prisma, result.course.id);
    const refreshed = await prisma.course.findUnique({
      where: { id: result.course.id },
    });

    return {
      message: "Super course created successfully",
      statusCode: 201,
      data: {
        ...result,
        course: refreshed ?? result.course,
      },
    };
  }

  // Helper 1: Update base course
  private static async updateCourseBase(
    tx: Prisma.TransactionClient,
    data: UpdateSuperCourseDto,
  ) {
    return await tx.course.update({
      where: { id: data.courseId },
      data: {
        title: data.title,
        coverIcon: data.coverIcon,
        description: data.description ?? null,
        isPublished: data.isPublished ?? true,
      },
    });
  }

  // Helper 2: Upsert course intro
  private static async upsertCourseIntro(
    tx: Prisma.TransactionClient,
    courseId: string,
    courseIntro: SuperCourseCourseIntroDto | undefined,
  ) {
    if (!courseIntro) return;
    const existingIntro = await tx.courseIntro.findUnique({
      where: { courseId },
    });
    if (existingIntro) {
      await tx.courseIntro.update({
        where: { id: existingIntro.id },
        data: {
          title: courseIntro.title,
          summary: courseIntro.summary,
          bannerImage: courseIntro.bannerImage ?? null,
          thumbnail: courseIntro.thumbnail,
        },
      });
    } else {
      await tx.courseIntro.create({
        data: {
          courseId,
          title: courseIntro.title,
          summary: courseIntro.summary,
          bannerImage: courseIntro.bannerImage ?? null,
          thumbnail: courseIntro.thumbnail,
        },
      });
    }
  }

  // Helper 3: Upsert pre-test
  private static async upsertCoursePreTest(
    tx: Prisma.TransactionClient,
    courseId: string,
    preTest: UpdateSuperCourseDto["preTest"] | undefined,
  ) {
    if (!preTest) return;
    const existingPreTest = await tx.preTest.findFirst({ where: { courseId } });
    if (existingPreTest) {
      await tx.preTest.update({
        where: { id: existingPreTest.id },
        data: {
          questionToBeAnswered: preTest.questionToBeAnswered,
          marksToPass: preTest.marksToPass,
          description: preTest.description,
          isPublished: preTest.isPublished ?? true,
        },
      });
    } else {
      await tx.preTest.create({
        data: {
          courseId,
          questionToBeAnswered: preTest.questionToBeAnswered,
          marksToPass: preTest.marksToPass,
          description: preTest.description,
          isPublished: preTest.isPublished ?? true,
        },
      });
    }
  }

  // Helper 4: Upsert final test
  private static async upsertCourseFinalTest(
    tx: Prisma.TransactionClient,
    courseId: string,
    finalTest: UpdateSuperCourseDto["finalTest"] | undefined,
  ) {
    if (!finalTest) return;
    const existingFinalTest = await tx.finalTest.findFirst({
      where: { courseId },
    });
    if (existingFinalTest) {
      await tx.finalTest.update({
        where: { id: existingFinalTest.id },
        data: {
          questionToBeAnswered: finalTest.questionToBeAnswered,
          marksToPass: finalTest.marksToPass,
          description: finalTest.description,
          isPublished: finalTest.isPublished ?? true,
        },
      });
    } else {
      await tx.finalTest.create({
        data: {
          courseId,
          questionToBeAnswered: finalTest.questionToBeAnswered,
          marksToPass: finalTest.marksToPass,
          description: finalTest.description,
          isPublished: finalTest.isPublished ?? true,
        },
      });
    }
  }

  // Helper 4b: Upsert course-level FinalExam (mirror of finalTest)
  private static async upsertCourseFinalExam(
    tx: Prisma.TransactionClient,
    courseId: string,
    finalExam: UpdateSuperCourseDto["finalExam"] | undefined,
  ) {
    if (!finalExam) return;
    const existingFinalExam = await tx.finalExam.findFirst({
      where: { courseId },
    });
    if (existingFinalExam) {
      await tx.finalExam.update({
        where: { id: existingFinalExam.id },
        data: {
          questionToBeAnswered: finalExam.questionToBeAnswered,
          marksToPass: finalExam.marksToPass,
          description: finalExam.description,
          isPublished: finalExam.isPublished ?? true,
        },
      });
    } else {
      await tx.finalExam.create({
        data: {
          courseId,
          questionToBeAnswered: finalExam.questionToBeAnswered,
          marksToPass: finalExam.marksToPass,
          description: finalExam.description,
          isPublished: finalExam.isPublished ?? true,
        },
      });
    }
  }

  // Helper 5: Upsert question bank
  private static async upsertCourseQuestionBank(
    tx: Prisma.TransactionClient,
    courseId: string,
    questionBank: NonNullable<UpdateSuperCourseDto["questionBank"]>,
  ) {
    if (!Array.isArray(questionBank)) return;
    const existingQuestionnaires = await tx.questionnaire.findMany({
      where: { courseId },
      include: { options: true, answers: true },
    });
    const updatedIds: string[] = [];
    for (const questionData of questionBank) {
      const existing = existingQuestionnaires.find(
        (q) => q.question === questionData.question,
      );
      if (existing) {
        updatedIds.push(existing.id);
        await tx.questionnaire.update({
          where: { id: existing.id },
          data: {
            question: questionData.question,
            questionImage: questionData.questionImage ?? null,
            feedbackStatement: questionData.feedbackStatement ?? null,
            allowMultiple: questionData.allowMultiple,
          },
        });
        await tx.option.deleteMany({ where: { questionnaireId: existing.id } });
        for (const optionData of questionData.options) {
          await tx.option.create({
            data: {
              label: optionData.label,
              image: optionData.image ?? null,
              questionnaireId: existing.id,
            },
          });
        }
        await tx.answer.deleteMany({ where: { questionnaireId: existing.id } });
        if (questionData.correctAnswer) {
          await tx.answer.create({
            data: {
              label: questionData.correctAnswer.label,
              image: questionData.correctAnswer.image ?? null,
              questionnaireId: existing.id,
            },
          });
        }
        if (
          questionData.correctAnswers &&
          questionData.correctAnswers.length > 0
        ) {
          for (const correctIndex of questionData.correctAnswers) {
            const correctOption = questionData.options[correctIndex];
            if (correctOption) {
              await tx.answer.create({
                data: {
                  label: correctOption.label,
                  image: correctOption.image ?? null,
                  questionnaireId: existing.id,
                },
              });
            }
          }
        }
      } else {
        const questionnaire = await tx.questionnaire.create({
          data: {
            question: questionData.question,
            questionImage: questionData.questionImage ?? null,
            feedbackStatement: questionData.feedbackStatement ?? null,
            allowMultiple: questionData.allowMultiple,
            courseId,
          },
        });
        for (const optionData of questionData.options) {
          await tx.option.create({
            data: {
              label: optionData.label,
              image: optionData.image ?? null,
              questionnaireId: questionnaire.id,
            },
          });
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
        if (
          questionData.correctAnswers &&
          questionData.correctAnswers.length > 0
        ) {
          for (const correctIndex of questionData.correctAnswers) {
            const correctOption = questionData.options[correctIndex];
            if (correctOption) {
              await tx.answer.create({
                data: {
                  label: correctOption.label,
                  image: correctOption.image ?? null,
                  questionnaireId: questionnaire.id,
                },
              });
            }
          }
        }
      }
    }
    for (const existing of existingQuestionnaires) {
      if (!updatedIds.includes(existing.id)) {
        try {
          // Cascade delete will handle all related records (options, answers, attempt answers)
          await tx.questionnaire.delete({ where: { id: existing.id } });
        } catch (error) {
          console.warn(
            `Warning: Could not delete questionnaire ${existing.id}:`,
            error,
          );
        }
      }
    }
  }

  // Helper 6: Upsert sections and chapters
  private static async upsertSectionsAndChapters(
    tx: Prisma.TransactionClient,
    courseId: string,
    sectionsData: SuperCourseSectionDto[],
  ) {
    const existingSections = await tx.section.findMany({
      where: { courseId },
      include: {
        chapters: {
          include: {
            slides: true,
            midTest: {
              include: {
                questionnaires: {
                  include: {
                    options: true,
                    answers: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const sectionIdsToKeep: string[] = [];
    for (const [si, sectionData] of (sectionsData || []).entries()) {
      let section = existingSections.find((s) => s.title === sectionData.title);
      if (section) {
        sectionIdsToKeep.push(section.id);
        await tx.section.update({
          where: { id: section.id },
          data: {
            title: sectionData.title,
            description: sectionData.description ?? null,
            sectionNumber: sectionData.sectionNumber ?? si + 1,
          },
        });
      } else {
        const createdSection = await tx.section.create({
          data: {
            courseId,
            title: sectionData.title,
            description: sectionData.description ?? null,
            sectionNumber: sectionData.sectionNumber ?? si + 1,
          },
        });
        section = { ...createdSection, chapters: [] };
        sectionIdsToKeep.push(section.id);
      }
      const existingChapters = section.chapters || [];
      const chapterIdsToKeep: string[] = [];
      for (const chapterData of sectionData.chapters || []) {
        let chapter = existingChapters.find(
          (c) => c.title === chapterData.title,
        );
        if (chapter) {
          chapterIdsToKeep.push(chapter.id);
          await tx.chapter.update({
            where: { id: chapter.id },
            data: {
              title: chapterData.title,
              description: chapterData.description ?? null,
              chapterNumber: chapterData.chapterNumber ?? 1,
              activityAt: chapterData.activityAt ?? null,
              lessonDuration: chapterData.lessonDuration ?? 5,
              isPublished: chapterData.isPublished ?? true,
            },
          });
        } else {
          const createdChapter = await tx.chapter.create({
            data: {
              sectionId: section.id,
              title: chapterData.title,
              description: chapterData.description ?? null,
              chapterNumber: chapterData.chapterNumber ?? 1,
              activityAt: chapterData.activityAt ?? null,
              lessonDuration: chapterData.lessonDuration ?? 5,
              isPublished: chapterData.isPublished ?? true,
            },
          });
          chapter = { ...createdChapter, slides: [], midTest: null };
          chapterIdsToKeep.push(chapter.id);
        }
        // Upsert midTest for chapter.
        // Omission means "leave it as-is"; only explicit null removes it.
        if (chapterData.midTest) {
          if (chapter.midTest) {
            // MidTest already exists — update config only, never touch questionnaires.
            // Questions are managed independently via the /questionnaires endpoint.
            await tx.midTest.update({
              where: { id: chapter.midTest.id },
              data: {
                questionToBeAnswered: chapterData.midTest.questionToBeAnswered,
                marksToPass: chapterData.midTest.marksToPass,
                description: chapterData.midTest.description,
              },
            });
          } else {
            // No midTest yet — create one. Questionnaires are added separately.
            await tx.midTest.create({
              data: {
                chapterId: chapter.id,
                questionToBeAnswered: chapterData.midTest.questionToBeAnswered,
                marksToPass: chapterData.midTest.marksToPass,
                description: chapterData.midTest.description,
              },
            });
          }
        } else if (chapterData.midTest === null && chapter.midTest) {
          // MidTest intentionally removed — clean up everything
          for (const questionnaire of chapter.midTest.questionnaires || []) {
            await tx.attemptAnswer.deleteMany({
              where: { questionnaireId: questionnaire.id },
            });
            await tx.option.deleteMany({
              where: { questionnaireId: questionnaire.id },
            });
            await tx.answer.deleteMany({
              where: { questionnaireId: questionnaire.id },
            });
            await tx.questionnaire.delete({ where: { id: questionnaire.id } });
          }
          await tx.midTest.deleteMany({ where: { id: chapter.midTest.id } });
        }
        // Upsert Slides
        const existingSlides = chapter.slides || [];
        const slideIdsToKeep: string[] = [];
        for (const slideData of chapterData.slides || []) {
          const slide = existingSlides.find(
            (s) => s.slideNumber === slideData.slideNumber,
          );
          if (slide) {
            slideIdsToKeep.push(slide.id);
            await tx.slide.update({
              where: { id: slide.id },
              data: {
                note: slideData.note ?? null,
                description: slideData.description ?? null,
                // don't permanently set slideNumber here to avoid transient conflicts;
                // we'll normalize slide numbers to match payload order below
                file: slideData.file ?? null,
                isPublished: slideData.isPublished ?? true,
              },
            });
          } else {
            const createdSlide = await tx.slide.create({
              data: {
                chapterId: chapter.id,
                note: slideData.note ?? null,
                description: slideData.description ?? null,
                // assign provided number (or 0) temporarily; final numbering will be normalized
                slideNumber: slideData.slideNumber ?? 0,
                file: slideData.file ?? null,
                isPublished: slideData.isPublished ?? true,
              },
            });
            slideIdsToKeep.push(createdSlide.id);
          }
        }
        // Delete slides not in payload
        for (const slide of existingSlides) {
          if (!slideIdsToKeep.includes(slide.id)) {
            // remove dependent records referencing this slide first to avoid FK constraint
            await tx.fAQOnSlide.deleteMany({ where: { slideId: slide.id } });
            await tx.feedbackOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.studentOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.slideProgress.deleteMany({ where: { slideId: slide.id } });

            await tx.slide.deleteMany({ where: { id: slide.id } });
          }
        }

        // Normalize slide numbers to exactly match the order in the incoming payload.
        // This prevents re-ordering/shuffling when slide numbers change in the payload.
        for (let i = 0; i < slideIdsToKeep.length; i++) {
          const slideId = slideIdsToKeep[i];
          const desiredNumber =
            chapterData.slides &&
            chapterData.slides[i] &&
            chapterData.slides[i].slideNumber
              ? chapterData.slides[i].slideNumber
              : i + 1;
          await tx.slide.update({
            where: { id: slideId },
            data: { slideNumber: desiredNumber },
          });
        }
        // Normalize chapter numbers to exactly match the order in the incoming payload.
        // This prevents re-ordering/shuffling when chapter numbers change in the payload.
        for (let i = 0; i < chapterIdsToKeep.length; i++) {
          const chapterId = chapterIdsToKeep[i];
          const desiredNumber =
            sectionData.chapters &&
            sectionData.chapters[i] &&
            sectionData.chapters[i].chapterNumber
              ? sectionData.chapters[i].chapterNumber
              : i + 1;
          await tx.chapter.update({
            where: { id: chapterId },
            data: { chapterNumber: desiredNumber },
          });
        }
      }
      // Delete chapters not in payload
      for (const chapter of existingChapters) {
        if (!chapterIdsToKeep.includes(chapter.id)) {
          // delete dependent slide-level records for slides under this chapter
          for (const slide of chapter.slides || []) {
            await tx.fAQOnSlide.deleteMany({ where: { slideId: slide.id } });
            await tx.feedbackOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.studentOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.slideProgress.deleteMany({ where: { slideId: slide.id } });
          }

          await tx.slide.deleteMany({ where: { chapterId: chapter.id } });
          if (chapter.midTest) {
            for (const questionnaire of chapter.midTest.questionnaires || []) {
              await tx.attemptAnswer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.option.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.answer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.questionnaire.delete({
                where: { id: questionnaire.id },
              });
            }
            await tx.midTest.deleteMany({ where: { id: chapter.midTest.id } });
          }
          await tx.chapterProgress.deleteMany({
            where: { chapterId: chapter.id },
          });
          await tx.chapterReview.deleteMany({
            where: { chapterId: chapter.id },
          });
          await tx.chapter.delete({ where: { id: chapter.id } });
        }
      }
    }
    // Delete sections not in payload
    for (const section of existingSections) {
      if (!sectionIdsToKeep.includes(section.id)) {
        for (const chapter of section.chapters) {
          // delete dependent slide-level records for slides under this chapter
          for (const slide of chapter.slides || []) {
            await tx.fAQOnSlide.deleteMany({ where: { slideId: slide.id } });
            await tx.feedbackOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.studentOnSlide.deleteMany({
              where: { slideId: slide.id },
            });
            await tx.slideProgress.deleteMany({ where: { slideId: slide.id } });
          }

          await tx.slide.deleteMany({ where: { chapterId: chapter.id } });
          if (chapter.midTest) {
            for (const questionnaire of chapter.midTest.questionnaires || []) {
              await tx.attemptAnswer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.option.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.answer.deleteMany({
                where: { questionnaireId: questionnaire.id },
              });
              await tx.questionnaire.delete({
                where: { id: questionnaire.id },
              });
            }
            await tx.midTest.deleteMany({ where: { id: chapter.midTest.id } });
          }
          await tx.chapterProgress.deleteMany({
            where: { chapterId: chapter.id },
          });
          await tx.chapterReview.deleteMany({
            where: { chapterId: chapter.id },
          });
          await tx.chapter.delete({ where: { id: chapter.id } });
        }
        await tx.section.delete({ where: { id: section.id } });
      }
    }
  }

  // Updated Super Course Update Method for new payload structure
  public static async updateSuperCourse(
    data: UpdateSuperCourseDto,
    creatorId: string,
    io?: any,
  ) {
    // Ensure creator (staff) exists
    const staff = await prisma.staff.findUnique({
      where: { id: creatorId },
    });
    if (!staff) {
      throw new AppError("Creator (staff) not found", 404);
    }
    // Ensure course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id: data.courseId },
    });
    if (!existingCourse) {
      throw new AppError("Course not found", 404);
    }
    // Use transaction for safe update
    const result = await prisma.$transaction(
      async (tx) => {
        const course = await CourseService.updateCourseBase(tx, data);
        await CourseService.upsertCourseIntro(tx, course.id, data.courseIntro);
        await CourseService.upsertCoursePreTest(tx, course.id, data.preTest);
        await CourseService.upsertCourseFinalTest(
          tx,
          course.id,
          data.finalTest,
        );
        // Also upsert final exam if provided
        await CourseService.upsertCourseFinalExam(
          tx,
          course.id,
          data.finalExam,
        );
        // Only touch question bank when the caller explicitly sends it.
        // Passing undefined here hits the !Array.isArray guard and returns
        // early — preventing auto-save from wiping existing questions.
        await CourseService.upsertCourseQuestionBank(
          tx,
          course.id,
          data.questionBank as NonNullable<
            UpdateSuperCourseDto["questionBank"]
          >,
        );
        await CourseService.upsertSectionsAndChapters(
          tx,
          course.id,
          data.sections,
        );
        await CourseService.markCoursePendingNotification(tx, course.id);
        const refreshed = await tx.course.findUnique({
          where: { id: course.id },
        });
        return { course: refreshed ?? course };
      },
      {
        maxWait: CourseService.MAX_WAIT, // 1 minute
        timeout: CourseService.TRANSACTION_TIMEOUT, // 2 minutes
      },
    );

    return {
      message: "Super course updated successfully",
      statusCode: 200,
      data: result,
    };
  }

  // Helper to batch create options with improved concurrency control
  private static async batchCreateOptions(
    tx: Prisma.TransactionClient,
    options: SuperCourseOptionDto[],
    questionnaireId: string,
    batchSize: number,
  ) {
    for (let i = 0; i < options.length; i += batchSize) {
      const batch = options.slice(i, i + batchSize);

      // Create all options in this batch in parallel
      await Promise.all(
        batch.map((optionData) =>
          tx.option.create({
            data: {
              label: optionData.label,
              image: optionData.image ?? null,
              questionnaireId,
            },
          }),
        ),
      );

      // Small delay between batches to prevent connection pool exhaustion
      if (i + batchSize < options.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, CourseService.BATCH_DELAY),
        );
      }
    }
  }

  // Helper to batch create answers with improved concurrency control
  private static async batchCreateAnswers(
    tx: Prisma.TransactionClient,
    answers: SuperCourseAnswerDto[],
    questionnaireId: string,
    batchSize: number,
  ) {
    for (let i = 0; i < answers.length; i += batchSize) {
      const batch = answers.slice(i, i + batchSize);

      // Create all answers in this batch in parallel
      await Promise.all(
        batch.map((answerData) =>
          tx.answer.create({
            data: {
              label: answerData.label,
              image: answerData.image ?? null,
              questionnaireId,
            },
          }),
        ),
      );

      // Small delay between batches
      if (i + batchSize < answers.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, CourseService.BATCH_DELAY),
        );
      }
    }
  }

  private static readonly BATCH_SIZE = 50; // Increased from 5 to 50 for better throughput
  private static readonly TRANSACTION_TIMEOUT = 600000; // 10 minutes (increased from 5)
  private static readonly MAX_WAIT = 120000; // 2 minutes
  private static readonly CHUNK_BATCH_SIZE = 50; // Items per batch in chunked operations
  private static readonly BATCH_DELAY = 50; // 50ms delay between batches to prevent timeout

  /**
   * Get dashboard statistics
   */
  public static async getDashboardStatistics(filters?: AnalyticsFilters) {
    const { studentWhere, progressWhere, districtList } =
      CourseService.buildAnalyticsStudentScope(filters);

    // Date ranges for trend calculations
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get total courses (current and previous period)
    const totalCourses = await prisma.course.count();
    const previousCourses = await prisma.course.count({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    const courseTrend = CourseService.calculateTrend(
      totalCourses,
      previousCourses,
    );

    // Get unpublished courses (current and previous period)
    const unpublishedCourses = await prisma.course.count({
      where: { isPublished: false },
    });
    const previousUnpublished = await prisma.course.count({
      where: {
        isPublished: false,
        createdAt: { lt: thirtyDaysAgo },
      },
    });
    const unpublishedTrend = CourseService.calculateTrend(
      unpublishedCourses,
      previousUnpublished,
    );

    // Get total students (current and previous period)
    const totalStudents = await prisma.student.count({ where: studentWhere });
    const previousStudents = await prisma.student.count({
      where: {
        ...studentWhere,
        user: {
          ...(studentWhere.user as object | undefined),
          createdAt: { lt: thirtyDaysAgo },
        },
      },
    });
    const studentsTrend = CourseService.calculateTrend(
      totalStudents,
      previousStudents,
    );

    // Get total trainers (staff) (current and previous period)
    const totalTrainers = await prisma.staff.count();
    const previousTrainers = await prisma.staff.count({
      where: {
        user: { createdAt: { lt: thirtyDaysAgo } },
      },
    });
    const trainersTrend = CourseService.calculateTrend(
      totalTrainers,
      previousTrainers,
    );

    // Get total staff (all users with STAFF role) (current and previous period)
    const totalStaff = await prisma.userRole.count({
      where: { name: "STAFF" },
    });
    const previousStaff = await prisma.userRole.count({
      where: {
        name: "STAFF",
        user: { createdAt: { lt: thirtyDaysAgo } },
      },
    });
    const staffTrend = CourseService.calculateTrend(totalStaff, previousStaff);

    // Get active users (current period)
    const studentActivityScope: Record<string, unknown> = {
      courseProgresses: { some: { updatedAt: { gte: thirtyDaysAgo } } },
    };
    if (districtList.length > 0) {
      studentActivityScope.user = { district: { in: districtList } };
    }
    if (filters?.role) studentActivityScope.role = filters.role;

    const activeUsersWhere =
      districtList.length > 0 || filters?.role
        ? { student: studentActivityScope }
        : {
            OR: [
              {
                student: {
                  courseProgresses: {
                    some: { updatedAt: { gte: thirtyDaysAgo } },
                  },
                },
              },
              {
                staff: {
                  courses: { some: { updatedAt: { gte: thirtyDaysAgo } } },
                },
              },
            ],
          };

    const previousStudentActivityScope: Record<string, unknown> = {
      courseProgresses: {
        some: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      },
    };
    if (districtList.length > 0) {
      previousStudentActivityScope.user = { district: { in: districtList } };
    }
    if (filters?.role) previousStudentActivityScope.role = filters.role;

    const previousActiveUsersWhere =
      districtList.length > 0 || filters?.role
        ? { student: previousStudentActivityScope }
        : {
            OR: [
              {
                student: {
                  courseProgresses: {
                    some: {
                      updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
                    },
                  },
                },
              },
              {
                staff: {
                  courses: {
                    some: {
                      updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
                    },
                  },
                },
              },
            ],
          };

    const activeUsers = await prisma.user.count({ where: activeUsersWhere });

    const previousActiveUsers = await prisma.user.count({
      where: previousActiveUsersWhere,
    });
    const activeUsersTrend = CourseService.calculateTrend(
      activeUsers,
      previousActiveUsers,
    );

    // Calculate completion rate (current period)
    const totalProgresses = await prisma.courseProgress.count({
      where: progressWhere,
    });
    const completedProgresses = await prisma.courseProgress.count({
      where: { isCompleted: true, ...progressWhere },
    });
    const completionRate =
      totalProgresses > 0
        ? Math.round((completedProgresses / totalProgresses) * 100 * 10) / 10
        : 0;

    // Calculate completion rate (previous period)
    const previousTotalProgresses = await prisma.courseProgress.count({
      where: { createdAt: { lt: thirtyDaysAgo }, ...progressWhere },
    });
    const previousCompletedProgresses = await prisma.courseProgress.count({
      where: {
        isCompleted: true,
        updatedAt: { lt: thirtyDaysAgo },
        ...progressWhere,
      },
    });
    const previousCompletionRate =
      previousTotalProgresses > 0
        ? Math.round(
            (previousCompletedProgresses / previousTotalProgresses) * 100 * 10,
          ) / 10
        : 0;
    const completionRateTrend = CourseService.calculateTrend(
      completionRate,
      previousCompletionRate,
    );

    // Get new enrollments in the last 30 days
    const newEnrollments = await prisma.courseProgress.count({
      where: { createdAt: { gte: thirtyDaysAgo }, ...progressWhere },
    });

    // Get five recent courses with enrollment and rating data
    const recentCourses = await prisma.course.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            progresses: true, // This gives us the enrollment count
          },
        },
      },
    });

    // Transform recent courses data
    const fiveRecentCourses = recentCourses.map((course) => ({
      id: course.id,
      name: course.title,
      enrolled: course._count.progresses,
      rating: Math.round((course.rating || 0) * 10) / 10, // Ensure proper rounding to 1 decimal
    }));

    // Get 3 popular courses (most enrolled)
    const popularCourses = await prisma.course.findMany({
      take: 3,
      orderBy: {
        progresses: {
          _count: "desc",
        },
      },
      include: {
        _count: {
          select: {
            progresses: true,
          },
        },
      },
    });

    const threePopularCourses = popularCourses.map((course) => ({
      id: course.id,
      title: course.title,
      studentsEnrolled: course._count.progresses,
      status: course.isPublished ? "active" : "inactive",
      rating: Math.round((course.rating || 0) * 10) / 10,
    }));

    // Get recent activities from database
    const recentActivities = [];

    // Get most recent student enrollment
    const recentEnrollment = await prisma.courseProgress.findFirst({
      where: progressWhere,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        course: true,
      },
    });

    if (recentEnrollment) {
      recentActivities.push({
        id: `enrollment_${recentEnrollment.id}`,
        userId: recentEnrollment.student.userId,
        userName: recentEnrollment.student.user.fullNames,
        userPhoto: recentEnrollment.student.user.photo,
        action: "enrolled",
        description: `Enrolled in ${recentEnrollment.course.title}`,
        timestamp: recentEnrollment.createdAt,
        type: "enrollment",
      });
    }

    // Get most recent course completion
    const recentCompletion = await prisma.courseProgress.findFirst({
      where: { isCompleted: true, ...progressWhere },
      orderBy: { updatedAt: "desc" },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        course: true,
      },
    });

    if (recentCompletion) {
      recentActivities.push({
        id: `completion_${recentCompletion.id}`,
        userId: recentCompletion.student.userId,
        userName: recentCompletion.student.user.fullNames,
        userPhoto: recentCompletion.student.user.photo,
        action: "completed",
        description: `Completed ${recentCompletion.course.title} course`,
        timestamp: recentCompletion.updatedAt,
        type: "completion",
      });
    }

    return {
      message: "Dashboard statistics fetched successfully",
      statusCode: 200,
      data: {
        totalCourses: { value: totalCourses, trend: courseTrend },
        unpublishedCourses: {
          value: unpublishedCourses,
          trend: unpublishedTrend,
        },
        totalStudents: { value: totalStudents, trend: studentsTrend },
        totalTrainers: { value: totalTrainers, trend: trainersTrend },
        totalStaff: { value: totalStaff, trend: staffTrend },
        activeUsers: { value: activeUsers, trend: activeUsersTrend },
        completionRate: { value: completionRate, trend: completionRateTrend },
        newEnrollments,
        fiveRecentCourses,
        threePopularCourses,
        recentActivities,
      },
    };
  }

  /**
   * Calculate trend between current and previous values
   */
  private static calculateTrend(
    current: number,
    previous: number,
  ): { value: number; direction: "up" | "down" | "stable" } {
    if (previous === 0) {
      return {
        value: current > 0 ? 100 : 0,
        direction: current > 0 ? "up" : "stable",
      };
    }

    const percentageChange = Math.round(
      ((current - previous) / previous) * 100,
    );
    const absChange = Math.abs(percentageChange);

    if (percentageChange > 0) {
      return { value: absChange, direction: "up" };
    } else if (percentageChange < 0) {
      return { value: absChange, direction: "down" };
    } else {
      return { value: 0, direction: "stable" };
    }
  }

  /**
   * Broadcast real-time dashboard statistics to connected users
   */
  public static async broadcastDashboardStats(io: any) {
    try {
      const stats = await this.getDashboardStatistics();
      io.to("ADMIN").to("STAFF").emit("dashboard_stats_updated", stats.data);
    } catch (error) {
      console.error("Error broadcasting dashboard stats:", error);
    }
  }

  /**
   * Trigger real-time dashboard update when course progress changes
   */
  public static async onCourseProgressUpdate(io: any) {
    await this.broadcastDashboardStats(io);
  }

  /**
   * Trigger real-time dashboard update when new course is created
   */
  public static async onCourseCreated(io: any) {
    await this.broadcastDashboardStats(io);
  }

  /**
   * Get comprehensive course analytics
   */
  public static async getCourseAnalytics(filters?: AnalyticsFilters) {
    const { progressWhere } = CourseService.buildAnalyticsStudentScope(filters);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 1. Total Courses with trend
    const totalCourses = await prisma.course.count();
    const previousCourses = await prisma.course.count({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    const coursesTrend = CourseService.calculateTrend(
      totalCourses,
      previousCourses,
    );

    // 2. Active Enrollments (students with ongoing courses) with trend
    const activeEnrollments = await prisma.courseProgress.count({
      where: { isCompleted: false, ...progressWhere },
    });
    const previousActiveEnrollments = await prisma.courseProgress.count({
      where: {
        isCompleted: false,
        createdAt: { lt: thirtyDaysAgo },
        ...progressWhere,
      },
    });
    const enrollmentsTrend = CourseService.calculateTrend(
      activeEnrollments,
      previousActiveEnrollments,
    );

    // 3. Average Completion Rate with trend
    const totalProgresses = await prisma.courseProgress.count({
      where: progressWhere,
    });
    const completedProgresses = await prisma.courseProgress.count({
      where: { isCompleted: true, ...progressWhere },
    });
    const avgCompletionRate =
      totalProgresses > 0
        ? Math.round((completedProgresses / totalProgresses) * 100)
        : 0;

    const previousTotalProgresses = await prisma.courseProgress.count({
      where: { createdAt: { lt: thirtyDaysAgo }, ...progressWhere },
    });
    const previousCompletedProgresses = await prisma.courseProgress.count({
      where: {
        isCompleted: true,
        updatedAt: { lt: thirtyDaysAgo },
        ...progressWhere,
      },
    });
    const previousAvgCompletionRate =
      previousTotalProgresses > 0
        ? Math.round(
            (previousCompletedProgresses / previousTotalProgresses) * 100,
          )
        : 0;
    const completionRateTrend = CourseService.calculateTrend(
      avgCompletionRate,
      previousAvgCompletionRate,
    );

    // 4. Certificates Issued (real count from the Certificate table) with trend
    const certificatesIssued = await prisma.certificate.count({
      where: progressWhere,
    });
    const previousCertificatesIssued = await prisma.certificate.count({
      where: { ...progressWhere, createdAt: { lt: thirtyDaysAgo } },
    });
    const certificatesTrend = CourseService.calculateTrend(
      certificatesIssued,
      previousCertificatesIssued,
    );

    // 5. Top Performing Courses (by completion rate)
    const coursesWithMetrics = await prisma.course.findMany({
      include: {
        _count: {
          select: {
            progresses: { where: progressWhere },
          },
        },
        progresses: {
          where: progressWhere,
          select: {
            isCompleted: true,
          },
        },
      },
    });

    const certificateCountsByCourse = await prisma.certificate.groupBy({
      by: ["courseId"],
      where: progressWhere,
      _count: { id: true },
    });
    const certifiedCountMap = new Map(
      certificateCountsByCourse.map((c) => [c.courseId, c._count.id]),
    );

    const topPerformingCourses = coursesWithMetrics
      .map((course) => {
        const totalEnrolled = course._count.progresses;
        const completed = course.progresses.filter((p) => p.isCompleted).length;
        const inProgress = totalEnrolled - completed;
        const completionRate =
          totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0;

        return {
          id: course.id,
          name: course.title,
          completion: completionRate,
          students: totalEnrolled,
          enrolled: totalEnrolled,
          inProgress,
          completed,
          rate: completionRate,
          certified: certifiedCountMap.get(course.id) ?? 0,
        };
      })
      .filter((course) => course.enrolled > 0) // Only include courses with enrollments
      .sort((a, b) => b.completion - a.completion) // Sort by completion rate descending
      .slice(0, 10); // Top 10 courses

    // 6. Course Performance Metrics Table (all courses with detailed stats)
    const coursePerformanceMetrics = topPerformingCourses.slice(0, 20); // Limit to top 20 for table

    // 7. Enrollment trends data (last 6 months)
    const enrollmentTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const enrollments = await prisma.courseProgress.count({
        where: {
          createdAt: { gte: monthStart, lt: monthEnd },
          ...progressWhere,
        },
      });

      enrollmentTrends.push({
        month: monthStart.toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
        enrollments,
      });
    }

    return {
      message: "Course analytics fetched successfully",
      statusCode: 200,
      data: {
        // Main stats with trends
        totalCourses: { value: totalCourses, trend: coursesTrend },
        activeEnrollments: {
          value: activeEnrollments,
          trend: enrollmentsTrend,
        },
        avgCompletionRate: {
          value: avgCompletionRate,
          trend: completionRateTrend,
        },
        certificatesIssued: {
          value: certificatesIssued,
          trend: certificatesTrend,
        },

        // Charts data
        enrollmentTrends,
        topPerformingCourses: topPerformingCourses.slice(0, 5), // Top 5 for chart

        // Table data
        coursePerformanceMetrics,

        // Additional insights
        totalStudentsEnrolled: totalProgresses,
        averageStudentsPerCourse:
          totalCourses > 0 ? Math.round(totalProgresses / totalCourses) : 0,
        mostPopularCourse: topPerformingCourses[0] || null,
      },
    };
  }

  /**
   * Get comprehensive student analytics for the dashboard
   */
  public static async getStudentAnalytics(filters?: AnalyticsFilters) {
    const districtList = filters?.district
      ? [filters.district]
      : filters?.province
        ? (PROVINCE_DISTRICTS[filters.province] ?? [])
        : [];

    const userFilter: any = {};
    if (districtList.length > 0) userFilter.district = { in: districtList };
    if (filters?.gender) userFilter.gender = filters.gender;
    if (filters?.hospitalId) userFilter.hospitalId = filters.hospitalId;
    const hasUserFilter = Object.keys(userFilter).length > 0;

    const studentWhere: any = hasUserFilter ? { user: userFilter } : {};
    if (filters?.role) studentWhere.role = filters.role;

    const progressWhere: any = hasUserFilter
      ? { student: { user: userFilter } }
      : {};
    if (filters?.role) {
      progressWhere.student = {
        ...(progressWhere.student ?? {}),
        role: filters.role,
      };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 1. Total Students
    const totalStudents = await prisma.student.count({ where: studentWhere });
    const previousUserFilter: any = { createdAt: { lt: thirtyDaysAgo } };
    if (districtList.length > 0)
      previousUserFilter.district = { in: districtList };
    const previousStudentWhere: any = { user: previousUserFilter };
    if (filters?.role) previousStudentWhere.role = filters.role;
    const previousTotalStudents = await prisma.student.count({
      where: previousStudentWhere,
    });
    const studentsTrend = CourseService.calculateTrend(
      totalStudents,
      previousTotalStudents,
    );

    // 2. Active Students (students with recent activity)
    const activeStudents = await prisma.student.count({
      where: {
        ...studentWhere,
        OR: [
          { courseProgresses: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
          { slideProgress: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
          { attempts: { some: { updatedAt: { gte: thirtyDaysAgo } } } },
        ],
      },
    });
    const previousActiveStudents = await prisma.student.count({
      where: {
        ...studentWhere,
        OR: [
          {
            courseProgresses: {
              some: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            },
          },
          {
            slideProgress: {
              some: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            },
          },
          {
            attempts: {
              some: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
            },
          },
        ],
      },
    });
    const activeStudentsTrend = CourseService.calculateTrend(
      activeStudents,
      previousActiveStudents,
    );

    // 3. Average Study Time — computed per course (real session data where it
    // exists, an activity-count estimate elsewhere), then rolled up into the
    // aggregate so the top-line number and the per-course list can never
    // disagree with each other.
    const studentFilterForRelation: any = {};
    if (hasUserFilter) studentFilterForRelation.user = userFilter;
    if (filters?.role) studentFilterForRelation.role = filters.role;
    const hasStudentFilterForRelation =
      Object.keys(studentFilterForRelation).length > 0;

    // 3a. Active (studentId, courseId) pairs from CourseProgress (courseId is direct).
    const courseProgressRows = await prisma.courseProgress.findMany({
      where: { ...progressWhere, updatedAt: { gte: thirtyDaysAgo } },
      select: { studentId: true, courseId: true },
    });

    // 3b. Active (studentId, slideId) pairs from SlideProgress, resolved to
    // courseId via Slide -> Chapter -> Section (SlideProgress has no direct
    // courseId, and relationMode="prisma" means there's no FK to raw-SQL join on).
    const slideProgressRows = await prisma.slideProgress.findMany({
      where: {
        updatedAt: { gte: thirtyDaysAgo },
        ...(hasStudentFilterForRelation
          ? { student: studentFilterForRelation }
          : {}),
      },
      select: { studentId: true, slideId: true },
    });
    const slideIds = Array.from(
      new Set(slideProgressRows.map((r) => r.slideId)),
    );
    const slideCourseRows =
      slideIds.length > 0
        ? await prisma.slide.findMany({
            where: { id: { in: slideIds } },
            select: {
              id: true,
              chapter: { select: { section: { select: { courseId: true } } } },
            },
          })
        : [];
    const slideToCourse = new Map(
      slideCourseRows.map((s) => [s.id, s.chapter.section.courseId]),
    );

    const courseActiveStudents = new Map<string, Set<string>>();
    const courseProgressCounts = new Map<string, number>();
    const courseSlideCounts = new Map<string, number>();
    const addActiveStudent = (courseId: string, studentId: string) => {
      const set = courseActiveStudents.get(courseId) ?? new Set<string>();
      set.add(studentId);
      courseActiveStudents.set(courseId, set);
    };
    for (const r of courseProgressRows) {
      addActiveStudent(r.courseId, r.studentId);
      courseProgressCounts.set(
        r.courseId,
        (courseProgressCounts.get(r.courseId) ?? 0) + 1,
      );
    }
    for (const r of slideProgressRows) {
      const courseId = slideToCourse.get(r.slideId);
      if (!courseId) continue;
      addActiveStudent(courseId, r.studentId);
      courseSlideCounts.set(
        courseId,
        (courseSlideCounts.get(courseId) ?? 0) + 1,
      );
    }

    // 3c. Real session-duration data (UserSession heartbeats), grouped per course.
    const realSessions = await prisma.userSession.findMany({
      where: {
        startedAt: { gte: thirtyDaysAgo },
        ...(hasUserFilter ? { user: userFilter } : {}),
      },
      select: { startedAt: true, lastSeenAt: true, courseId: true },
    });
    const sessionsByCourse = new Map<string, number[]>();
    for (const s of realSessions) {
      if (!s.courseId) continue;
      const hours =
        (s.lastSeenAt.getTime() - s.startedAt.getTime()) / (1000 * 60 * 60);
      const arr = sessionsByCourse.get(s.courseId) ?? [];
      arr.push(hours);
      sessionsByCourse.set(s.courseId, arr);
    }

    // 3d. Build one entry per active course: real average where sessions
    // exist, otherwise the same 5min/slide + 30min/progress-update estimate
    // used historically, just scoped to that course instead of globally.
    const activeCourseIds = new Set<string>([
      ...courseActiveStudents.keys(),
      ...sessionsByCourse.keys(),
    ]);
    let avgStudyTimeByCourse: {
      courseId: string;
      courseTitle: string;
      avgHours: number;
      source: "live" | "estimated";
      activeStudents: number;
    }[] = [];
    if (activeCourseIds.size > 0) {
      const courseIds = Array.from(activeCourseIds);
      const coursesForNames = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true },
      });
      const titleMap = new Map(coursesForNames.map((c) => [c.id, c.title]));
      avgStudyTimeByCourse = courseIds.map((courseId) => {
        const activeStudentsInCourse =
          courseActiveStudents.get(courseId)?.size ?? 0;
        const realHoursArr = sessionsByCourse.get(courseId) ?? [];
        let avgHours: number;
        let source: "live" | "estimated";
        if (realHoursArr.length > 0) {
          avgHours =
            realHoursArr.reduce((s, v) => s + v, 0) / realHoursArr.length;
          source = "live";
        } else {
          const estimatedHours =
            (courseSlideCounts.get(courseId) ?? 0) * (5 / 60) +
            (courseProgressCounts.get(courseId) ?? 0) * (30 / 60);
          avgHours =
            activeStudentsInCourse > 0
              ? estimatedHours / activeStudentsInCourse
              : 0;
          source = "estimated";
        }
        return {
          courseId,
          courseTitle: titleMap.get(courseId) ?? "Unknown course",
          avgHours: Math.round(avgHours * 10) / 10,
          source,
          activeStudents: activeStudentsInCourse,
        };
      });
      avgStudyTimeByCourse.sort((a, b) => b.avgHours - a.avgHours);
    }

    // 3e. Aggregate = weighted average of the per-course numbers above, so
    // this can never contradict what the per-course list shows.
    const totalWeightedHours = avgStudyTimeByCourse.reduce(
      (sum, c) => sum + c.avgHours * c.activeStudents,
      0,
    );
    const totalWeight = avgStudyTimeByCourse.reduce(
      (sum, c) => sum + c.activeStudents,
      0,
    );
    const avgStudyTime = totalWeight > 0 ? totalWeightedHours / totalWeight : 0;
    const anyLiveCourse = avgStudyTimeByCourse.some((c) => c.source === "live");

    // Previous period calculation
    const previousStudyTimeData = await prisma.slideProgress.aggregate({
      where: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _count: { id: true },
    });
    const previousCourseProgressData = await prisma.courseProgress.aggregate({
      where: { updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _count: { id: true },
    });
    const previousEstimatedHours =
      (previousStudyTimeData._count.id * 5 +
        previousCourseProgressData._count.id * 30) /
      60;
    const previousAvgStudyTime =
      previousActiveStudents > 0
        ? previousEstimatedHours / previousActiveStudents
        : 0;
    const studyTimeTrend = CourseService.calculateTrend(
      avgStudyTime,
      previousAvgStudyTime,
    );

    // 4. Overall Completion Rate
    const totalCourseProgresses = await prisma.courseProgress.count({
      where: progressWhere,
    });
    const completedCourseProgresses = await prisma.courseProgress.count({
      where: { isCompleted: true, ...progressWhere },
    });
    const completionRate =
      totalCourseProgresses > 0
        ? (completedCourseProgresses / totalCourseProgresses) * 100
        : 0;

    // Previous completion rate
    const previousTotalProgresses = await prisma.courseProgress.count({
      where: { createdAt: { lt: thirtyDaysAgo }, ...progressWhere },
    });
    const previousCompletedProgresses = await prisma.courseProgress.count({
      where: {
        isCompleted: true,
        createdAt: { lt: thirtyDaysAgo },
        ...progressWhere,
      },
    });
    const previousCompletionRate =
      previousTotalProgresses > 0
        ? (previousCompletedProgresses / previousTotalProgresses) * 100
        : 0;
    const completionRateTrend = CourseService.calculateTrend(
      completionRate,
      previousCompletionRate,
    );

    // 5. On Leave Students (INACTIVE or SUSPENDED)
    const onLeaveStudents = await prisma.student.count({
      where: {
        ...studentWhere,
        status: { in: ["INACTIVE", "SUSPENDED"] },
      },
    });
    const prevOnLeaveUserFilter: any = { createdAt: { lt: thirtyDaysAgo } };
    if (districtList.length > 0)
      prevOnLeaveUserFilter.district = { in: districtList };
    const prevOnLeaveWhere: any = {
      status: { in: ["INACTIVE", "SUSPENDED"] },
      user: prevOnLeaveUserFilter,
    };
    if (filters?.role) prevOnLeaveWhere.role = filters.role;
    const previousOnLeaveStudents = await prisma.student.count({
      where: prevOnLeaveWhere,
    });
    const onLeaveTrend = CourseService.calculateTrend(
      onLeaveStudents,
      previousOnLeaveStudents,
    );

    // 6. Performance Distribution (based on average scores, respects all filters)
    const attemptRows = await prisma.attempTest.findMany({
      where: {
        marks: { gt: 0 },
        ...progressWhere,
      },
      select: { studentId: true, marks: true },
    });

    // Group by student, compute per-student average in memory
    const marksByStudent = new Map<string, number[]>();
    attemptRows.forEach(({ studentId, marks }) => {
      const existing = marksByStudent.get(studentId) ?? [];
      existing.push(marks);
      marksByStudent.set(studentId, existing);
    });

    const studentAvgScores = Array.from(marksByStudent.values()).map(
      (marks) => marks.reduce((s, m) => s + m, 0) / marks.length,
    );

    // Categorize performance
    const performanceDistribution = {
      excellent: 0, // 90-100%
      good: 0, // 80-89%
      average: 0, // 70-79%
      poor: 0, // 60-69%
      failing: 0, // Below 60%
    };

    studentAvgScores.forEach((avgScore) => {
      if (avgScore >= 90) performanceDistribution.excellent++;
      else if (avgScore >= 80) performanceDistribution.good++;
      else if (avgScore >= 70) performanceDistribution.average++;
      else if (avgScore >= 60) performanceDistribution.poor++;
      else performanceDistribution.failing++;
    });

    // 6. Top Performers
    const topPerformers = await prisma.student.findMany({
      where: studentWhere,
      include: {
        user: true,
        courseProgresses: {
          where: { isCompleted: true },
          include: { course: true },
        },
        attempts: {
          where: { isCompleted: true },
          orderBy: { marks: "desc" },
        },
      },
      take: 20,
    });

    const topPerformersData = topPerformers
      .map((student) => {
        const completedCourses = student.courseProgresses.length;
        const avgScore =
          student.attempts.length > 0
            ? student.attempts.reduce(
                (sum, attempt) => sum + attempt.marks,
                0,
              ) / student.attempts.length
            : 0;
        const certificates = completedCourses; // Assuming 1 certificate per completed course

        return {
          id: student.id,
          name: student.user.fullNames,
          photo: student.user.photo,
          completedCourses,
          avgScore: Math.round((avgScore || 0) * 10) / 10,
          certificates,
          district: student.user.district,
          sector: student.user.sector,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    // 7. Most Active Learners (based on recent activity)
    const mostActivelearners = await prisma.student.findMany({
      where: studentWhere,
      include: {
        user: true,
        slideProgress: {
          where: { updatedAt: { gte: thirtyDaysAgo } },
          orderBy: { updatedAt: "desc" },
        },
        courseProgresses: {
          where: { updatedAt: { gte: thirtyDaysAgo } },
        },
      },
      take: 20,
    });

    const mostActiveLearners = mostActivelearners
      .map((student) => {
        const recentSlideActivity = student.slideProgress.length;
        const recentCourseActivity = student.courseProgresses.length;
        const totalActivity = recentSlideActivity + recentCourseActivity;
        const estimatedHours =
          (recentSlideActivity * 5 + recentCourseActivity * 30) / 60;
        const lastActivity =
          student.slideProgress[0]?.updatedAt ||
          student.courseProgresses[0]?.updatedAt;

        return {
          id: student.id,
          name: student.user.fullNames,
          photo: student.user.photo,
          studyHours: Math.round(estimatedHours * 10) / 10,
          activeCourses: student.courseProgresses.filter(
            (cp) => !cp.isCompleted,
          ).length,
          lastActive: lastActivity,
          totalActivity,
          district: student.user.district,
          sector: student.user.sector,
        };
      })
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 5);

    // 8. Recent Student Activity
    const recentActivity = await prisma.courseProgress.findMany({
      where: {
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        ...progressWhere,
      }, // Last 24 hours
      include: {
        student: { include: { user: true } },
        course: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    const recentActivityData = recentActivity.map((progress) => ({
      id: progress.id,
      studentName: progress.student.user.fullNames,
      studentPhoto: progress.student.user.photo,
      courseName: progress.course.title,
      progress: Math.round(progress.progress),
      lastActivity: progress.updatedAt,
      status: progress.isCompleted ? "Completed" : "Active",
      district: progress.student.user.district,
      sector: progress.student.user.sector,
    }));

    // 9. Engagement Trends (last 7 days)
    const engagementTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dailyActivity = await prisma.slideProgress.count({
        where: {
          updatedAt: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      engagementTrends.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        activity: dailyActivity,
      });
    }

    return {
      message: "Student analytics fetched successfully",
      statusCode: 200,
      data: {
        // Main stats with trends
        totalStudents: { value: totalStudents, trend: studentsTrend },
        activeStudents: { value: activeStudents, trend: activeStudentsTrend },
        onLeaveStudents: { value: onLeaveStudents, trend: onLeaveTrend },
        avgStudyTime: {
          value: Math.round(avgStudyTime * 10) / 10,
          trend: studyTimeTrend,
          unit: "hours",
          isEstimate: !anyLiveCourse,
        },
        avgStudyTimeByCourse,
        completionRate: {
          value: Math.round(completionRate * 10) / 10,
          trend: completionRateTrend,
          unit: "percent",
        },

        // Performance distribution
        performanceDistribution: {
          excellent: {
            range: "90-100%",
            count: performanceDistribution.excellent,
            percentage:
              totalStudents > 0
                ? Math.round(
                    (performanceDistribution.excellent / totalStudents) * 100,
                  )
                : 0,
          },
          good: {
            range: "80-89%",
            count: performanceDistribution.good,
            percentage:
              totalStudents > 0
                ? Math.round(
                    (performanceDistribution.good / totalStudents) * 100,
                  )
                : 0,
          },
          average: {
            range: "70-79%",
            count: performanceDistribution.average,
            percentage:
              totalStudents > 0
                ? Math.round(
                    (performanceDistribution.average / totalStudents) * 100,
                  )
                : 0,
          },
          poor: {
            range: "60-69%",
            count: performanceDistribution.poor,
            percentage:
              totalStudents > 0
                ? Math.round(
                    (performanceDistribution.poor / totalStudents) * 100,
                  )
                : 0,
          },
          failing: {
            range: "Below 60%",
            count: performanceDistribution.failing,
            percentage:
              totalStudents > 0
                ? Math.round(
                    (performanceDistribution.failing / totalStudents) * 100,
                  )
                : 0,
          },
        },

        // Top performers and active learners
        topPerformers: topPerformersData,
        mostActiveLearners,

        // Recent activity
        recentActivity: recentActivityData,

        // Engagement trends
        engagementTrends,

        // Additional metrics
        activeStudentPercentage:
          totalStudents > 0
            ? Math.round((activeStudents / totalStudents) * 100)
            : 0,
        averageCoursesPerStudent:
          totalStudents > 0
            ? Math.round(totalCourseProgresses / totalStudents)
            : 0,
      },
    };
  }

  /**
   * Chunked section creation for handling large sections
   * Breaks sections into manageable chunks to prevent transaction timeout
   */
  public static async createSectionsInChunks(
    courseId: string,
    sections: SuperCourseSectionDto[],
  ) {
    if (!sections || sections.length === 0) {
      return { successful: 0, failed: 0, errors: [], createdSections: [] };
    }

    return await BatchOperationExecutor.executeInChunkedTransactions(
      sections,
      async (tx, sectionChunk) => {
        for (const sectionData of sectionChunk) {
          await CourseService.createSectionWithChapters(
            tx,
            courseId,
            sectionData,
          );
        }
      },
      prisma,
      {
        batchSize: CourseService.CHUNK_BATCH_SIZE,
        delayBetweenBatches: CourseService.BATCH_DELAY,
        transactionTimeout: CourseService.TRANSACTION_TIMEOUT,
      },
    );
  }

  /**
   * Helper to create a single section with all its chapters and slides
   */
  private static async createSectionWithChapters(
    tx: Prisma.TransactionClient,
    courseId: string,
    sectionData: SuperCourseSectionDto,
  ) {
    const section = await tx.section.create({
      data: {
        courseId,
        title: sectionData.title,
        description: sectionData.description ?? null,
        sectionNumber: sectionData.sectionNumber ?? 0,
      },
    });

    for (const chapterData of sectionData.chapters || []) {
      await CourseService.createChapterWithContent(tx, section.id, chapterData);
    }

    return section;
  }

  /**
   * Helper to create a single chapter with all its slides and tests
   */
  private static async createChapterWithContent(
    tx: Prisma.TransactionClient,
    sectionId: string,
    chapterData: any,
  ) {
    const chapter = await tx.chapter.create({
      data: {
        sectionId,
        title: chapterData.title,
        description: chapterData.description ?? null,
        chapterNumber: chapterData.chapterNumber ?? 1,
        activityAt: chapterData.activityAt ?? null,
        lessonDuration: chapterData.lessonDuration ?? 5,
        isPublished: chapterData.isPublished ?? true,
      },
    });

    // Create mid-test if provided
    if (chapterData.midTest) {
      const midTest = await tx.midTest.create({
        data: {
          chapterId: chapter.id,
          questionToBeAnswered: chapterData.midTest.questionToBeAnswered,
          marksToPass: chapterData.midTest.marksToPass,
          description: chapterData.midTest.description,
        },
      });

      // Batch create questionnaires with options and answers
      await Promise.all(
        (chapterData.midTest.questionnaires || []).map(async (q: any) => {
          const questionnaire = await tx.questionnaire.create({
            data: {
              question: q.question,
              questionImage: q.questionImage ?? null,
              feedbackStatement: q.feedbackStatement ?? null,
              allowMultiple: q.allowMultiple,
              midTestId: midTest.id,
            },
          });

          if (q.options && q.options.length > 0) {
            await Promise.all(
              q.options.map((optionData: any) =>
                tx.option.create({
                  data: {
                    label: optionData.label,
                    image: optionData.image ?? null,
                    questionnaireId: questionnaire.id,
                  },
                }),
              ),
            );
          }

          if (q.answers && q.answers.length > 0) {
            await Promise.all(
              q.answers.map((answerData: any) =>
                tx.answer.create({
                  data: {
                    label: answerData.label,
                    image: answerData.image ?? null,
                    questionnaireId: questionnaire.id,
                  },
                }),
              ),
            );
          }
        }),
      );
    }

    // Create slides
    for (const slideData of chapterData.slides || []) {
      await tx.slide.create({
        data: {
          chapterId: chapter.id,
          note: slideData.note ?? null,
          description: slideData.description ?? null,
          slideNumber: slideData.slideNumber,
          file: slideData.file ?? null,
          isPublished: slideData.isPublished ?? true,
        },
      });
    }

    return chapter;
  }

  /**
   * Partial course update for handling section updates
   * Useful when updating specific sections without affecting others
   */
  public static async updateSectionInCourse(
    courseId: string,
    sectionData: SuperCourseSectionDto,
  ) {
    const existingSection = await prisma.section.findFirst({
      where: {
        courseId,
        title: sectionData.title,
      },
      include: {
        chapters: {
          include: {
            slides: true,
            midTest: { include: { questionnaires: true } },
          },
        },
      },
    });

    if (!existingSection) {
      throw new AppError(
        `Section "${sectionData.title}" not found in course`,
        404,
      );
    }

    return await prisma.$transaction(
      async (tx) => {
        await CourseService.upsertSectionContent(
          tx,
          existingSection.id,
          sectionData,
        );
      },
      {
        timeout: CourseService.TRANSACTION_TIMEOUT,
        maxWait: CourseService.MAX_WAIT,
      },
    );
  }

  /**
   * Helper to upsert section content (chapters, slides, etc)
   */
  private static async upsertSectionContent(
    tx: Prisma.TransactionClient,
    sectionId: string,
    sectionData: SuperCourseSectionDto,
  ) {
    const existingChapters = await tx.chapter.findMany({
      where: { sectionId },
      include: {
        slides: true,
        midTest: { include: { questionnaires: true } },
      },
    });

    const chapterIdsToKeep: string[] = [];

    for (const chapterData of sectionData.chapters || []) {
      const chapter = existingChapters.find(
        (c) => c.title === chapterData.title,
      );

      if (chapter) {
        chapterIdsToKeep.push(chapter.id);
        // Update chapter metadata
        await tx.chapter.update({
          where: { id: chapter.id },
          data: {
            title: chapterData.title,
            description: chapterData.description ?? null,
            chapterNumber: chapterData.chapterNumber ?? 1,
            lessonDuration: chapterData.lessonDuration ?? 5,
            isPublished: chapterData.isPublished ?? true,
          },
        });
      } else {
        const newChapter = await tx.chapter.create({
          data: {
            sectionId,
            title: chapterData.title,
            description: chapterData.description ?? null,
            chapterNumber: chapterData.chapterNumber ?? 1,
            lessonDuration: chapterData.lessonDuration ?? 5,
            isPublished: chapterData.isPublished ?? true,
          },
        });
        chapterIdsToKeep.push(newChapter.id);
      }
    }

    // Delete chapters not in the update payload
    for (const chapter of existingChapters) {
      if (!chapterIdsToKeep.includes(chapter.id)) {
        await tx.chapter.delete({ where: { id: chapter.id } });
      }
    }
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATIONS - Separate lightweight endpoints for N+1 queries
  // ============================================================================

  /**
   * OPTIMIZED: Get course basic info only (no nested data)
   * Response time: ~50ms (vs 500ms for full getCourseById)
   * Use cases: List views, course cards, quick lookups
   */
  public static async getCourseBasic(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        coverIcon: true,
        rating: true,
        createdAt: true,
        isPublished: true,
        creatorId: true,
        staff: {
          select: {
            id: true,
            user: {
              select: { id: true, email: true, fullNames: true },
            },
          },
        },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    return {
      message: "Course fetched successfully",
      statusCode: 200,
      data: {
        ...course,
        rating: Math.round((course.rating || 0) * 10) / 10,
      },
    };
  }

  /**
   * OPTIMIZED: Get course with only sections and chapters (no slides/tests)
   * Response time: ~150ms
   * Use cases: Course outline view, section navigation
   */
  public static async getCourseSections(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        coverIcon: true,
        rating: true,
        isPublished: true,
        intro: {
          select: {
            id: true,
            title: true,
            summary: true,
            bannerImage: true,
            thumbnail: true,
          },
        },
        sections: {
          orderBy: { sectionNumber: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            chapters: {
              orderBy: { chapterNumber: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                chapterNumber: true,
                lessonDuration: true,
                isPublished: true,
                activityAt: true,
              },
            },
          },
        },
        staff: {
          select: {
            id: true,
            user: { select: { id: true, fullNames: true } },
          },
        },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    return {
      message: "Course sections fetched successfully",
      statusCode: 200,
      data: {
        ...course,
        rating: Math.round((course.rating || 0) * 10) / 10,
      },
    };
  }

  /**
   * OPTIMIZED: Get chapter with slides and midTest only
   * Response time: ~100ms
   * Use cases: Chapter detail view, slide navigation
   */
  public static async getChapterWithSlides(chapterId: string) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        section: {
          select: { id: true, title: true, courseId: true },
        },
        slides: {
          orderBy: { slideNumber: "asc" },
          select: {
            id: true,
            note: true,
            description: true,
            slideNumber: true,
            file: true,
            isPublished: true,
          },
        },
      },
    });
    if (!chapter) throw new AppError("Chapter not found", 404);

    return {
      message: "Chapter with slides fetched successfully",
      statusCode: 200,
      data: chapter,
    };
  }

  /**
   * OPTIMIZED: Get chapter midTest with questions
   * Response time: ~80ms
   * Use cases: Test detail view, taking tests
   */
  public static async getChapterMidTest(chapterId: string) {
    const midTest = await prisma.midTest.findFirst({
      where: { chapterId },
      select: {
        id: true,
        questionToBeAnswered: true,
        marksToPass: true,
        description: true,
        questionnaires: {
          select: {
            id: true,
            question: true,
            questionImage: true,
            feedbackStatement: true,
            allowMultiple: true,
            options: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    });
    if (!midTest) throw new AppError("MidTest not found", 404);

    return {
      message: "Chapter midTest fetched successfully",
      statusCode: 200,
      data: midTest,
    };
  }

  /**
   * OPTIMIZED: Get course tests (pre, final, exam) only
   * Response time: ~80ms
   * Use cases: Test listing, quick access to course assessments
   */
  public static async getCourseTests(courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        preTests: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            questionToBeAnswered: true,
            marksToPass: true,
            description: true,
            isPublished: true,
          },
        },
        finalTest: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            questionToBeAnswered: true,
            marksToPass: true,
            description: true,
            isPublished: true,
          },
        },
        finalExam: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            questionToBeAnswered: true,
            marksToPass: true,
            description: true,
            isPublished: true,
          },
        },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    return {
      message: "Course tests fetched successfully",
      statusCode: 200,
      data: {
        courseId: course.id,
        courseTitle: course.title,
        preTests: course.preTests,
        finalTest: course.finalTest,
        finalExam: course.finalExam,
      },
    };
  }

  /**
   * OPTIMIZED: Get course progress summary only
   * Response time: ~100ms
   * Use cases: Dashboard, progress tracking
   */
  public static async getCourseProgressSummary(courseId: string) {
    const progresses = await prisma.courseProgress.findMany({
      where: { courseId },
      select: {
        id: true,
        courseId: true,
        studentId: true,
        student: {
          select: { id: true, user: { select: { fullNames: true } } },
        },
        isCompleted: true,
        progress: true,
      },
    });

    // Calculate summary stats
    const total = progresses.length;
    const completed = progresses.filter((p) => p.isCompleted).length;
    const inProgress = total - completed;
    const avgProgress =
      total > 0
        ? progresses.reduce((sum, p) => sum + (p.progress || 0), 0) / total
        : 0;

    return {
      message: "Course progress summary fetched successfully",
      statusCode: 200,
      data: {
        courseId,
        totalEnrolled: total,
        completed,
        inProgress,
        averageProgress: Math.round(avgProgress * 100) / 100,
        enrollments: progresses,
      },
    };
  }

  /**
   * OPTIMIZED: Get all courses with basic info only (for list views)
   * Response time: ~200ms (vs 3000ms+ for full getAllCourses)
   * Use cases: Course catalog, course listings with pagination
   */
  public static async getAllCoursesBasic(
    searchq?: string,
    limit?: number,
    page?: number,
  ) {
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
    };
    if (searchq) {
      where.OR = [
        { title: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const take = limit ?? 15;
    const skip = page && page > 0 ? (page - 1) * take : 0;

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          coverIcon: true,
          rating: true,
          createdAt: true,
          staff: {
            select: {
              user: { select: { fullNames: true } },
            },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    const transformedCourses = courses.map((course) => ({
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
    }));

    return {
      message: "Courses fetched successfully",
      statusCode: 200,
      data: transformedCourses,
      pagination: {
        page: page ?? 1,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    };
  }

  /**
   * OPTIMIZED: Get my courses with basic info only
   * Response time: ~200ms (vs 3000ms+ for full getMyAllCourses)
   * Use cases: Student dashboard, my courses list
   */
  public static async getMyAllCoursesBasic(
    studentId: string,
    searchq?: string,
    limit?: number,
    page?: number,
  ) {
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
      progresses: {
        some: {
          studentId,
        },
      },
    };
    if (searchq) {
      where.OR = [
        { title: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const take = limit ?? 15;
    const skip = page && page > 0 ? (page - 1) * take : 0;

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          coverIcon: true,
          rating: true,
          createdAt: true,
          progresses: {
            where: { studentId },
            select: { progress: true, isCompleted: true },
          },
          staff: {
            select: {
              user: { select: { fullNames: true } },
            },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    const transformedCourses = courses.map((course) => ({
      ...course,
      rating: Math.round((course.rating || 0) * 10) / 10,
      studentProgress: course.progresses[0]?.progress ?? 0,
      isCompleted: !!course.progresses[0]?.isCompleted,
    }));

    return {
      message: "My courses fetched successfully",
      statusCode: 200,
      data: transformedCourses,
      pagination: {
        page: page ?? 1,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    };
  }

  public static async getTestScoreAnalytics(filters?: AnalyticsFilters) {
    const { studentWhere } = CourseService.buildAnalyticsStudentScope(filters);
    const attemptWhere =
      Object.keys(studentWhere).length > 0 ? { student: studentWhere } : {};

    // Get all courses that have at least one attempt
    const courses = await prisma.course.findMany({
      where: {
        OR: [{ preTests: { some: {} } }, { finalTest: { some: {} } }],
      },
      select: {
        id: true,
        title: true,
        preTests: {
          select: {
            id: true,
            attempts: {
              where: { isCompleted: true, marks: { gt: 0 }, ...attemptWhere },
              select: {
                marks: true,
                student: { select: { user: { select: { district: true } } } },
              },
            },
          },
        },
        finalTest: {
          select: {
            id: true,
            attempts: {
              where: { isCompleted: true, marks: { gt: 0 }, ...attemptWhere },
              select: {
                marks: true,
                student: { select: { user: { select: { district: true } } } },
              },
            },
          },
        },
      },
    });

    const courseScores = courses
      .map((course) => {
        // Aggregate all pre-test attempts across all preTests for this course
        const preAttempts = course.preTests.flatMap((pt) => pt.attempts);
        const finalAttempts = course.finalTest.flatMap((ft) => ft.attempts);

        const meanPreTest =
          preAttempts.length > 0
            ? Math.round(
                (preAttempts.reduce((sum, a) => sum + a.marks, 0) /
                  preAttempts.length) *
                  10,
              ) / 10
            : null;

        const meanFinalTest =
          finalAttempts.length > 0
            ? Math.round(
                (finalAttempts.reduce((sum, a) => sum + a.marks, 0) /
                  finalAttempts.length) *
                  10,
              ) / 10
            : null;

        const knowledgeGain =
          meanPreTest !== null && meanFinalTest !== null && meanPreTest > 0
            ? Math.round(
                ((meanFinalTest - meanPreTest) / meanPreTest) * 100 * 10,
              ) / 10
            : null;

        return {
          courseId: course.id,
          courseTitle: course.title,
          meanPreTest,
          meanFinalTest,
          knowledgeGain,
          preTestAttempts: preAttempts.length,
          finalTestAttempts: finalAttempts.length,
        };
      })
      .filter((c) => c.meanPreTest !== null || c.meanFinalTest !== null);

    // Platform-wide averages
    const coursesWithBoth = courseScores.filter(
      (c) => c.meanPreTest !== null && c.meanFinalTest !== null,
    );

    const overallMeanPreTest =
      coursesWithBoth.length > 0
        ? Math.round(
            (coursesWithBoth.reduce((sum, c) => sum + (c.meanPreTest ?? 0), 0) /
              coursesWithBoth.length) *
              10,
          ) / 10
        : 0;

    const overallMeanFinalTest =
      coursesWithBoth.length > 0
        ? Math.round(
            (coursesWithBoth.reduce(
              (sum, c) => sum + (c.meanFinalTest ?? 0),
              0,
            ) /
              coursesWithBoth.length) *
              10,
          ) / 10
        : 0;

    const overallKnowledgeGain =
      overallMeanPreTest > 0
        ? Math.round(
            ((overallMeanFinalTest - overallMeanPreTest) / overallMeanPreTest) *
              100 *
              10,
          ) / 10
        : 0;

    // --- Per-district breakdown ---
    const districtPre = new Map<string, number[]>();
    const districtFinal = new Map<string, number[]>();
    for (const course of courses) {
      for (const pt of course.preTests) {
        for (const a of pt.attempts) {
          const d = a.student.user.district ?? "Ntizwi";
          if (!districtPre.has(d)) districtPre.set(d, []);
          districtPre.get(d)!.push(a.marks);
        }
      }
      for (const ft of course.finalTest) {
        for (const a of ft.attempts) {
          const d = a.student.user.district ?? "Ntizwi";
          if (!districtFinal.has(d)) districtFinal.set(d, []);
          districtFinal.get(d)!.push(a.marks);
        }
      }
    }
    const allDistricts = new Set([
      ...districtPre.keys(),
      ...districtFinal.keys(),
    ]);
    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
        : null;
    const byDistrict = Array.from(allDistricts)
      .map((district) => {
        const preArr = districtPre.get(district) ?? [];
        const finalArr = districtFinal.get(district) ?? [];
        const meanPreTest = avg(preArr);
        const meanFinalTest = avg(finalArr);
        const knowledgeGain =
          meanPreTest !== null && meanFinalTest !== null && meanPreTest > 0
            ? Math.round(
                ((meanFinalTest - meanPreTest) / meanPreTest) * 100 * 10,
              ) / 10
            : null;
        return {
          district,
          meanPreTest,
          meanFinalTest,
          knowledgeGain,
          preTestAttempts: preArr.length,
          finalTestAttempts: finalArr.length,
        };
      })
      .sort(
        (a, b) =>
          b.preTestAttempts +
          b.finalTestAttempts -
          (a.preTestAttempts + a.finalTestAttempts),
      )
      .slice(0, 20);

    return {
      message: "Test score analytics fetched successfully",
      statusCode: 200,
      data: {
        overallMeanPreTest,
        overallMeanFinalTest,
        overallKnowledgeGain,
        byCourse: courseScores,
        byDistrict,
      },
    };
  }

  public static async getCommunicationsAnalytics(filters?: AnalyticsFilters) {
    const { userFilter, districtList } =
      CourseService.buildAnalyticsStudentScope(filters);
    const senderFilter: Record<string, unknown> = { ...userFilter };
    if (filters?.role) senderFilter.student = { role: filters.role };

    const dmWhere: any = { isDeleted: false };
    const gmWhere: any = { isDeleted: false };
    const cpWhere: any = { isDeleted: false };

    const hasSenderFilter = Object.keys(senderFilter).length > 0;
    if (hasSenderFilter) {
      dmWhere.sender = senderFilter;
      gmWhere.sender = senderFilter;
      cpWhere.author = senderFilter;
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Who counts as a "supervisor" for classifying CHW-to-supervisor vs peer-to-peer
    const supervisorRoles = await prisma.userRole.findMany({
      where: { name: { in: ["CHO", "TRAINER"] } },
      select: { userId: true },
    });
    const supervisorIds = new Set(supervisorRoles.map((r) => r.userId));

    // Pull direct + group messages once (with just enough to classify + timestamp),
    // then bucket by relationship role and by month in JS — avoids N extra queries.
    const [directMsgs, groupMsgs, communityCount, communityThisMonth] =
      await Promise.all([
        prisma.directMessage.findMany({
          where: dmWhere,
          select: {
            timestamp: true,
            chat: { select: { userId1: true, userId2: true } },
          },
        }),
        prisma.groupMessage.findMany({
          where: gmWhere,
          select: {
            timestamp: true,
            group: { select: { participants: { select: { userId: true } } } },
          },
        }),
        prisma.communityPost.count({ where: cpWhere }),
        prisma.communityPost.count({
          where: { ...cpWhere, timestamp: { gte: thirtyDaysAgo } },
        }),
      ]);

    const monthBucket = (d: Date) =>
      d.toLocaleString("default", { month: "short", year: "numeric" });

    let peerToPeerCount = 0;
    let peerToPeerThisMonth = 0;
    let chwToSupervisorCount = 0;
    let chwToSupervisorThisMonth = 0;
    const trendMap = new Map<
      string,
      { peerToPeer: number; chwToSupervisor: number; community: number }
    >();

    for (const m of directMsgs) {
      const involvesSupervisor =
        supervisorIds.has(m.chat.userId1) || supervisorIds.has(m.chat.userId2);
      const isThisMonth = m.timestamp >= thirtyDaysAgo;
      const bucket = trendMap.get(monthBucket(m.timestamp)) ?? {
        peerToPeer: 0,
        chwToSupervisor: 0,
        community: 0,
      };
      if (involvesSupervisor) {
        chwToSupervisorCount += 1;
        if (isThisMonth) chwToSupervisorThisMonth += 1;
        bucket.chwToSupervisor += 1;
      } else {
        peerToPeerCount += 1;
        if (isThisMonth) peerToPeerThisMonth += 1;
        bucket.peerToPeer += 1;
      }
      trendMap.set(monthBucket(m.timestamp), bucket);
    }

    for (const m of groupMsgs) {
      const involvesSupervisor = m.group.participants.some((p) =>
        supervisorIds.has(p.userId),
      );
      const isThisMonth = m.timestamp >= thirtyDaysAgo;
      const bucket = trendMap.get(monthBucket(m.timestamp)) ?? {
        peerToPeer: 0,
        chwToSupervisor: 0,
        community: 0,
      };
      if (involvesSupervisor) {
        chwToSupervisorCount += 1;
        if (isThisMonth) chwToSupervisorThisMonth += 1;
        bucket.chwToSupervisor += 1;
      } else {
        peerToPeerCount += 1;
        if (isThisMonth) peerToPeerThisMonth += 1;
        bucket.peerToPeer += 1;
      }
      trendMap.set(monthBucket(m.timestamp), bucket);
    }

    const totalCommunications =
      peerToPeerCount + chwToSupervisorCount + communityCount;
    const totalThisMonth =
      peerToPeerThisMonth + chwToSupervisorThisMonth + communityThisMonth;

    // Monthly trend for last 6 months (community counted per-month separately,
    // since it isn't reclassified — merged in below)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      const label = monthBucket(monthStart);

      const c = await prisma.communityPost.count({
        where: { ...cpWhere, timestamp: { gte: monthStart, lt: monthEnd } },
      });
      const bucket = trendMap.get(label) ?? {
        peerToPeer: 0,
        chwToSupervisor: 0,
        community: 0,
      };

      monthlyTrend.push({
        month: label,
        peerToPeer: bucket.peerToPeer,
        chwToSupervisor: bucket.chwToSupervisor,
        community: c,
        total: bucket.peerToPeer + bucket.chwToSupervisor + c,
      });
    }

    return {
      message: "Communications analytics fetched successfully",
      statusCode: 200,
      data: {
        total: totalCommunications,
        thisMonth: totalThisMonth,
        byType: [
          {
            type: "peerToPeer",
            label: "Peer-to-peer",
            count: peerToPeerCount,
            thisMonth: peerToPeerThisMonth,
          },
          {
            type: "chwToSupervisor",
            label: "CHW ↔ Supervisor",
            count: chwToSupervisorCount,
            thisMonth: chwToSupervisorThisMonth,
          },
          {
            type: "community",
            label: "Umuryango",
            count: communityCount,
            thisMonth: communityThisMonth,
          },
        ],
        monthlyTrend,
      },
    };
  }

  /**
   * Supervisor response rate — a PROXY metric estimated from direct-message
   * reply times between CHWs and supervisors (CHO/TRAINER), not a formal
   * "this needs a response" tracked construct (none exists in the schema).
   */
  public static async getSupervisorResponseRate(filters?: AnalyticsFilters) {
    const { studentWhere } = CourseService.buildAnalyticsStudentScope(filters);

    const supervisorRoles = await prisma.userRole.findMany({
      where: { name: { in: ["CHO", "TRAINER"] } },
      select: { userId: true },
    });
    const supervisorIds = new Set(supervisorRoles.map((r) => r.userId));

    const chwStudents = await prisma.student.findMany({
      where: studentWhere,
      select: { userId: true },
    });
    const chwIds = new Set(chwStudents.map((s) => s.userId));

    const emptyResult = {
      totalChwMessages: 0,
      respondedCount: 0,
      responseRate: 0,
      avgResponseHours: null as number | null,
      within24hRate: 0,
      note: "Estimated from message reply times between CHWs and supervisors (CHO/Trainer) in direct chats.",
    };

    if (chwIds.size === 0 || supervisorIds.size === 0) {
      return {
        message: "Supervisor response rate fetched successfully",
        statusCode: 200,
        data: emptyResult,
      };
    }

    const chats = await prisma.directChat.findMany({
      where: {
        OR: [
          {
            userId1: { in: Array.from(chwIds) },
            userId2: { in: Array.from(supervisorIds) },
          },
          {
            userId2: { in: Array.from(chwIds) },
            userId1: { in: Array.from(supervisorIds) },
          },
        ],
      },
      select: {
        messages: {
          where: { isDeleted: false },
          orderBy: { timestamp: "asc" },
          select: { senderId: true, timestamp: true },
        },
      },
    });

    let totalChwMessages = 0;
    let respondedCount = 0;
    let respondedWithin24h = 0;
    let totalResponseMs = 0;

    for (const chat of chats) {
      const msgs = chat.messages;
      for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        if (!chwIds.has(msg.senderId)) continue;
        totalChwMessages += 1;
        for (let j = i + 1; j < msgs.length; j++) {
          if (supervisorIds.has(msgs[j].senderId)) {
            const diffMs =
              msgs[j].timestamp.getTime() - msg.timestamp.getTime();
            totalResponseMs += diffMs;
            respondedCount += 1;
            if (diffMs <= 24 * 60 * 60 * 1000) respondedWithin24h += 1;
            break;
          }
        }
      }
    }

    const avgResponseHours =
      respondedCount > 0
        ? Math.round(
            (totalResponseMs / respondedCount / (1000 * 60 * 60)) * 10,
          ) / 10
        : null;
    const responseRate =
      totalChwMessages > 0
        ? Math.round((respondedCount / totalChwMessages) * 100)
        : 0;
    const within24hRate =
      totalChwMessages > 0
        ? Math.round((respondedWithin24h / totalChwMessages) * 100)
        : 0;

    return {
      message: "Supervisor response rate fetched successfully",
      statusCode: 200,
      data: {
        totalChwMessages,
        respondedCount,
        responseRate,
        avgResponseHours,
        within24hRate,
        note: emptyResult.note,
      },
    };
  }

  public static async getDemographicsAnalytics(filters?: AnalyticsFilters) {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { studentWhere } = CourseService.buildAnalyticsStudentScope(filters);

    // Get all students with user info and progress
    const students = await prisma.student.findMany({
      where: studentWhere,
      include: {
        user: {
          select: {
            district: true,
            sector: true,
            gender: true,
            birthdate: true,
          },
        },
        courseProgresses: {
          select: { isCompleted: true, progress: true },
        },
        certificates: {
          select: { id: true },
        },
      },
    });

    // Helper: derive age group from birthdate
    const getAgeGroup = (birthdate: Date | null): string => {
      if (!birthdate) return "Ntizwi";
      const age = Math.floor(
        (now.getTime() - new Date(birthdate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      );
      if (age < 30) return "<30";
      if (age < 50) return "30-49";
      if (age < 60) return "50-59";
      return "60+";
    };

    // Helper: check if student has completed at least one module
    const hasCompletedModule = (s: (typeof students)[0]) =>
      s.courseProgresses.some((cp) => cp.isCompleted);

    // --- By District ---
    const districtMap = new Map<
      string,
      { total: number; completedAtLeastOne: number; certified: number }
    >();
    for (const s of students) {
      const district = s.user.district ?? "Ntizwi";
      const existing = districtMap.get(district) ?? {
        total: 0,
        completedAtLeastOne: 0,
        certified: 0,
      };
      districtMap.set(district, {
        total: existing.total + 1,
        completedAtLeastOne:
          existing.completedAtLeastOne + (hasCompletedModule(s) ? 1 : 0),
        certified: existing.certified + (s.certificates.length > 0 ? 1 : 0),
      });
    }

    const byDistrict = Array.from(districtMap.entries())
      .map(([district, data]) => ({
        district,
        total: data.total,
        completedAtLeastOne: data.completedAtLeastOne,
        completionRate:
          data.total > 0
            ? Math.round((data.completedAtLeastOne / data.total) * 100)
            : 0,
        certificationRate:
          data.total > 0 ? Math.round((data.certified / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // Top 20 districts

    // --- By Gender ---
    const genderMap = new Map<
      string,
      { total: number; completedAtLeastOne: number; certified: number }
    >();
    for (const s of students) {
      const rawGender = s.user.gender;
      const gender = rawGender
        ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
        : "Ntizwi";
      const existing = genderMap.get(gender) ?? {
        total: 0,
        completedAtLeastOne: 0,
        certified: 0,
      };
      genderMap.set(gender, {
        total: existing.total + 1,
        completedAtLeastOne:
          existing.completedAtLeastOne + (hasCompletedModule(s) ? 1 : 0),
        certified: existing.certified + (s.certificates.length > 0 ? 1 : 0),
      });
    }

    const byGender = Array.from(genderMap.entries()).map(([gender, data]) => ({
      gender,
      total: data.total,
      completedAtLeastOne: data.completedAtLeastOne,
      completionRate:
        data.total > 0
          ? Math.round((data.completedAtLeastOne / data.total) * 100)
          : 0,
      certificationRate:
        data.total > 0 ? Math.round((data.certified / data.total) * 100) : 0,
    }));

    // --- By Age Group ---
    const ageMap = new Map<
      string,
      { total: number; completedAtLeastOne: number; certified: number }
    >();
    for (const s of students) {
      const ageGroup = getAgeGroup(s.user.birthdate);
      const existing = ageMap.get(ageGroup) ?? {
        total: 0,
        completedAtLeastOne: 0,
        certified: 0,
      };
      ageMap.set(ageGroup, {
        total: existing.total + 1,
        completedAtLeastOne:
          existing.completedAtLeastOne + (hasCompletedModule(s) ? 1 : 0),
        certified: existing.certified + (s.certificates.length > 0 ? 1 : 0),
      });
    }

    // Enforce order: <30, 30-49, 50-59, 60+, Ntizwi
    const ageOrder = ["<30", "30-49", "50-59", "60+", "Ntizwi"];
    const byAgeGroup = ageOrder
      .filter((ag) => ageMap.has(ag))
      .map((ageGroup) => {
        const data = ageMap.get(ageGroup)!;
        return {
          ageGroup,
          total: data.total,
          completedAtLeastOne: data.completedAtLeastOne,
          completionRate:
            data.total > 0
              ? Math.round((data.completedAtLeastOne / data.total) * 100)
              : 0,
          certificationRate:
            data.total > 0
              ? Math.round((data.certified / data.total) * 100)
              : 0,
        };
      });

    // --- Combined cross-tab: District × Gender × Age Group, with active-status breakdown ---
    const combinedMap = new Map<
      string,
      {
        district: string;
        gender: string;
        ageGroup: string;
        total: number;
        active: number;
        inactive: number;
        suspended: number;
        graduated: number;
      }
    >();
    for (const s of students) {
      const district = s.user.district ?? "Ntizwi";
      const rawGender = s.user.gender;
      const gender = rawGender
        ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
        : "Ntizwi";
      const ageGroup = getAgeGroup(s.user.birthdate);
      const key = `${district}||${gender}||${ageGroup}`;
      const existing = combinedMap.get(key) ?? {
        district,
        gender,
        ageGroup,
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        graduated: 0,
      };
      existing.total += 1;
      if (s.status === "ACTIVE") existing.active += 1;
      else if (s.status === "INACTIVE") existing.inactive += 1;
      else if (s.status === "SUSPENDED") existing.suspended += 1;
      else if (s.status === "GRADUATED") existing.graduated += 1;
      combinedMap.set(key, existing);
    }
    const combined = Array.from(combinedMap.values())
      .map((row) => ({
        ...row,
        activeRate:
          row.total > 0 ? Math.round((row.active / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 100); // cap payload size — sparse combinations beyond this are rarely useful

    return {
      message: "Demographics analytics fetched successfully",
      statusCode: 200,
      data: {
        totalStudents: students.length,
        byDistrict,
        byGender,
        byAgeGroup,
        combined,
      },
    };
  }

  /**
   * Certification rate — total, per course, per district, per health facility.
   * "Rate" always means % of students in scope with >=1 certificate for the
   * relevant grouping, matching the definition already used by
   * getDemographicsAnalytics's certificationRate — one consistent definition
   * across the app instead of the old completedProgresses-based proxy.
   */
  public static async getCertificationAnalytics(filters?: AnalyticsFilters) {
    const { studentWhere, progressWhere } =
      CourseService.buildAnalyticsStudentScope(filters);

    // --- Total ---
    const totalStudents = await prisma.student.count({ where: studentWhere });
    const certifiedStudents = await prisma.student.count({
      where: { ...studentWhere, certificates: { some: {} } },
    });
    const totalIssued = await prisma.certificate.count({
      where: progressWhere,
    });
    const totalRate =
      totalStudents > 0
        ? Math.round((certifiedStudents / totalStudents) * 100)
        : 0;

    // --- By course ---
    const courses = await prisma.course.findMany({
      select: {
        id: true,
        title: true,
        _count: { select: { progresses: { where: progressWhere } } },
      },
    });
    const certsByCourse = await prisma.certificate.groupBy({
      by: ["courseId"],
      where: progressWhere,
      _count: { id: true },
    });
    const certsByCourseMap = new Map(
      certsByCourse.map((c) => [c.courseId, c._count.id]),
    );
    const byCourse = courses
      .map((c) => {
        const eligible = c._count.progresses;
        const issued = certsByCourseMap.get(c.id) ?? 0;
        return {
          courseId: c.id,
          courseTitle: c.title,
          eligible,
          issued,
          rate: eligible > 0 ? Math.round((issued / eligible) * 100) : 0,
        };
      })
      .filter((c) => c.eligible > 0)
      .sort((a, b) => b.issued - a.issued);

    // --- By district ---
    const studentsForGrouping = await prisma.student.findMany({
      where: studentWhere,
      select: {
        user: {
          select: {
            district: true,
            hospitalId: true,
            hospital: { select: { name: true } },
          },
        },
        certificates: { select: { id: true } },
      },
    });

    const districtMap = new Map<string, { total: number; certified: number }>();
    for (const s of studentsForGrouping) {
      const district = s.user.district ?? "Ntizwi";
      const existing = districtMap.get(district) ?? { total: 0, certified: 0 };
      existing.total += 1;
      if (s.certificates.length > 0) existing.certified += 1;
      districtMap.set(district, existing);
    }
    const byDistrict = Array.from(districtMap.entries())
      .map(([district, d]) => ({
        district,
        eligible: d.total,
        issued: d.certified,
        rate: d.total > 0 ? Math.round((d.certified / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.issued - a.issued)
      .slice(0, 20);

    // --- By health facility (hospital) ---
    const facilityMap = new Map<
      string,
      { name: string; total: number; certified: number }
    >();
    for (const s of studentsForGrouping) {
      const hospitalId = s.user.hospitalId ?? "unknown";
      const hospitalName = s.user.hospital?.name ?? "Unknown facility";
      const existing = facilityMap.get(hospitalId) ?? {
        name: hospitalName,
        total: 0,
        certified: 0,
      };
      existing.total += 1;
      if (s.certificates.length > 0) existing.certified += 1;
      facilityMap.set(hospitalId, existing);
    }
    const byFacility = Array.from(facilityMap.entries())
      .map(([hospitalId, d]) => ({
        hospitalId,
        hospitalName: d.name,
        eligible: d.total,
        issued: d.certified,
        rate: d.total > 0 ? Math.round((d.certified / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.issued - a.issued)
      .slice(0, 20);

    return {
      message: "Certification analytics fetched successfully",
      statusCode: 200,
      data: {
        total: {
          eligible: totalStudents,
          issued: totalIssued,
          certifiedStudents,
          rate: totalRate,
        },
        byCourse,
        byDistrict,
        byFacility,
      },
    };
  }

  public static async getCHWDashboardStats(filters?: AnalyticsFilters) {
    const { studentWhere, progressWhere, userFilter } =
      CourseService.buildAnalyticsStudentScope(filters);
    const baseStudentWhere = studentWhere;
    const baseProgressWhere = progressWhere;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const chwStudentFilter: Record<string, unknown> = filters?.role
      ? { role: filters.role }
      : { isNot: null };

    const [
      // Card 1: CHW (student) counts by status
      totalCHWs,
      activeCHWs,
      inactiveCHWs,
      suspendedCHWs,
      graduatedCHWs,
      // Card 2: Completion rate data
      totalProgresses,
      completedProgresses,
      // Card 3: Test attempt counts by type
      preTestAttempts,
      midTestAttempts,
      finalTestAttempts,
      finalExamAttempts,
      // Card 4: Supervisors by gender
      totalSupervisors,
      maleSupervisors,
      femaleSupervisors,
      // Login/activation — CHWs
      chwActivated,
      chwActivatedPrevious,
      chwLoginEvents,
      // Login/activation — Supervisors (CHO)
      supervisorActivated,
      supervisorActivatedPrevious,
      supervisorLoginEvents,
      // Whether any LoginEvent history older than 30 days exists at all —
      // if not, "previous period" comparisons are meaningless (tracking
      // hasn't been running long enough yet), so the trend arrow is
      // suppressed rather than showing a misleading "+100%" cold-start spike.
      historicalLoginEventCount,
    ] = await Promise.all([
      // Card 1
      prisma.student.count({ where: baseStudentWhere }),
      prisma.student.count({
        where: { status: "ACTIVE", ...baseStudentWhere },
      }),
      prisma.student.count({
        where: { status: "INACTIVE", ...baseStudentWhere },
      }),
      prisma.student.count({
        where: { status: "SUSPENDED", ...baseStudentWhere },
      }),
      prisma.student.count({
        where: { status: "GRADUATED", ...baseStudentWhere },
      }),
      // Card 2
      prisma.courseProgress.count({ where: baseProgressWhere }),
      prisma.courseProgress.count({
        where: { isCompleted: true, ...baseProgressWhere },
      }),
      // Card 3 — count attempts where each test type is set
      prisma.attempTest.count({
        where: { preTestId: { not: null }, ...baseProgressWhere },
      }),
      prisma.attempTest.count({
        where: { midTestId: { not: null }, ...baseProgressWhere },
      }),
      prisma.attempTest.count({
        where: { finalTestId: { not: null }, ...baseProgressWhere },
      }),
      prisma.attempTest.count({
        where: { finalExamId: { not: null }, ...baseProgressWhere },
      }),
      // Card 4 — users with CHO role
      prisma.userRole.count({
        where: {
          name: "CHO",
          ...(Object.keys(userFilter).length > 0 ? { user: userFilter } : {}),
        },
      }),
      prisma.userRole.count({
        where: { name: "CHO", user: { ...userFilter, gender: "Male" } },
      }),
      prisma.userRole.count({
        where: { name: "CHO", user: { ...userFilter, gender: "Female" } },
      }),
      // Login/activation — CHWs
      prisma.student.count({
        where: {
          ...baseStudentWhere,
          user: { ...userFilter, lastLoginAt: { not: null } },
        },
      }),
      prisma.student.count({
        where: {
          ...baseStudentWhere,
          user: {
            ...userFilter,
            loginEvents: { some: { createdAt: { lt: thirtyDaysAgo } } },
          },
        },
      }),
      prisma.loginEvent.count({
        where: { user: { ...userFilter, student: chwStudentFilter } },
      }),
      // Login/activation — Supervisors (CHO)
      prisma.userRole.count({
        where: {
          name: "CHO",
          user: { ...userFilter, lastLoginAt: { not: null } },
        },
      }),
      prisma.userRole.count({
        where: {
          name: "CHO",
          user: {
            ...userFilter,
            loginEvents: { some: { createdAt: { lt: thirtyDaysAgo } } },
          },
        },
      }),
      prisma.loginEvent.count({
        where: {
          user: { ...userFilter, userRoles: { some: { name: "CHO" } } },
        },
      }),
      prisma.loginEvent.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
    ]);

    const hasTrendBaseline = historicalLoginEventCount > 0;

    const completionRate =
      totalProgresses > 0
        ? Math.round((completedProgresses / totalProgresses) * 100)
        : 0;

    const totalTestAttempts =
      preTestAttempts + midTestAttempts + finalTestAttempts + finalExamAttempts;

    return {
      message: "CHW dashboard stats fetched successfully",
      statusCode: 200,
      data: {
        chws: {
          total: totalCHWs,
          active: activeCHWs,
          inactive: inactiveCHWs,
          suspended: suspendedCHWs,
          graduated: graduatedCHWs,
          activationRate:
            totalCHWs > 0 ? Math.round((chwActivated / totalCHWs) * 100) : 0,
          activationTrend: hasTrendBaseline
            ? CourseService.calculateTrend(chwActivated, chwActivatedPrevious)
            : null,
          avgLogins:
            totalCHWs > 0
              ? Math.round((chwLoginEvents / totalCHWs) * 10) / 10
              : 0,
        },
        completion: {
          rate: completionRate,
          total: totalProgresses,
          completed: completedProgresses,
          inProgress: totalProgresses - completedProgresses,
        },
        tests: {
          total: totalTestAttempts,
          preTest: preTestAttempts,
          midTest: midTestAttempts,
          finalTest: finalTestAttempts,
          finalExam: finalExamAttempts,
        },
        supervisors: {
          total: totalSupervisors,
          male: maleSupervisors,
          female: femaleSupervisors,
          other: totalSupervisors - maleSupervisors - femaleSupervisors,
          activationRate:
            totalSupervisors > 0
              ? Math.round((supervisorActivated / totalSupervisors) * 100)
              : 0,
          activationTrend: hasTrendBaseline
            ? CourseService.calculateTrend(
                supervisorActivated,
                supervisorActivatedPrevious,
              )
            : null,
          avgLogins:
            totalSupervisors > 0
              ? Math.round((supervisorLoginEvents / totalSupervisors) * 10) / 10
              : 0,
        },
      },
    };
  }

  /**
   * Monthly trend of active CHWs (had course-progress activity that month),
   * scoped by the same district/gender/hospital/role filters as every other
   * analytics query in this file.
   */
  public static async getMonthlyActiveTrends(filters?: AnalyticsFilters) {
    const { studentWhere, userFilter } =
      CourseService.buildAnalyticsStudentScope(filters);
    const MONTHS = 6;

    const activeCHWTrend: { month: string; activeCHWs: number }[] = [];
    const activeUsersTrend: { month: string; activeUsers: number }[] = [];

    for (let i = MONTHS - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      const monthLabel = monthStart.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const activeCHWs = await prisma.student.count({
        where: {
          ...studentWhere,
          courseProgresses: {
            some: { updatedAt: { gte: monthStart, lt: monthEnd } },
          },
        },
      });
      activeCHWTrend.push({ month: monthLabel, activeCHWs });

      const studentActivityFilter: Record<string, unknown> = {
        courseProgresses: {
          some: { updatedAt: { gte: monthStart, lt: monthEnd } },
        },
      };
      if (filters?.role) studentActivityFilter.role = filters.role;

      const activeUsers = await prisma.user.count({
        where: {
          ...userFilter,
          OR: [
            { student: studentActivityFilter },
            {
              staff: {
                courses: {
                  some: { updatedAt: { gte: monthStart, lt: monthEnd } },
                },
              },
            },
          ],
        },
      });
      activeUsersTrend.push({ month: monthLabel, activeUsers });
    }

    return {
      message: "Monthly active trends fetched successfully",
      statusCode: 200,
      data: { activeCHWTrend, activeUsersTrend },
    };
  }

  public static async getCourseDurationStats(filters?: AnalyticsFilters) {
    void filters;
    const courses = await prisma.course.findMany({
      select: {
        id: true,
        title: true,
        sections: {
          select: {
            chapters: {
              select: {
                lessonDuration: true,
              },
            },
          },
        },
      },
    });

    const byCourse = courses.map((course) => {
      const chapters = course.sections.flatMap((s) => s.chapters);
      const totalDuration = chapters.reduce(
        (sum, ch) => sum + (ch.lessonDuration ?? 5),
        0,
      );
      const avgDuration =
        chapters.length > 0
          ? Math.round((totalDuration / chapters.length) * 10) / 10
          : 0;

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalDurationMinutes: totalDuration,
        avgDurationMinutes: avgDuration,
        chapterCount: chapters.length,
      };
    });

    return {
      message: "Course duration stats fetched successfully",
      statusCode: 200,
      data: {
        byCourse,
      },
    };
  }

  public static async getRecentActivityFeed(filters?: AnalyticsFilters) {
    const LIMIT = 10;

    const { studentWhere } = CourseService.buildAnalyticsStudentScope(filters);
    const combinedStudentWhere =
      Object.keys(studentWhere).length > 0 ? { student: studentWhere } : {};

    const yearMonthWhere = (() => {
      if (!filters?.year && !filters?.month) return {};
      const now = new Date();
      const year = filters.year ? parseInt(filters.year) : now.getFullYear();
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthIndex = filters.month ? monthNames.indexOf(filters.month) : -1;

      if (monthIndex >= 0) {
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
        return { gte: start, lte: end };
      }
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      return { gte: start, lte: end };
    })();

    // ── Enrollments: latest course progress records created ──────
    const enrollments = await prisma.courseProgress.findMany({
      where: {
        ...combinedStudentWhere,
        ...(Object.keys(yearMonthWhere).length
          ? { createdAt: yearMonthWhere }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: {
        student: { include: { user: true } },
        course: true,
      },
    });

    const enrollmentItems = enrollments.map((e) => ({
      id: `enrollment_${e.id}`,
      type: "enrollment" as const,
      actorName: e.student.user.fullNames,
      actorPhoto: e.student.user.photo ?? null,
      title: "Enrolled in",
      subject: e.course.title,
      subjectId: e.course.id,
      score: null,
      timestamp: e.createdAt.toISOString(),
    }));

    // ── Submissions: latest completed test attempts ───────────────
    const submissions = await prisma.attempTest.findMany({
      where: {
        isCompleted: true,
        ...combinedStudentWhere,
        ...(Object.keys(yearMonthWhere).length
          ? { updatedAt: yearMonthWhere }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      include: {
        student: { include: { user: true } },
        preTest: { include: { course: true } },
        midTest: {
          include: {
            chapter: { include: { section: { include: { course: true } } } },
          },
        },
        finalTest: { include: { course: true } },
        finalExam: { include: { course: true } },
      },
    });

    const submissionItems = submissions.map((s) => {
      const course =
        s.preTest?.course ??
        s.finalTest?.course ??
        s.finalExam?.course ??
        s.midTest?.chapter?.section?.course ??
        null;

      const testType = s.preTestId
        ? "Pre-Test"
        : s.midTestId
          ? "Mid-Test"
          : s.finalTestId
            ? "Final Test"
            : "Final Exam";

      return {
        id: `submission_${s.id}`,
        type: "submission" as const,
        actorName: s.student.user.fullNames,
        actorPhoto: s.student.user.photo ?? null,
        title: `Submitted ${testType}`,
        subject: course?.title ?? "Unknown Course",
        subjectId: course?.id ?? null,
        score: Math.round(s.marks),
        timestamp: s.updatedAt.toISOString(),
      };
    });

    // ── Course Updates: latest courses created or updated ─────────
    const courseWhere: Record<string, unknown> = {};
    if (Object.keys(studentWhere).length > 0) {
      courseWhere.progresses = { some: { student: studentWhere } };
    }
    if (Object.keys(yearMonthWhere).length > 0) {
      courseWhere.updatedAt = yearMonthWhere;
    }

    const courses = await prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      include: {
        staff: { include: { user: true } },
      },
    });

    const courseUpdateItems = courses.map((c) => ({
      id: `course_${c.id}`,
      type: "courseUpdate" as const,
      actorName: c.staff.user.fullNames,
      actorPhoto: c.staff.user.photo ?? null,
      title: "Updated Course",
      subject: c.title,
      subjectId: c.id,
      score: null,
      timestamp: c.updatedAt.toISOString(),
    }));

    // ── All: merge and sort by timestamp desc, take top 10 ────────
    const all = [...enrollmentItems, ...submissionItems, ...courseUpdateItems]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, LIMIT);

    return {
      message: "Recent activity feed fetched successfully",
      statusCode: 200,
      data: {
        all,
        enrollments: enrollmentItems,
        submissions: submissionItems,
        courseUpdates: courseUpdateItems,
      },
    };
  }
}
