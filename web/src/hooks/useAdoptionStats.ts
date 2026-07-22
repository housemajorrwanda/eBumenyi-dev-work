import { useQuery } from "@tanstack/react-query";
import {
  IHospital,
  IEnrollmentTrend,
  ITestScoreAnalytics,
  ICommunicationsAnalytics,
  IDemographicsAnalytics,
  ICHWStats,
  ICourseAnalytics,
  ICourseDurationStats,
  IRecentActivityFeed,
  IMonthlyActiveTrends,
  ICertificationAnalytics,
  ISupervisorResponseRate,
  IAvgStudyTimeByCourse,
  IDashboardFilters,
} from "@/types";
import { listAllHospitals } from "@/services/hospitals.service";
import {
  getCourseAnalytics,
  getStudentAnalytics,
  getTestScoreAnalytics,
  getCommunicationsAnalytics,
  getDemographicsAnalytics,
  getCHWDashboardStats,
  getCourseDurationStats,
  getRecentActivityFeed,
  getMonthlyActiveTrends,
  getCertificationAnalytics,
  getSupervisorResponseRate,
} from "@/services/analytics.service";
import { DEFAULT_DASHBOARD_FILTERS } from "@/utils/constants/dashboardFilters";
import { buildDashboardFilterQuery, dashboardFilterKey } from "@/utils/dashboardFilterQuery";
import { dashboardKeys } from "@/utils/constants/queryKeys";

export type AnalyticsFilters = IDashboardFilters;

interface AdoptionStats {
  hospitals: IHospital[];
  totalChws: number;
  activeChws: number;
  registrationRate: number;
  activeRate: number;
  enrollmentTrends: IEnrollmentTrend[];
  avgStudyTimeByCourse: IAvgStudyTimeByCourse[];
  byProvince: {
    province: string;
    totalChws: number;
    activeChws: number;
    hospitals: number;
  }[];
  courseAnalytics: ICourseAnalytics | null;
  testScores: ITestScoreAnalytics | null;
  communications: ICommunicationsAnalytics | null;
  demographics: IDemographicsAnalytics | null;
  chwStats: ICHWStats | null;
  courseDuration: ICourseDurationStats | null;
  recentActivity: IRecentActivityFeed | null;
  monthlyActiveTrends: IMonthlyActiveTrends | null;
  certification: ICertificationAnalytics | null;
  supervisorResponseRate: ISupervisorResponseRate | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
}

const TOTAL_CHWS_NATIONAL = 58567;
const DASHBOARD_CACHE_MS = 1000 * 60 * 30;

interface AdoptionQueryResult {
  hospitals: IHospital[];
  enrollmentTrends: IEnrollmentTrend[];
  avgStudyTimeByCourse: IAvgStudyTimeByCourse[];
  courseAnalytics: ICourseAnalytics | null;
  testScores: ITestScoreAnalytics | null;
  communications: ICommunicationsAnalytics | null;
  demographics: IDemographicsAnalytics | null;
  chwStats: ICHWStats | null;
  courseDuration: ICourseDurationStats | null;
  recentActivity: IRecentActivityFeed | null;
  monthlyActiveTrends: IMonthlyActiveTrends | null;
  certification: ICertificationAnalytics | null;
  supervisorResponseRate: ISupervisorResponseRate | null;
}

