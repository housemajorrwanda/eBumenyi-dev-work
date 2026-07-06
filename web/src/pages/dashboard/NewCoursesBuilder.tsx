import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import CourseBuilder from "@/components/courseBuilder/CourseBuilder";
import {
  CourseBuilderData,
  CourseCreationForm,
  CourseChapter,
  CourseSection,
  CourseSlide,
  TestConfig,
} from "@/types/courseBuilder.d";
import { getCourseById, updateCourse, notifyCourseUsers } from "@/services/course.service";
import { ICourse, ISection, IChapter, ISlide } from "@/types";
import { courseKeys } from "@/utils/constants/queryKeys";

type CreatedCourseDraft = {
  id: string;
  title: string;
  description?: string;
  coverIcon: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type BuilderLocationState = {
  // create flow
  courseForm?: CourseCreationForm;
  createdCourse?: CreatedCourseDraft;
  // edit flow
  editCourseId?: string;
  course?: ICourse;
};

function detectFileType(url?: string): "pdf" | "image" | "video" | "document" {
  if (!url) return "document";
  const lower = url.toLowerCase();
  if (lower.match(/\.(pdf)$/)) return "pdf";
  if (lower.match(/\.(mp4|webm|mov|avi|mkv)$/)) return "video";
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) return "image";
  return "document";
}

function mapICourseToCourseBuilderData(course: ICourse): CourseBuilderData {
  const sections: CourseSection[] = (course.sections ?? []).map(
    (section: ISection, si: number) => ({
      id: section.id,
      title: section.title,
      description: section.description ?? "",
      order: section.sectionNumber ?? si + 1,
      hasTest: false,
      chapters: (section.chapters ?? []).map(
        (chapter: IChapter, ci: number) => {
          const slides: CourseSlide[] = (chapter.slides ?? []).map(
            (slide: ISlide, sli: number) => ({
              id: slide.id,
              title: slide.note || `Slide ${sli + 1}`,
              fileType: detectFileType(slide.file),
              fileUrl: slide.file ?? "",
              fileName: slide.file?.split("/").pop() ?? `slide-${sli + 1}`,
              order: slide.slideNumber ?? sli + 1,
              createdAt: slide.createdAt,
            })
          );

          const chapterResult: CourseChapter = {
            id: chapter.id,
            title: chapter.title,
            description: chapter.description ?? "",
            order: ci + 1,
            slides,
            hasTest: !!chapter.midTest,
            testId: chapter.midTest?.id,
            activityAt: chapter.activityAt ?? undefined,
            midTest: chapter.midTest
              ? {
                  questionToBeAnswered:
                    chapter.midTest.questionToBeAnswered ?? 5,
                  marksToPass: chapter.midTest.marksToPass ?? 60,
                  description: chapter.midTest.description ?? "",
                }
              : undefined,
          };
          return chapterResult;
        }
      ),
    })
  );

  const preTestSource = course.preTests?.[0];
  const finalTestSource = course.finalTest?.[0];
  const finalExamSource = course.finalExam?.[0];

  const preTest: TestConfig | undefined = preTestSource
    ? {
        questionToBeAnswered: preTestSource.questionToBeAnswered,
        marksToPass: preTestSource.marksToPass,
        description: preTestSource.description ?? "",
        isPublished: preTestSource.isPublished,
      }
    : undefined;

  const finalTest: TestConfig | undefined = finalTestSource
    ? {
        questionToBeAnswered: finalTestSource.questionToBeAnswered,
        marksToPass: finalTestSource.marksToPass,
        description: finalTestSource.description ?? "",
        isPublished: finalTestSource.isPublished,
      }
    : undefined;

  const finalExam: TestConfig | undefined = finalExamSource
    ? {
        questionToBeAnswered: finalExamSource.questionToBeAnswered,
        marksToPass: finalExamSource.marksToPass,
        description: finalExamSource.description ?? "",
        isPublished: finalExamSource.isPublished,
      }
    : undefined;

  return {
    id: course.id,
    title: course.title,
    description: course.description ?? "",
    coverIcon: course.coverIcon ?? "",
    sections,
    isPublished: course.isPublished,
    pendingNotificationType: course.pendingNotificationType ?? null,
    lastNotifiedAt: course.lastNotifiedAt ?? null,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    preTest,
    finalTest,
    finalExam,
  };
}

/** Map sequential slide index to persisted slideNumber, reserving activityAt for mid-test. */
function getSlideNumberForSave(
  slideIndex: number,
  activityAt?: number,
  hasMidTest = false,
): number {
  const base = slideIndex + 1;
  if (!hasMidTest || !activityAt || activityAt < 1) return base;
  return base >= activityAt ? base + 1 : base;
}

