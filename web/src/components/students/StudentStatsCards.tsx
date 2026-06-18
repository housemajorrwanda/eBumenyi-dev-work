import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserMinus, BarChart2 } from "lucide-react";
import { MetricCard } from "@/components/common/MetricCard";
import { getStudentAnalytics } from "@/services/analytics.service";
import { studentKeys } from "@/utils/constants/queryKeys";

interface StudentStatsCardsProps {
  roleFilter?: "TRAINEE" | "TESTER" | "CHO";
}

const buildStudentAnalyticsQuery = (roleFilter?: "TRAINEE" | "TESTER" | "CHO") => {
  return roleFilter ? `role=${roleFilter}` : "";
};

const getRoleLabel = (roleFilter?: "TRAINEE" | "TESTER" | "CHO") => {
  if (roleFilter === "TESTER") return "Tester";
  if (roleFilter === "CHO") return "CHO";
  return "CHW";
};

const StudentStatsCards = ({ roleFilter }: StudentStatsCardsProps) => {
  const query = buildStudentAnalyticsQuery(roleFilter);
  const { data, isLoading } = useQuery({
    queryKey: studentKeys.stats(roleFilter),
    queryFn: () => getStudentAnalytics(query),
  });

  if (isLoading) {
    return (
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse'>
        {[...Array(4)].map((_, i) => (
          <div key={i} className='h-32 bg-gray-100 rounded-xl' />
        ))}
      </div>
    );
  }

  const analytics = data?.data;
  if (!analytics) return null;

  const { totalStudents, activeStudents, onLeaveStudents, completionRate } =
    analytics;
  const roleLabel = getRoleLabel(roleFilter);
  const roleLabelPlural = `${roleLabel}s`;

  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
      <MetricCard
        title={`Total ${roleLabelPlural}`}
        value={totalStudents.value.toLocaleString()}
        icon={<Users size={18} />}
        iconBg='bg-[#EBF0F9]'
        iconColor='text-[#3363AD]'
        trend={totalStudents.trend}
        description='vs last 30 days'
      />
      <MetricCard
        title={`Active ${roleLabelPlural}`}
        value={activeStudents.value.toLocaleString()}
        icon={<UserCheck size={18} />}
        iconBg='bg-emerald-50'
        iconColor='text-emerald-600'
        trend={activeStudents.trend}
        description='vs last 30 days'
      />
      <MetricCard
        title={`On Leave ${roleLabelPlural}`}
        value={onLeaveStudents.value.toLocaleString()}
        icon={<UserMinus size={18} />}
        iconBg='bg-amber-50'
        iconColor='text-amber-500'
        trend={onLeaveStudents.trend}
        description='Inactive or suspended'
      />
      <MetricCard
        title={`Avg ${roleLabel} Progress`}
        value={`${completionRate.value}%`}
        icon={<BarChart2 size={18} />}
        iconBg='bg-purple-50'
        iconColor='text-purple-500'
        trend={completionRate.trend}
        description='Course completion rate'
      />
    </div>
  );
};

export default StudentStatsCards;
