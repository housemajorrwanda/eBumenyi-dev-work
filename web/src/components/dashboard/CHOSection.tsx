import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BarChart2,
  UserPlus,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  Activity,
  MapPin,
} from "lucide-react";
import { getMyGroup, getGroupMonitoring } from "@/services/choGroup.service";
import { ICHOGroupMonitoringMember } from "@/types";

/* ─── Avatar ─────────────────────────────────────────────────────── */
const Avatar: React.FC<{ name: string; photo: string | null; size?: string }> = ({
  name,
  photo,
  size = "w-9 h-9",
}) => {
  const [failed, setFailed] = React.useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? "??";
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${size} rounded-full object-cover shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-[#EBF0F9] text-[#3363AD] flex items-center justify-center text-xs font-bold shrink-0`}
    >
      {initials}
    </div>
  );
};

/* ─── Member row ─────────────────────────────────────────────────── */
const MemberRow: React.FC<{ member: ICHOGroupMonitoringMember }> = ({ member }) => {
  const avgProgress =
    member.courseProgress.length > 0
      ? Math.round(
          member.courseProgress.reduce((s, c) => s + c.progress, 0) /
            member.courseProgress.length,
        )
      : 0;
  const completed = member.courseProgress.filter((c) => c.isCompleted).length;
  const total = member.courseProgress.length;

  const barColor =
    avgProgress === 100
      ? "bg-emerald-500"
      : avgProgress > 50
        ? "bg-[#3363AD]"
        : "bg-amber-400";

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors group">
      <Avatar name={member.user.fullNames} photo={member.user.photo} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#3363AD] transition-colors">
            {member.user.fullNames}
          </p>
          <span className="text-xs font-semibold text-gray-500 ml-2 shrink-0">
            {avgProgress}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${avgProgress}%` }}
          />
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-gray-400">
            {completed}/{total} course{total !== 1 ? "s" : ""} completed
          </span>
        </div>
      </div>

      {avgProgress === 100 && (
        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
      )}
    </div>
  );
};

/* ─── Stat card ──────────────────────────────────────────────────── */
const StatCard: React.FC<{
  value: string | number;
  label: string;
  Icon: React.ElementType;
  accent: string;
  bg: string;
  isLoading?: boolean;
}> = ({ value, label, Icon, accent, bg, isLoading }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
      <Icon size={20} className={accent} />
    </div>
    <div>
      <p className={`text-2xl font-extrabold ${isLoading ? "text-gray-200 animate-pulse" : "text-gray-900"}`}>
        {isLoading ? "—" : value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  </div>
);

/* ─── Main CHO section ───────────────────────────────────────────── */
export const CHOSection: React.FC = () => {
  const navigate = useNavigate();

  const { data: group } = useQuery({
    queryKey: ["cho-group-mine"],
    queryFn: getMyGroup,
    retry: false,
  });

  const { data: monitoring, isLoading } = useQuery({
    queryKey: ["cho-group-monitoring"],
    queryFn: getGroupMonitoring,
    retry: false,
  });

  const members = monitoring?.members ?? [];

  const avgGroupProgress =
    members.length > 0
      ? Math.round(
          members.reduce((s, m) => {
            const avg =
              m.courseProgress.length > 0
                ? m.courseProgress.reduce((a, c) => a + c.progress, 0) /
                  m.courseProgress.length
                : 0;
            return s + avg;
          }, 0) / members.length,
        )
      : 0;

  const completedCount = members.filter((m) =>
    m.courseProgress.some((c) => c.isCompleted),
  ).length;

  const activeCount = members.filter((m) =>
    m.courseProgress.some((c) => c.progress > 0 && !c.isCompleted),
  ).length;

  return (
    <div className="space-y-5">
      {/* ── Section header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#EBF0F9] flex items-center justify-center">
            <Users size={14} className="text-[#3363AD]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {group ? group.name : "My CHW Group"}
            </h2>
            {(group?.sectors?.length ?? 0) > 0 && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> {group!.sectors!.join(", ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate("/cho-group")}
          className="text-xs text-[#3363AD] hover:underline flex items-center gap-0.5"
        >
          View group <ChevronRight size={12} />
        </button>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          value={monitoring?.totalMembers ?? 0}
          label="Total CHWs"
          Icon={Users}
          bg="bg-[#EBF0F9]"
          accent="text-[#3363AD]"
          isLoading={isLoading}
        />
        <StatCard
          value={activeCount}
          label="Actively Learning"
          Icon={Activity}
          bg="bg-amber-50"
          accent="text-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          value={completedCount}
          label="Completed a Course"
          Icon={CheckCircle2}
          bg="bg-emerald-50"
          accent="text-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          value={`${avgGroupProgress}%`}
          label="Avg Group Progress"
          Icon={TrendingUp}
          bg="bg-purple-50"
          accent="text-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* ── Main grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — member list (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EBF0F9] flex items-center justify-center">
                <BarChart2 size={14} className="text-[#3363AD]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">Member Progress</h3>
              {members.length > 0 && (
                <span className="text-xs bg-[#EBF0F9] text-[#3363AD] font-semibold px-2 py-0.5 rounded-full">
                  {members.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/cho-group")}
              className="text-xs text-[#3363AD] hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#EBF0F9] flex items-center justify-center mb-3">
                <Users size={20} className="text-[#3363AD]/40" />
              </div>
              <p className="text-sm font-medium text-gray-500">No members yet</p>
              <p className="text-xs text-gray-400 mt-1">Invite CHW members to your group</p>
              <button
                onClick={() => navigate("/cho-group/invite")}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3363AD] rounded-lg hover:bg-[#2a52a0] transition-colors"
              >
                Invite CHW
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {members.slice(0, 6).map((m) => (
                <MemberRow key={m.studentId} member={m} />
              ))}
              {members.length > 6 && (
                <button
                  onClick={() => navigate("/cho-group")}
                  className="w-full text-xs text-[#3363AD] hover:underline pt-2 pb-1 text-center"
                >
                  +{members.length - 6} more members
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right — quick actions (1/3) */}
        <div className="lg:col-span-1 space-y-3">
          {[
            {
              label: "My Group",
              desc: "View and manage CHWs",
              Icon: Users,
              path: "/cho-group",
              bg: "bg-[#EBF0F9]",
              color: "text-[#3363AD]",
            },
            {
              label: "Add CHW",
              desc: "Add new members",
              Icon: UserPlus,
              path: "/cho-group/invite",
              bg: "bg-amber-50",
              color: "text-amber-600",
            },
          ].map(({ label, desc, Icon, path, bg, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-sm transition-shadow flex items-center gap-3 group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                <Icon size={17} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-[#3363AD] transition-colors">
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-[#3363AD] transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
