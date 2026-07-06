/* eslint-disable react-hooks/exhaustive-deps */
import { useState, FC, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { ICourse } from "@/types";
import { formatDate } from "@/utils/formats/formats";
import { getAllCourses, deleteCourse } from "@/services/course.service";
import { courseKeys } from "@/utils/constants/queryKeys";
import { useNavigate } from "react-router-dom";
import {
  Search, Users, Star, Edit, Trash2, BookOpen,
  ChevronLeft, ChevronRight, LayoutGrid, List, FileText,
} from "lucide-react";
import ConfirmDelete from "@/components/common/ConfirmDelete";
import Table from "@/components/table/Table";
import TableActions from "@/components/table/TableActions";
import CourseTableActions from "./CourseTableActions";
import DocumentModal from "./DocumentModal";

interface ListProps {
  hideHeader?: boolean;
  filter?: string;
}

const CourseList: FC<ListProps> = ({ filter }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [toDelete, setToDelete] = useState<string | undefined>();
  const [showDocsId, setShowDocsId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const navigate = useNavigate();

  const buildQueryParams = (page: number, keyword?: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.append("page", page.toString());
    if (keyword) params.append("searchq", keyword);
    if (filter === "published") params.append("isPublished", "true");
    else if (filter === "draft") params.append("isPublished", "false");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const { data, isLoading } = useQuery({
    queryKey: courseKeys.list(`${filter}-${buildQueryParams(currentPage, searchKeyword)}`),
    queryFn: () => getAllCourses(buildQueryParams(currentPage, searchKeyword)),
  });

  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchKeyword(term);
      setCurrentPage(1);
    }, 500),
    [filter],
  );

  useEffect(() => {
    setCurrentPage(1);
    setSearchKeyword("");
    setLocalSearch("");
  }, [filter]);

  const courses = data?.data || [];
  const totalItems = data?.totalItems || 0;
  const itemsPerPage = data?.itemsPerPage || 15;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleEdit = (course: ICourse) => {
    navigate("/courses/builder", { state: { editCourseId: course.id, course } });
  };

  return (
    <div className="w-full space-y-4">
      {/* Search + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={localSearch}
            onChange={e => {
              setLocalSearch(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="Table view"
            className={`p-2 transition-colors ${
              viewMode === "table"
                ? "bg-primary text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <Table
          isLoading={isLoading}
          currentPage={data?.currentPage || 1}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onChangePage={setCurrentPage}
          columns={[
            { title: "Course Title", key: "title" },
            {
              title: "Enrolled",
              key: "enrolled",
              render: (row: ICourse) => <div>{row.progresses?.length || 0}</div>,
            },
            {
              title: "Reviews",
              key: "reviews",
              render: (row: ICourse) => (
                <span className="flex items-center gap-1">
                  <span className="text-yellow-500 text-lg">★</span>
                  <span className="text-[#333333]">{row.rating || 0}</span>
                </span>
              ),
            },
            {
              title: "Created",
              key: "createdAt",
              render: (row: ICourse) => (
                <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
              ),
            },
            {
              title: "Status",
              key: "isPublished",
              render: (row: ICourse) => (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  row.isPublished
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                  {row.isPublished ? "Published" : "Draft"}
                </span>
              ),
            },
            {
              title: "Created By",
              key: "creator",
              render: (row: ICourse) => (
                <div className="max-w-xs truncate" title={row.staff.user.fullNames}>
                  {row.staff.user.fullNames || "No creator"}
                </div>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              render: (row: ICourse) => (
                <TableActions>
                  <CourseTableActions item={row} />
                </TableActions>
              ),
            },
          ]}
          data={courses}
          searchFun={handleSearch}
        />
      )}

      {/* ── GRID VIEW ── */}
      {viewMode === "grid" && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <BookOpen className="w-12 h-12 mb-3 opacity-40" />
              <p className="font-medium text-gray-500">No courses found</p>
              <p className="text-sm mt-1">
                {localSearch ? "Try a different search term" : "Create your first course"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map(course => (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Cover */}
                  <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                    {course.coverIcon ? (
                      <img
                        src={course.coverIcon}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                      course.isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {course.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{course.title}</h3>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-500 min-w-0">
                        <span className="flex items-center gap-1 shrink-0">
                          <Users className="w-3.5 h-3.5" />
                          {course.progresses?.length || 0}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          {(course.rating || 0).toFixed(1)}
                        </span>
                        <span className="text-gray-400 truncate">{formatDate(course.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(course)}
                          title="Edit"
                          className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDocsId(course.id)}
                          title="Documents"
                          className="w-7 h-7 flex items-center justify-center text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(course.id)}
                          title="Delete"
                          className="w-7 h-7 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination (grid only — table has its own built-in) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-xs text-gray-600">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Shared modals */}
      {toDelete && (
        <ConfirmDelete
          type="course"
          id={toDelete}
          fn={async (id) => { await deleteCourse(id); return 1; }}
          queryKey={[...courseKeys.all]}
          setToDelete={setToDelete}
        />
      )}

      {showDocsId && (
        <DocumentModal
          courseId={showDocsId}
          isOpen={true}
          onClose={() => setShowDocsId(null)}
        />
      )}
    </div>
  );
};

export default CourseList;
