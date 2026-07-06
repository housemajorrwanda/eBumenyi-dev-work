import { IDashboardFilters } from "@/types";

/** Query string without leading `?` (e.g. `role=TRAINEE&district=Gasabo`). */
export const buildDashboardFilterQuery = (filters: IDashboardFilters): string => {
  const qsParams = new URLSearchParams();
  if (filters.district) qsParams.append("district", filters.district);
  if (filters.province) qsParams.append("province", filters.province);
  if (filters.gender) qsParams.append("gender", filters.gender);
  if (filters.role) qsParams.append("role", filters.role);
  if (filters.year) qsParams.append("year", filters.year);
  if (filters.month) qsParams.append("month", filters.month);
  if (filters.hospitalId) qsParams.append("hospitalId", filters.hospitalId);
  return qsParams.toString();
};

export const withDashboardFilterQuery = (
  path: string,
  filters: IDashboardFilters,
): string => {
  const qs = buildDashboardFilterQuery(filters);
  return qs ? `${path}?${qs}` : path;
};

export const dashboardFilterKey = (filters: IDashboardFilters) =>
  [
    filters.province,
    filters.district,
    filters.gender,
    filters.role,
    filters.year,
    filters.month,
    filters.hospitalId,
  ] as const;
