import React from "react";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { ICHWStats, ITestScoreAnalytics } from "@/types";

interface AssessmentOverviewCardProps {
  chwStats: ICHWStats | null;
  testScores: ITestScoreAnalytics | null;
}

interface OverviewRow {
  label: string;
  current: number | string;
  total: number | string;
  barWidth: number;      // 0-100
  barColor: string;
  subLabel?: string;
}

const OverviewItem: React.FC<OverviewRow> = ({
  label,
  current,
  total,
  barWidth,
  barColor,
  subLabel,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-gray-700 shrink-0">
          {label}
        </span>
        {subLabel && (
          <span className="text-xs text-gray-400 truncate">{subLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span className="text-sm font-bold text-gray-800">
          {current}
          <span className="text-gray-400 font-normal"> / {total}</span>
        </span>
      </div>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{
          width: `${Math.min(Math.max(barWidth, 0), 100)}%`,
          background: barColor,
        }}
      />
    </div>
  </div>
);

export const AssessmentOverviewCard: React.FC<AssessmentOverviewCardProps> = ({
  chwStats,
  testScores,
}) => {
  const totalStudents = chwStats?.chws.total ?? 0;
  const totalAttempts = chwStats?.tests.total ?? 0;
  const preTest       = chwStats?.tests.preTest ?? 0;
  const midTest       = chwStats?.tests.midTest ?? 0;
  const finalTest     = chwStats?.tests.finalTest ?? 0;
  const finalExam     = chwStats?.tests.finalExam ?? 0;
  const postTotal     = finalTest + finalExam;

  // Average score across all courses that have data
  const overallAvg = (() => {
    if (!testScores?.byCourse?.length) return 0;
    const withData = testScores.byCourse.filter(
      (c) => c.meanPreTest !== null || c.meanFinalTest !== null,
    );
    if (!withData.length) return 0;
    const sum = withData.reduce((acc, c) => {
      const score =
        c.meanPreTest !== null && c.meanFinalTest !== null
          ? (c.meanPreTest + c.meanFinalTest) / 2
          : (c.meanPreTest ?? c.meanFinalTest ?? 0);
      return acc + score;
    }, 0);
    return Math.round(sum / withData.length);
  })();

  const avgBarColor =
    overallAvg >= 70
      ? "rgba(51, 99, 173, 1)"
      : overallAvg >= 50
      ? "rgba(51, 99, 173, 0.7)"
      : overallAvg > 0
      ? "rgba(51, 99, 173, 0.4)"
      : "#e2e8f0";

  const avgSubLabel =
    overallAvg >= 70
      ? "Above target"
      : overallAvg >= 50
      ? "Near target"
      : overallAvg > 0
      ? "Below target"
      : "No score data yet";

  const rows: OverviewRow[] = [
    {
      label: "Total Attempts",
      current: totalAttempts,
      total: totalStudents > 0 ? totalStudents : "—",
      barWidth: totalStudents > 0
        ? Math.min(Math.round((totalAttempts / totalStudents) * 100), 100)
        : 0,
      barColor: "rgba(51, 99, 173, 1)",
      subLabel: `${preTest} pre · ${midTest} mid · ${postTotal} final`,
    },
    {
      label: "Pre-Test Coverage",
      current: preTest,
      total: totalStudents > 0 ? totalStudents : "—",
      barWidth: totalStudents > 0
        ? Math.round((preTest / totalStudents) * 100)
        : 0,
      barColor: "rgba(51, 99, 173, 0.7)",
      subLabel: totalStudents > 0
        ? `${Math.round((preTest / totalStudents) * 100)}% of CHWs`
        : undefined,
    },
    {
      label: "Final Test Coverage",
      current: postTotal,
      total: totalStudents > 0 ? totalStudents : "—",
      barWidth: totalStudents > 0
        ? Math.round((postTotal / totalStudents) * 100)
        : 0,
      barColor: "rgba(51, 99, 173, 0.4)",
      subLabel: `${finalTest} final test · ${finalExam} final exam`,
    },
    {
      label: "Average Score",
      current: overallAvg > 0 ? `${overallAvg}%` : "—",
      total: overallAvg > 0
        ? `${testScores?.byCourse?.filter(
            (c) => c.meanPreTest !== null || c.meanFinalTest !== null
          ).length ?? 0} courses`
        : "—",
      barWidth: overallAvg,
      barColor: avgBarColor,
      subLabel: avgSubLabel,
    },
  ];

  return (
    <Card>
      <DashboardSectionHeader
        icon={<ClipboardList size={16} />}
        title="Assessment Overview"
      />
      <div className="space-y-5">
        {rows.map((row) => (
          <OverviewItem key={row.label} {...row} />
        ))}
      </div>
    </Card>
  );
};
