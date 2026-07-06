import React from "react";
import { ICourseAnalytics, IStudentAnalytics, IDashboardStats, IDashboardFilters } from "@/types";
import { KpiCard } from "./shared/KpiCard";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { SectionSkeleton } from "./shared/SectionSkeleton";
// import { TrainingFunnelCard } from "./TrainingFunnelCard";
import { TestScoreCard } from "./TestScoreCard";
import { RecommendationReviewCard } from "./RecommendationReviewCard";
import { CertificationCard } from "./CertificationCard";
import { RecentLearnerActivity } from "./RecentLearnerActivity";
import { Users, Activity, CheckCircle, Award, BarChart2 } from "lucide-react";

interface Phase3SectionProps {
  dashboardStats: IDashboardStats | null;
  courseAnalytics: ICourseAnalytics | null;
  studentAnalytics: IStudentAnalytics | null;
  isLoading: boolean;
  isSupervisorView: boolean;
  hideKpis?: boolean;
  filters?: IDashboardFilters;
}

export const Phase3Section: React.FC<Phase3SectionProps> = ({
  dashboardStats,
  courseAnalytics,
  studentAnalytics,
  isLoading,
  isSupervisorView,
  hideKpis = false,
  filters: _filters,
}) => {
  if (isLoading && !dashboardStats) return <SectionSkeleton cards={4} rows={2} />;

  return (
    <div className="space-y-6">
      <DashboardSectionHeader
        icon={<BarChart2 size={18} />}
        title="Training Analytics"
      />

      {/* KPI row — 4 stat cards */}
      {!hideKpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total CHW"
            value={dashboardStats?.totalStudents?.value ?? 0}
            icon={<Users size={20} />}
            iconBg="bg-blue-50"
            iconColor="text-[#3363AD]"
            trend={dashboardStats?.totalStudents?.trend}
            description={`${dashboardStats?.newEnrollments ?? 0} new this month`}
          />
          <KpiCard
            title="Active Users"
            value={dashboardStats?.activeUsers?.value ?? 0}
            icon={<Activity size={20} />}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            trend={dashboardStats?.activeUsers?.trend}
          />
          <KpiCard
            title="Completion Rate"
            value={`${dashboardStats?.completionRate?.value ?? 0}%`}
            icon={<CheckCircle size={20} />}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            trend={dashboardStats?.completionRate?.trend}
          />
          <KpiCard
            title="Certificates"
            value={courseAnalytics?.certificatesIssued?.value ?? 0}
            icon={<Award size={20} />}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            trend={courseAnalytics?.certificatesIssued?.trend}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TestScoreCard studentAnalytics={studentAnalytics} />
        <RecommendationReviewCard />
      </div>

      {/* Certification + Activity row */}
      {!hideKpis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CertificationCard courseAnalytics={courseAnalytics} />
          <div className="lg:col-span-2">
            <RecentLearnerActivity
              activities={studentAnalytics?.recentActivity ?? []}
              isSupervisorView={isSupervisorView}
            />
          </div>
        </div>
      )}
    </div>
  );
};
