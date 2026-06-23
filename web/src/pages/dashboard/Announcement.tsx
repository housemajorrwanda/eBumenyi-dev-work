import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MegaphoneIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import FilterTabs, { TabItem } from "@/components/ui/FilterTabs";
import { toast } from "react-hot-toast";
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type IAnnouncement,
} from "@/services/announcement.service";

const Announcement: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<IAnnouncement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    announcement: IAnnouncement | null;
  }>({ isOpen: false, announcement: null });
  const [publishConfirm, setPublishConfirm] = useState<{
    isOpen: boolean;
    title: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: "", onConfirm: null });

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    segment: "",
    category: "",
    publishAt: new Date().toISOString().split("T")[0],
    validUntil: "",
    priority: "medium" as "high" | "medium" | "low",
    status: "draft" as "draft" | "published",
  });

  const categories = [
    "Training",
    "Maintenance",
    "Health Alert",
    "Updates",
    "Events",
    "Partnerships",
  ];
  const segmentOptions = [
    "all",
    "ADMIN",
    "TRAINER",
    "CHO",
    "TRAINEE",
    "TESTER",
    "DEVELOPER",
    "ADMINISTRATOR",
    "STAFF",
  ];

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const response = await getAllAnnouncements();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createAnnouncement>[0]) =>
      createAnnouncement(payload),
    onSuccess: () => {
      toast.success("Announcement created successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Error creating announcement";
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      id: string;
      payload: Parameters<typeof updateAnnouncement>[1];
    }) => updateAnnouncement(params.id, params.payload),
    onSuccess: () => {
      toast.success("Announcement updated successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setIsDialogOpen(false);
      setEditingAnnouncement(null);
      resetForm();
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Error updating announcement";
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Announcement deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDeleteConfirm({ isOpen: false, announcement: null });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Error deleting announcement";
      toast.error(errorMessage);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => updateAnnouncement(id, { status: "published" }),
    onSuccess: () => {
      toast.success("Announcement published successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setPublishConfirm({ isOpen: false, title: "", onConfirm: null });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : "Error publishing announcement";
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      body: "",
      segment: "",
      category: "",
      publishAt: new Date().toISOString().split("T")[0],
      validUntil: "",
      priority: "medium",
      status: "draft",
    });
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      const matchesSearch =
        announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        announcement.body.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || announcement.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || announcement.priority === priorityFilter;
      const matchesCategory =
        categoryFilter === "all" || announcement.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [announcements, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  const getPriorityBorderColor = (priority?: string) => {
    switch (priority) {
      case "high":   return "border-l-red-500";
      case "medium": return "border-l-yellow-400";
      case "low":    return "border-l-green-500";
      default:       return "border-l-gray-300";
    }
  };

  const getPriorityBadgeColor = (priority?: string) => {
    switch (priority) {
      case "high":   return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low":    return "bg-green-100 text-green-700";
      default:       return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    return status === "published"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600";
  };

  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditAnnouncement = (announcement: IAnnouncement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      body: announcement.body,
      segment: announcement.segment,
      category: announcement.category || "",
      publishAt: announcement.publishAt.split("T")[0],
      validUntil: announcement.validUntil ? announcement.validUntil.split("T")[0] : "",
      priority: announcement.priority || "medium",
      status: announcement.status || "draft",
    });
    setIsDialogOpen(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!formData.title || !formData.body || !formData.segment) {
      toast.error("Please fill in all required fields");
      return;
    }
    const payload = {
      title: formData.title,
      body: formData.body,
      segment: formData.segment,
      category: formData.category,
      publishAt: formData.publishAt,
      validUntil: formData.validUntil || null,
      priority: formData.priority,
      status: formData.status,
    };

    if (formData.status === "published") {
      setPublishConfirm({
        isOpen: true,
        title: formData.title,
        onConfirm: () => {
          setPublishConfirm({ isOpen: false, title: "", onConfirm: null });
          if (editingAnnouncement) {
            updateMutation.mutate({ id: editingAnnouncement.id, payload });
          } else {
            createMutation.mutate(payload);
          }
        },
      });
      return;
    }

    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDeleteAnnouncement = (announcement: IAnnouncement) => {
    setDeleteConfirm({ isOpen: true, announcement });
  };

  const confirmDelete = () => {
    if (!deleteConfirm.announcement) return;
    deleteMutation.mutate(deleteConfirm.announcement.id);
  };

  const handlePublishRequest = (announcement: IAnnouncement) => {
    setPublishConfirm({
      isOpen: true,
      title: announcement.title,
      onConfirm: () => publishMutation.mutate(announcement.id),
    });
  };

  const hasActiveFilters =
    searchTerm !== "" || priorityFilter !== "all" || categoryFilter !== "all";

  const statusTabs: TabItem[] = [
    { key: "all", label: "All", count: announcements.length },
    {
      key: "published",
      label: "Published",
      count: announcements.filter((a) => a.status === "published").length,
    },
    {
      key: "draft",
      label: "Draft",
      count: announcements.filter((a) => a.status === "draft").length,
    },
  ];

  const selectClass =
    "px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white text-sm text-gray-700 transition-all duration-200 outline-none";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-[#333333]">Announcements</h2>
          <p className="text-sm text-gray-500">
            Create and manage community announcements
          </p>
        </div>
        <button
          onClick={handleCreateAnnouncement}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white transition-all duration-200 hover:bg-[#4d81d2]"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Announcement</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total</p>
          <p className="text-3xl font-bold text-[#333333] mt-1">
            {isLoading ? "—" : announcements.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">announcements</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Published</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {isLoading
              ? "—"
              : announcements.filter((a) => a.status === "published").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">live now</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Drafts</p>
          <p className="text-3xl font-bold text-gray-500 mt-1">
            {isLoading
              ? "—"
              : announcements.filter((a) => a.status === "draft").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">unpublished</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">High Priority</p>
          <p className="text-3xl font-bold text-red-500 mt-1">
            {isLoading
              ? "—"
              : announcements.filter((a) => a.priority === "high").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">needs attention</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <FilterTabs
        items={statusTabs}
        activeTab={statusFilter}
        onTabChange={(key) =>
          setStatusFilter(key as "all" | "published" | "draft")
        }
        variant="default"
      />

      {/* Search + secondary filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search announcements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl border-gray-300 focus:border-primary"
          />
        </div>
        <select
          className={selectClass}
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as "all" | "high" | "medium" | "low")
          }
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          className={selectClass}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchTerm("");
              setPriorityFilter("all");
              setCategoryFilter("all");
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Announcement list */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-400 text-sm">Loading announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="text-5xl mb-3">📢</div>
          <p className="text-lg font-semibold text-[#333333] mb-1">
            No announcements found
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Try adjusting your filters or create a new announcement
          </p>
          <button
            onClick={handleCreateAnnouncement}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white transition-all duration-200 hover:bg-[#4d81d2]"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white border border-gray-200 border-l-4 ${getPriorityBorderColor(announcement.priority)} rounded-xl shadow-sm hover:shadow-md transition-all duration-200`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-[#333333]">
                        {announcement.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(announcement.status)}`}
                      >
                        {announcement.status === "published" ? "● Live" : "● Draft"}
                      </span>
                      {announcement.priority && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeColor(announcement.priority)}`}
                        >
                          {announcement.priority.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                      {announcement.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>
                        {new Date(announcement.publishAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {announcement.validUntil && (
                        <span>
                          · Expires{" "}
                          {new Date(announcement.validUntil).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                        {announcement.segment}
                      </span>
                      {announcement.category && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 font-medium">
                          {announcement.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions — only available for draft announcements */}
                  {announcement.status === "draft" && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handlePublishRequest(announcement)}
                        title="Publish"
                        className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-all duration-150"
                      >
                        <MegaphoneIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditAnnouncement(announcement)}
                        title="Edit"
                        className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-all duration-150"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement)}
                        title="Delete"
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}
        big={true}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Announcement Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter an engaging title..."
              className="rounded-xl border-gray-300 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Target Segment <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full ${selectClass}`}
                value={formData.segment}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, segment: e.target.value }))
                }
              >
                <option value="">Select segment</option>
                {segmentOptions.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Category
              </label>
              <select
                className={`w-full ${selectClass}`}
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Priority Level
              </label>
              <select
                className={`w-full ${selectClass}`}
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: e.target.value as "high" | "medium" | "low",
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <select
                className={`w-full ${selectClass}`}
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.value as "draft" | "published",
                  }))
                }
              >
                <option value="draft">Save as Draft</option>
                <option value="published">Publish Immediately</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Announcement Message <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary resize-vertical text-sm text-gray-700 transition-all duration-200 outline-none"
              value={formData.body}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, body: e.target.value }))
              }
              placeholder="Write your announcement message here..."
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Publish Date
              </label>
              <input
                type="date"
                className={`w-full ${selectClass}`}
                value={formData.publishAt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, publishAt: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Valid Until
                <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                className={`w-full ${selectClass}`}
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, validUntil: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 rounded-xl disabled:opacity-50"
            >
              Cancel
            </Button>
            <button
              onClick={handleSaveAnnouncement}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-[#4d81d2] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingAnnouncement
                  ? "Update Announcement"
                  : "Create Announcement"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, announcement: null })}
        title="Delete Announcement"
      >
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#333333]">
              "{deleteConfirm.announcement?.title}"
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ isOpen: false, announcement: null })}
              disabled={deleteMutation.isPending}
              className="px-5 rounded-xl disabled:opacity-50"
            >
              Cancel
            </Button>
            <button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={publishConfirm.isOpen}
        onClose={() => setPublishConfirm({ isOpen: false, title: "", onConfirm: null })}
        title="Publish Announcement"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MegaphoneIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-700 text-sm">
                You are about to publish{" "}
                <span className="font-semibold text-[#333333]">
                  "{publishConfirm.title}"
                </span>
                . Once published, this announcement will be sent to all targeted users and <span className="font-medium text-gray-800">cannot be edited or deleted</span>.
              </p>
              <p className="text-xs text-gray-400 mt-2">Are you sure you want to proceed?</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setPublishConfirm({ isOpen: false, title: "", onConfirm: null })}
              disabled={publishMutation.isPending || createMutation.isPending || updateMutation.isPending}
              className="px-5 rounded-xl disabled:opacity-50"
            >
              Cancel
            </Button>
            <button
              onClick={() => publishConfirm.onConfirm?.()}
              disabled={publishMutation.isPending || createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MegaphoneIcon className="w-4 h-4" />
              {publishMutation.isPending || createMutation.isPending || updateMutation.isPending
                ? "Publishing..."
                : "Yes, Publish"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Announcement;
