import React from "react";
import {
  GraduationCap,
  PlayCircle,
  ChevronRight,
  BookOpen,
  Clock,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLearnerDashboard } from "@/hooks/useLearnerDashboard";
import { LearnerStatsRow } from "./LearnerStatsRow";
import { MyCertificatesList } from "./MyCertificatesList";
import { SectionSkeleton } from "./shared/SectionSkeleton";
import { ICourseStatEntry, ILastViewedLocation } from "@/services/progress.service";

/* ─────────────────────────────────────────────────────────────────── */
/* Continue learning hero card                                          */
/* ─────────────────────────────────────────────────────────────────── */
const ContinueLearningCard: React.FC<{ loc: ILastViewedLocation }> = ({ loc }) => {
  const navigate = useNavigate();
  return (
    <div
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      onClick={() => navigate(`/learn/${loc.courseId}`)}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#3363AD] to-[#4a7bbf]" />
      <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10" />
      <div className="absolute right-16 -bottom-10 w-32 h-32 rounded-full bg-white/10" />

      <div className="relative z-10 flex items-center gap-5 p-6">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <PlayCircle size={24} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-amber-300" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
              Continue where you left off
            </span>
          </div>
          <p className="text-base font-bold text-white truncate">{loc.courseTitle}</p>
          <p className="text-sm text-white/70 truncate mt-0.5">{loc.chapterTitle}</p>
        </div>

        <ChevronRight
          size={20}
          className="text-white/60 shrink-0 group-hover:translate-x-1 transition-transform"
        />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Course icon — renders coverIcon as image with fallback               */
/* coverIcon is always an image URL in this codebase (never an emoji)  */
/* ─────────────────────────────────────────────────────────────────── */
const CourseIcon: React.FC<{ icon: string | null | undefined; completed: boolean }> = ({
  icon,
  completed,
}) => {
  const [failed, setFailed] = React.useState(false);
  const bg = completed ? "bg-emerald-50" : "bg-[#EBF0F9]";
  const color = completed ? "text-emerald-500" : "text-[#3363AD]";

  if (icon && !failed) {
    return (
      <div className={`shrink-0 w-11 h-11 rounded-xl overflow-hidden ${bg}`}>
        <img
          src={icon}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
      <BookOpen size={18} className={color} />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Course progress card                                                 */
/* ─────────────────────────────────────────────────────────────────── */
const CourseCard: React.FC<{ course: ICourseStatEntry }> = ({ course }) => {
  const navigate = useNavigate();
  const pct = Math.min(100, Math.max(0, Math.round(course.progress ?? 0)));

  const statusLabel = course.isCompleted
    ? "Completed"
    : course.isStarted
    ? "In Progress"
    : "Not Started";

  const statusClass = course.isCompleted
    ? "text-emerald-600 bg-emerald-50"
    : course.isStarted
    ? "text-[#3363AD] bg-[#EBF0F9]"
    : "text-gray-400 bg-gray-50";

  const StatusIcon = course.isCompleted
    ? CheckCircle2
    : course.isStarted
    ? Clock
    : BookOpen;

  const barColor = course.isCompleted ? "bg-emerald-500" : "bg-[#3363AD]";

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm
        transition-shadow duration-200 cursor-pointer group"
      onClick={() => navigate(`/learn/${course.courseId}`)}
    >
      <div className="flex items-center gap-3">
        <CourseIcon icon={course.coverIcon} completed={course.isCompleted} />

        <div className="flex-1 min-w-0">
          {/* Title + status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#3363AD] transition-colors">
              {course.title}
            </p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${statusClass}`}>
              <StatusIcon size={9} />
              {statusLabel}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{course.totalChapters} chapters</span>
              <span className="text-xs font-semibold text-gray-600">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <ChevronRight size={14} className="text-gray-300 shrink-0 group-hover:text-[#3363AD] transition-colors" />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Main LearnerSection                                                  */
/* ─────────────────────────────────────────────────────────────────── */
export const LearnerSection: React.FC = () => {
  const navigate = useNavigate();
  const {
    studentStats,
    certificates,
    totalCertificates,
    isLoading,
    error,
  } = useLearnerDashboard();

  if (isLoading) return <SectionSkeleton cards={4} rows={2} />;

  const enrolledCourses = (studentStats?.courses ?? []).filter((c) => c.isEnrolled);
  const activeCourses = enrolledCourses.filter((c) => !c.isCompleted);
  const completedCourses = enrolledCourses.filter((c) => c.isCompleted);
  const lastViewed = studentStats?.lastViewedLocation ?? null;

  return (
    <div className="space-y-5">
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Continue hero ────────────────────────────────────────── */}
      {lastViewed && (
        <ContinueLearningCard loc={lastViewed} />
      )}

      {/* ── Stats row ────────────────────────────────────────────── */}
      <LearnerStatsRow
        summary={studentStats?.summary ?? null}
        totalCertificates={totalCertificates}
        isLoading={isLoading}
      />

      {/* ── Main grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — courses (2/3) */}
        <div className="lg:col-span-2 space-y-4">

          {/* In-progress courses */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF0F9] flex items-center justify-center">
                  <TrendingUp size={14} className="text-[#3363AD]" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">In Progress</h3>
                {activeCourses.length > 0 && (
                  <span className="text-xs bg-[#EBF0F9] text-[#3363AD] font-semibold px-2 py-0.5 rounded-full">
                    {activeCourses.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/my-learning")}
                className="text-xs text-[#3363AD] hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight size={12} />
              </button>
            </div>

            {activeCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#EBF0F9] flex items-center justify-center mb-3">
                  <BookOpen size={20} className="text-[#3363AD]/40" />
                </div>
                <p className="text-sm font-medium text-gray-500">No courses in progress</p>
                <p className="text-xs text-gray-400 mt-1">Browse the catalog to get started</p>
                <button
                  onClick={() => navigate("/course-catalog")}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3363AD] rounded-lg hover:bg-[#2a52a0] transition-colors"
                >
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCourses.slice(0, 4).map((course) => (
                  <CourseCard key={course.courseId} course={course} />
                ))}
              </div>
            )}
          </div>

          {/* Completed courses */}
          {completedCourses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Completed</h3>
                <span className="text-xs bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                  {completedCourses.length}
                </span>
              </div>
              <div className="space-y-1">
                {completedCourses.slice(0, 3).map((course) => (
                  <div
                    key={course.courseId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/learn/${course.courseId}`)}
                  >
                    <CourseIcon icon={course.coverIcon} completed={true} />
                    <p className="text-sm text-gray-700 font-medium flex-1 truncate group-hover:text-[#3363AD] transition-colors">
                      {course.title}
                    </p>
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — certificates + quick actions (1/3) */}
        <div className="lg:col-span-1 space-y-4">
          <MyCertificatesList certificates={certificates} isLoading={isLoading} />

          <div className="space-y-2">
            <button
              onClick={() => navigate("/my-learning")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                bg-[#EBF0F9] hover:bg-[#dce6f5] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap size={15} className="text-[#3363AD]" />
                <span className="text-sm font-medium text-[#3363AD]">My Courses</span>
              </div>
              <ChevronRight size={13} className="text-[#3363AD]/50 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => navigate("/my-certificates")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                bg-[#EBF0F9] hover:bg-[#dce6f5] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <Award size={15} className="text-[#3363AD]" />
                <span className="text-sm font-medium text-[#3363AD]">All Certificates</span>
              </div>
              <ChevronRight size={13} className="text-[#3363AD]/50 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
