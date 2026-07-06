import { TsoaResponse } from "tsoa";

export type RoleTypeEnum =
  | "ADMIN"
  | "TRAINER"
  | "CHO"
  | "TRAINEE"
  | "DEVELOPER"
  | "TESTER"
  | "STAFF";

export interface IResponse<T> {
  statusCode: number;
  message: string;
  error?: unknown;
  data?: T;
}

export interface IPaged<T> {
  data: T;
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  statusCode: number;
  message: string;
  error?: unknown;
}

export interface Paged<T> {
  data: T;
  totalItems: number;
  statusCode: number;
  message: string;
  error?: unknown;
}

export type TUser = {
  id: string;
  email?: string | null;
  fullNames: string;
  password: string;
  phoneNumber: string;
  photo?: Express.Multer.File | string | null;
  video?: Express.Multer.File | string | null;
  audio?: Express.Multer.File | string | null;
  bio?: string;
  hospitalId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  userRoles?: IUserRole[];
  staff?: IStaff;
  student?: IStudent;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID?: string | null;
  birthdate?: Date | string | null;
  gender?: string;
  industry?: string;
};

export interface IUserRole {
  id: string;
  name: RoleType;
  userId: string;
}

export interface IStaff {
  id: string;
  role: string;
}

export interface IStudentModel {
  id: string;
  role: string;
}

export interface IHospital {
  id: string;
  name: string;
  location?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  contact?: string | null;
  email?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserResponse {
  id: string;
  fullNames: string;
  email: string | null;
  userRoles: IUserRole[];
  password: string;
  createdAt: Date;
  phoneNumber: string;
  updatedAt: Date;
  otp: string | null;
  otpExpiresAt: Date | null;
  photo: string;
  video: string | null;
  audio: string | null;
  bio: string | null;
  hospital: IHospital | null;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID?: string | null;
  birthdate?: Date | null | string;
  gender: string | null;
  industry?: string | null;
}

export interface UserResponse extends Omit<
  IUserResponse,
  | "createdAt"
  | "updatedAt"
  | "userRoles"
  | "password"
  | "phoneNumber"
  | "otp"
  | "otpExpiresAt"
  | "photo"
  | "video"
  | "audio"
  | "bio"
  | "hospitalId"
  | "industry"
> {}

export interface CreateUserDto {
  fullNames: string;
  email?: string | null;
  phoneNumber: string;
  photo?: Express.Multer.File | string | null;
  video?: Express.Multer.File | string | null;
  audio?: Express.Multer.File | string | null;
  bio?: string;
  hospitalId?: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID?: string | null;
  birthdate?: Date | string | null;
  gender?: string | null;
  industry?: string | null;
}

export interface UpdateProfileDto {
  fullNames: string;
  email?: string | null;
  phoneNumber: string;
  photo?: Express.Multer.File | string | null;
  video?: Express.Multer.File | string | null;
  audio?: Express.Multer.File | string | null;
  bio?: string;
  hospitalId?: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID?: string | null;
  birthdate?: Date | string | null;
  gender?: string | null;
  industry?: string | null;
}

export type RoleType = RoleTypeEnum;

export interface IUser extends Omit<TUser, "id" | "createdAt" | "updatedAt"> {}
export interface ILoginResponse extends Omit<
  TUser,
  "password" | "createdAt" | "updatedAt" | "userRoles"
> {
  token: string;
  userRoles: IUserRole[];
  completedTours: string[];
}
export interface ILoginUser extends Pick<IUser, "fullNames" | "phoneNumber"> {}

// Password-based login payload (email + password)
export interface IPasswordLogin {
  email: string;
  password: string;
}

export interface ISignUpUser extends Pick<
  IUser,
  | "email"
  | "fullNames"
  | "photo"
  | "video"
  | "audio"
  | "bio"
  | "hospitalId"
  | "phoneNumber"
> {
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID?: string | null;
  birthdate?: Date | string | null;
  gender?: string | null;
  industry?: string | null;
  role?: RoleType;
}

export type TErrorResponse = TsoaResponse<
  400 | 401 | 500,
  IResponse<{ message: string }>
>;

export interface IResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
}

export interface TNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "comment"
    | "like"
    | "new_message"
    | "system"
    | "reply"
    | "mention";
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export type PushPlatform = "ios" | "android" | "web" | "desktop";

export interface RegisterPushTokenDto {
  token: string;
  platform?: PushPlatform;
  deviceId?: string | null;
  expiresAt?: string | null;
}

