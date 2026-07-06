// Course Builder Types

export interface CourseSlide {
  id: string;
  title: string;
  fileType: "pdf" | "image" | "video" | "document";
  fileUrl: string;
  fileName: string;
  order: number;
  createdAt: string;
}

export interface TestConfig {
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
  isPublished?: boolean;
}

export interface CourseChapter {
  id: string;
  title: string;
  description?: string;
  order: number;
  slides: CourseSlide[];
  hasTest: boolean;
  testId?: string;
  midTest?: TestConfig;
  activityAt?: number;
}

export interface CourseSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  chapters: CourseChapter[];
  hasTest: boolean;
  testId?: string;
}

export interface CourseBuilderData {
  id: string;
  title: string;
  description: string;
  coverIcon: string; // uploaded image URL/data URL or legacy icon value
  sections: CourseSection[];
  isPublished: boolean;
  pendingNotificationType?: 'created' | 'updated' | null;
  lastNotifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  preTest?: TestConfig;
  finalTest?: TestConfig;
  finalExam?: TestConfig;
}

export interface CourseCreationForm {
  title: string;
  description: string;
  coverIcon: string;
}

export interface SlideUploadData {
  title: string;
  file: File;
  fileType: "pdf" | "image" | "video" | "document";
}
