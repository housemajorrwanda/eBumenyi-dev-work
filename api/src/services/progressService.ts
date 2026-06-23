import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { NotificationHelper } from "../utils/notificationHelper";
import {
  extractStudentFirstName,
  generateConversationalRecommendations,
  type ConversationalMessage,
} from "./recommendationNlpService";

export class ProgressService {
  // Slide progress: mark slideProgress.isCompleted true when student views slide
  public static async markSlideCompleted(studentId: string, slideId: string, io?: any) {
    // ensure slide exists
    const slide = await prisma.slide.findUnique({ where: { id: slideId } });
    if (!slide) throw new AppError("Slide not found", 404);

    // ensure student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // upsert slideProgress
    const existing = await prisma.slideProgress.findFirst({
      where: { studentId, slideId },
    });

    if (existing) {
      if (existing.isCompleted) {
        // make sure there is a StudentOnSlide record even if slideProgress already marked
        const existingStudentOnSlideEarly =
          await prisma.studentOnSlide.findFirst({
            where: { studentId, slideId },
          });
        if (!existingStudentOnSlideEarly) {
          await prisma.studentOnSlide.create({
            data: { studentId, slideId, progress: 100 },
          });
        }
        await prisma.slideProgress.update({
          where: { id: existing.id },
          data: { isCompleted: true },
        });
      }
    } else {
      await prisma.slideProgress.create({
        data: { studentId, slideId, isCompleted: true },
      });
    }

    // ensure there is a StudentOnSlide record and set progress to 100
    const existingStudentOnSlide = await prisma.studentOnSlide.findFirst({
      where: { studentId, slideId },
    });
    if (existingStudentOnSlide) {
      if (
        !existingStudentOnSlide.progress ||
        existingStudentOnSlide.progress < 100
      ) {
        await prisma.studentOnSlide.update({
          where: { id: existingStudentOnSlide.id },
          data: { progress: 100 },
        });
      }
    } else {
      await prisma.studentOnSlide.create({
        data: { studentId, slideId, progress: 100 },
      });
    }

    // After marking slide completed, update chapter progress
    await ProgressService.recomputeChapterProgressForStudent(
      studentId,
      slide.chapterId,
      io,
    );

    // After updating chapter, update course progress (needs courseId)
    const chapter = await prisma.chapter.findUnique({
      where: { id: slide.chapterId },
    });
    if (chapter) {
      const section = await prisma.section.findUnique({
        where: { id: chapter.sectionId },
      });
      if (section) {
        const courseId = section.courseId;
        await ProgressService.recomputeCourseProgressForStudent(
          studentId,
          courseId,
          io,
        );
      }
    }

    return { message: "Slide marked completed", statusCode: 200, existing };
  }

