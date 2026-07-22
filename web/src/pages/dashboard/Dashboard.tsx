import React, { useState } from "react";
import { Phase3Section } from "@/components/dashboard/Phase3Section";
import { LearnerSection } from "@/components/dashboard/LearnerSection";
import { AdoptionSection } from "@/components/dashboard/AdoptionSection";
import { SupervisorResponseCard } from "@/components/dashboard/SupervisorResponseCard";
import { DeveloperSection } from "@/components/dashboard/DeveloperSection";
import { CEHOSection } from "@/components/dashboard/CEHOSection";
import { DashboardGlobalFilters } from "@/components/dashboard/DashboardGlobalFilters";
import { useAuth } from "@/hooks/useAuth";
import { IDashboardFilters } from "@/types";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAdoptionStats } from "@/hooks/useAdoptionStats";
import {
  DEFAULT_DASHBOARD_FILTERS,
} from "@/utils/constants/dashboardFilters";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const [filters, setFilters] = useState<IDashboardFilters>(DEFAULT_DASHBOARD_FILTERS);

  const userRoles: string[] = user?.roles
    ? Array.isArray(user.roles)
      ? (user.roles as string[])
      : [user.roles as string]
    : [];

  const needsAnalytics = userRoles.some((r) =>
    ["ADMIN", "TRAINER", "STAFF", "DEVELOPER"].includes(r),
  );
  const needsAdoption = userRoles.some((r) =>
    ["ADMIN", "STAFF", "DEVELOPER"].includes(r),
  );

  const {
    dashboardStats,
    courseAnalytics,
    studentAnalytics,
    isLoading,
    isFetching: isStatsFetching,
  } = useDashboardStats({ enabled: needsAnalytics, filters });
  const { supervisorResponseRate, isFetching: isAdoptionFetching } = useAdoptionStats(
    filters,
    needsAdoption,
  );
  const isRefetching = isStatsFetching || isAdoptionFetching;

  const is = (role: string) => userRoles.includes(role);
  const isAnyOf = (...roles: string[]) => roles.some((r) => userRoles.includes(r));

  if (!user) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-[#3363AD]' />
      </div>
    );
  }

  const isLearner = isAnyOf("TRAINEE", "TESTER", "CEHO");
  const isCEHO = is("CEHO");
  const showAnalyticsFilters = needsAnalytics;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const learnerSubtitle =
    hour < 12
      ? "Ready to learn something new today?"
      : hour < 17
        ? "Keep up the great progress!"
        : "A great time to review what you've learned.";

  return (
    <div className='space-y-8 p-1'>
      {/* ── Welcome header ──────────────────────────────────────────────────── */}
      <div className='flex items-center justify-between gap-4 flex-wrap'>
        <div>
          <h1 className='text-xl font-bold text-gray-900'>
            {isLearner || isCEHO
              ? `${greeting}, ${user.fullNames}!`
              : `Welcome, ${user.fullNames}!`}
          </h1>
          <p className='text-xs text-gray-500 mt-0.5'>
            {isLearner ? learnerSubtitle : "Here's what's happening on the platform"}
          </p>
        </div>

        {showAnalyticsFilters && (
          <div className='flex items-center gap-3'>
            <DashboardGlobalFilters filters={filters} onChange={setFilters} />
            {isRefetching && (
              <span className='flex items-center gap-1.5 text-xs text-gray-400'>
                <span className='h-3 w-3 rounded-full border-2 border-gray-300 border-t-[#3363AD] animate-spin' />
                Updating…
              </span>
            )}
          </div>
        )}
      </div>

      {isAnyOf("ADMIN", "STAFF", "DEVELOPER") && (
        <AdoptionSection filters={filters} onFiltersChange={setFilters} />
      )}

      {isAnyOf("ADMIN", "TRAINER", "STAFF", "DEVELOPER") && (
        <Phase3Section
          dashboardStats={dashboardStats}
          courseAnalytics={courseAnalytics}
          studentAnalytics={studentAnalytics}
          isLoading={isLoading}
          isFetching={isStatsFetching}
          isSupervisorView={false}
          hideKpis={isAnyOf("ADMIN", "DEVELOPER")}
          filters={filters}
        />
      )}

      {isAnyOf("ADMIN", "STAFF", "DEVELOPER") && (
        <div className="w-full lg:w-1/2">
          <SupervisorResponseCard data={supervisorResponseRate} />
        </div>
      )}

      {is("DEVELOPER") && <DeveloperSection />}

      {isAnyOf("TRAINEE", "TESTER", "CEHO") && <LearnerSection />}

      {isCEHO && <CEHOSection />}
    </div>
  );
};
