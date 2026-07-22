import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  CheckCircle2,
  Users,
  TrendingUp,
  Activity,
  Award,
} from "lucide-react";
import { getGroupMonitoring } from "@/services/cehoGroup.service";
import { ICEHOGroupMonitoringMember } from "@/types";
import { MetricCard } from "@/components/common/MetricCard";
import { Button } from "@/components/common/Button";

const MemberAvatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const [failed, setFailed] = useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? "??";
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[#EBF0F9] text-[#3363AD] flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
};

function ProgressBar({ value, completed }: { value: number; completed: boolean }) {
  const color = completed ? "bg-emerald-500" : value > 50 ? "bg-[#3363AD]" : "bg-amber-400";
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function MemberCard({ member }: { member: ICEHOGroupMonitoringMember }) {
  const [expanded, setExpanded] = useState(false);

  const completed = member.courseProgress.filter((c) => c.isCompleted).length;
  const total = member.courseProgress.length;
  const avgProgress =
    total > 0
      ? Math.round(member.courseProgress.reduce((s, c) => s + c.progress, 0) / total)
      : 0;
  const passing = member.recentTestAttempts.filter((a) => a.marks >= 70).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <button
        type="button"
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <MemberAvatar name={member.user.fullNames} photo={member.user.photo} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{member.user.fullNames}</p>
            {member.recentTestAttempts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 shrink-0">
                <Award className="w-2.5 h-2.5" />
                {passing}/{member.recentTestAttempts.length} tests passed
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-1.5">
            <ProgressBar value={avgProgress} completed={avgProgress === 100} />
            <span className="text-xs font-bold text-gray-600 w-8 text-right shrink-0">
              {avgProgress}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3363AD] bg-[#EBF0F9] rounded-full px-2 py-0.5">
              <BookOpen className="w-2.5 h-2.5" />
              {total} course{total !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {completed} completed
            </span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/40">
          {member.courseProgress.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">No courses started yet</p>
          ) : (
            <div className="space-y-3">
              {member.courseProgress.map((cp) => (
                <div key={cp.courseId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm text-gray-700 truncate pr-3">{cp.courseTitle}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {cp.isCompleted && (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                          Done
                        </span>
                      )}
                      <span className="text-xs font-bold" style={{ color: cp.isCompleted ? "#059669" : "#3363AD" }}>
                        {Math.round(cp.progress)}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={cp.progress} completed={cp.isCompleted} />
                </div>
              ))}
            </div>
          )}

          {member.recentTestAttempts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Recent test scores
              </p>
              <div className="flex flex-wrap gap-2">
                {member.recentTestAttempts.slice(0, 6).map((a) => (
                  <span
                    key={a.id}
                    className={`text-xs font-bold rounded-full px-3 py-1 ${
                      a.marks >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {a.marks}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CEHOGroupMonitoringPage = () => {
  const [search, setSearch] = useState("");

  const { data: monitoring, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ceho-group-monitoring"],
    queryFn: getGroupMonitoring,
  });

  const members = monitoring?.members ?? [];
  const filtered = members.filter((m) =>
    m.user.fullNames.toLowerCase().includes(search.toLowerCase()),
  );

  const avgGroupProgress =
    members.length > 0
      ? Math.round(
          members.reduce((s, m) => {
            const a = m.courseProgress.length
              ? m.courseProgress.reduce((x, c) => x + c.progress, 0) / m.courseProgress.length
              : 0;
            return s + a;
          }, 0) / members.length,
        )
      : 0;

  const completedCount = members.filter((m) => m.courseProgress.some((c) => c.isCompleted)).length;
  const activeCount = members.filter((m) =>
    m.courseProgress.some((c) => c.progress > 0 && !c.isCompleted),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/ceho-group"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-[#333333]">Group Monitoring</h2>
            <p className="text-sm text-gray-500">
              {monitoring
                ? `${monitoring.groupName} — individual learning progress`
                : "Track individual CHW learning progress"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total CHWs"
          value={monitoring?.totalMembers ?? 0}
          icon={<Users size={18} />}
          iconBg="bg-[#EBF0F9]"
          iconColor="text-[#3363AD]"
        />
        <MetricCard
          title="Actively Learning"
          value={activeCount}
          icon={<Activity size={18} />}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <MetricCard
          title="Completed a Course"
          value={completedCount}
          icon={<CheckCircle2 size={18} />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          title="Avg Group Progress"
          value={`${avgGroupProgress}%`}
          icon={<TrendingUp size={18} />}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
        />
      </div>

      {/* Member list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {search ? "No members match your search" : "No data available"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <MemberCard key={member.studentId} member={member} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CEHOGroupMonitoringPage;
