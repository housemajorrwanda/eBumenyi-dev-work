/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactElement } from "react";

export type UserRole =
  | "ADMIN"
  | "TRAINER"
  | "TRAINEE"
  | "TESTER"
  | "DEVELOPER"
  | "CEHO"
  | "STAFF";
export type UserIndustry = "WELTEL" | "RBC" | "SFH" | "CIIC-HIN";
export type Permission = "ALL" | "DEFAULT";

export interface User {
  id: string;
  fullNames: string;
  email: string;
  phoneNumber?: string;
  roles: UserRole | UserRole[];
  permissions: string[];
  photo?: string;
  industry?: UserIndustry;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface IPasswordLogin {
  email: string;
  password: string;
}

export interface ISignup {
  email: string;
  fullNames: string;
  phoneNumber: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  NID?: string;
  birthdate?: string;
  gender?: string;
}

export interface UserData {
  token: string;
  fullNames: string;
  email: string;
  phoneNumber: string;
  id: string;
  roles: string[];
  photo: string;
}

export interface LoginResponse {
  message: string;
  statusCode: number;
  data: UserData;
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

export interface SidebarLinkProps {
  text: string;
  Icon: ReactElement;
  to: string;
  roles?: UserRole[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  actionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface ICourseFake {
  id: string;
  creatorId: string;
  title: string;
  rating: number;
  coverImage: string;
  description: string;
  isPublished: boolean;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: number; // in hours
  enrolledCount: number;
  createdAt: string;
  updatedAt: string;
  trainer?: ITrainer;
  modules: IModule[];
  students: IStudent[];
}

export interface IModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  duration: number;
  lessons: ILesson[];
  createdAt: string;
}

export interface ILesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  type: "video" | "document" | "quiz" | "assignment";
  duration: number;
  order: number;
  videoUrl?: string;
  documentUrl?: string;
  createdAt: string;
}

export interface IStudent {
  id: string;
  userId: string;
  fullNames: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  photo?: string;
  enrolledCourses: number;
  completedCourses: number;
  progress: number;
  isActive: boolean;
  joinedDate: string;
}

export interface ITrainer {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  photo?: string;
  specialization: string;
  coursesCreated: number;
  totalStudents: number;
  rating: number;
  bio?: string;
  isActive: boolean;
  joinedDate: string;
}

// export interface IStaff {
//   id: string;
//   userId: string;
//   firstName: string;
//   lastName: string;
//   email: string;
//   phoneNumber: string;
//   photo?: string;
//   position: string;
//   department: string;
//   role: UserRole;
//   isActive: boolean;
//   joinedDate: string;
// }

export interface IStaff {
  id: string;
  userId: string;
  role: string;
  user: IUser;
}

export interface IHospital {
  id: string;
  name: string;
  province: string;
  district: string;
  sector: string;
  cell?: string;
  village?: string;
  contact?: string;
  chwSupervisor?: string;
  chwSupervisorContact?: string;
  totalChws: number;
  activeChws: number;
  catchmentArea: string[];
  email?: string;
  website?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IProgress {
  id: string;
  studentId: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  completedPercentage: number;
  lastAccessedAt: Date;
  completedAt?: Date;
}

export interface IAnalytics {
  totalStudents: number;
  totalCourses: number;
  totalTrainers: number;
  activeUsers: number;
  completionRate: number;
  averageProgress: number;
  newEnrollmentsThisMonth: number;
  coursesCompletedThisMonth: number;
  recentActivities: IActivity[];
  popularCourses: ICourse[];
  performanceMetrics: IPerformanceMetric[];
}

export interface IActivity {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  action: string;
  description: string;
  timestamp: Date;
  type: "enrollment" | "completion" | "login" | "course_created" | "feedback";
}

export interface IPerformanceMetric {
  label: string;
  value: number;
  change: number; // percentage change
  trend: "up" | "down" | "stable";
}

export interface IComment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  createdAt: Date;
  replies?: IComment[];
}

export interface ISender {
  id: string;
  fullNames: string;
  photo?: string;
}

export interface IReadBy {
  userId: string;
  readAt: string;
}

export interface ICommentUser {
  id: string;
  fullNames: string;
  photo?: string;
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

export interface IAttachment {
  url: string;
  type: "image" | "video" | "audio" | "file";
  name?: string;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ISender;
  type: "text" | "image" | "video" | "audio" | "file" | "blog";
  title?: string;
  content?: string;
  attachments?: IAttachment[] | null;
  timestamp: string;
  editedAt?: string | null;
  isEdited?: boolean;
  readBy?: IReadBy[];
  likes?: number;
  isLikedByMe?: boolean;
  comments?: ICommentThread[];
  /** Only present on search results — this message's 0-based position under the
   * conversation's normal newest-first pagination, used to jump to the page that
   * contains it. */
  offsetInConversation?: number;
}

export type ConversationType = "direct" | "group" | "community";

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
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageId?: string | null;
  participants: IConversationParticipant[];
  lastMessage?: IMessage | null;
  muted?: boolean;
  createdById?: string;
  photo?: string | null;
}

export interface IParticipant {
  id: string;
  name: string;
  photo?: string;
  role: UserRole;
  isOnline: boolean;
}

export interface IGroup {
  id: string;
  type: "group";
  name: string;
  description?: string;
  isPublic: boolean;
  participants: IConversationParticipant[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── CEHO Group ────────────────────────────────────────────────────────────────

export interface ICEHOGroup {
  id: string;
  name: string;
  district?: string | null;
  sectors?: string[];
  cells?: string[];
  villages?: string[];
  cell?: string | null;
  village?: string | null;
  description?: string | null;
  cehoId: string;
  createdAt: string;
  updatedAt: string;
  ceho?: {
    id: string;
    user: { id: string; fullNames: string; photo: string | null; phoneNumber: string | null };
  };
  _count?: { members: number };
}

export interface ICEHOGroupMember {
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
    };
  };
}

export interface ICEHOGroupInvitation {
  id: string;
  groupId: string;
  studentId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  invitedAt: string;
  respondedAt: string | null;
  group?: {
    id: string;
    name: string;
    ceho?: { user: { id: string; fullNames: string; photo: string | null; phoneNumber: string | null } };
  };
  student?: { user: { id: string; fullNames: string; photo: string | null; phoneNumber: string | null } };
}

export interface ICEHOGroupMonitoringMember {
  studentId: string;
  user: { id: string; fullNames: string; photo: string | null; phoneNumber: string | null };
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

export interface ICEHOGroupMonitoring {
  groupId: string;
  groupName: string;
  totalMembers: number;
  members: ICEHOGroupMonitoringMember[];
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

export interface ICommunity {
  id: string;
  type: "community";
  name: string;
  description?: string;
  isPublic: boolean;
  participants: IConversationParticipant[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface IMeeting {
  id: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  participants: IParticipant[];
  scheduledAt: Date;
  duration: number; // in minutes
  meetingUrl: string;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  courseId?: string;
  createdAt: Date;
}

export interface IFeedback {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  actionUrl?: string;
  createdAt: Date;
  entityType?: string;
  entityId?: string;
}

export interface IDashboardStatsResponse {
  message: string;
  statusCode: number;
  data: IDashboardStats;
}

export interface IDashboardStats {
  totalCourses: IStatWithTrend<number>;
  unpublishedCourses: IStatWithTrend<number>;
  totalStudents: IStatWithTrend<number>;
  totalTrainers: IStatWithTrend<number>;
  totalStaff: IStatWithTrend<number>;
  activeUsers: IStatWithTrend<number>;
  completionRate: IStatWithTrend<number>;
  newEnrollments: number;

  fiveRecentCourses: IFiveRecentCourse[];
  threePopularCourses: IPopularCourse[];
  recentActivities: IRecentActivity[];
}

export interface IStatWithTrend<T> {
  value: T;
  trend: {
    value: number;
    direction: "up" | "down" | "stable";
  };
}

export interface IFiveRecentCourse {
  id: string;
  name: string;
  enrolled: number;
  rating: number;
}

export interface IPopularCourse {
  id: string;
  title: string;
  studentsEnrolled: number;
  status: string;
  rating: number;
}

export interface IRecentActivity {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  action: string;
  description: string;
  timestamp: string; // ISO date
  type: "enrollment" | "completion" | string;
}

export interface ISettings {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: "public" | "private" | "connections";
    showEmail: boolean;
    showPhone: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    theme: "light" | "dark" | "auto";
  };
}

export interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

export interface ICourse {
  id: string;
  creatorId: string;
  title: string;
  rating: number;
  coverIcon: string;
  description: string;
  isPublished: boolean;
  pendingNotificationType?: 'created' | 'updated' | null;
  lastNotifiedAt?: string | null;
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

export interface IUser {
  id: string;
  email: string;
  password: string;
  fullNames: string;
  phoneNumber: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID: string | null;
  gender: string | null;
  birthdate: string | null;
  createdAt: string;
  updatedAt: string;
  otp: string | null;
  otpExpiresAt: string | null;
  photo: string;
  hospitalId?: string | null;
}

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

export interface IProgress {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISection {
  id: string;
  courseId: string;
  title: string;
  description: string;
  totalChapter: number;
  sectionNumber: number;
  createdAt: string;
  updatedAt: string;
  chapters: IChapter[];
}

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

export interface ITest {
  id: string;
  courseId: string;
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
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
export interface IQuestionnaire {
  id: string;
  question: string;
  questionImage: string;
  feedbackStatement: string;
  allowMultiple: boolean;
  courseId: string | null;
  midTestId: string | null;
  createdAt: string;
  updatedAt: string;
  answers: IAnswer[];
  options: IOption[];
}

export interface IAnswer {
  id: string;
  label: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  questionnaireId: string;
}

export interface IOption {
  id: string;
  label: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  questionnaireId: string;
}

export interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

// / Slide Feedback Types
export interface ISlideFeedback {
  id: string;
  userId: string;
  slideId: string;
  message: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  slide: {
    id: string;
    chapterId: string;
    note: string;
    slideNumber: number;
    chapter: {
      id: string;
      title: string;
      section: {
        id: string;
        title: string;
        course: {
          id: string;
          title: string;
        };
      };
    };
  };
  user: {
    id: string;
    fullNames: string;
    photo: string;
  };
}

// Chapter Review Types
export interface ICategoryRating {
  id: string;
  category: string;
  categoryId: string;
  label: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface IChapterReview {
  id: string;
  studentId: string;
  chapterId: string;
  comment: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    user: {
      id: string;
      fullNames: string;
      photo: string;
    };
  };
  chapter: {
    id: string;
    title: string;
  };
  categoryRatings: ICategoryRating[];
}

// Section Review Types
export interface ISectionReview {
  id: string;
  studentId: string;
  sectionId: string;
  comment: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    user: {
      id: string;
      fullNames: string;
      photo: string;
    };
  };
  section: {
    id: string;
    title: string;
  };
  categoryRatings: ICategoryRating[];
}

// Course Review Types
export interface ICourseReview {
  id: string;
  studentId: string;
  courseId: string;
  comment: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    user: {
      id: string;
      fullNames: string;
      photo: string;
    };
  };
  course: {
    id: string;
    title: string;
    coverIcon: string;
  };
  categoryRatings: ICategoryRating[];
}

// System Review Types
export interface ISystemReview {
  id: string;
  userId: string;
  feedback: string;
  overallRating: number;
  recommendation: string;
  createdAt: string;
  updatedAt: string;
  categoryRatings: ICategoryRating[];
  user: {
    id: string;
    fullNames: string;
    photo: string;
  };
}

export interface ICourseAnalyticsResponse {
  message: string;
  statusCode: number;
  data: ICourseAnalytics;
}

export interface ICourseAnalytics {
  totalCourses: IStatWithTrend<number>;
  activeEnrollments: IStatWithTrend<number>;
  avgCompletionRate: IStatWithTrend<number>;
  certificatesIssued: IStatWithTrend<number>;

