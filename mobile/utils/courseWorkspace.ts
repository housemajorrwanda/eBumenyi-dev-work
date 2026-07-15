import type { ICourse, IChapter, IMidTest, ITest } from '@/types';

export function findChapterInCourse(course: ICourse, chapterId: string): IChapter | null {
  for (const section of course.sections ?? []) {
    for (const chapter of section.chapters ?? []) {
      if (chapter.id === chapterId) return chapter;
    }
  }
  return null;
}

/** Questionnaire reads `test[].course.questionnaires`; mid-tests store questions on midTest itself. */
export function midTestAsITest(midTest: IMidTest, course: ICourse): ITest {
  return {
    id: midTest.id,
    courseId: course.id,
    isPublished: midTest.isPublished,
    createdAt: midTest.createdAt,
    updatedAt: midTest.updatedAt,
    questionToBeAnswered: midTest.questionToBeAnswered,
    marksToPass: midTest.marksToPass,
    description: midTest.description,
    course: {
      ...course,
      questionnaires: midTest.questionnaires ?? [],
    },
  };
}

export function findNextIncompleteSectionId(
  course: ICourse,
  chapterProgress: Array<{ chapterId: string; isCompleted: boolean }>,
): string | undefined {
  let nextSectionId = course.sections[0]?.id;
  outer: for (const section of course.sections) {
    for (const ch of section.chapters) {
      const completed = chapterProgress.find(
        (cp) => cp.chapterId === ch.id && cp.isCompleted,
      );
      if (!completed) {
        nextSectionId = section.id;
        break outer;
      }
    }
  }
  return nextSectionId;
}