export interface NotificationCategories {
  courseUpdates: boolean;
  assignmentReminders: boolean;
  certificates: boolean;
  systemUpdates: boolean;
}

export interface UpdateSettingsDto {
  theme?: string;
  language?: string;
  timezone?: string;
  dateFormat?: string;
  emailNotif?: boolean;
  pushNotif?: boolean;
  smsNotif?: boolean;
  categories?: NotificationCategories;
}

export interface UserSettingsResponse {
  id: string;
  userId: string;
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  emailNotif: boolean;
  pushNotif: boolean;
  smsNotif: boolean;
  categories: NotificationCategories;
  updatedAt: Date;
}

// Onboarding
export interface CompleteTourDto {
  tourKey: string;
}

export interface OnboardingStatusResponse {
  completedTours: string[];
}

// Course
export interface CreateCourseDto {
  creatorId: string; // staff id
  title: string;
  coverIcon: string;
  description?: string | null;
  isPublished?: boolean;
}
export interface TCourseResponse {
  id: string;
  creatorId: string;
  title: string;
  coverIcon: string;
  description?: string | null;
  isPublished: boolean;
  pendingNotificationType?: "created" | "updated" | null;
  lastNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotifyCourseUsersDto {
  roles?: Array<"TRAINEE" | "TESTER" | "CHO" | "TRAINER" | "STAFF" | "ADMIN">;
}

// Section
export interface CreateSectionDto {
  courseId: string;
  title: string;
  description?: string | null;
}
export interface TSectionResponse {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  totalChapter: number;
  createdAt: Date;
  updatedAt: Date;
}

// Chapter
export interface CreateChapterDto {
  sectionId: string;
  title: string;
  description?: string | null;
  chapterNumber?: number;
  activityAt?: number;
  lessonDuration?: number;
  isPublished?: boolean;
}
export interface TChapterResponse {
  id: string;
  sectionId: string;
  title: string;
  description?: string | null;
  totalSlide: number;
  chapterNumber: number;
  activityAt?: number | null;
  lessonDuration: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Slide
export interface CreateSlideDto {
  chapterId: string;
  note?: string | null;
  description?: string | null;
  slideNumber: number;
  file?: string | null;
  isPublished?: boolean;
}
export interface TSlideResponse {
  id: string;
  chapterId: string;
  note?: string | null;
  description?: string | null;
  slideNumber: number;
  file?: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// CourseIntro
export interface CreateCourseIntroDto {
  courseId: string;
  title: string;
  summary: string;
  bannerImage?: string | null;
  thumbnail: string;
}
export interface TCourseIntroResponse {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  bannerImage?: string | null;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tests
export interface CreatePreTestDto {
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished?: boolean;
}
export interface TPreTestResponse {
  id: string;
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMidTestDto {
  chapterId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
}
export interface TMidTestResponse {
  id: string;
  chapterId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFinalTestDto {
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished?: boolean;
}
export interface TFinalTestResponse {
  id: string;
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFinalExamDto {
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished?: boolean;
}
export interface TFinalExamResponse {
  id: string;
  courseId: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Questionnaire / Option / Answer
export interface CreateQuestionnaireDto {
  question: string;
  questionImage?: string | null;
  feedbackStatement?: string | null;
  allowMultiple?: boolean;
  courseId?: string | null;
  midTestId?: string | null;
}
export interface TQuestionnaireResponse {
  id: string;
  question: string;
  questionImage?: string | null;
  feedbackStatement?: string | null;
  allowMultiple: boolean;
  options: TOptionResponse[];
  answers: TAnswerResponse[];
  courseId?: string | null;
  midTestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOptionDto {
  label: string;
  image?: string | null;
  questionnaireId: string;
}
export interface TOptionResponse {
  id: string;
  label: string;
  image?: string | null;
  questionnaireId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnswerDto {
  label: string;
  image?: string | null;
  questionnaireId: string;
}
export interface TAnswerResponse {
  id: string;
  label: string;
  image?: string | null;
  questionnaireId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Super Course Creation DTOs - Complex nested structure
export interface SuperCourseOptionDto {
  label: string;
  image?: string;
}

export interface SuperCourseAnswerDto {
  label: string;
  image?: string;
}

export interface SuperCourseQuestionDto {
  question: string;
  questionImage?: string;
  feedbackStatement?: string;
  allowMultiple: boolean;
  options: SuperCourseOptionDto[];
  correctAnswer?: SuperCourseAnswerDto;
  correctAnswers?: number[];
  correctAnswerIndex?: number;
}

export interface SuperCourseActivityInstructionDto {
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
}

export interface SuperCourseActivityDto {
  instruction: SuperCourseActivityInstructionDto;
  questions: SuperCourseQuestionDto[];
}

export interface SuperCourseSlideDto {
  note?: string;
  description?: string;
  slideNumber: number;
  file?: string;
  isPublished?: boolean;
  isActivitySlide?: boolean;
  isPreTestSlide?: boolean;
  isFinalTestSlide?: boolean;
  activity?: SuperCourseActivityDto;
}

export interface SuperCourseChapterDto {
  title: string;
  description?: string;
  chapterNumber?: number;
  activityAt?: number;
  lessonDuration?: number;
  isPublished?: boolean;
  slides: SuperCourseSlideDto[];
  midTest?: {
    questionToBeAnswered: number;
    marksToPass: number;
    description?: string;
    questionnaires?: Array<{
      question: string;
      questionImage?: string;
      feedbackStatement?: string;
      allowMultiple: boolean;
      options: Array<{ label: string; image?: string }>;
      answers?: Array<{ label: string; image?: string }>;
    }>;
  } | null;
}

export interface SuperCourseSectionDto {
  title: string;
  description?: string;
  sectionNumber?: number;
  chapters: SuperCourseChapterDto[];
}

export interface SuperCourseCourseIntroDto {
  title: string;
  summary: string;
  bannerImage?: string;
  thumbnail: string;
}

export interface CreateSuperCourseDto {
  title: string;
  coverIcon: string;
  description?: string;
  isPublished?: boolean;
  courseIntro: SuperCourseCourseIntroDto;
  sections: SuperCourseSectionDto[];
  preTest?: {
    questionToBeAnswered: number;
    marksToPass: number;
    description?: string;
    isPublished?: boolean;
  };
  finalTest?: {
    questionToBeAnswered: number;
    marksToPass: number;
    description?: string;
    isPublished?: boolean;
  };
  finalExam?: {
    questionToBeAnswered: number;
    marksToPass: number;
    description?: string;
    isPublished?: boolean;
  };
  questionBank?: Array<{
    question: string;
    questionImage?: string;
    feedbackStatement?: string;
    allowMultiple: boolean;
    options: Array<{ label: string; image?: string }>;
    correctAnswer?: { label: string; image?: string };
    correctAnswers?: number[];
    correctAnswerIndex?: number;
  }>;
}

export interface UpdateSuperCourseDto extends CreateSuperCourseDto {
  courseId: string;
}

// Attempt Test
export interface CreateAttempTestDto {
  preTestId?: string | null;
  midTestId?: string | null;
  finalTestId?: string | null;
  finalExamId?: string | null;
  tryCount?: number;
  studentId?: string;
  questionAnswers?: Array<{
    questionnaireId: string;
    selectedAnswerIds: string[];
  }>;
}
export interface TAttempTestResponse {
  id: string;
  studentId: string;
  preTestId?: string | null;
  midTestId?: string | null;
  finalTestId?: string | null;
  finalExamId?: string | null;
  tryCount: number;
  marks: number;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAttemptAnswerDto {
  attemptId: string;
  questionnaireId: string;
  selectedAnswerIds: string[];
}
export interface TAttemptAnswerResponse {
  id: string;
  attemptId: string;
  questionnaireId: string;
  selectedAnswerIds: string[];
  isCorrect: boolean;
  marks: number;
  createdAt: Date;
  updatedAt: Date;
}

// Progress
export interface CreateCourseProgressDto {
  courseId: string;
  studentId: string;
  progress?: number;
  isCompleted: boolean;
}
export interface TCourseProgressResponse {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChapterProgressDto {
  studentId: string;
  chapterId: string;
  progress?: number;
  isCompleted: boolean;
}
export interface TChapterProgressResponse {
  id: string;
  studentId: string;
  chapterId: string;
  progress: number;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSlideProgressDto {
  slideId: string;
  isCompleted: boolean;
}
export interface TSlideProgressResponse {
  id: string;
  studentId: string;
  slideId: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Student Statistics
export interface StudentCourseStatistics {
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
}

export interface StudentStatisticsSummary {
  totalCourses: number;
  enrolledCourses: number;
  unenrolledCourses: number;
  completedCourses: number;
  startedCourses: number;
}

export interface TStudentStatisticsResponse {
  summary: StudentStatisticsSummary;
  courses: StudentCourseStatistics[];
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
}

// Slide-related
export interface CreateDocumentOnSlideDto {
  fileName: string;
  file: string;
  courseId: string;
}
export interface TDocumentOnSlideResponse {
  id: string;
  fileName: string;
  file: string;
  courseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFAQOnSlideDto {
  slideId: string;
  message: Express.Multer.File | string | null;
  isPublished?: boolean;
}
export interface TFAQOnSlideResponse {
  id: string;
  userId: string;
  slideId: string;
  message: Express.Multer.File | string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Feedback (same shape as FAQ but separate types)
export interface CreateFeedbackOnSlideDto {
  slideId: string;
  message: Express.Multer.File | string | null;
  isPublished?: boolean;
}
export interface TFeedbackOnSlideResponse {
  id: string;
  userId: string;
  slideId: string;
  message: Express.Multer.File | string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentOnSlideDto {
  studentId: string;
  slideId: string;
  progress?: number;
}
export interface TStudentOnSlideResponse {
  id: string;
  studentId: string;
  slideId: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

// Student / Staff
export interface CreateStudentDto {
  userId: string;
  role?: RoleType;
}
export interface TStudentResponse {
  id: string;
  userId: string;
  role: RoleType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffDto {
  userId: string;
  role?: RoleType;
}
export interface TStaffResponse {
  id: string;
  userId: string;
  role: RoleType;
  createdAt: Date;
  updatedAt: Date;
}

// System Review
export interface CategoryRating {
  category: string;
  id: string;
  label: string;
  rating: number;
}

export interface CreateSystemReviewDto {
  categoryRatings: CategoryRating[];
  feedback: string;
  overallRating: number;
  recommendation: "yes" | "no";
}

export interface TSystemReviewResponse {
  id: string;
  userId: string;
  categoryRatings: CategoryRating[];
  feedback: string;
  overallRating: number;
  recommendation: string;
  createdAt: Date;
  updatedAt: Date;
}

// Course Review
export interface CreateCourseReviewDto {
  courseId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
}
export interface TCourseReviewResponse {
  id: string;
  studentId: string;
  courseId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// Section Review
export interface CreateSectionReviewDto {
  sectionId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
}
export interface TSectionReviewResponse {
  id: string;
  studentId: string;
  sectionId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// Chapter Review
export interface CreateChapterReviewDto {
  chapterId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
}
export interface TChapterReviewResponse {
  id: string;
  studentId: string;
  chapterId: string;
  comment: string;
  categoryRatings: CategoryRating[];
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// Student interface for progress tracking
export interface IStudent {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  courses: string[];
  progress: string;
  createdAt: string;
  updatedAt: string;
}

// Dashboard Statistics
export interface RecentCourse {
  id: string;
  name: string;
  enrolled: number;
  rating: number;
}

export interface DashboardStatistics {
  totalCourses: number;
  unpublishedCourses: number;
  totalStudents: number;
  fiveRecentCourses: RecentCourse[];
}

export interface TDashboardStatisticsResponse {
  message: string;
  statusCode: number;
  data: DashboardStatistics;
}

export type CalendarEventType =
  | "TRAINING"
  | "REMINDER"
  | "DEADLINE"
  | "CUSTOM"
  | "WEBINAR"
  | "MEETING"
  | "SCREENING"
  | "DRILL";

export type CalendarFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export type MeetingType = "EBUMENYI_MEETING" | "GOOGLE_MEET" | "ZOOM" | "OTHER";

export type EventPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type CalendarAttendanceStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "COMPLETED";

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  type?: CalendarEventType;
  frequency?: CalendarFrequency;
  daysOfWeek?: number[];
  timezone?: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  reminderMinutesBefore?: number[] | number;
  recurrenceEndsAt?: string | null;
  meetingType?: MeetingType;
  location?: string;
  streamRoomId?: string | null;
  priority?: EventPriority;
  hostEmail?: string;
  participants?: {
    userId: string;
  }[];
  externalParticipants?: (
    | string
    | {
        email: string;
        name?: string | null;
      }
  )[];
  attachments?: { name?: string; originalName?: string; url: string }[];
}

export interface UpdateCalendarEventDto {
  title?: string;
  description?: string;
  type?: CalendarEventType;
  frequency?: CalendarFrequency;
  daysOfWeek?: number[];
  timezone?: string;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  reminderMinutesBefore?: number[] | number;
  recurrenceEndsAt?: string | null;
  meetingType?: MeetingType;
  location?: string | null;
  streamRoomId?: string | null;
  priority?: string;
  hostEmail?: string | null;
  participants?: {
    userId: string;
  }[];
  externalParticipants?: (
    | string
    | {
        email: string;
        name?: string | null;
      }
  )[];
  attachments?: { name?: string; originalName?: string; url: string }[];
}

export interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  frequency: CalendarFrequency;
  daysOfWeek: number[];
  timezone: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  reminderMinutesBefore: number[];
  recurrenceEndsAt: string | null;
  meetingType: MeetingType | null;
  location: string | null;
  streamRoomId: string | null;
  priority: EventPriority;
  hostEmail: string | null;
  createdById: string;
  isRepeating: boolean;
  commonId: string | null;
  isCancelled: boolean;
  amOwner: boolean;
  participants: Array<{
    id: string;
    userId: string;
    user:
      | {
          id: string;
          fullNames: string;
          email: string | null;
          phoneNumber: string;
        }
      | undefined;
  }>;
  externalParticipants: Array<{
    id: string;
    email: string;
    name: string | null;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Certificate interfaces
export interface CreateCertificateDto {
  studentId: string;
  courseId: string;
  pdf: string;
}

export interface TCertificateResponse {
  id: string;
  studentId: string;
  courseId: string;
  pdf: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCertificateDto {
  pdf?: string;
}

export interface CreateHospitalDto {
  name: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  contact?: string;
  email?: string;
  chwSupervisor?: string;
  chwSupervisorContact?: string;
  totalChws?: number;
  activeChws?: number;
  catchmentArea?: string[];
}

export interface UpdateHospitalDto extends Partial<CreateHospitalDto> {}
export interface HospitalResponse {
  id: string;
  name: string;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  contact?: string | null;
  email?: string | null;
  chwSupervisor?: string | null;
  chwSupervisorContact?: string | null;
  totalChws?: number | null;
  activeChws?: number | null;
  catchmentArea?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// Messaging interfaces
export type ConversationType = "direct" | "group" | "community";
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "blog";

export interface CreateConversationDto {
  type: ConversationType;
  name?: string;
  isPublic?: boolean;
  participantIds: string[]; // User IDs to add as participants
}

export interface UpdateConversationDto {
  name?: string;
  isPublic?: boolean;
}

export interface ConversationResponse {
  id: string;
  type: ConversationType;
  name?: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipantResponse[];
  lastMessage?: MessageResponse | null;
}

export interface ConversationParticipantResponse {
  id: string;
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    fullNames: string;
    email?: string | null;
  };
}

export interface CreateMessageDto {
  conversationId: string;
  type: MessageType;
  title?: string; // For blog posts
  content?: string; // Text content or blog body
  attachments?: string | null; // JSON string of media/files
}

export interface UpdateMessageDto {
  title?: string;
  content?: string;
  attachments?: string | null;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  title?: string | null;
  content?: string | null;
  attachments?: string | null;
  timestamp: Date;
  sender: {
    id: string;
    fullNames: string;
    email?: string | null;
  };
  readBy: MessageReadResponse[];
  likes: MessageLikeResponse[];
  comments: CommentResponse[];
}

export interface MessageReadResponse {
  id: string;
  userId: string;
  readAt: Date;
  user: {
    id: string;
    fullNames: string;
  };
}

export interface MessageLikeResponse {
  id: string;
  userId: string;
  likedAt: Date;
  user: {
    id: string;
    fullNames: string;
  };
}

export interface CreateCommentDto {
  messageId: string;
  text: string;
  parentId?: string; // For replies
}

export interface UpdateCommentDto {
  text: string;
}

export interface CommentResponse {
  id: string;
  messageId: string;
  userId: string;
  text: string;
  timestamp: Date;
  parentId?: string | null;
  user: {
    id: string;
    fullNames: string;
    email?: string | null;
  };
  replies: CommentResponse[];
}

export interface EditMessageDto {
  content: string;
  title?: string;
}

export interface AddParticipantDto {
  userId: string;
}

export interface UpdateConversationDto {
  name?: string;
  isPublic?: boolean;
}

export interface SearchMessagesResponse {
  messages: MessageResponse[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Announcements
export interface CreateAnnouncementDto {
  title: string;
  body: string;
  segment: string; // role name or 'all'
  category?: string;
  publishAt?: string;
  validUntil?: string | null;
  priority?: "high" | "medium" | "low";
  status?: "draft" | "published";
}

export interface UpdateAnnouncementDto {
  title?: string;
  body?: string;
  segment?: string;
  category?: string;
  publishAt?: string;
  /** @isString */
  validUntil?: string | null;
  priority?: "high" | "medium" | "low";
  status?: "draft" | "published";
}

export interface AnnouncementResponse {
  id: string;
  title: string;
  body: string;
  segment: string;
  category: string;
  priority?: string;
  status?: string;
  publishAt: string;
  validUntil: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
