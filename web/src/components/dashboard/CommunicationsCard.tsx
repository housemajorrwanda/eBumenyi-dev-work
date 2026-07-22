import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { ICommunicationsAnalytics } from "@/types";

interface CommunicationsCardProps {
  data: ICommunicationsAnalytics | null;
  filteredTrend?: ICommunicationsAnalytics["monthlyTrend"];
}

const TYPE_COLORS: Record<string, string> = {
  peerToPeer: "#3363AD",
  chwToSupervisor: "#5B86C4",
  community: "#82A5D6",
};

export const CommunicationsCard: React.FC<CommunicationsCardProps> = ({
  data,
  filteredTrend,
}) => {
  if (!data) {
    return (
      <Card>
        <DashboardSectionHeader
          icon={<MessageSquare size={16} />}
          title='Communications'
        />
        <div className='flex items-center justify-center h-40 text-sm text-gray-400'>
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <DashboardSectionHeader
        icon={<MessageSquare size={16} />}
        title='Communications'
      />

      {/* Total + this month */}
      <div className='flex items-center gap-4 mb-4'>
        <div>
          <p className='text-2xl font-bold text-gray-800'>
            {data.total.toLocaleString()}
          </p>
          <p className='text-xs text-gray-500'>Total messages</p>
        </div>
        <div className='h-10 w-px bg-gray-100' />
        <div>
          <p className='text-2xl font-bold text-[#3363AD]'>
            {data.thisMonth.toLocaleString()}
          </p>
          <p className='text-xs text-gray-500'>This month</p>
        </div>
      </div>

      {/* Type breakdown bars */}
      <div className='space-y-2.5 mb-4'>
        {data.byType.map((t) => {
          const pct = data.total > 0 ? Math.round((t.count / data.total) * 100) : 0;
          return (
            <div key={t.type} className='flex items-center gap-3'>
              <span className='w-32 text-xs text-gray-600 shrink-0'>
                {t.type === "peerToPeer"
                  ? "Peer-to-peer"
                  : t.type === "chwToSupervisor"
                    ? "CHW ↔ Supervisor"
                    : "Community posts"}
              </span>
              <div className='flex-1 bg-gray-100 rounded-full h-2'>
                <div
                  className='h-2 rounded-full transition-all duration-500'
                  style={{
                    width: `${pct}%`,
                    background: TYPE_COLORS[t.type] ?? "#94a3b8",
                  }}
                />
              </div>
              <span className='text-xs font-medium text-gray-700 w-8 text-right shrink-0'>
                {t.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Monthly trend stacked bar */}
      <div style={{ height: 160 }}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            data={filteredTrend ?? data.monthlyTrend}
            margin={{ top: 0, right: 8, left: 20, bottom: 32 }}
            barSize={40}
          >
            <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
            <XAxis
              dataKey='month'
              tick={{ fontSize: 9 }}
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
              tick={{ fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Messages",
                angle: -90,
                position: "insideLeft",
                dx: -12,
                style: { fontSize: 10, fill: "#9ca3af", textAnchor: "middle" },
              }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
            <Bar
              dataKey='peerToPeer'
              name='Peer-to-peer'
              stackId='a'
              fill='#3363AD'
            />
            <Bar
              dataKey='chwToSupervisor'
              name='CHW ↔ Supervisor'
              stackId='a'
              fill='#5B86C4'
            />
            <Bar
              dataKey='community'
              name='Community posts'
              stackId='a'
              fill='#82A5D6'
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
