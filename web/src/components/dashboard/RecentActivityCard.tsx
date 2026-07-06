import React, { useState } from "react";
import { BookOpen, ClipboardCheck, RefreshCw, Activity } from "lucide-react";
import { Card } from "@/components/common/Card";
import { IActivityItem, IRecentActivityFeed, ActivityType } from "@/types";

interface RecentActivityCardProps {
  data: IRecentActivityFeed | null;
  isLoading: boolean;
}

type TabKey = "all" | "enrollments" | "submissions" | "courseUpdates";

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { key: "all", label: "All", icon: <Activity size={13} /> },
  { key: "enrollments", label: "Enrollments", icon: <BookOpen size={13} /> },
  { key: "submissions", label: "Submissions", icon: <ClipboardCheck size={13} /> },
  { key: "courseUpdates", label: "Course Updates", icon: <RefreshCw size={13} /> },
];

const PRIMARY_COLOR = "#3363AD";

const withOpacity = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace("#", "");
  const normalized =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TYPE_COLORS: Record<ActivityType, string> = {
  enrollment: PRIMARY_COLOR,
  submission: withOpacity(PRIMARY_COLOR, 0.82),
  courseUpdate: withOpacity(PRIMARY_COLOR, 0.64),
};

const TYPE_BG: Record<ActivityType, string> = {
  enrollment: "bg-blue-50",
  submission: "bg-blue-50",
  courseUpdate: "bg-blue-50",
};

// Generate initials from full name
const getInitials = (name: string): string => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// Relative time formatter
const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const ActivityRow: React.FC<{ item: IActivityItem }> = ({ item }) => (
  <div className='flex items-start gap-3 py-3 border-b border-gray-50 last:border-0'>
    {/* Avatar */}
    {item.actorPhoto ? (
      <img
        src={item.actorPhoto}
        alt={item.actorName}
        className='w-8 h-8 rounded-full object-cover shrink-0'
      />
    ) : (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center
                    text-xs font-semibold shrink-0 ${TYPE_BG[item.type]}`}
        style={{
          color: TYPE_COLORS[item.type],
          backgroundColor: withOpacity(
            PRIMARY_COLOR,
            item.type === "enrollment"
              ? 0.08
              : item.type === "submission"
                ? 0.12
                : 0.16,
          ),
        }}
      >
        {getInitials(item.actorName)}
      </div>
    )}

    {/* Content */}
    <div className='flex-1 min-w-0'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-gray-800 leading-tight'>
            {item.title}
          </p>
          <p className='text-xs text-gray-500 mt-0.5 flex items-center gap-1'>
            <span className='font-medium text-gray-600 truncate'>
              {item.actorName}
            </span>
            <span className='text-gray-300'>→</span>
            <span className='truncate' style={{ color: TYPE_COLORS[item.type] }}>
              {item.subject}
            </span>
          </p>
          {item.score !== null && (
            <p className='text-xs text-gray-400 mt-0.5'>
              Score:{" "}
              <span className='font-semibold text-gray-600'>{item.score}%</span>
            </p>
          )}
        </div>
        <span className='text-xs text-gray-400 shrink-0 mt-0.5'>
          {relativeTime(item.timestamp)}
        </span>
      </div>
    </div>
  </div>
);

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  data,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const items: IActivityItem[] = data?.[activeTab] ?? [];

  // Summary line for header — count per type from "all"
  const allItems = data?.all ?? [];
  const enrollCount = allItems.filter((i) => i.type === "enrollment").length;
  const subCount = allItems.filter((i) => i.type === "submission").length;
  const updateCount = allItems.filter((i) => i.type === "courseUpdate").length;

  return (
    <Card padding={false}>
      <div className='p-4 pb-0'>
        {/* Header */}
        <div className='flex items-center justify-between mb-1'>
          <h3 className='text-sm font-semibold text-gray-800'>Recent Activity</h3>
        </div>

        {/* AI-style summary line */}
        <p className='text-xs text-gray-400 mb-3'>
          <span className='font-medium text-[#3363AD]'>Summary: </span>
          {enrollCount} enrollment{enrollCount !== 1 ? "s" : ""}, {subCount}{" "}
          submission{subCount !== 1 ? "s" : ""}, {updateCount} course update
          {updateCount !== 1 ? "s" : ""}
        </p>

        {/* Tab bar */}
        <div className='flex border-b border-gray-100'>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                         transition-colors border-b-2 -mb-px ${
                           activeTab === tab.key
                             ? "border-[#3363AD] text-[#3363AD]"
                             : "border-transparent text-gray-500 hover:text-gray-700"
                         }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity list */}
      <div className='px-4 pb-2 overflow-y-auto' style={{ maxHeight: 680 }}>
        {isLoading ? (
          <div className='space-y-3 pt-3 animate-pulse'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='flex gap-3'>
                <div className='w-8 h-8 bg-gray-100 rounded-full shrink-0' />
                <div className='flex-1 space-y-1.5'>
                  <div className='h-3 bg-gray-100 rounded w-3/4' />
                  <div className='h-3 bg-gray-100 rounded w-1/2' />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='flex items-center justify-center h-32 text-sm text-gray-400'>
            No recent activity
          </div>
        ) : (
          <div className='pt-1'>
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
