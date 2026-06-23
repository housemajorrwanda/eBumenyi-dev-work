import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStudentById } from '@/services/students.service';
import {
  Calendar,
  BookOpen,
  Award,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  FileText,
  User,
  MapPin,
  Phone,
  Activity,
  MessageSquare,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SlideFeedbackDetail {
  id: string;
  message: string;
  comment?: string;
  createdAt?: string;
  feedbackDate?: string;
  slideInfo?: {
    slideNumber: number;
    chapterTitle: string;
    courseTitle: string;
    sectionTitle: string;
  };
}

interface ChapterReviewDetail {
  reviewId: string;
  rating: number;
  comment: string;
  reviewDate: string;
  chapterInfo: {
    chapterId: string;
    chapterTitle: string;
    chapterNumber: number;
    sectionTitle: string;
    courseTitle: string;
  };
  categoryRatings: CategoryRating[];
}

interface SectionReviewDetail {
  reviewId: string;
  rating: number;
  comment: string;
  reviewDate: string;
  sectionInfo?: {
    sectionTitle: string;
    courseTitle: string;
  };
  categoryRatings: CategoryRating[];
}

interface CourseReviewDetail {
  reviewId: string;
  rating: number;
  comment: string;
  reviewDate: string;
  courseInfo: {
    courseId: string;
    courseTitle: string;
    courseDescription: string;
  };
  categoryRatings: CategoryRating[];
}

interface SystemReviewDetail {
  reviewId: string;
  rating?: number;
  overallRating?: number;
  comment?: string;
  feedback?: string;
  recommendation?: string;
  reviewDate?: string;
  createdAt?: string;
  categoryRatings: CategoryRating[];
}

interface CategoryRating {
  ratingId: string;
  category: string;
  rating: number;
  ratedAt: string;
}

type ActiveTab = 'overview' | 'courses' | 'tests' | 'reviews';

// Renders compact inline star rating
const StarRating: React.FC<{ rating: number | null | undefined; size?: 'sm' | 'md' }> = ({
  rating,
  size = 'md',
}) => {
  const safe = rating || 0;
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < Math.floor(safe) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-medium text-gray-600">{safe.toFixed(1)}</span>
    </div>
  );
};