  enrollmentTrends: IEnrollmentTrend[];
  topPerformingCourses: ICoursePerformance[];
  coursePerformanceMetrics: ICoursePerformance[];

  totalStudentsEnrolled: number;
  averageStudentsPerCourse: number;
  mostPopularCourse: ICoursePerformance;
}

export interface IStatWithTrend<T> {
  value: T;
  trend: {
    value: number;
    direction: "up" | "down" | "stable";
  };
}

export interface IEnrollmentTrend {
  month: string; // e.g. "Oct 2025"
  enrollments: number;
}

export interface ICoursePerformance {
  id: string;
  name: string;
  completion: number; // % completion
  students: number; // total students
  enrolled: number; // enrolled count
  inProgress: number;
  completed: number;
  rate: number; // completion rate
  certified: number; // certificates issued for this course
}

export interface IStudentAnalyticsResponse {
  message: string;
  statusCode: number;
  data: IStudentAnalytics;
}

export interface IAvgStudyTimeByCourse {
  courseId: string;
  courseTitle: string;
  avgHours: number;
  source: "live" | "estimated";
  activeStudents: number;
}

export interface IStudentAnalytics {
  totalStudents: IStatWithTrend<number>;
  activeStudents: IStatWithTrend<number>;
  onLeaveStudents: IStatWithTrend<number>;
  avgStudyTime: IStatWithTrend<number> & { unit: string; isEstimate: boolean };
  avgStudyTimeByCourse: IAvgStudyTimeByCourse[];
  completionRate: IStatWithTrend<number> & { unit: string };

