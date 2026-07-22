import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { IMonthlyActiveTrends } from "@/types";

interface MonthlyActiveTrendsChartProps {
  data: IMonthlyActiveTrends | null;
}

export const MonthlyActiveTrendsChart: React.FC<MonthlyActiveTrendsChartProps> = ({
  data,
}) => {
  const chartData = (data?.activeUsersTrend ?? []).map((row, i) => ({
    month: row.month,
    activeUsers: row.activeUsers,
    activeCHWs: data?.activeCHWTrend?.[i]?.activeCHWs ?? 0,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <DashboardSectionHeader
          icon={<Activity size={16} />}
          title="Monthly Active Trend"
        />
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <DashboardSectionHeader
        icon={<Activity size={16} />}
        title="Monthly Active Trend"
      />
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 20, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Month",
                position: "insideBottomRight",
                offset: -8,
                style: { fontSize: 10, fill: "#9ca3af" },
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Active",
                angle: -90,
                position: "insideLeft",
                dx: -12,
                style: { fontSize: 10, fill: "#9ca3af", textAnchor: "middle" },
              }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                boxShadow: "none",
              }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="activeUsers"
              stroke="#3363AD"
              strokeWidth={2}
              dot={{ fill: "#3363AD", r: 4 }}
              activeDot={{ r: 6 }}
              name="Active Users"
            />
            <Line
              type="monotone"
              dataKey="activeCHWs"
              stroke="#82A5D6"
              strokeWidth={2}
              dot={{ fill: "#82A5D6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Active CHWs"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
