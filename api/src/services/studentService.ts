/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../utils/client";
import AppError from "../utils/error";
import {
  IStudent,
  RoleTypeEnum,
  CreateUserDto,
} from "../utils/interfaces/common";
import { Prisma, StudentStatus } from "@prisma/client";
import { UserService } from "./userService";
import { roles } from "../utils/roles";

export class StudentService {
  /**
   * Helper method to cap progress at 100% and round to 1 decimal
   */
  private static capAndRoundProgress(progress: number): number {
    return Math.min(Math.max(progress || 0, 0), 100);
  }

  /**
   * Helper method to validate and convert status string to StudentStatus enum
   */
  private static validateAndConvertStatus(status: string): StudentStatus {
    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"];
    const upperStatus = status.toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      throw new AppError(
        "Invalid status. Valid statuses are: ACTIVE, INACTIVE, SUSPENDED, GRADUATED",
        400,
      );
    }
    return upperStatus as StudentStatus;
  }

  /**
   * Get all students with their course enrollment and progress statistics
   */
  public static async getStudentsWithProgress(
    searchq?: string,
    limit?: number,
    currentPage?: number,
    status?: string,
    sortBy?: string,
    order?: "asc" | "desc",
    gender?: string,
    courseId?: string,
    role?: string,
    noGroup?: boolean,
  ) {
    const where: Prisma.StudentWhereInput = {};

    // Filter by student role (TRAINEE vs TESTER)
    if (role) {
      where.role = role as RoleTypeEnum;
    }

    if (noGroup) {
      const [members, groups] = await Promise.all([
        prisma.cHOGroupMember.findMany({ select: { studentId: true } }),
        prisma.cHOGroup.findMany({ select: { choId: true } }),
      ]);
      const groupedIds = [
        ...members.map((m) => m.studentId),
        ...groups.map((g) => g.choId),
      ];
      where.id = { notIn: [...new Set(groupedIds)] };
    }

    // Filter by status if provided
    if (status && status !== "all") {
      where.status = this.validateAndConvertStatus(status);
    }

    if (gender && gender !== "all") {
      where.user = {
        ...((where.user as any) || {}),
        gender: { equals: gender, mode: "insensitive" },
      };
    }

    if (courseId && courseId !== "all") {
      where.courseProgresses = {
        some: { courseId },
      };
    }

    if (searchq) {
      where.OR = [
        {
          user: {
            fullNames: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            phoneNumber: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            district: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            sector: { contains: searchq, mode: "insensitive" },
          },
        },
      ];
    }

    const take = limit ?? 15;
    const skip = currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

    // Define the orderBy array
    let prismaOrderBy: any = { user: { createdAt: "desc" } };

    // Process backend-native sorting
    if (sortBy && order) {
      if (sortBy === "fullName") prismaOrderBy = { user: { fullNames: order } };
      else if (sortBy === "phoneNumber")
        prismaOrderBy = { user: { phoneNumber: order } };
      else if (sortBy === "location")
        prismaOrderBy = { user: { district: order } };
      else if (sortBy === "createdAt")
        prismaOrderBy = { user: { createdAt: order } };
      else if (sortBy === "status") prismaOrderBy = { status: order };
    }

    const students = await prisma.student.findMany({
      where,
      take,
      skip,
      orderBy: prismaOrderBy,
      include: {
        user: {
          select: {
            id: true,
            fullNames: true,
            phoneNumber: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        courseProgresses: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const totalItems = await prisma.student.count({ where });

    // Transform the data to match IStudent interface
    const transformedStudents: IStudent[] = students.map((student) => {
      const enrolledCourses = student.courseProgresses;
      const totalCourses = enrolledCourses.length;

      // Calculate overall progress: sum of all course progress / total courses
      let totalProgress = 0;
      if (totalCourses > 0) {
        const progressSum = enrolledCourses.reduce((sum, courseProgress) => {
          return sum + courseProgress.progress;
        }, 0);
        totalProgress = progressSum / totalCourses;
      }

      // Format progress as percentage with proper capping and rounding
      const cappedProgress = this.capAndRoundProgress(totalProgress);
      const progressPercentage = `${Math.round(cappedProgress)}%`;

      // Get course titles
      const courseNames = enrolledCourses.map((cp) => cp.course.title);

      return {
        id: student.id,
        userId: student.user.id,
        fullName: student.user.fullNames,
        phoneNumber: student.user.phoneNumber,
        district: student.user.district,
        sector: student.user.sector,
        cell: student.user.cell,
        village: student.user.village,
        courses: courseNames,
        progress: progressPercentage,
        rawProgress: cappedProgress, // for sorting
        createdAt: student.user.createdAt.toISOString(),
        updatedAt: student.user.updatedAt.toISOString(),
      };
    });

    // Handle in-memory sorting for derived fields (progress, courses)
    if (sortBy && order) {
      if (sortBy === "progress") {
        transformedStudents.sort((a: any, b: any) => {
          const valA = a.rawProgress || 0;
          const valB = b.rawProgress || 0;
          return order === "asc" ? valA - valB : valB - valA;
        });
      } else if (sortBy === "courses") {
        transformedStudents.sort((a, b) => {
          const valA = a.courses.length || 0;
          const valB = b.courses.length || 0;
          return order === "asc" ? valA - valB : valB - valA;
        });
      }
    }

    // Clean up internal fields
    const finalData = transformedStudents.map((s: any) => {
      delete s.rawProgress;
      return s;
    });

    return {
      message: "Students with progress fetched successfully",
      statusCode: 200,
      data: finalData,
      totalItems,
      currentPage: currentPage || 1,
      itemsPerPage: take,
    };
  }

  /**
   * Get all students with their course enrollment and progress statistics (no pagination)
   */
  public static async getAllStudentsWithProgress(
    searchq?: string,
    status?: string,
    role?: string,
    limit?: number,
    noGroup?: boolean,
  ) {
    const where: Prisma.StudentWhereInput = {};

    // Filter by status if provided
    if (status) {
      where.status = this.validateAndConvertStatus(status);
    }

    if (role) {
      where.role = role as RoleTypeEnum;
    }

    if (noGroup) {
      const [members, groups] = await Promise.all([
        prisma.cHOGroupMember.findMany({ select: { studentId: true } }),
        prisma.cHOGroup.findMany({ select: { choId: true } }),
      ]);
      const groupedIds = [
        ...members.map((m) => m.studentId),
        ...groups.map((g) => g.choId),
      ];
      where.id = { notIn: [...new Set(groupedIds)] };
    }

    if (searchq) {
      where.OR = [
        {
          user: {
            fullNames: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            phoneNumber: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            district: { contains: searchq, mode: "insensitive" },
          },
        },
        {
          user: {
            sector: { contains: searchq, mode: "insensitive" },
          },
        },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      take: limit ?? undefined,
      orderBy: { user: { createdAt: "desc" } },
      include: {
        user: {
          select: {
            id: true,
            fullNames: true,
            phoneNumber: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        courseProgresses: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    // Transform the data to match IStudent interface
    const transformedStudents: IStudent[] = students.map((student) => {
      const enrolledCourses = student.courseProgresses;
      const totalCourses = enrolledCourses.length;

      // Calculate overall progress: sum of all course progress / total courses
      let totalProgress = 0;
      if (totalCourses > 0) {
        const progressSum = enrolledCourses.reduce((sum, courseProgress) => {
          return sum + courseProgress.progress;
        }, 0);
        totalProgress = progressSum / totalCourses;
      }

      // Format progress as percentage with proper capping and rounding
      const cappedProgress = this.capAndRoundProgress(totalProgress);
      const progressPercentage = `${Math.round(cappedProgress)}%`;

      // Get course titles
      const courseNames = enrolledCourses.map((cp) => cp.course.title);

      return {
        id: student.id,
        userId: student.user.id,
        fullName: student.user.fullNames,
        phoneNumber: student.user.phoneNumber,
        district: student.user.district,
        sector: student.user.sector,
        cell: student.user.cell,
        village: student.user.village,
        courses: courseNames,
        progress: progressPercentage,
        createdAt: student.user.createdAt.toISOString(),
        updatedAt: student.user.updatedAt.toISOString(),
      };
    });

    return {
      message: "All students with progress fetched successfully",
      statusCode: 200,
      data: transformedStudents,
    };
  }

  /**
   * Get comprehensive student information including all attempts, questions, answers, and progress
   */
  public static async getStudentWithProgressById(studentId: string) {
    const student: any = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          include: {
            feedbacks: {
              include: {
                slide: {
                  select: {
                    id: true,
                    note: true,
                    slideNumber: true,
                    chapter: {
                      select: {
                        id: true,
                        title: true,
                        chapterNumber: true,
                        section: {
                          select: {
                            id: true,
                            title: true,
                            course: {
                              select: {
                                id: true,
                                title: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
            systemReview: {
              include: {
                categoryRatings: {
                  orderBy: { createdAt: "desc" },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        courseProgresses: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                coverIcon: true,
                rating: true,
                isPublished: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        attempts: {
          include: {
            preTest: {
              select: {
                id: true,
                description: true,
                questionToBeAnswered: true,
                marksToPass: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            midTest: {
              select: {
                id: true,
                description: true,
                questionToBeAnswered: true,
                marksToPass: true,
                chapter: {
                  select: {
                    id: true,
                    title: true,
                    section: {
                      select: {
                        id: true,
                        title: true,
                        course: {
                          select: {
                            id: true,
                            title: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            finalTest: {
              select: {
                id: true,
                description: true,
                questionToBeAnswered: true,
                marksToPass: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            finalExam: {
              select: {
                id: true,
                description: true,
                questionToBeAnswered: true,
                marksToPass: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            attemptAnswers: {
              include: {
                questionnaire: {
                  include: {
                    options: true,
                    answers: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                    midTest: {
                      select: {
                        id: true,
                        chapter: {
                          select: {
                            id: true,
                            title: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        courseReview: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
              },
            },
            categoryRatings: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        sectionReview: {
          include: {
            section: {
              select: {
                id: true,
                title: true,
                description: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
            categoryRatings: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        chapterReview: {
          include: {
            chapter: {
              select: {
                id: true,
                title: true,
                description: true,
                chapterNumber: true,
                section: {
                  select: {
                    id: true,
                    title: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
            categoryRatings: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // Calculate course progress statistics
    const enrolledCourses = student.courseProgresses;
    const totalCourses = enrolledCourses.length;
    let totalProgress = 0;

    if (totalCourses > 0) {
      const progressSum = enrolledCourses.reduce(
        (sum: number, courseProgress: any) => {
          return sum + courseProgress.progress;
        },
        0,
      );
      totalProgress = progressSum / totalCourses;
    }

    const cappedProgress = this.capAndRoundProgress(totalProgress);

    // Process attempts with detailed information
    const processedAttempts = (student.attempts || []).map((attempt: any) => {
      const testType = attempt.preTestId
        ? "Pre-Test"
        : attempt.midTestId
          ? "Mid-Test"
          : attempt.finalTestId
            ? "Final Test"
            : attempt.finalExamId
              ? "Final Exam"
              : "Unknown";

      const testInfo =
        attempt.preTest ||
        attempt.midTest ||
        attempt.finalTest ||
        attempt.finalExam;

      const questionsWithAnswers = (attempt.attemptAnswers || []).map(
        (attemptAnswer: any) => {
          // Get unique correct answer labels (remove duplicates)
          const correctAnswerLabels = (
            attemptAnswer.questionnaire.answers || []
          )
            .map((answer: any) => answer.label)
            .filter(
              (label: string, index: number, array: string[]) =>
                label && label.trim() !== "" && array.indexOf(label) === index,
            );

          // Convert selected answer IDs to labels
          const selectedAnswerLabels = (attemptAnswer.selectedAnswerIds || [])
            .map((selectedId: string) => {
              const option = (attemptAnswer.questionnaire.options || []).find(
                (opt: any) => opt.id === selectedId,
              );
              return option ? option.label : null;
            })
            .filter((label: string) => label && label.trim() !== "");

          return {
            questionId: attemptAnswer.questionnaire.id,
            question: attemptAnswer.questionnaire.question,
            questionImage: attemptAnswer.questionnaire.questionImage || "",
            feedbackStatement:
              attemptAnswer.questionnaire.feedbackStatement || "",
            allowMultiple: attemptAnswer.questionnaire.allowMultiple,
            availableOptions: (attemptAnswer.questionnaire.options || []).map(
              (option: any) => ({
                id: option.id,
                label: option.label,
                image: option.image || "",
              }),
            ),
            correctAnswers: correctAnswerLabels.map((label: string) => ({
              label: label,
              image: "",
            })),
            studentSelectedAnswers: selectedAnswerLabels,
            isCorrect: attemptAnswer.isCorrect,
            marksAwarded: attemptAnswer.marks,
            answeredAt: attemptAnswer.createdAt.toISOString(),
          };
        },
      );

      return {
        attemptId: attempt.id,
        testType,
        testInfo: testInfo
          ? {
              id: testInfo.id,
              description: testInfo.description,
              questionToBeAnswered: testInfo.questionToBeAnswered,
              marksToPass: testInfo.marksToPass,
              course:
                testInfo.course?.title ||
                (testInfo as any).chapter?.section?.course?.title,
              chapter: (testInfo as any).chapter?.title,
            }
          : null,
        tryCount: attempt.tryCount,
        totalMarks: attempt.marks,
        isCompleted: attempt.isCompleted,
        isPassed: testInfo ? attempt.marks >= testInfo.marksToPass : false,
        questionsAnswered: questionsWithAnswers.length,
        correctAnswers: questionsWithAnswers.filter((q: any) => q.isCorrect)
          .length,
        accuracyPercentage:
          questionsWithAnswers.length > 0
            ? Math.round(
                (questionsWithAnswers.filter((q: any) => q.isCorrect).length /
                  questionsWithAnswers.length) *
                  100,
              )
            : 0,
        questionsWithAnswers,
        attemptDate: attempt.createdAt.toISOString(),
        lastUpdated: attempt.updatedAt.toISOString(),
      };
    });

    // Calculate comprehensive statistics
    const totalAttempts = processedAttempts.length;
    const completedAttempts = processedAttempts.filter(
      (a: any) => a.isCompleted,
    ).length;
    const passedAttempts = processedAttempts.filter(
      (a: any) => a.isPassed,
    ).length;
    const averageScore =
      totalAttempts > 0
        ? processedAttempts.reduce(
            (sum: number, attempt: any) => sum + attempt.totalMarks,
            0,
          ) / totalAttempts
        : 0;

    const comprehensiveStudentData = {
      // Basic student information
      studentInfo: {
        id: student.id,
        userId: student.user.id,
        fullName: student.user.fullNames,
        phoneNumber: student.user.phoneNumber,
        district: student.user.district,
        sector: student.user.sector,
        cell: student.user.cell,
        village: student.user.village,
        NID: student.user.NID,
        gender: student.user.gender,
        birthdate: student.user.birthdate?.toISOString(),
        photo: student.user.photo,
        video: student.user.video,
        audio: student.user.audio,
        bio: student.user.bio,
        hospitalId: student.user.hospitalId,
        industry: student.user.industry,
        status: student.status,
        role: student.role,
        createdAt: student.user.createdAt.toISOString(),
        updatedAt: student.user.updatedAt.toISOString(),
      },

      // Course enrollment and progress
      courseProgress: {
        totalCoursesEnrolled: totalCourses,
        overallProgress: `${Math.round(cappedProgress)}%`,
        enrolledCourses: enrolledCourses.map((cp: any) => ({
          courseId: cp.course.id,
          courseTitle: cp.course.title,
          courseDescription: cp.course.description,
          courseCoverIcon: cp.course.coverIcon,
          courseRating: cp.course.rating,
          isPublished: cp.course.isPublished,
          progress: `${Math.round(this.capAndRoundProgress(cp.progress))}%`,
          isCompleted: cp.isCompleted,
          enrollmentDate: cp.createdAt.toISOString(),
          lastUpdated: cp.updatedAt.toISOString(),
        })),
      },

      // Comprehensive test attempts and performance
      testAttempts: {
        totalAttempts,
        completedAttempts,
        passedAttempts,
        failedAttempts: completedAttempts - passedAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        successRate:
          completedAttempts > 0
            ? Math.round((passedAttempts / completedAttempts) * 100)
            : 0,
        attemptsByType: {
          preTests: processedAttempts.filter(
            (a: any) => a.testType === "Pre-Test",
          ).length,
          finalTests: processedAttempts.filter(
            (a: any) => a.testType === "Final Test",
          ).length,
          finalExams: processedAttempts.filter(
            (a: any) => a.testType === "Final Exam",
          ).length,
        },
        detailedAttempts: processedAttempts,
      },

      // Performance analytics
      analytics: {
        studyTimeEstimate: (student.chapterProgresses || []).reduce(
          (total: number, chp: any) => total + chp.chapter.lessonDuration,
          0,
        ),
        learningPath: enrolledCourses
          .map((cp: any) => cp.course.title)
          .join(" → "),
        strongAreas: processedAttempts
          .filter((a: any) => a.accuracyPercentage >= 80)
          .map((a: any) => a.testInfo?.course || "Unknown")
          .filter(
            (value: any, index: number, self: any[]) =>
              self.indexOf(value) === index,
          ),
        improvementAreas: processedAttempts
          .filter((a: any) => a.accuracyPercentage < 60)
          .map((a: any) => a.testInfo?.course || "Unknown")
          .filter(
            (value: any, index: number, self: any[]) =>
              self.indexOf(value) === index,
          ),
      },

      // Student Feedbacks and Reviews
      feedbacksAndReviews: {
        // Slide Feedbacks
        slideFeedbacks: {
          totalFeedbacks: student.user.feedbacks?.length || 0,
          feedbackDetails: (student.user.feedbacks || []).map(
            (feedback: any) => ({
              feedbackId: feedback.id,
              message: feedback.message,
              isPublished: feedback.isPublished,
              slideInfo: {
                slideId: feedback.slide.id,
                slideNote: feedback.slide.note,
                slideNumber: feedback.slide.slideNumber,
                chapterTitle: feedback.slide.chapter.title,
                chapterNumber: feedback.slide.chapter.chapterNumber,
                sectionTitle: feedback.slide.chapter.section.title,
                courseTitle: feedback.slide.chapter.section.course.title,
              },
              feedbackDate: feedback.createdAt.toISOString(),
              lastUpdated: feedback.updatedAt.toISOString(),
            }),
          ),
        },

        // Course Reviews
        courseReviews: {
          totalReviews: student.courseReview?.length || 0,
          reviewDetails: (student.courseReview || []).map((review: any) => ({
            reviewId: review.id,
            rating: review.rating,
            comment: review.comment,
            courseInfo: {
              courseId: review.course.id,
              courseTitle: review.course.title,
              courseDescription: review.course.description,
            },
            categoryRatings: (review.categoryRatings || []).map(
              (rating: any) => ({
                ratingId: rating.id,
                category: rating.category,
                rating: rating.rating,
                ratedAt: rating.createdAt.toISOString(),
              }),
            ),
            reviewDate: review.createdAt.toISOString(),
            lastUpdated: review.updatedAt.toISOString(),
          })),
        },

        // Section Reviews
        sectionReviews: {
          totalReviews: student.sectionReview?.length || 0,
          reviewDetails: (student.sectionReview || []).map((review: any) => ({
            reviewId: review.id,
            rating: review.rating,
            comment: review.comment,
            sectionInfo: {
              sectionId: review.section.id,
              sectionTitle: review.section.title,
              sectionDescription: review.section.description,
              courseTitle: review.section.course.title,
            },
            categoryRatings: (review.categoryRatings || []).map(
              (rating: any) => ({
                ratingId: rating.id,
                category: rating.category,
                rating: rating.rating,
                ratedAt: rating.createdAt.toISOString(),
              }),
            ),
            reviewDate: review.createdAt.toISOString(),
            lastUpdated: review.updatedAt.toISOString(),
          })),
        },

        // Chapter Reviews
        chapterReviews: {
          totalReviews: student.chapterReview?.length || 0,
          reviewDetails: (student.chapterReview || []).map((review: any) => ({
            reviewId: review.id,
            rating: review.rating,
            comment: review.comment,
            chapterInfo: {
              chapterId: review.chapter.id,
              chapterTitle: review.chapter.title,
              chapterDescription: review.chapter.description,
              chapterNumber: review.chapter.chapterNumber,
              sectionTitle: review.chapter.section.title,
              courseTitle: review.chapter.section.course.title,
            },
            categoryRatings: (review.categoryRatings || []).map(
              (rating: any) => ({
                ratingId: rating.id,
                category: rating.category,
                rating: rating.rating,
                ratedAt: rating.createdAt.toISOString(),
              }),
            ),
            reviewDate: review.createdAt.toISOString(),
            lastUpdated: review.updatedAt.toISOString(),
          })),
        },

        // System Reviews
        systemReviews: {
          totalReviews: student.user.systemReview?.length || 0,
          reviewDetails: (student.user.systemReview || []).map(
            (review: any) => ({
              reviewId: review.id,
              rating: review.rating,
              comment: review.comment,
              category: review.category,
              categoryRatings: (review.categoryRatings || []).map(
                (rating: any) => ({
                  ratingId: rating.id,
                  category: rating.category,
                  rating: rating.rating,
                  ratedAt: rating.createdAt.toISOString(),
                }),
              ),
              reviewDate: review.createdAt.toISOString(),
              lastUpdated: review.updatedAt.toISOString(),
            }),
          ),
        },

        // Feedback Summary Analytics
        feedbackAnalytics: {
          totalFeedbacksGiven:
            (student.user.feedbacks?.length || 0) +
            (student.courseReview?.length || 0) +
            (student.sectionReview?.length || 0) +
            (student.chapterReview?.length || 0) +
            (student.user.systemReview?.length || 0),
          averageRatingGiven: (() => {
            const allRatings = [
              ...(student.courseReview || []).map((r: any) => r.rating),
              ...(student.sectionReview || []).map((r: any) => r.rating),
              ...(student.chapterReview || []).map((r: any) => r.rating),
              ...(student.user.systemReview || []).map((r: any) => r.rating),
            ];
            return allRatings.length > 0
              ? Math.round(
                  (allRatings.reduce(
                    (sum: number, rating: number) => sum + rating,
                    0,
                  ) /
                    allRatings.length) *
                    100,
                ) / 100
              : 0;
          })(),
          engagementLevel: (() => {
            const totalPossibleFeedbacks =
              (student.slideProgress || []).length + // slides viewed
              (student.courseProgresses || []).length + // courses enrolled
              (student.chapterProgresses || []).length; // chapters studied
            const actualFeedbacks =
              (student.user.feedbacks?.length || 0) +
              (student.courseReview?.length || 0) +
              (student.chapterReview?.length || 0);
            return totalPossibleFeedbacks > 0
              ? Math.min(
                  100,
                  Math.round((actualFeedbacks / totalPossibleFeedbacks) * 100),
                )
              : 0;
          })(),
        },
      },
    };

    return {
      message: "Comprehensive student data fetched successfully",
      statusCode: 200,
      data: comprehensiveStudentData,
    };
  }

  /**
   * Get student statistics summary
   */
  public static async getStudentStatisticsSummary(role?: string) {
    const roleWhere: Prisma.StudentWhereInput = role
      ? { role: role as any }
      : {};

    const totalStudents = await prisma.student.count({ where: roleWhere });

    const studentsWithProgress = await prisma.student.count({
      where: { ...roleWhere, courseProgresses: { some: {} } },
    });

    const studentsWithoutProgress = totalStudents - studentsWithProgress;

    // Average progress — scoped to the role's student IDs when role is set
    let averageProgress = 0;
    if (role) {
      const studentIds = await prisma.student.findMany({
        where: roleWhere,
        select: { id: true },
      });
      const ids = studentIds.map((s) => s.id);
      if (ids.length > 0) {
        const allProgressData = await prisma.courseProgress.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids } },
          _avg: { progress: true },
        });
        if (allProgressData.length > 0) {
          const total = allProgressData.reduce(
            (sum, d) => sum + (d._avg.progress || 0),
            0,
          );
          averageProgress = total / allProgressData.length;
        }
      }
    } else {
      const allProgressData = await prisma.courseProgress.groupBy({
        by: ["studentId"],
        _avg: { progress: true },
      });
      if (allProgressData.length > 0) {
        const total = allProgressData.reduce(
          (sum, d) => sum + (d._avg.progress || 0),
          0,
        );
        averageProgress = total / allProgressData.length;
      }
    }

    return {
      message: "Student statistics summary fetched successfully",
      statusCode: 200,
      data: {
        totalStudents,
        studentsWithProgress,
        studentsWithoutProgress,
        averageProgress: `${Math.round(this.capAndRoundProgress(averageProgress))}%`,
      },
    };
  }

  /**
   * Update student status
   */
  public static async updateStudentStatus(studentId: string, status: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { status: this.validateAndConvertStatus(status) },
      include: {
        user: {
          select: {
            id: true,
            fullNames: true,
            phoneNumber: true,
            district: true,
            sector: true,
          },
        },
      },
    });

    return {
      message: "Student status updated successfully",
      statusCode: 200,
      data: updatedStudent,
    };
  }

  /**
   * Get all students enrolled in a specific course with basic user info and progress
   */
  public static async getStudentsByCourse(courseId: string) {
    // ensure course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError("Course not found", 404);

    // find course progress records for the course and include student.user info
    const progresses = await prisma.courseProgress.findMany({
      where: { courseId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const students = progresses.map((p) => ({
      studentId: p.student.id,
      userId: p.student.user.id,
      fullNames: p.student.user.fullNames,
      avatar: p.student.user.photo,
      phoneNumber: p.student.user.phoneNumber,
      district: p.student.user.district,
      sector: p.student.user.sector,
      bio: p.student.user.bio,
      hospitalId: p.student.user.hospitalId,
      video: p.student.user.video,
      Audio: p.student.user.audio,
      progress: this.capAndRoundProgress(p.progress || 0),
      isCompleted: !!p.isCompleted,
      enrollmentDate: p.createdAt,
    }));

    return {
      message: "Students fetched by course",
      statusCode: 200,
      data: students,
    };
  }

  public static async updateStudentInfo(
    studentId: string,
    data: CreateUserDto & { role?: string },
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student) throw new AppError("Student not found", 404);

    const { role, ...userDto } = data;

    const result = await UserService.updateUser(student.userId, userDto);

    if (role) {
      const normalizedRole = String(role).toUpperCase();
      if (normalizedRole !== roles.TRAINEE && normalizedRole !== roles.TESTER) {
        throw new AppError("Invalid role. Use TRAINEE or TESTER.", 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.student.update({
          where: { id: studentId },
          data: { role: normalizedRole as any },
        });

        await tx.userRole.deleteMany({
          where: {
            userId: student.userId,
            name: { in: [roles.TRAINEE as any, roles.TESTER as any] },
          },
        });

        await tx.userRole.create({
          data: { userId: student.userId, name: normalizedRole as any },
        });
      });
    }

    return result;
  }
}
