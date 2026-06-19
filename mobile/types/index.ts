/* eslint-disable @typescript-eslint/array-type */
export interface IUserData {
  id: string;
  fullNames: string;
  email: string;
  phoneNumber: string | null;
  photo: string;
  NID: number | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  roles: string[];
}

export interface ILoginResponse {
  message: string;
  statusCode: number;
  data: IUserData;
}

export interface IStudentStatisticsResponse {
  message: string;
  statusCode: number;
  data: IStudentStatisticsData;
}

export interface IStudentStatisticsData {
  summary: IStudentStatisticsSummary;
  courses: IStudentCourse[];
  lastViewedLocation: ILastViewedLocation | null;
}

export interface IStudentStatisticsSummary {
  totalCourses: number;
  enrolledCourses: number;
  unenrolledCourses: number;
  completedCourses: number;
  startedCourses: number;
}

export interface IStudentCourse {
  courseId: string;
  title: string;
  coverIcon: string;
  description: string;
  totalChapters: number;
  totalTests: number;
  completedTests: number;
  courseDuration: number;
  isEnrolled: boolean;
  isStarted: boolean;
  isCompleted: boolean;
  isStudentReviewedCourse: boolean;
  enrollmentDate: string | null;
  completedAt: string | null;
  progress: number;
  createdAt: string;
}

export interface ILastViewedLocation {
  courseId: string;
  courseTitle: string;
  coverIcon: string;
  sectionId: string;
  sectionTitle: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  slideId: string;
  lastViewedAt: string;
}

export interface ICourseResponse {
  message: string;
  statusCode: number;
  data: ICourse[];
}

export interface IOneCourseResponse {
  message: string;
  statusCode: number;
  data: ICourse;
}

// ===== Course Level =====
export interface ICourse {
  id: string;
  creatorId: string;
  title: string;
  coverIcon: string;
  description: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  staff: IStaff;
  sections: ISection[];
  intro: ICourseIntro;
  progresses: IProgress[];
  preTests: ITest[];
  finalTest: ITest[];
  finalExam: ITest[];
  questionnaires: IQuestionnaire[];
}

// ===== Staff & User =====
export interface IStaff {
  id: string;
  userId: string;
  role: string;
  user: IUser;
}

export interface IResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
}

