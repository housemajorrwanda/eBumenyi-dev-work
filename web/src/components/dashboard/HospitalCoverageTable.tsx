import React, { useState } from "react";
import { Card } from "@/components/common/Card";
import { DashboardSectionHeader } from "./shared/DashboardSectionHeader";
import { Building2 } from "lucide-react";

type SortKey = "province" | "totalChws" | "activeChws" | "hospitals" | "rate";

interface Row {
  province: string;
  totalChws: number;
  activeChws: number;
  hospitals: number;
}

interface HospitalCoverageTableProps {
  byProvince: Row[];
  totalChws?: number;
  registrationRate?: number;
}

export const HospitalCoverageTable: React.FC<HospitalCoverageTableProps> = ({
  byProvince,
  totalChws,
  registrationRate,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("totalChws");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...byProvince].map(r => ({ 
    ...r, 
    rate: r.totalChws > 0 ? Math.round((r.activeChws / r.totalChws) * 100) : 0 
  })).sort((a, b) => {
    const av = a[sortKey as keyof typeof a] as number | string;
    const bv = b[sortKey as keyof typeof b] as number | string;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className={`text-left text-xs font-medium uppercase tracking-wide
        ${sortKey === k ? "text-[#3363AD]" : "text-gray-500"}
        hover:text-[#3363AD] transition-colors flex items-center gap-1`}
    >
      {label}
      <span className="opacity-50">
        {sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  return (
    <Card>
      <DashboardSectionHeader
        icon={<Building2 size={16} />}
        title="Coverage by Province"
      />
      {typeof totalChws === "number" && typeof registrationRate === "number" && (
        <p className="text-xs text-gray-500 -mt-3 mb-4">
          {totalChws.toLocaleString()} CHWs registered — {registrationRate}% of national target
        </p>
      )}
      {byProvince.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 pr-4 text-left">
                  <SortBtn label="Province" k="province" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortBtn label="CHWs" k="totalChws" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortBtn label="Active" k="activeChws" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortBtn label="Hospitals" k="hospitals" />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortBtn label="%" k="rate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.province}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 pr-4 font-medium text-gray-800">
                    {row.province}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600">
                    {row.totalChws.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600">
                    {row.activeChws.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600">
                    {row.hospitals}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      row.rate >= 70
                        ? "bg-green-100 text-green-700"
                        : row.rate >= 40
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {row.rate}%
                    </span>
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
