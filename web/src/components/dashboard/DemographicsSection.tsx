import React, { useState, useMemo } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { IDemographicsAnalytics, IDemographicRow } from "@/types";

interface DemographicsSectionProps {
  data: IDemographicsAnalytics | null;
  filteredByDistrict?: IDemographicsAnalytics["byDistrict"];
  filteredByGender?: IDemographicsAnalytics["byGender"];
}

type FilterView = "district" | "gender" | "ageGroup" | "combined";

const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
    <span className="text-xs font-medium text-gray-600 w-8 text-right shrink-0">
      {value}%
    </span>
  </div>
);

export const DemographicsSection: React.FC<DemographicsSectionProps> = ({ data, filteredByDistrict, filteredByGender }) => {
  const [activeView, setActiveView] = useState<FilterView>("district");
  const [searchDistrict, setSearchDistrict] = useState("");

  // Hooks must run unconditionally — before any early return
  const rawRows: IDemographicRow[] = useMemo(() => {
    if (!data) return [];
    if (activeView === "district") return filteredByDistrict ?? data.byDistrict;
    if (activeView === "gender")   return filteredByGender   ?? data.byGender;
    if (activeView === "ageGroup") return data.byAgeGroup;
    return [];
  }, [activeView, data, filteredByDistrict, filteredByGender]);

  const rows = useMemo(() => {
    if (activeView !== "district" || !searchDistrict.trim()) return rawRows;
    return rawRows.filter(r =>
      (r.district ?? "").toLowerCase().includes(searchDistrict.toLowerCase())
    );
  }, [rawRows, activeView, searchDistrict]);

  const combinedRows = useMemo(() => {
    const all = data?.combined ?? [];
    if (!searchDistrict.trim()) return all;
    return all.filter(r => r.district.toLowerCase().includes(searchDistrict.toLowerCase()));
  }, [data, searchDistrict]);

  const tabs: { key: FilterView; label: string }[] = [
    { key: "district", label: "District" },
    { key: "gender",   label: "Gender" },
    { key: "ageGroup", label: "Age Group" },
    { key: "combined", label: "Combined" },
  ];

  const getLabel = (row: IDemographicRow): string => {
    const raw = row.district ?? row.gender ?? row.ageGroup;
    if (!raw) return "—";
    if (row.gender != null)
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    return raw;
  };

  if (!data) {
    return (
      <Card>
        <DashboardSectionHeader icon={<Users size={16} />} title="Learner Demographics" />
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <DashboardSectionHeader
        icon={<Users size={16} />}
        title="Learner Demographics"
      />

      {/* Summary */}
      <p className="text-xs text-gray-500 mb-3">
        Total learners: <span className="font-semibold text-gray-700">{data.totalStudents.toLocaleString()}</span>
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveView(tab.key); setSearchDistrict(""); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeView === tab.key
                ? "bg-white text-[#3363AD] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* District search */}
      {(activeView === "district" || activeView === "combined") && (
        <input
          type="text"
          placeholder="Search district..."
          value={searchDistrict}
          onChange={e => setSearchDistrict(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
            mb-3 focus:outline-none focus:ring-1 focus:ring-[#3363AD]"
        />
      )}

      {/* Combined cross-tab table */}
      {activeView === "combined" ? (
        combinedRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 font-medium text-gray-500">District</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Gender</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Age Group</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-500">Learners</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-500">Active</th>
                  <th className="text-left py-2 pl-3 font-medium text-gray-500 min-w-[100px]">Active (%)</th>
                </tr>
              </thead>
              <tbody>
                {combinedRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-3 font-medium text-gray-800">{row.district}</td>
                    <td className="py-2.5 px-2 text-gray-600">{row.gender}</td>
                    <td className="py-2.5 px-2 text-gray-600">{row.ageGroup}</td>
                    <td className="py-2.5 px-2 text-right text-gray-600">{row.total.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-gray-600">{row.active.toLocaleString()}</td>
                    <td className="py-2.5 pl-3">
                      <ProgressBar value={row.activeRate} color="#3363AD" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-3 font-medium text-gray-500">
                  {activeView === "district" ? "District" : activeView === "gender" ? "Gender" : "Age Group"}
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500">Learners</th>
                <th className="text-left py-2 pl-3 font-medium text-gray-500 min-w-[100px]">Completion (%)</th>
                <th className="text-left py-2 pl-3 font-medium text-gray-500 min-w-[100px]">Certification (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 pr-3 font-medium text-gray-800">
                    {getLabel(row)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-600">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="py-2.5 pl-3">
                    <ProgressBar value={row.completionRate} color="#3363AD" />
                  </td>
                  <td className="py-2.5 pl-3">
                    <ProgressBar value={row.certificationRate} color="#3363AD" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
