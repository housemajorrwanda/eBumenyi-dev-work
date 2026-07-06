import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  IDashboardFilters,
  IDemographicsAnalytics,
  ICommunicationsAnalytics,
  IEnrollmentTrend,
  IHospital,
} from "@/types";
import { IOptionFieldOption } from "@/components/common/form/ComboboxField";
import { getAllHospitals } from "@/services/hospitals.service";
import { PROVINCE_DISTRICTS } from "@/utils/constants/provinceDistricts";

interface FilteredData {
  filters: IDashboardFilters;
  setFilters: (f: IDashboardFilters) => void;
  // Derived option lists for the filter bar dropdowns
  availableProvinces: string[];
  availableDistricts: string[];
  availableGenders: string[];
  availableYears: string[];
  availableMonths: string[];
  availableHospitals: IOptionFieldOption[];
  handleHospitalSearch: (query: string) => void;
  // Filtered data slices
  filteredByDistrict: IDemographicsAnalytics["byDistrict"];
  filteredByGender: IDemographicsAnalytics["byGender"];
  filteredByAgeGroup: IDemographicsAnalytics["byAgeGroup"];
  filteredProvinces: { province: string; totalChws: number; activeChws: number; hospitals: number }[];
  filteredEnrollmentTrends: IEnrollmentTrend[];
  filteredCommTrend: ICommunicationsAnalytics["monthlyTrend"];
}

interface UseDashboardFiltersInput {
  byProvince: { province: string; totalChws: number; activeChws: number; hospitals: number }[];
  demographics: IDemographicsAnalytics | null;
  enrollmentTrends: IEnrollmentTrend[];
  communications: ICommunicationsAnalytics | null;
  hospitals: IHospital[];
}

// Extract year from a month string like "Apr 2026" → "2026"
const extractYear = (monthStr: string): string =>
  monthStr.split(" ")[1] ?? "";

// Extract short month from a month string like "Apr 2026" → "Apr"
const extractMonth = (monthStr: string): string =>
  monthStr.split(" ")[0] ?? "";

export const useDashboardFilters = (
  { byProvince, demographics, enrollmentTrends, communications, hospitals }: UseDashboardFiltersInput,
  filters: IDashboardFilters,
  setFilters: (f: IDashboardFilters) => void
): FilteredData => {

  const [availableHospitals, setAvailableHospitals] = useState<IOptionFieldOption[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed with the first 10 hospitals from the already-fetched list
  useEffect(() => {
    if (hospitals.length > 0) {
      setAvailableHospitals(
        hospitals.slice(0, 10).map((h) => ({ value: h.id, label: h.name }))
      );
    }
  }, [hospitals]);

  const handleHospitalSearch = useCallback((query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query) params.set("searchq", query);
        const res = await getAllHospitals(`?${params.toString()}`);
        const list: IHospital[] = res?.data ?? [];
        setAvailableHospitals(list.map((h) => ({ value: h.id, label: h.name })));
      } catch {
        // keep existing options on error
      }
    }, 300);
  }, []);

  // ── Derive available options ──────────────────────────────────
  const availableProvinces = useMemo(
    () => Object.keys(PROVINCE_DISTRICTS).sort(),
    [],
  );

  const availableDistricts = useMemo(() => {
    if (!filters.province) return [];
    return PROVINCE_DISTRICTS[filters.province] ?? [];
  }, [filters.province]);

  const availableGenders = useMemo(
    () => [...new Set(
      (demographics?.byGender ?? [])
        .map((r) => r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase() : "")
        .filter(Boolean)
    )],
    [demographics],
  );

  const allTrendMonths = useMemo(
    () => [
      ...enrollmentTrends.map((t) => t.month),
      ...(communications?.monthlyTrend ?? []).map((t) => t.month),
    ],
    [enrollmentTrends, communications],
  );

  const availableYears = useMemo(
    () => [...new Set(allTrendMonths.map(extractYear).filter(Boolean))].sort(),
    [allTrendMonths],
  );

  const availableMonths = useMemo(
    () => [...new Set(allTrendMonths.map(extractMonth).filter(Boolean))],
    [allTrendMonths],
  );

  // ── Apply filters ─────────────────────────────────────────────
  const filteredProvinces = useMemo(
    () => filters.province
      ? byProvince.filter((r) => r.province === filters.province)
      : byProvince,
    [byProvince, filters.province],
  );

  const filteredByDistrict = useMemo(() => {
    let rows = demographics?.byDistrict ?? [];
    if (filters.district) rows = rows.filter((r) => r.district === filters.district);
    return rows;
  }, [demographics, filters.district]);

  const filteredByGender = useMemo(() => {
    let rows = demographics?.byGender ?? [];
    if (filters.gender)
      rows = rows.filter(
        (r) =>
          (r.gender ?? "").toLowerCase() === filters.gender.toLowerCase(),
      );
    return rows;
  }, [demographics, filters.gender]);

  // Age group is not filtered by the dropdowns — it uses its own tab
  const filteredByAgeGroup = useMemo(
    () => demographics?.byAgeGroup ?? [],
    [demographics],
  );

  const filteredEnrollmentTrends = useMemo(() => {
    let trends = enrollmentTrends;
    if (filters.year)
      trends = trends.filter((t) => extractYear(t.month) === filters.year);
    if (filters.month)
      trends = trends.filter((t) => extractMonth(t.month) === filters.month);
    return trends;
  }, [enrollmentTrends, filters.year, filters.month]);

  const filteredCommTrend = useMemo(() => {
    let trends = communications?.monthlyTrend ?? [];
    if (filters.year)
      trends = trends.filter((t) => extractYear(t.month) === filters.year);
    if (filters.month)
      trends = trends.filter((t) => extractMonth(t.month) === filters.month);
    return trends;
  }, [communications, filters.year, filters.month]);

  return {
    filters,
    setFilters,
    availableProvinces,
    availableDistricts,
    availableGenders,
    availableYears,
    availableMonths,
    availableHospitals,
    handleHospitalSearch,
    filteredByDistrict,
    filteredByGender,
    filteredByAgeGroup,
    filteredProvinces,
    filteredEnrollmentTrends,
    filteredCommTrend,
  };
};
