import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  Award,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import {
  getAllCertificates,
  type IIssuedCertificate,
} from "@/services/certificates.service";
import {
  listCertificateTemplates,
  type CertificateTemplateSummary,
} from "@/services/certificateTemplate.service";
import { getAllCoursesNoPagination } from "@/services/course.service";
import { ICourse } from "@/types";
import { formatDate } from "@/utils/formats/formats";

const PAGE_SIZE = 15;

interface CarriedFilters {
  district?: string;
  province?: string;
  gender?: string;
  role?: string;
  year?: string;
  month?: string;
  hospitalId?: string;
}

const CARRIED_FILTER_LABELS: Record<keyof CarriedFilters, string> = {
  district: "District",
  province: "Province",
  gender: "Gender",
  role: "Role",
  year: "Year",
  month: "Month",
  hospitalId: "Hospital",
};

const CARRIED_ROLE_LABELS: Record<string, string> = {
  TRAINEE: "CHW",
  TESTER: "Tester",
  CEHO: "CEHO",
};

export default function IssuedCertificatesPage() {
  const location = useLocation();

  // Pre-selection from navigation state (coming from a template/certification card)
  const navState = location.state as
    | ({ templateId?: string; templateName?: string; courseId?: string } & CarriedFilters)
    | null;

  // ── Filter state ─────────────────────────────────────────────────────
  const [filterTemplateId, setFilterTemplateId] = useState(navState?.templateId ?? "");
  const [filterCourseId, setFilterCourseId] = useState(navState?.courseId ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── Filters carried over from another page (e.g. Certification Rate card) ──
  const [carriedFilters, setCarriedFilters] = useState<CarriedFilters>({
    district: navState?.district,
    province: navState?.province,
    gender: navState?.gender,
    role: navState?.role,
    year: navState?.year,
    month: navState?.month,
    hospitalId: navState?.hospitalId,
  });
  const clearCarriedFilter = (key: keyof CarriedFilters) =>
    setCarriedFilters((prev) => ({ ...prev, [key]: undefined }));
  const activeCarriedCount = Object.values(carriedFilters).filter(Boolean).length;

  // ── Dropdown options ─────────────────────────────────────────────────
  const [templates, setTemplates] = useState<CertificateTemplateSummary[]>([]);
  const [courses, setCourses] = useState<ICourse[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // ── Table state ──────────────────────────────────────────────────────
  const [certificates, setCertificates] = useState<IIssuedCertificate[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load templates once ───────────────────────────────────────────────
  useEffect(() => {
    listCertificateTemplates()
      .then(setTemplates)
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // ── Load courses once (independent of the template filter) ───────────
  useEffect(() => {
    getAllCoursesNoPagination()
      .then((res) => setCourses(res.data ?? []))
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoadingCourses(false));
  }, []);

  // ── Debounce search ──────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTemplateId, filterCourseId, dateFrom, dateTo, carriedFilters]);

  // ── Fetch table data ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllCertificates({
        searchq: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        page: currentPage,
        templateId: filterTemplateId || undefined,
        courseId: filterCourseId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        district: carriedFilters.district || undefined,
        province: carriedFilters.province || undefined,
        gender: carriedFilters.gender || undefined,
        role: carriedFilters.role || undefined,
        year: carriedFilters.year || undefined,
        month: carriedFilters.month || undefined,
        hospitalId: carriedFilters.hospitalId || undefined,
      });
      setCertificates(res.data ?? []);
      setTotalItems(res.totalItems ?? 0);
    } catch {
      toast.error("Failed to load certificates");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, currentPage, filterTemplateId, filterCourseId, dateFrom, dateTo, carriedFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const activeFilterCount =
    [filterTemplateId, filterCourseId, dateFrom, dateTo].filter(Boolean).length +
    activeCarriedCount;

  const clearFilters = () => {
    setFilterTemplateId("");
    setFilterCourseId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setCarriedFilters({});
  };

  // ── Fetch ALL for export (respects current filters) ──────────────────
  const fetchAllForExport = async (): Promise<IIssuedCertificate[]> => {
    const res = await getAllCertificates({
      searchq: debouncedSearch || undefined,
      limit: 9999,
      page: 1,
      templateId: filterTemplateId || undefined,
      courseId: filterCourseId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      district: carriedFilters.district || undefined,
      province: carriedFilters.province || undefined,
      gender: carriedFilters.gender || undefined,
      role: carriedFilters.role || undefined,
      year: carriedFilters.year || undefined,
      month: carriedFilters.month || undefined,
      hospitalId: carriedFilters.hospitalId || undefined,
    });
    return res.data ?? [];
  };

  const exportFileName = () => {
    const parts = ["issued-certificates"];
    const tpl = templates.find((t) => t.id === filterTemplateId);
    if (tpl) parts.push(tpl.name);
    const c = courses.find((c) => c.id === filterCourseId);
    if (c) parts.push(c.title);
    if (dateFrom) parts.push(`from-${dateFrom}`);
    if (dateTo) parts.push(`to-${dateTo}`);
    return parts.join("-");
  };

  // ── Excel export ─────────────────────────────────────────────────────
  const exportExcel = async () => {
    const toastId = toast.loading("Preparing Excel...");
    try {
      const all = await fetchAllForExport();
      const tpl = templates.find((t) => t.id === filterTemplateId);
      const crs = courses.find((c) => c.id === filterCourseId);

      const title = tpl
        ? `ISSUED CERTIFICATES — ${tpl.name.toUpperCase()}`
        : "ISSUED CERTIFICATES REPORT";

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Issued Certificates");

      ws.columns = [
        { width: 6 },
        { width: 28 },
        { width: 16 },
        { width: 16 },
        { width: 34 },
        { width: 24 },
        { width: 14 },
      ];

      const PRIMARY = "FF3363AD";
      const PRIMARY_LIGHT = "FFEBF0F8";
      const BORDER_COLOR = "FFE5E7EB";
      const thin: ExcelJS.Border = { style: "thin", color: { argb: BORDER_COLOR } };
      const cellBorder: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

      // ── Title row ─────────────────────────────
      ws.mergeCells("A1:G1");
      const titleCell = ws.getCell("A1");
      titleCell.value = title;
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
      titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 30;

      // ── Metadata block ─────────────────────────
      ws.addRow([]);
      const meta: [string, string | number][] = [
        ["Template", tpl?.name ?? "All Templates"],
        ["Course", crs?.title ?? "All Courses"],
        ["Date Range", dateFrom || dateTo ? `${dateFrom || "—"} → ${dateTo || "—"}` : "All dates"],
        ["Generated", new Date().toLocaleDateString()],
        ["Total Records", all.length],
      ];
      meta.forEach(([label, value]) => {
        const row = ws.addRow([label, value]);
        row.getCell(1).font = { bold: true, color: { argb: "FF374151" }, size: 10 };
        row.getCell(2).font = { color: { argb: "FF3363AD" }, size: 10 };
      });

      // ── Separator ──────────────────────────────
      ws.addRow([]);

      // ── Column header row ──────────────────────
      const headerRow = ws.addRow(["#", "Student Name", "Phone", "District", "Course", "Template", "Issue Date"]);
      headerRow.height = 22;
      headerRow.eachCell((cell, col) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : "left" };
        cell.border = cellBorder;
      });

      // ── Data rows ──────────────────────────────
      all.forEach((c, i) => {
        const row = ws.addRow([
          i + 1,
          c.student.user.fullNames,
          c.student.user.phoneNumber ?? "",
          c.student.user.district ?? "",
          c.course.title,
          c.course.certificateTemplate?.name ?? "—",
          formatDate(c.createdAt),
        ]);
        const shade = i % 2 === 1;
        row.eachCell((cell, col) => {
          if (shade) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
          cell.border = cellBorder;
          cell.font = { size: 10 };
          cell.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : "left" };
        });
      });

      // ── Download ───────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exportFileName()}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success("Excel exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  // ── PDF export ───────────────────────────────────────────────────────
  const exportPdf = async () => {
    const toastId = toast.loading("Preparing PDF...");
    try {
      const all = await fetchAllForExport();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFillColor(51, 99, 173);
      doc.rect(0, 0, 297, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      const tpl = templates.find((t) => t.id === filterTemplateId);
      const crs = courses.find((c) => c.id === filterCourseId);
      const reportTitle = tpl
        ? `Issued Certificates — ${tpl.name}`
        : "Issued Certificates Report";
      doc.text(reportTitle, 14, 12);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const subtitleParts: string[] = [];
      if (tpl) subtitleParts.push(`Template: ${tpl.name}`);
      if (crs) subtitleParts.push(`Course: ${crs.title}`);
      if (dateFrom || dateTo) subtitleParts.push(`Date: ${dateFrom || "—"} → ${dateTo || "—"}`);
      doc.text(subtitleParts.length ? subtitleParts.join("  |  ") : "All certificates", 14, 22);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 297 - 14, 22, { align: "right" });

      autoTable(doc, {
        startY: 27,
        head: [["#", "Student Name", "Phone", "District", "Course", "Template", "Issue Date"]],
        body: all.map((c, i) => [
          i + 1,
          c.student.user.fullNames,
          c.student.user.phoneNumber ?? "",
          c.student.user.district ?? "—",
          c.course.title,
          c.course.certificateTemplate?.name ?? "—",
          formatDate(c.createdAt),
        ]),
        headStyles: { fillColor: [51, 99, 173], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [235, 240, 248] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          2: { cellWidth: 26 },
          3: { cellWidth: 22 },
          6: { cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, 297 / 2, doc.internal.pageSize.height - 6, { align: "center" });
        },
      });

      doc.save(`${exportFileName()}.pdf`);
      toast.success("PDF exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  return (
    <div className="w-full min-h-full bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600" />
              Issued Certificates
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              All certificates issued across all templates and courses
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
              {activeFilterCount} active
            </span>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {activeCarriedCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400">From dashboard:</span>
            {(Object.entries(carriedFilters) as [keyof CarriedFilters, string | undefined][])
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => (
                <span
                  key={key}
                  className="flex items-center gap-1 bg-[#3363AD]/10 text-[#3363AD] text-xs px-2 py-1 rounded-full"
                >
                  {CARRIED_FILTER_LABELS[key]}:{" "}
                  {key === "role" ? (CARRIED_ROLE_LABELS[value as string] ?? value) : value}
                  <button
                    onClick={() => clearCarriedFilter(key)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Template filter */}
          <div className="relative">
            <select
              value={filterTemplateId}
              onChange={(e) => setFilterTemplateId(e.target.value)}
              disabled={loadingTemplates}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none pr-8 text-gray-700 disabled:opacity-50"
            >
              <option value="">All templates</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
          </div>

          {/* Course filter */}
          <div className="relative">
            <select
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              disabled={loadingCourses}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none pr-8 text-gray-700 disabled:opacity-50"
            >
              <option value="">
                {loadingCourses ? "Loading courses..." : "All courses"}
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
          </div>

          {/* Date range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                title="From date"
              />
            </div>
            <div className="flex-1">
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                title="To date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Total count */}
      <div className="mb-4">
        <div className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm gap-2">
          <span className="text-gray-500">Total results:</span>
          <span className="font-bold text-blue-600">{totalItems}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-10">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Student Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Course</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Template</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Issue Date</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-5 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-36 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-44 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-7 w-8 bg-gray-100 rounded-lg mx-auto" /></td>
                  </tr>
                ))
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400">
                    <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-gray-500">No certificates found</p>
                    <p className="text-xs mt-1">
                      {activeFilterCount > 0 || search
                        ? "Try adjusting your filters"
                        : "No certificates have been issued yet"}
                    </p>
                    {(activeFilterCount > 0 || search) && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                certificates.map((cert, idx) => (
                  <tr
                    key={cert.id}
                    className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{cert.student.user.fullNames}</div>
                      {cert.student.user.district && (
                        <div className="text-xs text-gray-400">{cert.student.user.district}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {cert.course.coverIcon && (
                          <img
                            src={cert.course.coverIcon}
                            alt=""
                            className="w-6 h-6 rounded object-cover shrink-0"
                          />
                        )}
                        <span className="text-gray-800 line-clamp-2 leading-snug">
                          {cert.course.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cert.course.certificateTemplate ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {cert.course.certificateTemplate.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {formatDate(cert.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cert.pdf ? (
                        <button
                          onClick={() => setPreviewUrl(cert.pdf!)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                          title="View certificate"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-700">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalItems)}
              </span>{" "}
              of <span className="font-medium text-gray-700">{totalItems}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-7 h-7 text-xs rounded-lg font-medium transition ${
                        currentPage === p ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ width: "min(90vw, 1000px)", height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">Certificate Preview</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download="certificate.pdf"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Certificate PDF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