// Renders a section of category ratings inside a review card
const CategoryRatings: React.FC<{ ratings: CategoryRating[] }> = ({ ratings }) => {
  if (!ratings || ratings.length === 0) return null;
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Category Ratings</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {ratings.map((cr) => (
          <div key={cr.ratingId} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-xs text-gray-600 truncate mr-2">{cr.category}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < cr.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                />
              ))}
              <span className="ml-1 text-xs text-gray-400">({cr.rating})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StudentActivityPage: React.FC = () => {
  const { id: studentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const {
    data: studentResponse,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudentById(studentId!),
    enabled: !!studentId,
    retry: 1,
  });

  const studentData = studentResponse?.data;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Loading CHW data...</p>
        </div>
      </div>
    );
  }

  if (error || !studentData) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center max-w-sm w-full">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-[#333333] mb-1">
            {error ? 'Failed to load CHW' : 'CHW not found'}
          </h3>
          <p className="text-sm text-gray-400 mb-6">
            {error
              ? 'An error occurred while fetching CHW data.'
              : 'This CHW does not exist or was removed.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => refetch()}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-[#4d81d2] transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/students')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Back to CHWs
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { studentInfo, courseProgress, testAttempts } = studentData;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const fb = studentData?.feedbacksAndReviews;
  const totalReviews =
    (fb?.slideFeedbacks?.totalFeedbacks || 0) +
    (fb?.chapterReviews?.totalReviews || 0) +
    (fb?.sectionReviews?.totalReviews || 0) +
    (fb?.courseReviews?.totalReviews || 0) +
    (fb?.systemReviews?.totalReviews || 0);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity, count: undefined },
    { id: 'courses', label: 'Courses', icon: BookOpen, count: courseProgress.totalCoursesEnrolled },
    { id: 'tests', label: 'Tests', icon: FileText, count: testAttempts.totalAttempts },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare, count: totalReviews },
  ] as const;

  const typeColors = ['bg-primary', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500'];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all duration-150"
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-[#333333]">CHW Activity Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and analyze CHW performance and engagement
          </p>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Avatar with online indicator */}
          <div className="relative flex-shrink-0">
            <img
              src={studentInfo.photo}
              alt={studentInfo.fullName}
              className="w-20 h-20 rounded-xl object-cover border-2 border-gray-100"
            />
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                studentInfo.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#333333]">{studentInfo.fullName}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    {studentInfo.gender} · {studentInfo.role}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {studentInfo.village}, {studentInfo.cell}, {studentInfo.sector}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {studentInfo.phoneNumber}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                    studentInfo.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  ● {studentInfo.status}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Calendar className="w-3.5 h-3.5" />
                  Since {formatDate(studentInfo.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab navigation (matches FilterTabs default style) ── */}
      <ul className="flex items-center gap-6 border-b border-[#cccccc]/50 overflow-x-auto pb-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <li
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 py-3 cursor-pointer select-none whitespace-nowrap text-base font-medium transition-all duration-200 ${
                isActive
                  ? 'border-b-2 border-[#4d81d2] text-[#4d81d2] font-semibold'
                  : 'text-[#333333] hover:text-[#4d81d2]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    isActive ? 'bg-[#4d81d2] text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* ════════════════════════════════
          OVERVIEW TAB
      ════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Courses */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">Courses</p>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#333333]">
                {courseProgress.totalCoursesEnrolled}
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Overall Progress</span>
                  <span className="font-semibold text-primary">{courseProgress.overallProgress}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: courseProgress.overallProgress }}
                  />
                </div>
              </div>
            </div>

            {/* Tests */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">Test Attempts</p>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Award className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#333333]">{testAttempts.totalAttempts}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {testAttempts.passedAttempts} passed
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    {testAttempts.failedAttempts} failed
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{testAttempts.successRate}%</p>
                  <p className="text-xs text-gray-400">success</p>
                </div>
              </div>
            </div>

            {/* Avg Score */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">Avg Score</p>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#333333]">
                {(testAttempts.averageScore || 0).toFixed(1)}%
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Accuracy</span>
                  <span className="font-semibold text-purple-600">
                    {(testAttempts.averageScore || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${testAttempts.averageScore || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Engagement */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">Engagement</p>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#333333]">
                {fb?.feedbackAnalytics?.engagementLevel || 0}%
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Feedbacks given</span>
                  <span className="font-semibold text-yellow-600">
                    {fb?.feedbackAnalytics?.totalFeedbacksGiven || 0}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => {
                    const avg = fb?.feedbackAnalytics?.averageRatingGiven || 0;
                    return (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.floor(avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                        }`}
                      />
                    );
                  })}
                  <span className="ml-1 text-xs text-gray-400">
                    ({(fb?.feedbackAnalytics?.averageRatingGiven || 0).toFixed(1)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lower cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Test Attempts */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-[#333333]">Recent Test Attempts</h3>
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <div className="divide-y divide-gray-100">
                {testAttempts.detailedAttempts.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.attemptId}
                    className="flex items-center justify-between px-5 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          attempt.isPassed ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-[#333333]">{attempt.testType}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{attempt.testInfo.course}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          attempt.isPassed ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {attempt.totalMarks}%
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(attempt.attemptDate)}</p>
                    </div>
                  </div>
                ))}
                {testAttempts.detailedAttempts.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-gray-400">
                    No test attempts yet
                  </div>
                )}
              </div>
            </div>

            {/* Test Type Distribution */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">Test Type Distribution</h3>
              </div>
              <div className="p-5 space-y-5">
                {Object.entries(testAttempts.attemptsByType).map(([type, count], i) => {
                  const pct =
                    testAttempts.totalAttempts > 0
                      ? (count / testAttempts.totalAttempts) * 100
                      : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-700 capitalize">
                          {type.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-semibold text-[#333333]">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${typeColors[i % typeColors.length]} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(testAttempts.attemptsByType).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          COURSES TAB
      ════════════════════════════════ */}
      {activeTab === 'courses' && (
        <div className="space-y-3">
          {courseProgress.enrolledCourses.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-500">No courses enrolled yet</p>
            </div>
          ) : (
            courseProgress.enrolledCourses.map((course) => (
              <div
                key={course.courseId}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex gap-4">
                  <img
                    src={course.courseCoverIcon}
                    alt={course.courseTitle}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#333333] truncate">{course.courseTitle}</h4>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                          {course.courseDescription}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                          <StarRating rating={course.courseRating} />
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />
                            Enrolled {formatDate(course.enrollmentDate)}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            Updated {formatDate(course.lastUpdated)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            course.isCompleted
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {course.isCompleted ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Completed
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" /> In Progress
                            </>
                          )}
                        </span>
                        <p
                          className={`text-2xl font-bold ${
                            course.isCompleted ? 'text-green-600' : 'text-primary'
                          }`}
                        >
                          {course.progress}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            course.isCompleted ? 'bg-green-500' : 'bg-primary'
                          }`}
                          style={{ width: course.progress }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════
          TESTS TAB
      ════════════════════════════════ */}
      {activeTab === 'tests' && (
        <div className="space-y-5">
          {/* Summary pills */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Attempts', value: testAttempts.totalAttempts, cls: 'bg-primary/10 text-primary' },
              { label: 'Passed', value: testAttempts.passedAttempts, cls: 'bg-green-50 text-green-600' },
              { label: 'Failed', value: testAttempts.failedAttempts, cls: 'bg-red-50 text-red-500' },
              {
                label: 'Average Score',
                value: `${(testAttempts.averageScore || 0).toFixed(1)}%`,
                cls: 'bg-purple-50 text-purple-600',
              },
            ].map((s) => (
              <div key={s.label} className={`${s.cls} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Detailed attempts */}
          <h3 className="text-base font-semibold text-[#333333]">
            All Attempts ({testAttempts.detailedAttempts.length})
          </h3>

          <div className="space-y-3">
            {testAttempts.detailedAttempts.map((attempt) => {
              const isExpanded = expandedAttemptId === attempt.attemptId;
              return (
                <div
                  key={attempt.attemptId}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Clickable header */}
                  <button
                    onClick={() =>
                      setExpandedAttemptId(isExpanded ? null : attempt.attemptId)
                    }
                    className="w-full text-left"
                  >
                    <div
                      className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between transition-colors duration-150 ${
                        isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            attempt.isPassed ? 'bg-green-100' : 'bg-red-50'
                          }`}
                        >
                          {attempt.isPassed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#333333] text-sm">
                            {attempt.testInfo.course}
                            <span className="text-gray-400 font-normal ml-1">· {attempt.testType}</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Try #{attempt.tryCount} · {formatDateTime(attempt.attemptDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p
                              className={`text-xl font-bold ${
                                attempt.isPassed ? 'text-green-600' : 'text-red-500'
                              }`}
                            >
                              {attempt.totalMarks}%
                            </p>
                            <p className="text-xs text-gray-400">score</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold text-primary">
                              {attempt.correctAnswers}/{attempt.questionsAnswered}
                            </p>
                            <p className="text-xs text-gray-400">correct</p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            attempt.isPassed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {attempt.isPassed ? 'PASSED' : 'FAILED'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded question details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5">
                      {attempt.testInfo.description && (
                        <p className="text-sm text-gray-500 mb-4">{attempt.testInfo.description}</p>
                      )}
                      <h5 className="text-sm font-semibold text-[#333333] mb-4">
                        Question-by-Question Analysis ({attempt.questionsWithAnswers?.length || 0} questions)
                      </h5>
                      <div className="space-y-4">
                        {attempt.questionsWithAnswers?.map((question, qIndex) => (
                          <div
                            key={question.questionId}
                            className={`rounded-xl border p-4 ${
                              question.isCorrect
                                ? 'border-green-200 bg-green-50/50'
                                : 'border-red-200 bg-red-50/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-sm font-medium text-[#333333] flex-1">
                                <span className="text-gray-400 mr-1">Q{qIndex + 1}.</span>
                                {question.question}
                              </p>
                              <span
                                className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  question.isCorrect
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-600'
                                }`}
                              >
                                {question.isCorrect ? `✓ +${question.marksAwarded}` : '✗ 0'}
                              </span>
                            </div>

                            {question.questionImage && (
                              <img
                                src={question.questionImage}
                                alt="Question"
                                className="max-w-xs rounded-lg mb-3 border border-gray-200"
                              />
                            )}

                            <div className="space-y-1.5 mb-3">
                              {question.availableOptions.map((option) => {
                                const isCorrect = question.correctAnswers.some(
                                  (c) => c.label === option.label,
                                );
                                const isSelected = question.studentSelectedAnswers.includes(option.label);
                                return (
                                  <div
                                    key={option.id}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm ${
                                      isCorrect && isSelected
                                        ? 'border-green-400 bg-green-100'
                                        : isSelected && !isCorrect
                                        ? 'border-red-400 bg-red-100'
                                        : isCorrect
                                        ? 'border-green-200 bg-green-50'
                                        : 'border-gray-200 bg-white'
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                        isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                                      }`}
                                    >
                                      {isSelected && (
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                      )}
                                    </div>
                                    <span className="flex-1 text-gray-700">{option.label}</span>
                                    {isCorrect && (
                                      <span className="text-xs font-medium text-green-600 flex-shrink-0">
                                        ✓ Correct
                                      </span>
                                    )}
                                    {isSelected && !isCorrect && (
                                      <span className="text-xs font-medium text-red-500 flex-shrink-0">
                                        ✗ Selected
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {question.feedbackStatement && (
                              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-primary">
                                <strong>Feedback:</strong> {question.feedbackStatement}
                              </div>
                            )}

                            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                              <span>
                                <strong className="text-gray-500">Correct:</strong>{' '}
                                {question.correctAnswers.map((a) => a.label).join(', ')}
                              </span>
                              <span>
                                <strong className="text-gray-500">CHW answered:</strong>{' '}
                                {question.studentSelectedAnswers.length > 0
                                  ? question.studentSelectedAnswers.join(', ')
                                  : 'No answer selected'}
                              </span>
                              <span>
                                <strong className="text-gray-500">At:</strong>{' '}
                                {formatDateTime(question.answeredAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          REVIEWS TAB
      ════════════════════════════════ */}
      {activeTab === 'reviews' && (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: 'Slide',
                count: fb?.slideFeedbacks?.totalFeedbacks || 0,
                num: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                label: 'Chapter',
                count: fb?.chapterReviews?.totalReviews || 0,
                num: 'text-green-600',
                bg: 'bg-green-50',
              },
              {
                label: 'Section',
                count: fb?.sectionReviews?.totalReviews || 0,
                num: 'text-purple-600',
                bg: 'bg-purple-50',
              },
              {
                label: 'Course',
                count: fb?.courseReviews?.totalReviews || 0,
                num: 'text-yellow-600',
                bg: 'bg-yellow-50',
              },
              {
                label: 'System',
                count: fb?.systemReviews?.totalReviews || 0,
                num: 'text-red-500',
                bg: 'bg-red-50',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm"
              >
                <p className={`text-2xl font-bold ${item.num}`}>{item.count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label} Reviews</p>
              </div>
            ))}
          </div>

          {/* No reviews */}
          {totalReviews === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-[#333333] mb-1">No Reviews Yet</p>
              <p className="text-sm text-gray-400">
                This CHW hasn't provided any reviews or feedback yet.
              </p>
            </div>
          )}

          {/* Slide Reviews */}
          {fb?.slideFeedbacks?.feedbackDetails && fb.slideFeedbacks.feedbackDetails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">Slide Reviews</h3>
                <p className="text-xs text-gray-400 mt-0.5">Feedback on specific slides within chapters</p>
              </div>
              <div className="divide-y divide-gray-100">
                {fb.slideFeedbacks.feedbackDetails.map((item: SlideFeedbackDetail) => (
                  <div key={item.id} className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Slide #{item.slideInfo?.slideNumber ?? 'N/A'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(item.createdAt || item.feedbackDate || new Date().toISOString())}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#333333]">
                      {item.slideInfo?.chapterTitle ?? 'Unknown Chapter'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.slideInfo?.courseTitle ?? 'Unknown Course'} ·{' '}
                      {item.slideInfo?.sectionTitle ?? 'Unknown Section'}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{item.message || item.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Reviews */}
          {fb?.chapterReviews?.reviewDetails && fb.chapterReviews.reviewDetails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">Chapter Reviews</h3>
                <p className="text-xs text-gray-400 mt-0.5">Detailed feedback on course chapters</p>
              </div>
              <div className="divide-y divide-gray-100">
                {fb.chapterReviews.reviewDetails.map((r: ChapterReviewDetail) => (
                  <div key={r.reviewId} className="p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-gray-400">{formatDate(r.reviewDate)}</span>
                    </div>
                    <p className="text-sm font-medium text-[#333333]">
                      Chapter: {r.chapterInfo.chapterTitle}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.chapterInfo.courseTitle} · {r.chapterInfo.sectionTitle}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{r.comment}</p>
                    <CategoryRatings ratings={r.categoryRatings} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Reviews */}
          {fb?.sectionReviews?.reviewDetails && fb.sectionReviews.reviewDetails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">Section Reviews</h3>
                <p className="text-xs text-gray-400 mt-0.5">Feedback on course sections</p>
              </div>
              <div className="divide-y divide-gray-100">
                {fb.sectionReviews.reviewDetails.map((r: SectionReviewDetail) => (
                  <div key={r.reviewId} className="p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-gray-400">{formatDate(r.reviewDate)}</span>
                    </div>
                    <p className="text-sm font-medium text-[#333333]">
                      Section: {r.sectionInfo?.sectionTitle ?? 'Unknown Section'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.sectionInfo?.courseTitle ?? 'Unknown Course'}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{r.comment}</p>
                    <CategoryRatings ratings={r.categoryRatings} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Course Reviews */}
          {fb?.courseReviews?.reviewDetails && fb.courseReviews.reviewDetails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">Course Reviews</h3>
                <p className="text-xs text-gray-400 mt-0.5">Overall feedback on completed courses</p>
              </div>
              <div className="divide-y divide-gray-100">
                {fb.courseReviews.reviewDetails.map((r: CourseReviewDetail) => (
                  <div key={r.reviewId} className="p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-gray-400">{formatDate(r.reviewDate)}</span>
                    </div>
                    <p className="text-sm font-medium text-[#333333]">
                      {r.courseInfo.courseTitle}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{r.comment}</p>
                    <CategoryRatings ratings={r.categoryRatings} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Reviews */}
          {fb?.systemReviews?.reviewDetails && fb.systemReviews.reviewDetails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#333333]">System Reviews</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Overall feedback about the learning platform
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {fb.systemReviews.reviewDetails.map((r: SystemReviewDetail) => (
                  <div key={r.reviewId} className="p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <StarRating rating={r.overallRating ?? r.rating} />
                      <span className="text-xs text-gray-400">
                        {formatDate(r.reviewDate || r.createdAt || new Date().toISOString())}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#333333]">Platform Feedback</p>
                    <p className="text-sm text-gray-700 mt-2">{r.feedback || r.comment}</p>
                    {r.recommendation && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        <strong className="text-gray-600">Recommendation:</strong> {r.recommendation}
                      </p>
                    )}
                    <CategoryRatings ratings={r.categoryRatings} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentActivityPage;