export const useAdoptionStats = (
  filters: AnalyticsFilters = DEFAULT_DASHBOARD_FILTERS,
  enabled: boolean = true,
): AdoptionStats => {
  const qs = buildDashboardFilterQuery(filters);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: dashboardKeys.adoption(dashboardFilterKey(filters)),
    queryFn: async (): Promise<AdoptionQueryResult> => {
      const results = await Promise.allSettled([
        listAllHospitals(),
        getCourseAnalytics(qs),
        getStudentAnalytics(qs),
        getTestScoreAnalytics(qs),
        getCommunicationsAnalytics(qs),
        getDemographicsAnalytics(qs),
        getCHWDashboardStats(qs),
        getCourseDurationStats(qs),
        getRecentActivityFeed(qs),
        getMonthlyActiveTrends(qs),
        getCertificationAnalytics(qs),
        getSupervisorResponseRate(qs),
      ]);

      let hospitalList: IHospital[] = [];
      const hospitalsRes = results[0];
      if (hospitalsRes.status === "fulfilled") {
        hospitalList = hospitalsRes.value?.data ?? [];
      }

      let enrollmentTrends: IEnrollmentTrend[] = [];
      let courseAnalytics: ICourseAnalytics | null = null;
      const analyticsRes = results[1];
      if (analyticsRes.status === "fulfilled") {
        courseAnalytics = analyticsRes.value?.data ?? null;
        enrollmentTrends = courseAnalytics?.enrollmentTrends ?? [];
      }

      let avgStudyTimeByCourse: IAvgStudyTimeByCourse[] = [];
      const studentRes = results[2];
      if (studentRes.status === "fulfilled") {
        avgStudyTimeByCourse = studentRes.value?.data?.avgStudyTimeByCourse ?? [];
      }

      const testScores =
        results[3].status === "fulfilled" ? results[3].value?.data ?? null : null;
      const communications =
        results[4].status === "fulfilled" ? results[4].value?.data ?? null : null;
      const demographics =
        results[5].status === "fulfilled" ? results[5].value?.data ?? null : null;
      const chwStats =
        results[6].status === "fulfilled" ? results[6].value?.data ?? null : null;
      const courseDuration =
        results[7].status === "fulfilled" ? results[7].value?.data ?? null : null;
      const recentActivity =
        results[8].status === "fulfilled" ? results[8].value?.data ?? null : null;
      const monthlyActiveTrends =
        results[9].status === "fulfilled" ? results[9].value?.data ?? null : null;
      const certification =
        results[10].status === "fulfilled" ? results[10].value?.data ?? null : null;
      const supervisorResponseRate =
        results[11].status === "fulfilled" ? results[11].value?.data ?? null : null;

      return {
        hospitals: hospitalList,
        enrollmentTrends,
        avgStudyTimeByCourse,
        courseAnalytics,
        testScores,
        communications,
        demographics,
        chwStats,
        courseDuration,
        recentActivity,
        monthlyActiveTrends,
        certification,
        supervisorResponseRate,
      };
    },
    enabled,
    keepPreviousData: true,
    staleTime: DASHBOARD_CACHE_MS,
    gcTime: DASHBOARD_CACHE_MS,
  });

  const hospitals = data?.hospitals ?? [];
  const totalChws = hospitals.reduce((s, h) => s + (h.totalChws ?? 0), 0);
  const activeChws = hospitals.reduce((s, h) => s + (h.activeChws ?? 0), 0);
  const registrationRate = Math.round((totalChws / TOTAL_CHWS_NATIONAL) * 100);
  const activeRate = totalChws > 0 ? Math.round((activeChws / totalChws) * 100) : 0;

  const provinceMap = new Map<
    string,
    { totalChws: number; activeChws: number; hospitals: number }
  >();
  for (const h of hospitals) {
    const prov = h.province ?? "Unknown";
    const ex = provinceMap.get(prov) ?? {
      totalChws: 0,
      activeChws: 0,
      hospitals: 0,
    };
    provinceMap.set(prov, {
      totalChws: ex.totalChws + (h.totalChws ?? 0),
      activeChws: ex.activeChws + (h.activeChws ?? 0),
      hospitals: ex.hospitals + 1,
    });
  }

  const byProvince = Array.from(provinceMap.entries())
    .map(([province, stats]) => ({ province, ...stats }))
    .sort((a, b) => b.totalChws - a.totalChws);

  return {
    hospitals,
    totalChws,
    activeChws,
    registrationRate,
    activeRate,
    enrollmentTrends: data?.enrollmentTrends ?? [],
    avgStudyTimeByCourse: data?.avgStudyTimeByCourse ?? [],
    byProvince,
    courseAnalytics: data?.courseAnalytics ?? null,
    testScores: data?.testScores ?? null,
    communications: data?.communications ?? null,
    demographics: data?.demographics ?? null,
    chwStats: data?.chwStats ?? null,
    courseDuration: data?.courseDuration ?? null,
    recentActivity: data?.recentActivity ?? null,
    monthlyActiveTrends: data?.monthlyActiveTrends ?? null,
    certification: data?.certification ?? null,
    supervisorResponseRate: data?.supervisorResponseRate ?? null,
    isLoading,
    isFetching,
    error: error ? "Failed to fetch data. Please try again." : null,
    refetch: () => {
      void refetch();
    },
  };
};
