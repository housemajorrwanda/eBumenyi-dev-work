/* eslint-disable react-hooks/exhaustive-deps */
import { useState, FC, useCallback, useEffect } from "react";
import { studentKeys } from "@/utils/constants/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import Table from "@/components/table/Table";
import PageContent from "@/components/common/PageContent";
import { formatDate } from "@/utils/formats/formats";
import { getAllStudents, IStudent } from "@/services/students.service";
import { getAllCoursesNoPagination } from "@/services/course.service";
import StudentTableActions from "./StudentTableActions";
import TableActions from "../table/TableActions";
import { BulkStudentRoleActions } from "./BulkStudentRoleActions";
import { useAuth } from "@/hooks/useAuth";
import type { ICourse } from "@/types";

interface StudentsListProps {
  hideHeader?: boolean;
  filter?: string;
  roleFilter?: "TRAINEE" | "TESTER" | "CEHO";
}

const StudentsList: FC<StudentsListProps> = ({
  hideHeader = false,
  filter,
  roleFilter,
}) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["ADMIN"]);
  const canChangeLearnerRole = hasRole(["ADMIN", "STAFF", "TRAINER"]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [limit, setLimit] = useState(15);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedStudents, setSelectedStudents] = useState<Map<string, IStudent>>(new Map());

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("");

  const { data: coursesResponse } = useQuery({
    queryKey: ["all-courses-no-pagination"],
    queryFn: () => getAllCoursesNoPagination(),
  });
  const courses = coursesResponse?.data || [];

  // Build query parameters
  const buildQueryParams = (page: number, keyword?: string) => {
    const params = new URLSearchParams();

    if (page > 1) params.append("page", page.toString());
    if (keyword) params.append("searchq", keyword);

    params.append("limit", limit.toString());
    if (sortBy) params.append("sortBy", sortBy);
    if (order) params.append("order", order);

    // Add filters
    if (statusFilter) {
      params.append("status", statusFilter);
    } else if (filter === "active") {
      params.append("status", "active");
    } else if (filter === "inactive") {
      params.append("status", "inactive");
    }

    if (genderFilter) params.append("gender", genderFilter);
    if (courseFilter) params.append("courseId", courseFilter);
    if (roleFilter) params.append("role", roleFilter);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  };

  // Main query with all parameters including filter
  const { data, isLoading } = useQuery({
    queryKey: studentKeys.list(
      `${filter}-${roleFilter}-${buildQueryParams(currentPage, searchKeyword)}`,
    ),
    queryFn: () => getAllStudents(buildQueryParams(currentPage, searchKeyword)),
  });

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((searchTerm: string) => {
      setSearchKeyword(searchTerm);
      setCurrentPage(1);
    }, 500),
    [filter],
  );

  // Page change handler
  const onChangePage = (page: number) => {
    setCurrentPage(page);
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortBy(key);
    setOrder(direction);
    setCurrentPage(1); // Reset to page 1 on sort change
  };

  // Reset page and search when filter changes
  const resetFilters = () => {
    setCurrentPage(1);
    setSearchKeyword("");
    setSortBy("createdAt");
    setOrder("desc");
    setStatusFilter("");
    setGenderFilter("");
    setCourseFilter("");
  };

  // Effect to reset pagination and search when filter changes
  useEffect(() => {
    resetFilters();
    setSelectedStudents(new Map());
  }, [filter, roleFilter]);

  const selectedRowIds = Array.from(selectedStudents.keys());

  const handleSelectionChange = (pageSelectedIds: string[]) => {
    setSelectedStudents((prev) => {
      const next = new Map(prev);
      const pageRows = data?.data ?? [];
      const pageIdSet = new Set(pageRows.map((s) => s.id));

      for (const pageId of pageIdSet) {
        if (!pageSelectedIds.includes(pageId)) {
          next.delete(pageId);
        }
      }

      for (const id of pageSelectedIds) {
        const row = pageRows.find((s) => s.id === id);
        if (row) next.set(id, row);
      }

      return next;
    });
  };

  const clearSelection = () => {
    setSelectedStudents(new Map());
  };

  const showBulkActions =
    selectedStudents.size > 0 &&
    roleFilter &&
    ((roleFilter === "TESTER" && canChangeLearnerRole) ||
      (roleFilter === "TRAINEE" && isAdmin) ||
      (roleFilter === "CEHO" && isAdmin));

  const tableContent = (
    <>
      {showBulkActions && roleFilter && (
        <BulkStudentRoleActions
          roleFilter={roleFilter}
          selectedStudents={Array.from(selectedStudents.values())}
          onClear={clearSelection}
        />
      )}
      <Table
        isLoading={isLoading}
        currentPage={data?.currentPage || 1}
        totalItems={data?.totalItems || 0}
        itemsPerPage={limit}
        onChangePage={onChangePage}
        // New features
        selectable={Boolean(roleFilter && ((roleFilter === "TESTER" && canChangeLearnerRole) || isAdmin))}
        selectedRowIds={selectedRowIds}
        onSelectionChange={handleSelectionChange}
        onSort={handleSort}
        currentSortKey={sortBy}
        currentSortOrder={order}
        onRowsPerPageChange={(newLimit) => {
          setLimit(newLimit);
          setCurrentPage(1);
        }}
        filters={[
          {
            key: "course",
            label: "Course",
            value: courseFilter,
            onChange: (val) => {
              setCourseFilter(val);
              setCurrentPage(1);
            },
            options: courses.map((course: ICourse) => ({
              label: course.title,
              value: course.id,
            })),
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
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            },
            options: [
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
              // { label: "Graduated", value: "GRADUATED" },
              // { label: "Suspended", value: "SUSPENDED" },
            ],
          },
        ]}
        onResetFilters={resetFilters}
        columns={[
          {
            title: "CHW Name",
            key: "fullName",
            sortable: true,
            render: (row: IStudent) => {
              const initials = row.fullName?.substring(0, 2).toUpperCase() || "??";
              return (
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-[#3363AD]/10 text-[#3363AD] flex items-center justify-center text-xs font-bold shrink-0'>
                    {initials}
                  </div>
                  <span className='font-medium text-gray-900'>{row.fullName}</span>
                </div>
              );
            },
          },
          {
            title: "Phone Number",
            key: "phoneNumber",
            sortable: true,
          },
          {
            title: "District/Sector",
            key: "location",
            sortable: true,
            render: (row: IStudent) => (
              <div className='text-gray-600'>
                {row.district} / {row.sector}
              </div>
            ),
          },
          {
            title: "Courses",
            key: "courses",
            sortable: true,
            render: (row: IStudent) => (
              <div className='font-medium text-gray-700'>
                {row.courses.length > 1
                  ? `${row.courses.length} courses`
                  : row.courses[0] || "No courses"}
              </div>
            ),
          },
          {
            title: "Progress",
            key: "progress",
            sortable: true,
            render: (row: IStudent) => (
              <div className='w-32'>
                <div className='flex justify-between text-xs mb-1'>
                  <span className='text-gray-500 font-medium'>Completion</span>
                  <span className='text-gray-700 font-bold'>{row.progress}</span>
                </div>
                <div className='h-1.5 w-full bg-gray-100 rounded-full overflow-hidden'>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      row.progress === "100%" ? "bg-emerald-500" : "bg-[#3363AD]"
                    }`}
                    style={{ width: row.progress }}
                  ></div>
                </div>
              </div>
            ),
          },
          {
            title: "Created",
            key: "createdAt",
            sortable: true,
            render: (row: IStudent) => (
              <div className='text-sm text-gray-500 whitespace-nowrap'>
                {formatDate(row.createdAt)}
              </div>
            ),
          },
          {
            title: "Actions",
            key: "actions",
            render: (row: IStudent) => {
              return (
                <TableActions>
                  <StudentTableActions item={row} showPromote={roleFilter === "TRAINEE"} showDemote={roleFilter === "CEHO"} />
                </TableActions>
              );
            },
          },
        ]}
        data={data?.data || []}
        searchFun={handleSearch}
      />
    </>
  );

  if (hideHeader) {
    return <div className='w-full'>{tableContent}</div>;
  }

  return (
    <PageContent isLoading={isLoading} hasPadding={true} title='CHWs'>
      {tableContent}
    </PageContent>
  );
};

export default StudentsList;
