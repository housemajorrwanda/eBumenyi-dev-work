/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import Table from "@/components/table/Table";
import TableActions from "@/components/table/TableActions";
import StaffTableActions from "@/components/staff/StaffTableActions";
import { IStaff } from "@/types";
import { getAllStaff } from "@/services/staff.service";
import { formatDate } from "@/utils/formats/formats";

const ROLE_OPTIONS = [
  { label: "Admin", value: "ADMIN" },
  { label: "Trainer", value: "TRAINER" },
  { label: "CEHO", value: "CEHO" },
  { label: "Staff", value: "STAFF" },
  { label: "Developer", value: "DEVELOPER" },
];

export const Staff = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [limit, setLimit] = useState(15);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");

  const buildQueryParams = (page: number, keyword?: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.append("page", page.toString());
    if (keyword) params.append("searchq", keyword);
    params.append("limit", limit.toString());
    if (sortBy) params.append("sortBy", sortBy);
    if (order) params.append("order", order);
    if (roleFilter) params.append("role", roleFilter);
    if (genderFilter) params.append("gender", genderFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      "staff",
      currentPage,
      searchKeyword,
      limit,
      sortBy,
      order,
      roleFilter,
      genderFilter,
    ],
    queryFn: () => getAllStaff(buildQueryParams(currentPage, searchKeyword)),
  });

  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchKeyword(term);
      setCurrentPage(1);
    }, 500),
    [],
  );

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortBy(key);
    setOrder(direction);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setCurrentPage(1);
    setSearchKeyword("");
    setSortBy("createdAt");
    setOrder("desc");
    setRoleFilter("");
    setGenderFilter("");
  };

  useEffect(() => {
    resetFilters();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-[#333333]">
            Staff Management
          </h2>
          <p className="text-gray-600">Manage all staff members</p>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-[#3363AD]/5 border border-[#3363AD]/20 rounded-lg p-3 flex justify-between items-center text-[#3363AD]">
          <span className="text-sm font-medium">
            {selectedIds.length} staff selected
          </span>
          <div className="flex gap-2">
            <button className="text-xs font-semibold bg-white border border-[#3363AD]/20 px-3 py-1.5 rounded shadow-sm hover:bg-gray-50">
              Message Selected
            </button>
          </div>
        </div>
      )}

      <Table
        isLoading={isLoading}
        currentPage={data?.currentPage || 1}
        totalItems={data?.totalItems || 0}
        itemsPerPage={limit}
        onChangePage={(page) => setCurrentPage(page)}
        selectable={true}
        onSelectionChange={(ids) => setSelectedIds(ids)}
        onSort={handleSort}
        currentSortKey={sortBy}
        currentSortOrder={order}
        onRowsPerPageChange={(newLimit) => {
          setLimit(newLimit);
          setCurrentPage(1);
        }}
        filters={[
          {
            key: "role",
            label: "Role",
            value: roleFilter,
            onChange: (val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            },
            options: ROLE_OPTIONS,
          },
          {
            key: "gender",
            label: "Gender",
            value: genderFilter,
            onChange: (val) => {
              setGenderFilter(val);
              setCurrentPage(1);
            },
            options: [
              { label: "Male", value: "Male" },
              { label: "Female", value: "Female" },
            ],
          },
        ]}
        onResetFilters={resetFilters}
        columns={[
          {
            title: "Staff Member",
            key: "name",
            sortable: true,
            render: (row: IStaff) => {
              const initials =
                row.user.fullNames?.substring(0, 2).toUpperCase() || "??";
              return (
                <div className="flex items-center gap-3">
                  {row.user.photo ? (
                    <img
                      src={row.user.photo}
                      alt={row.user.fullNames}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#3363AD]/10 text-[#3363AD] flex items-center justify-center text-xs font-bold shrink-0">
                      {initials}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {row.user.fullNames}
                    </div>
                    <div className="text-xs text-gray-500">{row.user.email}</div>
                  </div>
                </div>
              );
            },
          },
          {
            title: "Phone Number",
            key: "phone",
            sortable: true,
            render: (row: IStaff) => (
              <div className="text-gray-700">{row.user.phoneNumber}</div>
            ),
          },
          {
            title: "Role",
            key: "role",
            sortable: true,
            render: (row: IStaff) => (
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  row.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : row.role === "DEVELOPER"
                      ? "bg-blue-100 text-blue-800"
                      : row.role === "TRAINER"
                        ? "bg-green-100 text-green-800"
                        : row.role === "CEHO"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                }`}
              >
                {row.role}
              </span>
            ),
          },
          {
            title: "District/Sector",
            key: "location",
            sortable: true,
            render: (row: IStaff) => (
              <div className="text-gray-600">
                {row.user.district} / {row.user.sector}
              </div>
            ),
          },
          {
            title: "Joined",
            key: "createdAt",
            sortable: true,
            render: (row: IStaff) => (
              <div className="text-sm text-gray-500 whitespace-nowrap">
                {formatDate(row.user.createdAt)}
              </div>
            ),
          },
          {
            title: "Actions",
            key: "actions",
            render: (row: IStaff) => (
              <TableActions>
                <StaffTableActions item={row} />
              </TableActions>
            ),
          },
        ]}
        data={data?.data || []}
        searchFun={handleSearch}
      />
    </div>
  );
};

export default Staff;
