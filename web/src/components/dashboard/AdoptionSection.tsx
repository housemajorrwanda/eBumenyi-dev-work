import React, { useCallback } from "react";
import { IDashboardFilters } from "@/types";
import { useAdoptionStats } from "@/hooks/useAdoptionStats";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { SectionSkeleton } from "./shared/SectionSkeleton";
import { EnrollmentTrendChart } from "./EnrollmentTrendChart";
import { CommunicationsCard } from "./CommunicationsCard";
import { TestScoreAnalyticsCard } from "./TestScoreAnalyticsCard";
import { CourseChartsCard } from "./CourseChartsCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { CourseEngagementTable } from "./CourseEngagementTable";
import { AssessmentOverviewCard } from "./AssessmentOverviewCard";
import { DemographicsSection } from "./DemographicsSection";
import { RwandaDistrictMap } from "./RwandaDistrictMap";
import { CHWStatsCards } from "./CHWStatsCards";
import { HospitalCoverageTable } from "./HospitalCoverageTable";
import { MonthlyActiveTrendsChart } from "./MonthlyActiveTrendsChart";
import { CertificationRateCard } from "./CertificationRateCard";

interface AdoptionSectionProps {
  filters: IDashboardFilters;
  onFiltersChange: (f: IDashboardFilters) => void;
}

export const AdoptionSection: React.FC<AdoptionSectionProps> = ({
  filters,
  onFiltersChange,
}) => {
  const {
    hospitals,
    enrollmentTrends,
    courseAnalytics,
    testScores,
    communications,
    demographics,
    chwStats,
    courseDuration,
    recentActivity,
    monthlyActiveTrends,
    certification,
    avgStudyTimeByCourse,
    byProvince,
    totalChws,
    registrationRate,
    isLoading,
    isFetching,
    error,
  } = useAdoptionStats(filters);

  const {
    filteredByDistrict,
    filteredByGender,
    filteredEnrollmentTrends,
    filteredCommTrend,
  } = useDashboardFilters(
    {
      byProvince: [],
      demographics,
      enrollmentTrends,
      communications,
      hospitals,
    },
    filters,
    onFiltersChange,
  );

  const handleDistrictClick = useCallback(
    (district: string) => onFiltersChange({ ...filters, district }),
    [filters, onFiltersChange],
  );

  if (isLoading && !chwStats) return <SectionSkeleton cards={5} rows={2} />;

  return (
    <div className={`space-y-5 transition-opacity duration-200 ${isFetching ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      {error && (
        <div
          className='text-sm text-red-500 bg-red-50 border border-red-100
            rounded-lg px-4 py-3'
        >
          {error}
        </div>
      )}

      <CHWStatsCards data={chwStats} isLoading={isLoading} />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <CourseEngagementTable
          courseAnalytics={courseAnalytics}
          testScores={testScores}
          avgStudyTimeByCourse={avgStudyTimeByCourse}
        />
        <AssessmentOverviewCard chwStats={chwStats} testScores={testScores} />
      </div>

   

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <CommunicationsCard
          data={communications}
          filteredTrend={filteredCommTrend}
        />
        <TestScoreAnalyticsCard data={testScores} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DemographicsSection
          data={demographics}
          filteredByDistrict={filteredByDistrict}
          filteredByGender={filteredByGender}
        />
        <RecentActivityCard data={recentActivity} isLoading={isLoading} />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <CourseChartsCard
          courseAnalytics={courseAnalytics}
          testScores={testScores}
          courseDuration={courseDuration}
        />
        <EnrollmentTrendChart trends={filteredEnrollmentTrends} />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <MonthlyActiveTrendsChart data={monthlyActiveTrends} />
        <CertificationRateCard data={certification} filters={filters} />
      </div>

      {/* <HospitalCoverageTable
        byProvince={byProvince}
        totalChws={totalChws}
        registrationRate={registrationRate}
      /> */}

      {/* District map */}
      <RwandaDistrictMap
        byDistrict={demographics?.byDistrict ?? []}
        hospitals={hospitals}
        activeDistrict={filters.district}
        hospitalId={filters.hospitalId}
        province={filters.province}
        onDistrictClick={handleDistrictClick}
      />

    </div>
  );
};