  performanceDistribution: IPerformanceDistribution;

  topPerformers: ITopPerformer[];
  mostActiveLearners: IActiveLearner[];
  recentActivity: IRecentStudentActivity[];
  engagementTrends: IEngagementTrend[];

  activeStudentPercentage: number;
  averageCoursesPerStudent: number;
}

export interface IStatWithTrend<T> {
  value: T;
  trend: {
    value: number;
    direction: "up" | "down" | "stable";
  };
}

export interface IPerformanceDistribution {
  excellent: IPerformanceCategory;
  good: IPerformanceCategory;
  average: IPerformanceCategory;
  poor: IPerformanceCategory;
  failing: IPerformanceCategory;
}

export interface IPerformanceCategory {
  range: string; // e.g. "90-100%"
  count: number;
  percentage: number;
}

export interface ITopPerformer {
  id: string;
  name: string;
  photo: string;
  completedCourses: number;
  avgScore: number;
  certificates: number;
  district: string;
  sector: string;
}

export interface IActiveLearner {
  id: string;
  name: string;
  photo: string;
  studyHours: number;
  activeCourses: number;
  lastActive: string; // ISO date
  totalActivity: number;
  district: string;
  sector: string;
}

export interface IRecentStudentActivity {
  id: string;
  studentName: string;
  studentPhoto: string;
  courseName: string;
  progress: number;
  lastActivity: string; // ISO timestamp
  status: string; // e.g. "Active" | "Completed"
  district: string;
  sector: string;
}

export interface IEngagementTrend {
  date: string; // "Nov 25"
  activity: number;
}

// Types based on your API response
export interface StudentInfo {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  NID: string;
  gender: string;
  photo: string;
  status: string;
  role: string;
  hospitalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrolledCourse {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseCoverIcon: string;
  courseRating: number;
  isPublished: boolean;
  progress: string;
  isCompleted: boolean;
  enrollmentDate: string;
  lastUpdated: string;
}

export interface CourseProgress {
  totalCoursesEnrolled: number;
  overallProgress: string;
  enrolledCourses: EnrolledCourse[];
}

export interface TestAttempt {
  attemptId: string;
  testType: string;
  testInfo: {
    id: string;
    description: string;
    questionToBeAnswered: number;
    marksToPass: number;
    course: string;
  };
  tryCount: number;
  totalMarks: number;
  isCompleted: boolean;
  isPassed: boolean;
  questionsAnswered: number;
  correctAnswers: number;
  accuracyPercentage: number;
  attemptDate: string;
  lastUpdated: string;
  questionsWithAnswers?: QuestionWithAnswer[];
}

export interface QuestionWithAnswer {
  questionId: string;
  question: string;
  questionImage: string;
  feedbackStatement: string;
  allowMultiple: boolean;
  availableOptions: AnswerOption[];
  correctAnswers: AnswerOption[];
  studentSelectedAnswers: string[];
  isCorrect: boolean;
  marksAwarded: number;
  answeredAt: string;
}

export interface AnswerOption {
  id: string;
  label: string;
  image: string;
}

export interface TestAttempts {
  totalAttempts: number;
  completedAttempts: number;
  passedAttempts: number;
  failedAttempts: number;
  averageScore: number;
  successRate: number;
  attemptsByType: {
    preTests: number;
    midTests: number;
    finalTests: number;
    finalExams: number;
  };
  detailedAttempts: DetailedTestAttempt[];
}

export interface DetailedTestAttempt extends TestAttempt {
  questionsWithAnswers?: QuestionWithAnswer[];
}

export interface Analytics {
  studyTimeEstimate: number;
  learningPath: string;
  strongAreas: string[];
  improvementAreas: string[];
}

export interface Review {
  reviewId: string;
  rating: number;
  comment: string;
  reviewDate: string;
  categoryRatings: {
    ratingId: string;
    category: string;
    rating: number;
  }[];
}

export interface FeedbackAnalytics {
  totalFeedbacksGiven: number;
  averageRatingGiven: number;
  engagementLevel: number;
}

export interface StudentData {
  studentInfo: StudentInfo;
  courseProgress: CourseProgress;
  testAttempts: TestAttempts;
  analytics: Analytics;
  feedbacksAndReviews: {
    slideFeedbacks?: {
      totalFeedbacks: number;
      feedbackDetails: any[];
    };
    chapterReviews?: {
      totalReviews: number;
      reviewDetails: any[];
    };
    sectionReviews?: {
      totalReviews: number;
      reviewDetails: any[];
    };
    courseReviews?: {
      totalReviews: number;
      reviewDetails: any[];
    };
    systemReviews?: {
      totalReviews: number;
      reviewDetails: any[];
    };
    feedbackAnalytics?: FeedbackAnalytics;
  };
}

export interface IEventParticipant {
  id: string;
  userId: string;
  status: "CONFIRMED" | "PENDING" | "DECLINED";
  role: string | null;
  user: {
    id: string;
    fullNames: string;
    email: string | null;
    phoneNumber: string | null;
  };
}

export interface IEventExternalParticipant {
  id: string;
  email: string;
  name: string | null;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
  role: string | null;
}

export interface IEvent {
  id?: string;
  title: string;
  description: string;
  type: "TRAINING" | "WEBINAR" | "MEETING" | "SCREENING" | "DRILL";
  frequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  daysOfWeek: string[];
  timezone: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  reminderMinutesBefore: number;
  recurrenceEndsAt: string | null;
  googleSyncEnabled: boolean;
  googleEventId: string | null;
  meetingType: "EBUMENYI_MEETING" | "GOOGLE_MEET" | "ZOOM" | "PHYSICAL";
  location: string;
  streamRoomId?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  hostEmail?: string;
  roles?: {
    instructor?: string;
    coordinator?: string;
    facilitator?: string;
    speaker?: string;
    chair?: string;
    lead?: string;
  };
  participants: IEventParticipant[];
  externalParticipants: IEventExternalParticipant[];
  createdById: string;
  status?: "confirmed" | "pending" | "scheduled" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
  // Expanded recurring instance fields
  isRecurringInstance?: boolean;
  instanceId?: string;
  occurrenceNumber?: number;
  titleOverride?: string;
  descriptionOverride?: string;
  locationOverride?: string;
  isCancelled?: boolean;
  originalEventId?: string;
}

export interface IMyCertificate {
  id: string;
  courseId: string;
  courseTitle: string;
  pdf: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMyCertificatesResponse {
  message: string;
  statusCode: number;
  data: IMyCertificate[];
}

export interface IMyCoursesResponse {
  message: string;
  statusCode: number;
  data: {
    totalCoursesEnrolled: number;
    overallProgress: string;
    enrolledCourses: EnrolledCourse[];
  };
}

// ── Test score analytics ──────────────────────────────────────────
export interface ITestScoreByCourse {
  courseId: string;
  courseTitle: string;
  meanPreTest: number | null;
  meanFinalTest: number | null;
  knowledgeGain: number | null;
  preTestAttempts: number;
  finalTestAttempts: number;
}

export interface ITestScoreByDistrict {
  district: string;
  meanPreTest: number | null;
  meanFinalTest: number | null;
  knowledgeGain: number | null;
  preTestAttempts: number;
  finalTestAttempts: number;
}

export interface ITestScoreAnalytics {
  overallMeanPreTest: number;
  overallMeanFinalTest: number;
  overallKnowledgeGain: number;
  byCourse: ITestScoreByCourse[];
  byDistrict: ITestScoreByDistrict[];
}

// ── Communications analytics ─────────────────────────────────────
export interface ICommType {
  type: string;
  label: string;
  count: number;
  thisMonth: number;
}

export interface ICommMonthlyTrend {
  month: string;
  peerToPeer: number;
  chwToSupervisor: number;
  community: number;
  total: number;
}

export interface ICommunicationsAnalytics {
  total: number;
  thisMonth: number;
  byType: ICommType[];
  monthlyTrend: ICommMonthlyTrend[];
}

// ── Demographics analytics ────────────────────────────────────────
export interface IDemographicRow {
  district?: string;
  gender?: string;
  ageGroup?: string;
  total: number;
  completedAtLeastOne: number;
  completionRate: number;
  certificationRate: number;
}

export interface IDemographicCombinedRow {
  district: string;
  gender: string;
  ageGroup: string;
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  graduated: number;
  activeRate: number;
}

export interface IDemographicsAnalytics {
  totalStudents: number;
  byDistrict: IDemographicRow[];
  byGender: IDemographicRow[];
  byAgeGroup: IDemographicRow[];
  combined: IDemographicCombinedRow[];
}

export interface IDashboardFilters {
  province: string; // "" means all
  district: string; // "" means all
  gender: string; // "" means all
  role: string; // "" means all; "TRAINEE" | "TESTER"
  year: string; // "" means all, e.g. "2025" | "2026"
  month: string; // "" means all, e.g. "Jan" | "Feb" ... "Dec"
  hospitalId: string; // "" means all
}

export interface IActivationTrend {
  value: number;
  direction: "up" | "down" | "stable";
}

export interface ICHWStats {
  chws: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    graduated: number;
    activationRate: number;
    activationTrend: IActivationTrend | null;
    avgLogins: number;
  };
  completion: {
    rate: number;
    total: number;
    completed: number;
    inProgress: number;
  };
  tests: {
    total: number;
    preTest: number;
    midTest: number;
    finalTest: number;
    finalExam: number;
  };
  supervisors: {
    total: number;
    male: number;
    female: number;
    other: number;
    activationRate: number;
    activationTrend: IActivationTrend | null;
    avgLogins: number;
  };
}

export interface ICourseDurationByCourse {
  courseId: string;
  courseTitle: string;
  totalDurationMinutes: number;
  avgDurationMinutes: number;
  chapterCount: number;
}

export interface ICourseDurationStats {
  byCourse: ICourseDurationByCourse[];
}

export type ActivityType = "enrollment" | "submission" | "courseUpdate";

export interface IActivityItem {
  id: string;
  type: ActivityType;
  actorName: string;
  actorPhoto: string | null;
  title: string;
  subject: string;
  subjectId: string | null;
  score: number | null;
  timestamp: string;
}

export interface IRecentActivityFeed {
  all: IActivityItem[];
  enrollments: IActivityItem[];
  submissions: IActivityItem[];
  courseUpdates: IActivityItem[];
}

export interface IMonthlyActiveTrends {
  activeCHWTrend: { month: string; activeCHWs: number }[];
  activeUsersTrend: { month: string; activeUsers: number }[];
}

export interface ICertificationRateEntry {
  eligible: number;
  issued: number;
  rate: number;
}

export interface ICertificationByCourse extends ICertificationRateEntry {
  courseId: string;
  courseTitle: string;
}

export interface ICertificationByDistrict extends ICertificationRateEntry {
  district: string;
}

export interface ICertificationByFacility extends ICertificationRateEntry {
  hospitalId: string;
  hospitalName: string;
}

export interface ICertificationAnalytics {
  total: ICertificationRateEntry & { certifiedStudents: number };
  byCourse: ICertificationByCourse[];
  byDistrict: ICertificationByDistrict[];
  byFacility: ICertificationByFacility[];
}

export interface ISupervisorResponseRate {
  totalChwMessages: number;
  respondedCount: number;
  responseRate: number;
  avgResponseHours: number | null;
  within24hRate: number;
  note: string;
}

