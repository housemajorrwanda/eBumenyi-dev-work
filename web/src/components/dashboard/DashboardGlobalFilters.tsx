import React from "react";
import { IDashboardFilters } from "@/types";
import { useFilterBarOptions } from "@/hooks/useFilterBarOptions";
import { GlobalFilterBar } from "./GlobalFilterBar";

interface DashboardGlobalFiltersProps {
  filters: IDashboardFilters;
  onChange: (filters: IDashboardFilters) => void;
}

export const DashboardGlobalFilters: React.FC<DashboardGlobalFiltersProps> = ({
  filters,
  onChange,
}) => {
  const {
    availableProvinces,
    availableDistricts,
    availableGenders,
    availableYears,
    availableMonths,
    availableHospitals,
    handleHospitalSearch,
  } = useFilterBarOptions(filters);

  return (
    <GlobalFilterBar
      filters={filters}
      onChange={onChange}
      provinces={availableProvinces}
      districts={availableDistricts}
      genders={availableGenders}
      years={availableYears}
      months={availableMonths}
      hospitals={availableHospitals}
      onHospitalSearch={handleHospitalSearch}
    />
  );
};
