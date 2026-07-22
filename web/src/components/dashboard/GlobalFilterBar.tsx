import React from "react";
import { Filter, X } from "lucide-react";
import { IDashboardFilters } from "@/types";
import { IOptionFieldOption } from "@/components/common/form/ComboboxField";
import { HospitalFilterSelect } from "./HospitalFilterSelect";
import {
  DEFAULT_DASHBOARD_FILTERS,
  DEFAULT_DASHBOARD_ROLE,
  hasActiveDashboardFilters,
} from "@/utils/constants/dashboardFilters";

interface GlobalFilterBarProps {
  filters: IDashboardFilters;
  onChange: (filters: IDashboardFilters) => void;
  provinces: string[];
  districts: string[];
  genders: string[];
  years: string[];
  months: string[];
  hospitals: IOptionFieldOption[];
  onHospitalSearch: (query: string) => void;
}

const EMPTY: IDashboardFilters = DEFAULT_DASHBOARD_FILTERS;

const ROLE_LABELS: Record<string, string> = {
  TRAINEE: "CHW",
  TESTER: "Tester",
  CEHO: "CEHO",
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "TRAINEE", label: "CHW" },
  { value: "TESTER", label: "Tester" },
  { value: "CEHO", label: "CEHO" },
];

const FILTER_CHIP_LABELS: Record<keyof IDashboardFilters, string> = {
  province: "Province",
  district: "District",
  gender: "Gender",
  role: "Role",
  year: "Year",
  month: "Month",
  hospitalId: "Hospital",
};

const SELECT_CLS = "text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#3363AD] bg-white transition-colors";

const SelectFilter: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`${SELECT_CLS} min-w-[70px] ${
      value ? "border-[#3363AD] text-[#3363AD] font-medium" : "border-gray-200 text-gray-600"
    }`}
    title={label}
  >
    <option value="">{label}</option>
    {options.map((opt) => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  onChange,
  provinces,
  districts,
  genders,
  years,
  months,
  hospitals,
  onHospitalSearch,
}) => {
  const hasActiveFilters = hasActiveDashboardFilters(filters);
  const isNonDefaultRole =
    filters.role !== "" && filters.role !== DEFAULT_DASHBOARD_ROLE;
  const set = (key: keyof IDashboardFilters) => (value: string) => {
    if (key === "province") {
      onChange({ ...filters, province: value, district: "" });
    } else {
      onChange({ ...filters, [key]: value });
    }
  };
  const reset = () => onChange(EMPTY);

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-2.5 py-1.5 shadow-sm">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 text-xs font-medium text-gray-600 shrink-0">
          <Filter size={12} className="text-[#3363AD]" />
        </div>

        {provinces.length > 0 && (
          <SelectFilter
            label="Province"
            value={filters.province}
            options={provinces}
            onChange={set("province")}
          />
        )}
        {filters.province !== "" && districts.length > 0 && (
          <SelectFilter
            label="District"
            value={filters.district}
            options={districts}
            onChange={set("district")}
          />
        )}
        {genders.length > 0 && (
          <SelectFilter
            label="Gender"
            value={filters.gender}
            options={genders}
            onChange={set("gender")}
          />
        )}
        <select
          value={filters.role}
          onChange={(e) => set("role")(e.target.value)}
          className={`${SELECT_CLS} min-w-[80px] ${
            isNonDefaultRole
              ? "border-[#3363AD] text-[#3363AD] font-medium"
              : "border-gray-200 text-gray-600"
          }`}
          title="Role"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {years.length > 0 && (
          <SelectFilter
            label="Year"
            value={filters.year}
            options={years}
            onChange={set("year")}
          />
        )}
        {months.length > 0 && (
          <SelectFilter
            label="Month"
            value={filters.month}
            options={months}
            onChange={set("month")}
          />
        )}

        <HospitalFilterSelect
          value={filters.hospitalId}
          options={hospitals}
          onSearch={onHospitalSearch}
          onChange={(value) =>
            onChange({ ...filters, hospitalId: value, province: "", district: "" })
          }
        />

        {hasActiveFilters && (
          <button
            onClick={reset}
            className="flex items-center gap-0.5 text-xs text-gray-400
              hover:text-red-500 transition-colors px-1.5 py-0.5 rounded
              hover:bg-red-50"
            title="Clear all filters"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mt-1 pt-1 border-t border-gray-50">
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(filters)
              .filter(([key, v]) => {
                if (!v) return false;
                if (key === "role" && v === DEFAULT_DASHBOARD_ROLE) return false;
                return true;
              })
              .map(([key, value]) => {
                const filterKey = key as keyof IDashboardFilters;
                let displayValue = value;
                if (filterKey === "role") displayValue = ROLE_LABELS[value] ?? value;
                else if (filterKey === "hospitalId")
                  displayValue =
                    hospitals.find((h) => h.value === value)?.label ?? "Selected hospital";
                const label = `${FILTER_CHIP_LABELS[filterKey]}: ${displayValue}`;
                return (
                  <span
                    key={key}
                    className="flex items-center gap-0.5 bg-[#3363AD]/10 text-[#3363AD]
                      text-[10px] px-1.5 py-0.5 rounded-full"
                  >
                    {label}
                    <button
                      onClick={() => set(filterKey)("")}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X size={8} />
                    </button>
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
