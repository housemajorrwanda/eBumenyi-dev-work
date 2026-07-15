import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Edit,
  Trash2,
  Search,
  Plus,
  BookOpen,
  Users,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  listCertificateTemplates,
  getLinkedCourses,
  deleteCertificateTemplate,
} from "@/services/certificateTemplate.service";
import { getAllCertificates } from "@/services/certificates.service";
import type {
  CertificateTemplateSummary,
  LinkedCourse,
} from "@/services/certificateTemplate.service";
import { formatDate } from "@/utils/formats/formats";
import Modal from "@/components/common/Modal";

interface TemplateWithCourses extends CertificateTemplateSummary {
  linkedCourses: LinkedCourse[];
}

export default function CertificatesManagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateWithCourses[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [deleteTarget, setDeleteTarget] = useState<TemplateWithCourses | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [totalIssued, setTotalIssued] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      try {
        const [list, issuedRes] = await Promise.all([
          listCertificateTemplates(),
          getAllCertificates({ limit: 1, page: 1 }),
        ]);
        const withCourses = await Promise.all(
          list.map(async (t) => {
            try {
              const courses = await getLinkedCourses(t.id);
              return { ...t, linkedCourses: courses };
            } catch {
              return { ...t, linkedCourses: [] };
            }
          })
        );
        if (!cancelledRef.current) {
          setTemplates(withCourses);
          setTotalIssued(issuedRes.totalItems);
        }
      } catch {
        if (!cancelledRef.current) toast.error("Failed to load certificate templates");
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
    return () => { cancelledRef.current = true; };
  }, []);

  const getStatus = (t: TemplateWithCourses) =>
    t.linkedCourses.length > 0 ? "active" : "draft";

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return templates.filter((t) => {
      const status = getStatus(t);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.linkedCourses.some((c) => c.title.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [templates, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter((t) => t.linkedCourses.length > 0).length,
    draft: templates.filter((t) => t.linkedCourses.length === 0).length,
    issued: totalIssued,
  }), [templates, totalIssued]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCertificateTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast.success("Template deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-full bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            Certificate Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create, manage, and distribute certificates for your workshops
          </p>
        </div>
        <button
          onClick={() => navigate("/certificates/design")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2B5493] transition"
        >
          <Plus className="w-4 h-4" />
          Create New Certificate
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Certificates" value={stats.total} color="text-gray-900" />
        <StatCard label="Active" value={stats.active} color="text-green-600" sub="Linked to a course" />
        <StatCard label="Draft" value={stats.draft} color="text-yellow-600" sub="Not linked yet" />
        <StatCard
          label="Issued"
          value={stats.issued}
          color="text-primary"
          sub="Certificates given"
          onClick={() => navigate("/certificates/issued")}
          actionLabel="View all →"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by certificate or linked course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg">
          {(["all", "active", "draft"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-36 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Award className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium text-gray-500">No certificates found</p>
          <p className="text-sm mt-1">
            {searchQuery ? "Try a different search term" : "Create your first certificate template"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((t) => {
            const status = getStatus(t);
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                {/* Thumbnail — taller for better preview */}
                <div className="relative h-52 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden">
                  {t.thumbnail ? (
                    <img
                      src={t.thumbnail}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-blue-200">
                      <FileText className="w-10 h-10" />
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                      status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {status === "active" ? "Active" : "Draft"}
                  </span>
                </div>

                {/* Body — 2 rows */}
                <div className="px-3 py-2.5 flex flex-col gap-2">
                  {/* Row 1: Name + date */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">
                      {t.name}
                    </h3>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(t.createdAt)}</span>
                  </div>

                  {/* Row 2: courses + issued + Edit + Delete */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    {/* Left: course chips only */}
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {t.linkedCourses.length === 0 ? (
                        <span className="text-xs text-gray-400">No course linked</span>
                      ) : (
                        <>
                          {t.linkedCourses.slice(0, 1).map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full min-w-0"
                            >
                              {c.coverIcon && (
                                <img src={c.coverIcon} alt="" className="w-3 h-3 rounded-full object-cover shrink-0" />
                              )}
                              <span className="truncate max-w-[80px]">{c.title}</span>
                            </span>
                          ))}
                          {t.linkedCourses.length > 1 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full shrink-0">
                              +{t.linkedCourses.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Right: issued + Edit + Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mr-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{t.issuedCount}</span>
                        {t.issuedCount > 0 && (
                          <button
                            onClick={() =>
                              navigate("/certificates/issued", {
                                state: { templateId: t.id, templateName: t.name },
                              })
                            }
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 transition"
                          >
                            View
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/certificates/design/${t.id}`)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="flex items-center justify-center w-7 h-7 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Certificate Template"
        centered
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">"{deleteTarget?.name}"</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
  onClick,
  actionLabel,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-0.5 ${onClick ? "cursor-pointer hover:border-blue-300 hover:shadow-sm transition" : ""}`}
      onClick={onClick}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {actionLabel && onClick && (
        <p className="text-xs text-blue-500 mt-1 font-medium">{actionLabel}</p>
      )}
    </div>
  );
}
