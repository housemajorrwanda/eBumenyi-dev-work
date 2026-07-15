import { IDashboardFilters } from "@/types";

export const DEFAULT_DASHBOARD_ROLE = "TRAINEE";

export const DEFAULT_DASHBOARD_FILTERS: IDashboardFilters = {
  province: "",
  district: "",
  gender: "",
  role: DEFAULT_DASHBOARD_ROLE,
  year: "",
  month: "",
  hospitalId: "",
};

/** True when any filter differs from the dashboard defaults (CHW role is not counted). */
export const hasActiveDashboardFilters = (filters: IDashboardFilters): boolean => {
  const nonDefaultRole = filters.role !== "" && filters.role !== DEFAULT_DASHBOARD_ROLE;
  const otherFiltersActive = (
    ["province", "district", "gender", "year", "month", "hospitalId"] as const
  ).some((key) => filters[key] !== "");
  return nonDefaultRole || otherFiltersActive;
};
