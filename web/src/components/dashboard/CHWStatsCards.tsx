import React from "react";
import {
  Users,
  CheckCircle,
  ClipboardList,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { ICHWStats, IActivationTrend } from "@/types";

interface CHWStatsCardsProps {
  data: ICHWStats | null;
  isLoading: boolean;
}

interface SubItem {
  label: string;
  value: number;
}

interface CardConfig {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  primary: string | number;
  subItems: SubItem[];
  activationRate?: number;
  activationTrend?: IActivationTrend | null;
}

/**
 * Always shows the rate as visible text ("11% activated") so the meaning is
 * clear without hovering. The up/down/stable arrow only appears once there's
 * a real 30-day-old baseline to compare against — right after this feature
 * ships there's no history yet, so the arrow is omitted rather than showing
 * a misleading "+100%" cold-start spike.
 */
const ActivationBadge: React.FC<{
  rate: number;
  trend: IActivationTrend | null | undefined;
}> = ({ rate, trend }) => (
  <div
    className={`flex items-center gap-1 text-xs font-medium shrink-0 ${
      !trend
        ? "text-gray-400"
        : trend.direction === "up"
          ? "text-green-600"
          : trend.direction === "down"
            ? "text-red-500"
            : "text-gray-400"
    }`}
    title="% of CHWs/supervisors who have logged in at least once"
  >
    {trend?.direction === "up" && <TrendingUp size={12} />}
    {trend?.direction === "down" && <TrendingDown size={12} />}
    {trend?.direction === "stable" && <Minus size={12} />}
    <span>{rate}% activated</span>
  </div>
);

const CHWStatCard: React.FC<CardConfig> = ({
  icon,
  iconBg,
  iconColor,
  title,
  primary,
  subItems,
  activationRate,
  activationTrend,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow duration-200">
    {/* Main card content */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{primary}</p>
        </div>
      </div>
      {activationRate !== undefined && (
        <ActivationBadge rate={activationRate} trend={activationTrend} />
      )}
    </div>

    {/* Sub items below */}
    {subItems.length > 0 && (
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {subItems.map((item) => (
            <span
              key={item.label}
              className="text-xs font-medium text-[#3363AD]"
            >
              {item.value.toLocaleString()}{" "}
              <span className="font-normal text-gray-500">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

export const CHWStatsCards: React.FC<CHWStatsCardsProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      icon: <Users size={22} />,
      iconBg: "bg-[#3363AD]/10",
      iconColor: "text-[#3363AD]",
      title: "Total CHW",
      primary: data?.chws.total ?? 0,
      activationRate: data?.chws.activationRate ?? 0,
      activationTrend: data?.chws.activationTrend,
      subItems: [
        {
          label: "active",
          value: data?.chws.active ?? 0,
        },
        {
          label: "inactive",
          value: data?.chws.inactive ?? 0,
        },
        {
          label: "avg logins",
          value: data?.chws.avgLogins ?? 0,
        },
      ],
    },
    {
      icon: <CheckCircle size={22} />,
      iconBg: "bg-[#3363AD]/10",
      iconColor: "text-[#3363AD]",
      title: "Course Completion",
      primary: `${data?.completion.rate ?? 0}%`,
      subItems: [
        {
          label: "courses completed",
          value: data?.completion.completed ?? 0,
        },
        {
          label: "enrollments",
          value: data?.completion.total ?? 0,
        },
      ],
    },
    {
      icon: <ClipboardList size={22} />,
      iconBg: "bg-[#3363AD]/10",
      iconColor: "text-[#3363AD]",
      title: "Test Attempts",
      primary: data?.tests.total ?? 0,
      subItems: [
        {
          label: "pre-test",
          value: data?.tests.preTest ?? 0,
        },
        // {
        //   label: "mid-test",
        //   value: data?.tests.midTest ?? 0,
        // },
        {
          label: "final-test",
          value: data?.tests.finalTest ?? 0,
        },
        {
          label: "final-exam",
          value: data?.tests.finalExam ?? 0,
        },
      ],
    },
    {
      icon: <UserCheck size={22} />,
      iconBg: "bg-[#3363AD]/10",
      iconColor: "text-[#3363AD]",
      title: "Total CEHO",
      primary: data?.supervisors.total ?? 0,
      activationRate: data?.supervisors.activationRate ?? 0,
      activationTrend: data?.supervisors.activationTrend,
      subItems: [
        {
          label: "male",
          value: data?.supervisors.male ?? 0,
        },
        {
          label: "female",
          value: data?.supervisors.female ?? 0,
        },
        {
          label: "avg logins",
          value: data?.supervisors.avgLogins ?? 0,
        },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <CHWStatCard key={i} {...card} />
      ))}
    </div>
  );
};