  // Recompute chapter progress: count slides in chapter and count slideProgress with isCompleted true
  public static async recomputeChapterProgressForStudent(
    studentId: string,
    chapterId: string,
    io?: any,
  ) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) throw new AppError("Chapter not found", 404);

    const totalSlides = await prisma.slide.count({ where: { chapterId } });

    // If no slides in chapter, mark as completed and clean up any orphaned progress
    if (totalSlides === 0) {
      // Clean up any slide progress for slides that no longer exist in this chapter
      await prisma.slideProgress.deleteMany({
        where: {
          studentId,
          slide: {
            chapterId,
          },
        },
      });

      // Update or create chapter progress as completed
      const existing = await prisma.chapterProgress.findFirst({
        where: { studentId, chapterId },
      });
      if (existing) {
        await prisma.chapterProgress.update({
          where: { id: existing.id },
          data: { progress: 100, isCompleted: true },
        });
      } else {
        await prisma.chapterProgress.create({
          data: {
            studentId,
            chapterId,
            progress: 100,
            isCompleted: true,
          },
        });
      }

      return {
        message: "Chapter progress recomputed (no slides)",
        statusCode: 200,
      } as {
        message: string;
        statusCode: number;
      };
    }

    // Count completed slides for this student in the chapter by joining slide relation
    const completedSlidesCorrect = await prisma.slideProgress.count({
      where: { studentId, isCompleted: true, slide: { chapterId } },
    });

    // Clean up any slide progress records for slides that were completed but no longer exist
    // First get all slide progress for this student that claim to be completed
    const allStudentSlideProgress = await prisma.slideProgress.findMany({
      where: {
        studentId,
        isCompleted: true,
      },
      include: {
        slide: true,
      },
    });

    // Find progress records where slide is null (orphaned)
    const orphanedSlideProgress = allStudentSlideProgress.filter(
      (sp) => !sp.slide,
    );

    if (orphanedSlideProgress.length > 0) {
      await prisma.slideProgress.deleteMany({
        where: {
          id: { in: orphanedSlideProgress.map((osp) => osp.id) },
        },
      });
    }

    const progress = (completedSlidesCorrect / totalSlides) * 100;

    // Ensure progress is between 0 and 100, rounded to 1 decimal place
    const cappedProgress = Math.min(Math.max(progress, 0), 100);
    const rounded = Math.round(cappedProgress * 10) / 10;

    // upsert chapter progress
    const existing = await prisma.chapterProgress.findFirst({
      where: { studentId, chapterId },
    });
    const wasAlreadyCompleted = existing?.isCompleted ?? false;
    if (existing) {
      await prisma.chapterProgress.update({
        where: { id: existing.id },
        data: { progress: rounded, isCompleted: rounded === 100 },
      });
    } else {
      await prisma.chapterProgress.create({
        data: {
          studentId,
          chapterId,
          progress: rounded,
          isCompleted: rounded === 100,
        },
      });
    }

    // ── Fire chapter-completion notification on first-time completion ──────────
    if (rounded === 100 && !wasAlreadyCompleted && io) {
      try {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true },
        });
        const chapterWithSection = await prisma.chapter.findUnique({
          where: { id: chapterId },
          include: { section: { select: { courseId: true } } },
        });
        const courseId = chapterWithSection?.section?.courseId;
        if (student && courseId) {
          await NotificationHelper.sendToUser(
            io,
            student.userId,
            `Igice warangije: "${chapter.title}"`,
            `Wabashije gusoza igice. Komeza usome urangize isomo ryose!`,
            "success",
            `/courses/${courseId}`,
            "chapter",
            courseId, // pass courseId so deep-link resolves to the course
            { chapterTitle: chapter.title, courseId },
            300_000, // 5-min dedup — prevents duplicate if called multiple times quickly
          );
        }
      } catch (notifErr) {
        console.warn("[ProgressService] Chapter completion notify failed:", notifErr);
      }
    }

    return { message: "Chapter progress recomputed", statusCode: 200 } as {
      message: string;
      statusCode: number;
    };
  }

  // Recompute course progress: calculate based on completed slides across all chapters
  public static async recomputeCourseProgressForStudent(
    studentId: string,
    courseId: string,
    io?: any,
  ) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError("Course not found", 404);

    // Get all slides in this course
    const totalSlides = await prisma.slide.count({
      where: {
        chapter: {
          section: { courseId },
        },
      },
    });

    // If no slides in course, mark as completed
    if (totalSlides === 0) {
      const existing = await prisma.courseProgress.findFirst({
        where: { studentId, courseId },
      });

      if (existing) {
        await prisma.courseProgress.update({
          where: { id: existing.id },
          data: { progress: 100, isCompleted: true },
        });
      } else {
        await prisma.courseProgress.create({
          data: {
            studentId,
            courseId,
            progress: 100,
            isCompleted: true,
          },
        });
      }

      return {
        message: "Course progress recomputed (no slides)",
        statusCode: 200,
      } as {
        message: string;
        statusCode: number;
      };
    }

    // Count completed slides for this student in this course
    const completedSlides = await prisma.slideProgress.count({
      where: {
        studentId,
        isCompleted: true,
        slide: {
          chapter: {
            section: { courseId },
          },
        },
      },
    });

    // Calculate progress based on slides completed, but cap at 100%
    let progress = (completedSlides / totalSlides) * 100;

    // Handle edge case where completed slides might exceed total slides (due to deleted slides)
    if (completedSlides > totalSlides) {
      progress = 100;
    }

    // Ensure progress is between 0 and 100, rounded to 1 decimal place
    const cappedProgress = Math.min(Math.max(progress, 0), 100);
    const rounded = Math.round(cappedProgress * 10) / 10;

    // Also check if all chapters are completed for course completion status
    const totalChapters = await prisma.chapter.count({
      where: { section: { courseId } },
    });

    // If no chapters, consider course completed
    let isCompleted = false;
    if (totalChapters === 0) {
      isCompleted = true;
    } else {
      const completedChapters = await prisma.chapterProgress.count({
        where: {
          studentId,
          isCompleted: true,
          chapter: { section: { courseId } },
        },
      });

      // Course is completed if all chapters are completed OR if progress is 100%
      isCompleted = completedChapters === totalChapters || rounded === 100;
    }

    const existing = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
    });
    const wasAlreadyCompleted = existing?.isCompleted ?? false;

    if (existing) {
      await prisma.courseProgress.update({
        where: { id: existing.id },
        data: { progress: rounded, isCompleted },
      });
    } else {
      await prisma.courseProgress.create({
        data: {
          studentId,
          courseId,
          progress: rounded,
          isCompleted,
        },
      });
    }

    // ── Fire course-completion notification on first-time completion ───────────
    if (isCompleted && !wasAlreadyCompleted && io) {
      try {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { userId: true },
        });
        if (student) {
          // Uses existing helper — actionUrl = /courses/{courseId}/certificate
          await NotificationHelper.notifyCourseCompletion(
            io,
            student.userId,
            courseId,
            course.title,
          );
        }
      } catch (notifErr) {
        console.warn("[ProgressService] Course completion notify failed:", notifErr);
      }
    }

    return { message: "Course progress recomputed", statusCode: 200 } as {
      message: string;
      statusCode: number;
    };
  }

  // Helper: Recompute all progress for a student (chapters and courses)
  public static async recomputeAllProgressForStudent(studentId: string) {
    // First, clean up orphaned slide progress records (slides that no longer exist)
    // Use a subquery approach to find progress records for non-existent slides
    const orphanedSlideProgressIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT sp.id 
      FROM "SlideProgress" sp 
      LEFT JOIN "Slide" s ON sp."slideId" = s.id 
      WHERE sp."studentId" = ${studentId} AND s.id IS NULL
    `;

    if (orphanedSlideProgressIds.length > 0) {
      await prisma.slideProgress.deleteMany({
        where: {
          id: { in: orphanedSlideProgressIds.map((item) => item.id) },
        },
      });
    }

    // Get all chapters where the student has any slides completed or in progress
    const chaptersWithProgress = await prisma.chapter.findMany({
      where: {
        slides: {
          some: {
            slideProgress: {
              some: { studentId },
            },
          },
        },
      },
      include: {
        section: true,
      },
    });

    // Also get all chapters where the student has chapter progress records
    const existingChapterProgresses = await prisma.chapterProgress.findMany({
      where: { studentId },
      include: {
        chapter: {
          include: {
            section: true,
          },
        },
      },
    });

    // Combine and deduplicate chapters
    const allChapterIds = new Set([
      ...chaptersWithProgress.map((ch) => ch.id),
      ...existingChapterProgresses.map((cp) => cp.chapterId),
    ]);

    // Recompute each chapter progress
    for (const chapterId of allChapterIds) {
      try {
        await this.recomputeChapterProgressForStudent(studentId, chapterId);
      } catch (error) {
        // If chapter no longer exists, clean up the progress record
        await prisma.chapterProgress.deleteMany({
          where: { studentId, chapterId },
        });
      }
    }

    // Get all courses where the student has any progress
    const coursesWithProgress = await prisma.course.findMany({
      where: {
        sections: {
          some: {
            chapters: {
              some: {
                slides: {
                  some: {
                    slideProgress: {
                      some: { studentId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Also get courses from existing course progress records
    const existingCourseProgresses = await prisma.courseProgress.findMany({
      where: { studentId },
      include: { course: true },
    });

    // Combine and deduplicate courses
    const allCourseIds = new Set([
      ...coursesWithProgress.map((course) => course.id),
      ...existingCourseProgresses.map((cp) => cp.courseId),
    ]);

    // Recompute each course progress
    for (const courseId of allCourseIds) {
      try {
        await this.recomputeCourseProgressForStudent(studentId, courseId);
      } catch (error) {
        // If course no longer exists, clean up the progress record
        await prisma.courseProgress.deleteMany({
          where: { studentId, courseId },
        });
      }
    }

    // Final cleanup: Remove any course progress that shows 0% with no actual slide progress
    const finalCourseProgresses = await prisma.courseProgress.findMany({
      where: { studentId },
    });

    for (const courseProgress of finalCourseProgresses) {
      if (courseProgress.progress === 0) {
        // Check if there are any actual completed slides for this course
        const hasCompletedSlides = await prisma.slideProgress.count({
          where: {
            studentId,
            isCompleted: true,
            slide: {
              chapter: {
                section: { courseId: courseProgress.courseId },
              },
            },
          },
        });

        // If no slides are completed and progress is 0, this might be a stale record
        if (hasCompletedSlides === 0) {
          // Check if course still exists and has slides
          const courseExists = await prisma.course.count({
            where: {
              id: courseProgress.courseId,
              sections: {
                some: {
                  chapters: {
                    some: {
                      slides: {
                        some: {},
                      },
                    },
                  },
                },
              },
            },
          });

          // If course doesn't exist or has no slides, remove the progress record
          if (courseExists === 0) {
            await prisma.courseProgress.delete({
              where: { id: courseProgress.id },
            });
          }
        }
      }
    }

    return {
      message: "All progress recomputed and cleaned up",
      statusCode: 200,
    };
  }

  // API: Get progress by student id (return course, chapter, slide progress lists)
  public static async getProgressByStudent(studentId: string) {
    // verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // First, recompute all progress to ensure accuracy
    await this.recomputeAllProgressForStudent(studentId);

    const courseProgress = await prisma.courseProgress.findMany({
      where: { studentId },
      include: {
        course: {
          include: {
            sections: {
              include: {
                chapters: true,
              },
            },
          },
        },
      },
    });

    const chapterProgress = await prisma.chapterProgress.findMany({
      where: { studentId },
      include: {
        chapter: {
          include: {
            section: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    const slideProgress = await prisma.slideProgress.findMany({
      where: { studentId },
      include: {
        slide: {
          include: {
            chapter: {
              include: {
                section: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get last viewed location
    const lastViewedSlide = slideProgress
      .filter((sp) => sp.isCompleted)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    let lastViewedLocation = null;

    if (lastViewedSlide) {
      const slide = lastViewedSlide.slide;
      const chapter = slide.chapter;
      const section = chapter.section;
      const course = section.course;

      lastViewedLocation = {
        courseId: course.id,
        courseTitle: course.title,
        coverIcon: course.coverIcon,
        sectionId: section.id,
        sectionTitle: section.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        slideId: slide.id,
        lastViewedAt: lastViewedSlide.updatedAt,
      };
    }

    return {
      message: "Progress fetched",
      statusCode: 200,
      data: {
        courseProgress,
        chapterProgress,
        slideProgress,
        lastViewedLocation,
      },
    };
  }

  // API: Get progress by student id and course id (return course, chapter, slide progress lists for a specific course)
  public static async getProgressByStudentAndCourse(
    studentId: string,
    courseId: string,
  ) {
    // verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new AppError("Course not found", 404);

    // Recompute progress for this course only - use comprehensive recomputation
    await this.recomputeAllProgressForStudent(studentId);

    // Then specifically recompute the course progress to ensure it's up to date
    await this.recomputeCourseProgressForStudent(studentId, courseId);

    // Get chapter progress for chapters in this course
    const chapterProgress = await prisma.chapterProgress.findMany({
      where: {
        studentId,
        chapter: {
          section: { courseId },
        },
      },
      include: {
        chapter: {
          include: {
            section: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    // Get pre-test for this course
    const preTest = await prisma.preTest.findFirst({ where: { courseId } });
    let preTestStatus = null;
    if (preTest) {
      const attempts = await prisma.attempTest.findMany({
        where: {
          studentId,
          preTestId: preTest.id,
        },
        orderBy: { marks: "desc" },
      });
      const attempted = attempts.length > 0;
      const passedAttempt = attempts.find(
        (a) => a.marks >= (preTest.marksToPass || 0),
      );
      let bestMarks = null;
      if (attempts.length > 0) {
        bestMarks = Math.max(...attempts.map((a) => a.marks ?? 0));
      }
      preTestStatus = {
        attempted,
        passed: !!passedAttempt,
        bestMarks,
        marksToPass: preTest.marksToPass,
        preTestId: preTest.id,
      };
    }

    // Get final test for this course
    const finalTest = await prisma.finalTest.findFirst({ where: { courseId } });
    let finalTestStatus = null;
    if (finalTest) {
      // Find all attempts for this student and this final test
      const attempts = await prisma.attempTest.findMany({
        where: {
          studentId,
          finalTestId: finalTest.id,
        },
        orderBy: { marks: "desc" },
      });
      const attempted = attempts.length > 0;
      const passedAttempt = attempts.find(
        (a) => a.marks >= (finalTest.marksToPass || 0),
      );
      let bestMarks = null;
      if (attempts.length > 0) {
        bestMarks = Math.max(...attempts.map((a) => a.marks ?? 0));
      }
      finalTestStatus = {
        attempted,
        passed: !!passedAttempt,
        bestMarks,
        marksToPass: finalTest.marksToPass,
        finalTestId: finalTest.id,
      };
    }

    // Additionally get final exam for this course (new)
    const finalExam = await prisma.finalExam.findFirst({ where: { courseId } });
    let finalExamStatus = null;
    if (finalExam) {
      const attempts = await prisma.attempTest.findMany({
        where: {
          studentId,
          finalExamId: finalExam.id,
        },
        orderBy: { marks: "desc" },
      });
      const attempted = attempts.length > 0;
      const passedAttempt = attempts.find(
        (a) => a.marks >= (finalExam.marksToPass || 0),
      );
      let bestMarks = null;
      if (attempts.length > 0) {
        bestMarks = Math.max(...attempts.map((a) => a.marks ?? 0));
      }
      finalExamStatus = {
        attempted,
        passed: !!passedAttempt,
        bestMarks,
        marksToPass: finalExam.marksToPass,
        finalExamId: finalExam.id,
      };
    }

    // Get completed slide IDs for this course
    const completedSlideRows = await prisma.slideProgress.findMany({
      where: {
        studentId,
        isCompleted: true,
        slide: { chapter: { section: { courseId } } },
      },
      select: { slideId: true },
    });
    const completedSlideIds = completedSlideRows.map((r) => r.slideId);

    return {
      message: "Progress fetched",
      statusCode: 200,
      data: {
        chapterProgress,
        completedSlideIds,
        preTestStatus,
        finalTestStatus,
        finalExamStatus,
      },
    };
  }

  // API: Get comprehensive statistics for a student
  public static async getStudentStatistics(studentId: string): Promise<{
    message: string;
    statusCode: number;
    data: {
      summary: {
        totalCourses: number;
        enrolledCourses: number;
        unenrolledCourses: number;
        completedCourses: number;
        startedCourses: number;
      };
      courses: Array<{
        courseId: string;
        title: string;
        coverIcon: string;
        description?: string | null;
        totalChapters: number;
        totalTests: number;
        completedTests: number;
        courseDuration: number;
        isEnrolled: boolean;
        isStarted: boolean;
        isCompleted: boolean;
        completedAt: Date | null;
        isStudentReviewedCourse: boolean;
        enrollmentDate: Date | null;
        progress: number;
        createdAt: Date;
      }>;
      lastViewedLocation?: {
        courseId: string;
        courseTitle: string;
        coverIcon: string;
        sectionId: string;
        sectionTitle: string;
        chapterId: string;
        chapterTitle: string;
        chapterNumber: number;
        slideId: string;
        lastViewedAt: Date;
      } | null;
    };
  }> {
    // verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // Get all courses with their progress and test data
    const allCourses = await prisma.course.findMany({
      where: { isPublished: true },
      include: {
        sections: {
          include: {
            chapters: {
              include: {
                slides: true,
                midTest: {
                  include: {
                    questionnaires: true,
                  },
                },
              },
            },
            course: {
              include: {
                questionnaires: true,
              },
            },
          },
        },
        progresses: {
          where: { studentId },
        },
        preTests: true,
        finalTest: true,
      },
    });

    // Get student's test attempts
    const testAttempts = await prisma.attempTest.findMany({
      where: { studentId },
      include: {
        preTest: true,
        midTest: true,
        finalTest: true,
      },
    });

    // Get student's course reviews to check if they reviewed each course
    const courseReviews = await prisma.courseReview.findMany({
      where: { studentId },
      select: {
        courseId: true,
        createdAt: true,
      },
    });

    // Get completion dates for all courses by finding the last completed slide for each course
    const courseCompletionDates = new Map<string, Date>();
    for (const course of allCourses) {
      const courseProgress = course.progresses[0];
      if (courseProgress?.isCompleted) {
        const lastCompletedSlide = await prisma.slideProgress.findFirst({
          where: {
            studentId,
            isCompleted: true,
            slide: {
              chapter: {
                section: { courseId: course.id },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        });

        if (lastCompletedSlide) {
          courseCompletionDates.set(course.id, lastCompletedSlide.updatedAt);
        }
      }
    }

    // Get last viewed location
    const lastViewedSlide = await prisma.slideProgress.findFirst({
      where: { studentId, isCompleted: true },
      include: {
        slide: {
          include: {
            chapter: {
              include: {
                section: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let lastViewedLocation = null;
    if (lastViewedSlide) {
      const slide = lastViewedSlide.slide;
      const chapter = slide.chapter;
      const section = chapter.section;
      const course = section.course;

      lastViewedLocation = {
        courseId: course.id,
        courseTitle: course.title,
        coverIcon: course.coverIcon,
        sectionId: section.id,
        sectionTitle: section.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        slideId: slide.id,
        lastViewedAt: lastViewedSlide.updatedAt,
      };
    }

    // Process course statistics
    const courseStatistics = allCourses.map((course) => {
      const courseProgress = course.progresses[0]; // Student's progress for this course
      const totalChapters = course.sections.reduce(
        (sum, section) => sum + section.chapters.length,
        0,
      );

      // Check if student has reviewed this course
      const studentReview = courseReviews.find(
        (review) => review.courseId === course.id,
      );
      const isStudentReviewedCourse = !!studentReview;

      // Count total tests in the course (only preTests and finalTest)
      let totalTests = 0;
      totalTests += course.preTests.length;
      if (course.finalTest) totalTests += 1;
      // Calculate course duration (sum of all chapter durations, convert min to hours)
      const totalMinutes = course.sections.reduce(
        (totalDuration, section) =>
          totalDuration +
          section.chapters.reduce(
            (sectionDuration, chapter) =>
              sectionDuration + (chapter.lessonDuration || 0),
            0,
          ),
        0,
      );
      const courseDuration = Math.round((totalMinutes / 60) * 10) / 10; // hours, 1 decimal

      // Count completed tests for this course
      let completedTests = 0;
      // Completed pre-tests
      course.preTests.forEach((preTest: { id: string }) => {
        const attempt = testAttempts.find(
          (att) => att.preTestId === preTest.id && att.isCompleted,
        );
        if (attempt) completedTests += 1;
      });
      // Completed mid-tests
      course.sections.forEach((section) => {
        section.chapters.forEach((chapter) => {
          if (chapter.midTest) {
            const attempt = testAttempts.find(
              (att) => att.midTestId === chapter.midTest!.id && att.isCompleted,
            );
            if (attempt) completedTests += 1;
          }
        });
      });
      // Completed final test(s)
      if (Array.isArray(course.finalTest)) {
        course.finalTest.forEach((finalTest: { id: string }) => {
          const attempt = testAttempts.find(
            (att) => att.finalTestId === finalTest.id && att.isCompleted,
          );
          if (attempt) completedTests += 1;
        });
      }

      // Determine enrollment status
      const isEnrolled = !!courseProgress;
      const enrollmentDate = courseProgress?.createdAt || null;
      const isStarted = isEnrolled && (courseProgress?.progress || 0) > 0;
      const isCompleted = courseProgress?.isCompleted || false;

      // Get completion date - when the last slide was completed (course became 100% complete)
      const completedAt: Date | null = isCompleted
        ? courseCompletionDates.get(course.id) || null
        : null;

      return {
        courseId: course.id,
        title: course.title,
        coverIcon: course.coverIcon,
        description: course.description,
        totalChapters,
        totalTests,
        completedTests,
        courseDuration,
        isEnrolled,
        isStarted,
        isCompleted,
        completedAt,
        isStudentReviewedCourse,
        enrollmentDate,
        progress: Math.min(
          Math.round((courseProgress?.progress || 0) * 10) / 10,
          100,
        ),
        createdAt: course.createdAt,
      };
    });

    // Sort courses by createdAt (descending)
    const sortedCourses = courseStatistics.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Calculate summary statistics
    const totalCourses = allCourses.length;
    const enrolledCourses = sortedCourses.filter((c) => c.isEnrolled).length;
    const unenrolledCourses = totalCourses - enrolledCourses;
    const completedCourses = sortedCourses.filter((c) => c.isCompleted).length;
    const startedCourses = sortedCourses.filter((c) => c.isStarted).length;

    return {
      message: "Student statistics fetched successfully",
      statusCode: 200,
      data: {
        summary: {
          totalCourses,
          enrolledCourses,
          unenrolledCourses,
          completedCourses,
          startedCourses,
        },
        courses: sortedCourses,
        lastViewedLocation,
      },
    };
  }

  // Helper: Enroll student in a course (create initial course progress)
  public static async enrollStudentInCourse(
    studentId: string,
    courseId: string,
    io?: any,
  ) {
    // verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new AppError("Course not found", 404);

    // check if already enrolled
    const existingProgress = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
    });

    if (existingProgress) {
      return {
        message: "Student already enrolled in this course",
        statusCode: 200,
        data: existingProgress,
      };
    }

    // create course progress record (enrollment)
    const courseProgress = await prisma.courseProgress.create({
      data: {
        studentId,
        courseId,
        progress: 0,
        isCompleted: false,
      },
    });

    // Notify student about enrollment
    if (io) {
      const user = await prisma.user.findUnique({
        where: { id: student.userId },
        select: { id: true },
      });
      if (user) {
        await NotificationHelper.notifyCourseEnrollment(
          io,
          user.id,
          courseId,
          course.title,
        ).catch((err) =>
          console.warn("[ProgressService] enrollment notification failed", err),
        );
      }
    }

    return {
      message: "Student enrolled in course successfully",
      statusCode: 201,
      data: courseProgress,
    };
  }

  // API: Manually trigger progress recomputation for a student (useful for fixing frozen progress)
  public static async forceRecomputeStudentProgress(studentId: string) {
    // verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new AppError("Student not found", 404);

    // Force recompute all progress
    await this.recomputeAllProgressForStudent(studentId);

    // Get updated progress data
    const courseProgress = await prisma.courseProgress.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const chapterProgress = await prisma.chapterProgress.findMany({
      where: { studentId },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            chapterNumber: true,
          },
        },
      },
    });

    return {
      message: "Progress forcefully recomputed successfully",
      statusCode: 200,
      data: {
        totalCoursesUpdated: courseProgress.length,
        totalChaptersUpdated: chapterProgress.length,
        courseProgress: courseProgress.map((cp) => ({
          courseId: cp.courseId,
          courseTitle: cp.course.title,
          progress: cp.progress,
          isCompleted: cp.isCompleted,
        })),
        chapterProgress: chapterProgress.map((chp) => ({
          chapterId: chp.chapterId,
          chapterTitle: chp.chapter.title,
          chapterNumber: chp.chapter.chapterNumber,
          progress: chp.progress,
          isCompleted: chp.isCompleted,
        })),
      },
    };
  }

  private static readonly RECOMMENDATION_MAX_CHAPTERS = 5;
  /** If fewer than this fraction of published slides are completed, flag incomplete_slides. */
  private static readonly SLIDE_COMPLETION_RATIO_OK = 0.78;

  /**
   * Post-completion recommendations for a certified course: mid-test performance,
   * slide completion per chapter, fast completion pacing — ranked and capped.
   */
  public static async getPostCourseRecommendations(
    studentId: string,
    courseId: string,
  ): Promise<{
    message: string;
    statusCode: number;
    data: {
      courseId: string;
      courseTitle: string;
      completedQuickly: boolean;
      expectedLessonMinutes: number;
      elapsedHours: number | null;
      summaryMessageRw: string;
      conversationalMessages: ConversationalMessage[];
      generatedByNlp: boolean;
      chapters: Array<{
        chapterId: string;
        sectionId: string;
        chapterTitle: string;
        chapterNumber: number;
        midTestId: string | null;
        bestMarks: number | null;
        marksToPass: number | null;
        attemptCount: number;
        reasons: Array<
          | "no_attempt"
          | "below_pass"
          | "barely_passed"
          | "fast_pace_review"
          | "incomplete_slides"
        >;
        severity: "high" | "moderate" | "low";
      }>;
    };
  }> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { fullNames: true } } },
    });
    if (!student) throw new AppError("Student not found", 404);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) throw new AppError("Course not found", 404);

    const studentFirstName = extractStudentFirstName(student.user?.fullNames);

    const certificate = await prisma.certificate.findUnique({
      where: {
        studentId_courseId: { studentId, courseId },
      },
    });

    const hasFinalExamAttempt =
      (await prisma.attempTest.count({
        where: {
          studentId,
          finalExam: { courseId },
        },
      })) > 0;

    if (!certificate && !hasFinalExamAttempt) {
      throw new AppError(
        "Inama ziboneke nyuma yo kugerageza ikizamini gisoza isomo cyangwa niba ufite impamyabumenyi.",
        404,
      );
    }

    const courseProgress = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
    });
    if (!courseProgress) {
      throw new AppError("Course enrollment not found", 404);
    }

    const eligibleByCompletion =
      courseProgress.isCompleted || !!certificate || hasFinalExamAttempt;
    if (!eligibleByCompletion) {
      throw new AppError("Course is not completed", 400);
    }

    const completedAt = await prisma.slideProgress.findFirst({
      where: {
        studentId,
        isCompleted: true,
        slide: {
          chapter: {
            section: { courseId },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const enrollmentDate = courseProgress.createdAt;
    const doneAt = completedAt?.updatedAt ?? null;
    let elapsedHours: number | null = null;
    if (doneAt) {
      elapsedHours =
        (doneAt.getTime() - enrollmentDate.getTime()) / (1000 * 60 * 60);
    }

    const courseChapters = await prisma.chapter.findMany({
      where: { section: { courseId } },
      orderBy: { chapterNumber: "asc" },
      include: {
        midTest: true,
        section: { select: { id: true } },
        slides: {
          where: { isPublished: true },
          select: { id: true },
        },
      },
    });

    const expectedLessonMinutes = courseChapters.reduce(
      (sum, ch) => sum + (ch.lessonDuration || 0),
      0,
    );
    const nominalHours = Math.max(expectedLessonMinutes / 60, 0.25);
    const completedQuickly =
      elapsedHours !== null &&
      elapsedHours > 0 &&
      elapsedHours < nominalHours * 0.35;

    const midTestIds = courseChapters
      .filter((ch) => ch.midTest)
      .map((ch) => ch.midTest!.id);

    const allMidAttempts =
      midTestIds.length > 0
        ? await prisma.attempTest.findMany({
            where: { studentId, midTestId: { in: midTestIds } },
          })
        : [];

    const attemptsByMidId = new Map<string, typeof allMidAttempts>();
    for (const a of allMidAttempts) {
      if (!a.midTestId) continue;
      const list = attemptsByMidId.get(a.midTestId) ?? [];
      list.push(a);
      attemptsByMidId.set(a.midTestId, list);
    }

    const allSlideIds = courseChapters.flatMap((ch) =>
      ch.slides.map((s) => s.id),
    );
    const completedSlideRows =
      allSlideIds.length > 0
        ? await prisma.slideProgress.findMany({
            where: {
              studentId,
              slideId: { in: allSlideIds },
              isCompleted: true,
            },
            select: { slideId: true },
          })
        : [];
    const completedSlideIds = new Set(completedSlideRows.map((r) => r.slideId));

    type RecReason =
      | "no_attempt"
      | "below_pass"
      | "barely_passed"
      | "fast_pace_review"
      | "incomplete_slides";

    type Severity = "high" | "moderate" | "low";

    const candidates: Array<{
      chapterId: string;
      sectionId: string;
      chapterTitle: string;
      chapterNumber: number;
      midTestId: string | null;
      bestMarks: number | null;
      marksToPass: number | null;
      attemptCount: number;
      reasons: RecReason[];
      severity: Severity;
      priorityScore: number;
    }> = [];

    const toSeverity = (reasons: RecReason[], score: number): Severity => {
      if (reasons.includes("below_pass")) return "high";
      if (
        reasons.includes("barely_passed") ||
        reasons.includes("incomplete_slides") ||
        score >= 50
      ) {
        return "moderate";
      }
      return "low";
    };

    const weight = (r: RecReason): number => {
      switch (r) {
        case "below_pass":
          return 100;
        case "no_attempt":
          return 25;
        case "barely_passed":
          return 55;
        case "incomplete_slides":
          return 42;
        case "fast_pace_review":
          return 28;
        default:
          return 0;
      }
    };

    for (const ch of courseChapters) {
      const attempts = ch.midTest
        ? (attemptsByMidId.get(ch.midTest.id) ?? [])
        : [];
      const attemptCount = attempts.length;
      const bestMarks =
        attemptCount > 0
          ? Math.max(...attempts.map((a) => a.marks ?? 0))
          : null;
      const marksToPass = ch.midTest?.marksToPass ?? 0;

      const reasons: RecReason[] = [];

      if (ch.midTest) {
        if (attemptCount === 0) {
          reasons.push("no_attempt");
        } else if (bestMarks !== null && bestMarks < marksToPass) {
          reasons.push("below_pass");
        } else if (
          bestMarks !== null &&
          bestMarks >= marksToPass &&
          bestMarks <= marksToPass + 10
        ) {
          reasons.push("barely_passed");
        }

        if (
          completedQuickly &&
          bestMarks !== null &&
          bestMarks < Math.max(marksToPass + 15, 80)
        ) {
          reasons.push("fast_pace_review");
        }
      }

      const slideList = ch.slides;
      const totalSlides = slideList.length;
      if (totalSlides > 0) {
        let completedCount = 0;
        for (const s of slideList) {
          if (completedSlideIds.has(s.id)) completedCount += 1;
        }
        const ratio = completedCount / totalSlides;
        if (ratio < ProgressService.SLIDE_COMPLETION_RATIO_OK) {
          reasons.push("incomplete_slides");
        }
      }

      // Mid-test not taken is the main action; slide gap is secondary and confuses copy.
      if (reasons.includes("no_attempt") && reasons.includes("incomplete_slides")) {
        reasons.splice(reasons.indexOf("incomplete_slides"), 1);
      }

      if (reasons.length === 0) continue;

      const priorityScore = reasons.reduce((sum, r) => sum + weight(r), 0);
      const severity = toSeverity(reasons, priorityScore);

      candidates.push({
        chapterId: ch.id,
        sectionId: ch.section.id,
        chapterTitle: ch.title,
        chapterNumber: ch.chapterNumber,
        midTestId: ch.midTest?.id ?? null,
        bestMarks,
        marksToPass: ch.midTest ? marksToPass : null,
        attemptCount,
        reasons,
        severity,
        priorityScore,
      });
    }

    const isNoAttemptOnly = (c: (typeof candidates)[0]) =>
      c.reasons.length === 1 && c.reasons[0] === "no_attempt";

    // Prefer strong-signal chapters, then fill remaining slots with weak-only ones so we
    // reliably surface up to RECOMMENDATION_MAX_CHAPTERS items when possible.
    const strong = candidates
      .filter((c) => !isNoAttemptOnly(c))
      .sort((a, b) => b.priorityScore - a.priorityScore);
    const weakOnly = candidates
      .filter(isNoAttemptOnly)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const max = ProgressService.RECOMMENDATION_MAX_CHAPTERS;
    const picked = [...strong, ...weakOnly].slice(0, max);

    const chapters = picked.map(({ priorityScore: _p, ...rest }) => rest);

    const summaryMessageRw = ProgressService.buildRecommendationSummaryRw(
      course.title,
      completedQuickly,
      chapters,
    );

    const { messages: conversationalMessages, generatedByNlp } =
      await generateConversationalRecommendations({
        studentFirstName,
        courseTitle: course.title,
        completedQuickly,
        chapters,
      });

    return {
      message: "Recommendations fetched",
      statusCode: 200,
      data: {
        courseId: course.id,
        courseTitle: course.title,
        completedQuickly,
        expectedLessonMinutes,
        elapsedHours,
        summaryMessageRw,
        conversationalMessages,
        generatedByNlp,
        chapters,
      },
    };
  }

  private static buildRecommendationSummaryRw(
    courseTitle: string,
    completedQuickly: boolean,
    chapters: Array<{
      chapterTitle: string;
      chapterNumber: number;
      reasons: string[];
    }>,
  ): string {
    const intro = `Isomo: «${courseTitle}». `;
    if (chapters.length === 0) {
      if (completedQuickly) {
        return (
          intro +
          "Warangije vuba, kandi ukoze neza ku masomo ya hagati. Komeza uko ukoze."
        );
      }
      return (
        intro +
        "Murakoze! Umusaruro wawe ku masomo ya hagati ni mwiza. Komeza uko ukoze."
      );
    }

    const lines: string[] = [intro];
    if (completedQuickly) {
      lines.push(
        "Warangije isomo vuba ku buryo butandukanye n'igihe cy'amasomo; bishobora kuba byari bigufi ku bice bimwe.",
      );
    }
    lines.push("Turagusaba kongera usubiremo ibi bice by'inyongera:");

    chapters.forEach((c, i) => {
      const bits: string[] = [];
      if (c.reasons.includes("no_attempt"))
        bits.push("tangira igeragezwa ry'icyiciro");
      if (c.reasons.includes("below_pass")) bits.push("amanota yari hasi");
      if (c.reasons.includes("barely_passed")) bits.push("wanyereye gusa");
      if (c.reasons.includes("fast_pace_review"))
        bits.push("bisaba isubiramo ryihuse");
      if (c.reasons.includes("incomplete_slides"))
        bits.push("amashusho menshi atarakozwa neza");
      lines.push(
        `${i + 1}. Icyiciro ${c.chapterNumber}: ${c.chapterTitle} (${bits.join(", ") || "subiramo"}).`,
      );
    });

    lines.push(
      "Kanda ku isomo mu myitwarire urebe amasomo, cyangwa usubiremo ibice byerekana.",
    );
    return lines.join(" ");
  }

  /**
   * Aggregate post-course recommendations across eligible student–course pairs
   * for the admin dashboard (top chapters + students with the most flags).
   */
  public static async getRecommendationInsights(): Promise<{
    message: string;
    statusCode: number;
    data: {
      mostRecommendedChapters: Array<{
        chapterId: string;
        chapterTitle: string;
        chapterNumber: number;
        courseId: string;
        courseTitle: string;
        recommendationCount: number;
        highSeverityCount: number;
        topReason:
          | "no_attempt"
          | "below_pass"
          | "barely_passed"
          | "fast_pace_review"
          | "incomplete_slides";
      }>;
      studentsWithMostRecommendations: Array<{
        studentId: string;
        studentName: string;
        studentPhoto: string;
        totalRecommendations: number;
        coursesAffected: number;
        highestSeverity: "high" | "moderate" | "low";
      }>;
      eligiblePairsProcessed: number;
    };
  }> {
    type Pair = { studentId: string; courseId: string };
    type Reason =
      | "no_attempt"
      | "below_pass"
      | "barely_passed"
      | "fast_pace_review"
      | "incomplete_slides";

    const pairKey = (p: Pair) => `${p.studentId}:${p.courseId}`;
    const pairs = new Map<string, Pair>();

    const [completed, certificates, finalExamAttempts] = await Promise.all([
      prisma.courseProgress.findMany({
        where: { isCompleted: true },
        select: { studentId: true, courseId: true },
      }),
      prisma.certificate.findMany({
        select: { studentId: true, courseId: true },
      }),
      prisma.attempTest.findMany({
        where: { finalExamId: { not: null } },
        select: {
          studentId: true,
          finalExam: { select: { courseId: true } },
        },
      }),
    ]);

    for (const p of completed) pairs.set(pairKey(p), p);
    for (const p of certificates) pairs.set(pairKey(p), p);
    for (const a of finalExamAttempts) {
      if (!a.finalExam?.courseId) continue;
      pairs.set(pairKey({ studentId: a.studentId, courseId: a.finalExam.courseId }), {
        studentId: a.studentId,
        courseId: a.finalExam.courseId,
      });
    }

    const pairList = Array.from(pairs.values());
    const chapterAgg = new Map<
      string,
      {
        chapterId: string;
        chapterTitle: string;
        chapterNumber: number;
        courseId: string;
        courseTitle: string;
        recommendationCount: number;
        highSeverityCount: number;
        reasonCounts: Map<string, number>;
      }
    >();

    const studentAgg = new Map<
      string,
      {
        totalRecommendations: number;
        courseIds: Set<string>;
        highestSeverity: "high" | "moderate" | "low";
      }
    >();

    const severityRank = { high: 3, moderate: 2, low: 1 };
    const reasonPriority: Reason[] = [
      "below_pass",
      "no_attempt",
      "incomplete_slides",
      "barely_passed",
      "fast_pace_review",
    ];

    const pickTopReason = (counts: Map<string, number>): Reason => {
      for (const r of reasonPriority) {
        if ((counts.get(r) ?? 0) > 0) return r;
      }
      return "incomplete_slides";
    };

    const batchSize = 8;
    for (let i = 0; i < pairList.length; i += batchSize) {
      const batch = pairList.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((p) =>
          ProgressService.getPostCourseRecommendations(p.studentId, p.courseId),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const pair = batch[j];
        if (result.status !== "fulfilled") continue;

        const { data } = result.value;
        if (!data.chapters.length) continue;

        for (const ch of data.chapters) {
          const existing = chapterAgg.get(ch.chapterId);
          if (existing) {
            existing.recommendationCount += 1;
            if (ch.severity === "high") existing.highSeverityCount += 1;
            for (const r of ch.reasons) {
              existing.reasonCounts.set(r, (existing.reasonCounts.get(r) ?? 0) + 1);
            }
          } else {
            const reasonCounts = new Map<string, number>();
            for (const r of ch.reasons) reasonCounts.set(r, 1);
            chapterAgg.set(ch.chapterId, {
              chapterId: ch.chapterId,
              chapterTitle: ch.chapterTitle,
              chapterNumber: ch.chapterNumber,
              courseId: data.courseId,
              courseTitle: data.courseTitle,
              recommendationCount: 1,
              highSeverityCount: ch.severity === "high" ? 1 : 0,
              reasonCounts,
            });
          }
        }

        let entry = studentAgg.get(pair.studentId);
        if (!entry) {
          entry = {
            totalRecommendations: 0,
            courseIds: new Set(),
            highestSeverity: "low",
          };
          studentAgg.set(pair.studentId, entry);
        }
        entry.totalRecommendations += data.chapters.length;
        entry.courseIds.add(pair.courseId);
        for (const ch of data.chapters) {
          if (severityRank[ch.severity] > severityRank[entry.highestSeverity]) {
            entry.highestSeverity = ch.severity;
          }
        }
      }
    }

    const mostRecommendedChapters = Array.from(chapterAgg.values())
      .sort((a, b) => {
        if (b.recommendationCount !== a.recommendationCount) {
          return b.recommendationCount - a.recommendationCount;
        }
        return b.highSeverityCount - a.highSeverityCount;
      })
      .slice(0, 8)
      .map((c) => ({
        chapterId: c.chapterId,
        chapterTitle: c.chapterTitle,
        chapterNumber: c.chapterNumber,
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        recommendationCount: c.recommendationCount,
        highSeverityCount: c.highSeverityCount,
        topReason: pickTopReason(c.reasonCounts),
      }));

    const studentIds = Array.from(studentAgg.keys());
    const students =
      studentIds.length > 0
        ? await prisma.student.findMany({
            where: { id: { in: studentIds } },
            include: { user: { select: { fullNames: true, photo: true } } },
          })
        : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const studentsWithMostRecommendations = Array.from(studentAgg.entries())
      .sort((a, b) => b[1].totalRecommendations - a[1].totalRecommendations)
      .slice(0, 8)
      .map(([studentId, agg]) => {
        const s = studentById.get(studentId);
        return {
          studentId,
          studentName: s?.user.fullNames ?? "Unknown",
          studentPhoto: s?.user.photo ?? "",
          totalRecommendations: agg.totalRecommendations,
          coursesAffected: agg.courseIds.size,
          highestSeverity: agg.highestSeverity,
        };
      });

    return {
      message: "Recommendation insights fetched",
      statusCode: 200,
      data: {
        mostRecommendedChapters,
        studentsWithMostRecommendations,
        eligiblePairsProcessed: pairList.length,
      },
    };
  }
}