function buildApiPayload(data: CourseBuilderData): Record<string, unknown> {
  return {
    title: data.title,
    coverIcon: data.coverIcon,
    description: data.description,
    isPublished: data.isPublished,
    courseIntro: {
      title: data.title,
      summary: data.description,
      bannerImage: data.coverIcon,
      thumbnail: data.coverIcon,
    },
    sections: data.sections.map((_section, _si) => ({
      title: _section.title,
      description: _section.description,
      sectionNumber: _si + 1,
      chapters: _section.chapters.map((chapter, ci) => ({
        title: chapter.title,
        description: chapter.description,
        chapterNumber: ci + 1,
        // Send undefined (omitted from JSON) when not set — sending null breaks
        // TSOA's double validation and causes a 500 error.
        // The backend upsert treats missing activityAt as null automatically.
        activityAt: chapter.activityAt,
        slides: chapter.slides
          .sort((a, b) => a.order - b.order)
          .map((slide, sli) => ({
            note: slide.title,
            slideNumber: getSlideNumberForSave(
              sli,
              chapter.activityAt,
              !!chapter.midTest,
            ),
            file: slide.fileUrl,
            isPublished: true,
          })),
        ...(chapter.midTest
          ? {
              midTest: {
                questionToBeAnswered: chapter.midTest.questionToBeAnswered,
                marksToPass: chapter.midTest.marksToPass,
                description: chapter.midTest.description,
              },
            }
          : {}),
      })),
    })),
    ...(data.preTest
      ? {
          preTest: {
            questionToBeAnswered: data.preTest.questionToBeAnswered,
            marksToPass: data.preTest.marksToPass,
            description: data.preTest.description,
          },
        }
      : {}),
    ...(data.finalTest
      ? {
          finalTest: {
            questionToBeAnswered: data.finalTest.questionToBeAnswered,
            marksToPass: data.finalTest.marksToPass,
            description: data.finalTest.description,
          },
        }
      : {}),
    ...(data.finalExam
      ? {
          finalExam: {
            questionToBeAnswered: data.finalExam.questionToBeAnswered,
            marksToPass: data.finalExam.marksToPass,
            description: data.finalExam.description,
          },
        }
      : {}),
  };
}

async function fetchCourseBuilderData(
  courseId: string,
): Promise<CourseBuilderData | void> {
  const freshResponse = await getCourseById(courseId);
  const freshCourse = freshResponse?.data as ICourse | undefined;
  if (freshCourse) return mapICourseToCourseBuilderData(freshCourse);
}

export default function NewCoursesBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const locationState = (location.state as BuilderLocationState | null) ?? null;

  // Resolve courseId from either flow (edit or create)
  const courseId =
    locationState?.editCourseId ?? locationState?.createdCourse?.id ?? null;

  const detailQueryKey = [...courseKeys.all, "detail", courseId];

  // Always fetch the latest saved data from the API once we have an ID.
  // This ensures navigating away and back always shows persisted data.
  const { data: fetchedCourseResponse, isLoading } = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => getCourseById(courseId!),
    enabled: !!courseId,
    // Don't re-fetch on window focus — user may be mid-edit
    refetchOnWindowFocus: false,
  });

  const fetchedCourse = fetchedCourseResponse?.data as ICourse | undefined;

  // Build CourseBuilderData from the API response when available,
  // otherwise fall back to the minimal draft from location state.
  const courseData: CourseBuilderData | null = (() => {
    if (fetchedCourse) {
      return mapICourseToCourseBuilderData(fetchedCourse);
    }
    // Still loading — return null to show spinner
    if (courseId && isLoading) return null;

    // Fallback: no ID at all (should not happen in normal flow)
    const draft = locationState?.createdCourse;
    const form = locationState?.courseForm;
    if (draft) {
      return {
        id: draft.id,
        title: draft.title,
        description: draft.description ?? form?.description ?? "",
        coverIcon: draft.coverIcon ?? form?.coverIcon ?? "",
        sections: [],
        isPublished: draft.isPublished,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      };
    }
    return null;
  })();

  // Silent background save — no toast, no cache invalidation (avoids remount while editing)
  const handleAutoSave = async (updatedCourse: CourseBuilderData): Promise<CourseBuilderData | void> => {
    try {
      const payload = buildApiPayload(updatedCourse);
      await updateCourse(updatedCourse.id, payload);
      // Update response is a shallow course — refetch full tree so midTest ids are available.
      return await fetchCourseBuilderData(updatedCourse.id);
    } catch (error) {
      const rawMsg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message;
      // rawMsg can be "" when TSOA throws a ValidateError with empty string —
      // fall back to a meaningful label in that case.
      const msg = rawMsg || "Auto-save failed";
      console.error("Auto-save error:", msg);
      throw error; // re-throw so CourseBuilder can show error status
    }
  };

  const handlePublishCourse = async (
    updatedCourse: CourseBuilderData,
  ): Promise<CourseBuilderData | void> => {
    try {
      const payload = buildApiPayload({ ...updatedCourse, isPublished: true });
      await updateCourse(updatedCourse.id, payload);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
      await queryClient.invalidateQueries({ queryKey: courseKeys.all });
      toast.success("Course published successfully!");
      return await fetchCourseBuilderData(updatedCourse.id);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Failed to publish course";
      toast.error(msg);
      throw error;
    }
  };

  const handleNotifyUsers = async (courseId: string) => {
    try {
      const response = await notifyCourseUsers(courseId);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
      toast.success(response.message || "Users notified successfully");
      const course = response.data?.course;
      if (course) {
        return mapICourseToCourseBuilderData(course);
      }
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Failed to notify users";
      toast.error(msg);
      throw error;
    }
  };

  const handleBack = () => {
    navigate("/courses");
  };

  if (isLoading && courseId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Course not found.</p>
      </div>
    );
  }

  return (
    // key forces CourseBuilder to fully remount (resetting its internal useState)
    // whenever the course ID or its updatedAt timestamp changes — e.g. after a
    // successful save re-fetches newer data from the API.
    <CourseBuilder
      key={`${courseData.id}-${courseData.updatedAt}`}
      courseData={courseData}
      onAutoSave={handleAutoSave}
      onPublish={handlePublishCourse}
      onNotifyUsers={handleNotifyUsers}
      onBack={handleBack}
    />
  );
}
