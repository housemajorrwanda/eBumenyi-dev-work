import React from "react";
import { Card } from "@/components/common/Card";
import { IStudentAnalytics } from "@/types";
import { BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TestScoreCardProps {
  studentAnalytics: IStudentAnalytics | null;
}

export const TestScoreCard: React.FC<TestScoreCardProps> = ({
  studentAnalytics,
}) => {
  if (!studentAnalytics || !studentAnalytics.performanceDistribution) {
    return (
      <Card>
        <div className='flex items-center gap-2 mb-4'>
          <BarChart2 size={20} className='text-[#3363AD]' />
          <h3 className='text-lg font-semibold text-gray-800'>
            CHW Performance
          </h3>
        </div>
        <div className='flex items-center justify-center h-40'>
          <p className='text-gray-500 text-sm'>No data available</p>
        </div>
      </Card>
    );
  }

  const { performanceDistribution, topPerformers } = studentAnalytics;

  const chartData = [
    { name: "Excellent", range: performanceDistribution.excellent.range, value: performanceDistribution.excellent.count, fill: "#3363AD" },
    { name: "Good",      range: performanceDistribution.good.range,      value: performanceDistribution.good.count,      fill: "#22c55e" },
    { name: "Average",   range: performanceDistribution.average.range,   value: performanceDistribution.average.count,   fill: "#f59e0b" },
    { name: "Poor",      range: performanceDistribution.poor.range,      value: performanceDistribution.poor.count,      fill: "#f97316" },
    { name: "Failing",   range: performanceDistribution.failing.range,   value: performanceDistribution.failing.count,   fill: "#ef4444" },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const item = chartData.find((d) => d.name === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={11} fontWeight={500}>
          {payload.value}
        </text>
        {item?.range && (
          <text x={0} y={0} dy={26} textAnchor="middle" fill="#9ca3af" fontSize={9}>
            {item.range}
          </text>
        )}
      </g>
    );
  };

  // Calculate average score from top performers
  const avgScore =
    topPerformers && topPerformers.length > 0
      ? topPerformers.reduce((sum, p) => sum + p.avgScore, 0) / topPerformers.length
      : 0;

  return (
    <Card>
      <div className='flex items-center gap-2 mb-4'>
        <BarChart2 size={20} className='text-[#3363AD]' />
        <h3 className='text-lg font-semibold text-gray-800'>CHW Performance</h3>
      </div>

      <div style={{ height: "200px" }}>
        <ResponsiveContainer width='100%' height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 20, bottom: 40 }}
            barSize={40}
          >
            <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
            <XAxis
              dataKey='name'
              tick={<CustomXAxisTick />}
              axisLine={false}
              tickLine={false}
              height={50}
              label={{
                value: "Performance Level",
                position: "insideBottomRight",
                offset: -8,
                style: { fontSize: 10, fill: "#9ca3af" },
              }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "CHW",
                angle: -90,
                position: "insideLeft",
                dx: -12,
                style: { fontSize: 10, fill: "#9ca3af", textAnchor: "middle" },
              }}
            />
            <Tooltip
              formatter={(value: number) => [value, "CHW"]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey='value' radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className='mt-3 flex items-center gap-2 text-sm text-gray-600'>
        <span>Average Score:</span>
        <span className='font-semibold text-[#3363AD]'>{avgScore.toFixed(1)}%</span>
      </div>
    </Card>
  );
};