export interface IPaged<T> {
  data: T;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface IUser {
  id: string;
  email: string | null;
  password?: string;
  fullNames: string;
  phoneNumber: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID: string;
  gender: string;
  birthdate: string | null;
  createdAt: string;
  updatedAt: string;
  otp: string | null;
  otpExpiresAt: string | null;
  photo: string;
  video: string | null;
  audio: string | null;
  bio: string | null;
  industry: string | null;
  hospital: IHospital | null;
  userRoles: IRoles[];
}

export interface IHospital {
  id: string;
  name: string;
  location: string;
  contact?: string;
  chwSupervisor?: string;
  chwSupervisorContact?: string;
  totalChws: number;
  activeChws: number;
  districtsCovered: string[];
  email?: string;
  website?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IRoles {
  id: string;
  userId: string;
  name: string;
}

// ===== Course Intro =====
export interface ICourseIntro {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  bannerImage: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Section Level =====
export interface ISection {
  id: string;
  courseId: string;
  title: string;
  description: string;
  totalChapter: number;
  createdAt: string;
  updatedAt: string;
  chapters: IChapter[];
}

// ===== Chapter Level =====
export interface IChapter {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  totalSlide: number;
  chapterNumber: number;
  activityAt: number;
  lessonDuration: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  slides: ISlide[];
  midTest: IMidTest;
}

// ===== Slides =====
export interface ISlide {
  id: string;
  chapterId: string;
  note: string;
  description: string;
  slideNumber: number;
  file: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Tests =====
export interface ITest {
  id: string;
  courseId: string;
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
  course: ICourse;
}

export interface IMidTest {
  id: string;
  chapterId: string;
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
  questionnaires: IQuestionnaire[];
}

// ===== Questionnaire =====
export interface IQuestionnaire {
  id: string;
  question: string;
  questionImage: string;
  feedbackStatement: string;
  allowMultiple: boolean;
  preTestId: string | null;
  midTestId: string | null;
  finalTestId: string | null;
  finalExamId: string | null;
  createdAt: string;
  updatedAt: string;
  options: IOption[];
  answers: IAnswer[];
}

// ===== Options =====
export interface IOption {
  id: string;
  label: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  questionnaireId: string;
}

export interface IAnswer {
  id: string;
  label: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  questionnaireId: string;
}

// ===== Progress =====
export interface IProgress {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ITestResponse {
  message: string;
  statusCode: number;
  data: ITest;
}

// Attempt Test
export interface CreateAttempTestDto {
  preTestId?: string | null;
  midTestId?: string | null;
  finalTestId?: string | null;
  finalExamId?: string | null;
  tryCount?: number;
  studentId?: string;
  questionAnswers?: {
    questionnaireId: string;
    selectedAnswerIds: string[];
  }[];
}
export interface TAttempTestResponse {
  id: string;
  studentId: string;
  preTestId: string | null;
  midTestId: string | null;
  finalTestId: string | null;
  finalExamId: string | null;
  tryCount: number;
  marks: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  attemptAnswers: IAttemptAnswer[];
  testInfo: ITestInfo;
}

export interface IAttemptAnswerResult {
  id: string;
  attemptId: string;
  questionnaireId: string;
  selectedAnswerIds: string[];
  isCorrect: boolean;
  marks: number;
  createdAt: string;
  updatedAt: string;
  selectedOptionLabels: string[];
  correctAnswerLabels: string[];
  questionnaire: IQuestionnaire;
}

export interface IQuestionnaireResult {
  id: string;
  question: string;
}

export interface ITestInfo {
  id: string;
  courseId: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
}

export interface IChapterResponse {
  message: string;
  statusCode: number;
  data: IChapter;
}

export interface IAttemptAnswer {
  id: string;
  attemptId: string;
  questionnaireId: string;
  selectedAnswerIds: string[];
  isCorrect: boolean;
  marks: number;
  createdAt: string;
  updatedAt: string;
  correctAnswerIds: string[];
}

export interface IAttempt {
  id: string;
  studentId: string;
  preTestId: string | null;
  midTestId: string | null;
  finalTestId: string | null;
  finalExamId: string | null;
  tryCount: number;
  marks: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  attemptAnswers: IAttemptAnswer[];
}

export interface IAttemptsResponse {
  message: string;
  statusCode: number;
  data: IAttempt[];
}

export interface IProgressResponse {
  message: string;
  statusCode: number;
  data: {
    chapterProgress: IChapterProgress[];
    completedSlideIds?: string[];
    finalTestStatus: IFinalTestStatus;
    finalExamStatus: IFinalExamStatus;
    preTestStatus: IPreTestStatus;
  };
}

export interface IChapterProgress {
  id: string;
  studentId: string;
  chapterId: string;
  progress: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  chapter: IChapter;
}

export interface IFinalTestStatus {
  attempted: boolean;
  passed: boolean;
  bestMarks: number;
  marksToPass: number;
  finalTestId: string;
}

export interface IFinalExamStatus {
  attempted: boolean;
  passed: boolean;
  bestMarks: number;
  marksToPass: number;
  finalExamId: string;
}

export interface IPreTestStatus {
  attempted: boolean;
  passed: boolean;
  bestMarks: number;
  marksToPass: number;
  preTestId: string;
}
export interface CreateCourseReviewDto {
  courseId: string;
  comment: string;
  rating: number;
  categoryRatings: SystemReviewCriteria[];
}

export interface CreateSectionReviewDto {
  sectionId: string;
  comment: string;
  rating: number;
  categoryRatings: SystemReviewCriteria[];
}

export interface TCourseReviewResponse {
  id: string;
  studentId: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TSectionReviewResponse {
  id: string;
  studentId: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChapterReviewDto {
  chapterId: string;
  comment: string;
  rating: number;
  categoryRatings: SystemReviewCriteria[];
}

export interface TChapterReviewResponse {
  id: string;
  studentId: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interface for items returned by GET /chapter-reviews/my-reviews
export interface IMyChapterReviewItem {
  id: string;
  studentId: string;
  chapterId: string;
  comment: string | null;
  reviewCriteria: string[];
  rating: number;
  createdAt: string;
  updatedAt: string;
  student?: any;
  chapter?: {
    id: string;
    title: string;
    chapterNumber?: number;
  };
}

export interface IMyChapterReviewsResponse {
  message: string;
  statusCode: number;
  data: IMyChapterReviewItem[];
}
export interface CreateSystemReviewDto {
  overallRating: number;
  categoryRatings: SystemReviewCriteria[];
  feedback: string;
  recommendation: 'yes' | 'no';
}

export interface SystemReviewCriteria {
  id: string;
  category: string;
  label: string;
  rating: number;
}

export interface TSystemReviewResponse {
  id: string;
  studentId: string;
  overallRating: number;
  categoryRatings: SystemReviewCriteria[];
  feedback: string;
  recommendation: 'yes' | 'no';
  createdAt: string;
  updatedAt: string;
}

// Documents API
export interface IDocumentItem {
  id: string;
  fileName: string;
  file: string; // URL to the file (pdf, doc, etc.)
  courseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDocumentsByCourseResponse {
  message: string;
  statusCode: number;
  data: IDocumentItem[];
}

// Students by course API
export interface IStudentByCourseItem {
  studentId: string;
  userId: string;
  fullNames: string;
  avatar: string;
  phoneNumber?: string | null;
  district?: string | null;
  sector?: string | null;
  bio?: string | null;
  video?: string | null;
  Audio?: string | null;
  progress?: number;
  isCompleted?: boolean;
  enrollmentDate?: string | null;
}

export interface IStudentsByCourseResponse {
  message: string;
  statusCode: number;
  data: IStudentByCourseItem[];
}

export interface CreateFaqDto {
  slideId: string;
  message: string | any;
  isPublished?: boolean;
}

export interface CreateFeedbackDto {
  slideId: string;
  message: string | any;
  isPublished?: boolean;
}

export interface CreateCoursePerformanceFeedbackDto {
  courseId: string;
  performanceType: 'pass' | 'fail';
  message: string;
  isPublished?: boolean;
}

// ─── CHO Group System ─────────────────────────────────────────────────────────

export interface ICHOGroup {
  id: string;
  name: string;
  sector?: string | null;
  description?: string | null;
  choId: string;
  groupChatId?: string | null;
  createdAt: string;
  updatedAt: string;
  cho?: {
    id: string;
    user: {
      id: string;
      fullNames: string;
      photo: string | null;
      phoneNumber: string | null;
    };
  };
  _count?: {
    members: number;
  };
}

export interface ICHOGroupMember {
  id: string;
  groupId: string;
  studentId: string;
  joinedAt: string;
  student: {
    id: string;
    user: {
      id: string;
      fullNames: string;
      photo: string | null;
      phoneNumber: string | null;
      district?: string | null;
      sector?: string | null;
      cell?: string | null;
      village?: string | null;
    };
  };
}

export interface ICHOGroupInvitation {
  id: string;
  groupId: string;
  studentId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  invitedAt: string;
  respondedAt: string | null;
  group?: {
    id: string;
    name: string;
    cho?: {
      user: {
        id: string;
        fullNames: string;
        photo: string | null;
        phoneNumber: string | null;
      };
    };
  };
  student?: {
    user: {
      id: string;
      fullNames: string;
      photo: string | null;
      phoneNumber: string | null;
    };
  };
}

export interface ICHOGroupMonitoringMember {
  studentId: string;
  user: {
    id: string;
    fullNames: string;
    photo: string | null;
    phoneNumber: string | null;
  };
  status: string;
  joinedGroupAt: string;
  courseProgress: Array<{
    courseId: string;
    courseTitle: string;
    progress: number;
    isCompleted: boolean;
  }>;
  recentTestAttempts: Array<{
    id: string;
    marks: number;
    isCompleted: boolean;
    tryCount: number;
    updatedAt: string;
  }>;
}

export interface ICHOGroupMonitoring {
  groupId: string;
  groupName: string;
  totalMembers: number;
  members: ICHOGroupMonitoringMember[];
}

export interface IStudentSearchResult {
  id: string;
  userId: string;
  status: string;
  groupMembership?: { id: string } | null;
  pendingInvitation?: { id: string } | null;
  user: {
    id: string;
    fullNames: string;
    photo: string | null;
    phoneNumber: string | null;
    district?: string | null;
    sector?: string | null;
  };
}

export interface CoursePerformanceFeedbackItem {
  id: string;
  courseId: string;
  performanceType: 'pass' | 'fail';
  message: string;
  trainerId: string;
  trainerName: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetCoursePerformanceFeedbackResponse {
  message: string;
  statusCode: number;
  data: CoursePerformanceFeedbackItem[];
}
export interface FaqItem {
  id: string;
  userId: string;
  userFullName: string;
  avatar?: string | null;
  slideId?: string | null;
  message: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  isMine?: boolean;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userFullName: string;
  avatar?: string | null;
  slideId?: string | null;
  message: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  isMine?: boolean;
}

export interface GetFaqsResponse {
  message: string;
  statusCode: number;
  data: FaqItem[];
}

export interface GetFeedbackResponse {
  message: string;
  statusCode: number;
  data: FeedbackItem[];
}
// Interface for items returned by GET /section-reviews/my-reviews
export interface IMySectionReviewItem {
  id: string;
  studentId: string;
  sectionId: string;
  comment: string | null;
  reviewCriteria: string[];
  rating: number;
  createdAt: string;
  updatedAt: string;
  student?: any;
  section?: {
    id: string;
    title: string;
  };
}

export interface IMySectionReviewsResponse {
  message: string;
  statusCode: number;
  data: IMySectionReviewItem[];
}

export type EventType = 'TRAINING' | 'REMINDER' | 'DEADLINE' | string;
// Uppercase values matching the backend API enum
export type EventFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ICalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: EventType;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  frequency: EventFrequency;
  daysOfWeek?: number[];
  recurrenceEndsAt?: string | null; // ISO string from API
  reminderMinutesBefore?: number[]; // API always returns array
  timezone?: string;
  meetingType?: string | null;
  location?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  hostEmail?: string | null;
  createdById?: string;
  participants?: {
    id: string;
    userId: string;
    user?: {
      id: string;
      fullNames: string;
      email?: string | null;
      phoneNumber: string;
    } | null;
  }[];
  externalParticipants?: {
    id: string;
    email: string;
    name?: string | null;
  }[];
  attachments?: {
    id: string;
    name: string;
    url: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateCalendarEventRequest {
  title: string;
  description?: string;
  type: EventType; // e.g. 'TRAINING'
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  frequency: EventFrequency; // e.g. 'NONE', 'DAILY', 'WEEKLY'
  daysOfWeek: number[]; // required when frequency === 'WEEKLY'
  recurrenceEndsAt?: Date; // required when frequency !== 'NONE'
  reminderMinutesBefore: number[]; // always array, e.g. [30]
  location?: string;
  timezone?: string; // defaults to 'Africa/Kigali' on server
  meetingType?: string; // defaults to 'OTHER' for mobile
  priority?: string; // defaults to 'MEDIUM' on server
}

// Certificate types
export interface ICertificate {
  id: string;
  studentId: string;
  courseId: string;
  pdf: string;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    title: string;
    coverIcon: string;
    description: string;
  };
}

export interface ICertificateResponse {
  message: string;
  statusCode: number;
  data: ICertificate;
}

export interface ICertificateListItem {
  id: string;
  title: string;
  image: string;
  courseId: string;
  progress: number;
  enrollmentDate: string;
  completedAt: string;
  slides: number;
  attempt: number;
  test: number;
  finalExamMarks: number;
  pdf: string;
}

export interface ICertificateListResponse {
  message: string;
  statusCode: number;
  data: ICertificateListItem[];
}

export type PostCourseRecommendationReason =
  | 'no_attempt'
  | 'below_pass'
  | 'barely_passed'
  | 'fast_pace_review'
  | 'incomplete_slides';

export type PostCourseRecommendationSeverity = 'high' | 'moderate' | 'low';

export interface IPostCourseRecommendationChapter {
  chapterId: string;
  sectionId: string;
  chapterTitle: string;
  chapterNumber: number;
  midTestId: string | null;
  bestMarks: number | null;
  marksToPass: number | null;
  attemptCount: number;
  reasons: PostCourseRecommendationReason[];
  severity: PostCourseRecommendationSeverity;
}

export interface IPostCourseRecommendationsData {
  courseId: string;
  courseTitle: string;
  completedQuickly: boolean;
  expectedLessonMinutes: number;
  elapsedHours: number | null;
  summaryMessageRw: string;
  chapters: IPostCourseRecommendationChapter[];
}

export interface IPostCourseRecommendationsResponse {
  message: string;
  statusCode: number;
  data: IPostCourseRecommendationsData;
}

export interface INotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: {
    location?: string;
    eventType?: string;
    startTime?: string;
    meetingType?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface INotificationResponse {
  statusCode: number;
  message: string;
  data: INotification[];
}

export interface ICommentThread {
  id: string;
  messageId: string;
  userId: string;
  text: string;
  timestamp: string;
  parentId?: string | null;
  user?: ICommentUser;
  replies?: ICommentThread[];
}

export interface ICommentUser {
  id: string;
  fullNames: string;
  photo?: string;
}

export type ConversationType = 'direct' | 'group' | 'community';

export interface IConversationParticipant {
  conversationId: string;
  userId: string;
  joinedAt: string;
  user?: IUser;
}

export interface IConversation {
  id: string;
  type: ConversationType;
  name?: string | null;
  displayName?: string | null;
  photo?: string | null; // Direct photo field from backend
  displayPhoto?: string | null; // Legacy field
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageId?: string | null;
  lastMessageSender?: 'me' | 'other' | null;
  unreadCount?: number;
  isDelivered?: boolean;
  isRead?: boolean;
  participants: IConversationParticipant[];
  lastMessage?: IMessage | null;
}

export interface IParticipant {
  id: string;
  name: string;
  photo?: string;
  role: UserRole;
  isOnline: boolean;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ISender;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'blog';
  title?: string;
  content?: string;
  attachments?: IAttachment[] | null;
  timestamp: string;
  editedAt?: string | null;
  isEdited?: boolean;
  isDelivered?: boolean;
  isRead?: boolean;
  readBy?: IReadBy[];
  likes?: number;
  likedBy?: string[];
  comments?: ICommentThread[];
}

export interface IReadBy {
  userId: string;
  readAt: string;
}

export interface IAttachment {
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name?: string;
}

export interface ISender {
  id: string;
  fullNames: string;
  photo?: string;
}

export type UserRole = 'ADMIN' | 'TRAINER' | 'TRAINEE' | 'TESTER' | 'DEVELOPER';
