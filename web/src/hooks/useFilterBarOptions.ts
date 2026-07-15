import { useMemo, useRef, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IOptionFieldOption } from "@/components/common/form/ComboboxField";
import { PROVINCE_DISTRICTS } from "@/utils/constants/provinceDistricts";
import { getAllHospitals } from "@/services/hospitals.service";
import {
  getCourseAnalytics,
  getCommunicationsAnalytics,
  getDemographicsAnalytics,
} from "@/services/analytics.service";
import { IDashboardFilters, IHospital } from "@/types";
import { dashboardKeys } from "@/utils/constants/queryKeys";

const DASHBOARD_CACHE_MS = 1000 * 60 * 30;

const extractYear = (monthStr: string): string => monthStr.split(" ")[1] ?? "";
const extractMonth = (monthStr: string): string => monthStr.split(" ")[0] ?? "";

export const useFilterBarOptions = (filters: IDashboardFilters) => {
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchedHospitals, setSearchedHospitals] = useState<IOptionFieldOption[] | null>(
    null,
  );

  const { data: optionsData } = useQuery({
    queryKey: dashboardKeys.filterOptions(),
    queryFn: async () => {
      const [demoRes, courseRes, commRes, hospitalsRes] = await Promise.allSettled([
        getDemographicsAnalytics(),
        getCourseAnalytics(),
        getCommunicationsAnalytics(),
        getAllHospitals("?limit=10"),
      ]);

      let genders: string[] = [];
      if (demoRes.status === "fulfilled") {
        const rows = demoRes.value?.data?.byGender ?? [];
        genders = [
          ...new Set(
            rows
              .map((r) =>
                r.gender
                  ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase()
                  : "",
              )
              .filter(Boolean),
          ),
        ];
      }

      const months: string[] = [];
      if (courseRes.status === "fulfilled") {
        months.push(...(courseRes.value?.data?.enrollmentTrends ?? []).map((t) => t.month));
      }
      if (commRes.status === "fulfilled") {
        months.push(...(commRes.value?.data?.monthlyTrend ?? []).map((t) => t.month));
      }

      let hospitals: IOptionFieldOption[] = [];
      if (hospitalsRes.status === "fulfilled") {
        const list: IHospital[] = hospitalsRes.value?.data ?? [];
        hospitals = list.map((h) => ({ value: h.id, label: h.name }));
      }

      return { genders, trendMonths: months, hospitals };
    },
    staleTime: DASHBOARD_CACHE_MS,
    gcTime: DASHBOARD_CACHE_MS,
  });

  const handleHospitalSearch = useCallback((query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query) params.set("searchq", query);
        const res = await getAllHospitals(`?${params.toString()}`);
        const list: IHospital[] = res?.data ?? [];
        setSearchedHospitals(list.map((h) => ({ value: h.id, label: h.name })));
      } catch {
        // keep existing options on error
      }
    }, 300);
  }, []);

  const availableHospitals = searchedHospitals ?? optionsData?.hospitals ?? [];

  const availableProvinces = useMemo(
    () => Object.keys(PROVINCE_DISTRICTS).sort(),
    [],
  );

  const availableDistricts = useMemo(() => {
    if (!filters.province) return [];
    return PROVINCE_DISTRICTS[filters.province] ?? [];
  }, [filters.province]);

  const trendMonths = optionsData?.trendMonths ?? [];

  const availableYears = useMemo(
    () => [...new Set(trendMonths.map(extractYear).filter(Boolean))].sort(),
    [trendMonths],
  );

  const availableMonths = useMemo(
    () => [...new Set(trendMonths.map(extractMonth).filter(Boolean))],
    [trendMonths],
  );

  return {
    availableProvinces,
    availableDistricts,
    availableGenders: optionsData?.genders ?? [],
    availableYears,
    availableMonths,
    availableHospitals,
    handleHospitalSearch,
  };
};
