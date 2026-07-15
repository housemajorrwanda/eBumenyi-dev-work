import { useQuery } from "@tanstack/react-query";
import { getMyCertificates, IMyCertificate } from "@/services/certificates.service";
import { getStudentStatistics, IStudentStatistics } from "@/services/progress.service";
import { dashboardKeys } from "@/utils/constants/queryKeys";

const DASHBOARD_CACHE_MS = 1000 * 60 * 30;

interface LearnerDashboardData {
  studentStats: IStudentStatistics | null;
  certificates: IMyCertificate[];
  totalCertificates: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useLearnerDashboard = (): LearnerDashboardData => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dashboardKeys.learner(),
    queryFn: async () => {
      const [stats, certs] = await Promise.all([
        getStudentStatistics(),
        getMyCertificates(),
      ]);
      return { studentStats: stats, certificates: certs };
    },
    staleTime: DASHBOARD_CACHE_MS,
    gcTime: DASHBOARD_CACHE_MS,
  });

  const certificates = data?.certificates ?? [];

  return {
    studentStats: data?.studentStats ?? null,
    certificates,
    totalCertificates: certificates.length,
    isLoading,
    error: error ? "Failed to fetch data. Please try again." : null,
    refetch: () => {
      void refetch();
    },
  };
};
