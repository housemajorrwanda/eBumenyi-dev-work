import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Award, ChevronDown } from "lucide-react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { ICertificationAnalytics, IDashboardFilters } from "@/types";

interface CertificationRateCardProps {
  data: ICertificationAnalytics | null;
  filters: IDashboardFilters;
}

type TabKey = "total" | "course" | "district" | "facility";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "course", label: "Per Course" },
  { key: "district", label: "Per District" },
  { key: "facility", label: "Per Facility" },
];

const PIE_COLORS = ["#3363AD", "#94a3b8"];

const truncate = (str: string, n = 14) =>
  str.length > n ? str.slice(0, n) + "…" : str;

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  boxShadow: "none",
};

type GoToIssuedExtra = Partial<IDashboardFilters> & { courseId?: string };

export const CertificationRateCard: React.FC<CertificationRateCardProps> = ({
  data,
  filters,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("total");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label ?? "";

  const goToIssued = (extra: GoToIssuedExtra) => {
    navigate("/certificates/issued", { state: { ...filters, ...extra } });
  };

  if (!data) {
    return (
      <Card>
        <DashboardSectionHeader icon={<Award size={16} />} title="Certification Rate" />
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const pieData = [
    { name: "Certified", value: data.total.certifiedStudents },
    {
      name: "Not yet certified",
      value: Math.max(data.total.eligible - data.total.certifiedStudents, 0),
    },
  ];

  const courseData = data.byCourse.map((c) => ({
    name: truncate(c.courseTitle),
    Eligible: c.eligible,
    Issued: c.issued,
    courseId: c.courseId,
  }));
  const districtData = data.byDistrict.map((d) => ({
    name: truncate(d.district),
    Eligible: d.eligible,
    Issued: d.issued,
    district: d.district,
  }));
  const facilityData = data.byFacility.map((f) => ({
    name: truncate(f.hospitalName),
    Eligible: f.eligible,
    Issued: f.issued,
    hospitalId: f.hospitalId,
  }));

  const handleBarClick = (entry: unknown, extraKey: "courseId" | "district" | "hospitalId") => {
    const payload = (entry as { payload?: Record<string, unknown> })?.payload ?? entry;
    const value = (payload as Record<string, unknown>)?.[extraKey];
    if (typeof value === "string" && value) {
      goToIssued({ [extraKey]: value } as GoToIssuedExtra);
    }
  };

  const renderBreakdownChart = (
    chartData: { name: string }[],
    extraKey: "courseId" | "district" | "hospitalId",
  ) =>
    chartData.length === 0 ? (
      <p className="text-sm text-gray-400 text-center py-6">No data available</p>
    ) : (
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 20, bottom: 32 }} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Eligible" fill="#82A5D6" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="Issued"
              fill="#3363AD"
              radius={[4, 4, 0, 0]}
              style={{ cursor: "pointer" }}
              onClick={(entry) => handleBarClick(entry, extraKey)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );

  return (
    <Card>
      <DashboardSectionHeader icon={<Award size={16} />} title="Certification Rate" />

      {/* Dropdown switcher */}
      <div className="flex items-center justify-end mb-4">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 text-sm text-gray-600
                       border border-gray-200 rounded-lg px-3 py-1.5
                       hover:border-[#3363AD] hover:text-[#3363AD]
                       transition-colors focus:outline-none"
          >
            {activeLabel}
            <ChevronDown
              size={14}
              className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-white border
                         border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px]
                         overflow-hidden"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    activeTab === tab.key
                      ? "bg-[#3363AD]/10 text-[#3363AD] font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === "total" && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            {data.total.issued > 0 ? (
              <button
                onClick={() => goToIssued({})}
                className="font-semibold text-[#3363AD] hover:underline"
              >
                {data.total.issued.toLocaleString()} certificates issued
              </button>
            ) : (
              <span>{data.total.issued.toLocaleString()} certificates issued</span>
            )}{" "}
            — <span className="font-semibold text-gray-700">{data.total.rate}%</span> of
            eligible CHWs certified
          </p>
          {data.total.eligible === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No data available</p>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        style={{ cursor: index === 0 ? "pointer" : "default" }}
                        onClick={() => index === 0 && goToIssued({})}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === "course" && renderBreakdownChart(courseData, "courseId")}
      {activeTab === "district" && renderBreakdownChart(districtData, "district")}
      {activeTab === "facility" && renderBreakdownChart(facilityData, "hospitalId")}

      {dropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
      )}
    </Card>
  );
};
