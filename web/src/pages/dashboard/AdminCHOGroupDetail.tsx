import { useState, useCallback, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Users,
  MapPin,
  Phone,
  UserPlus,
  Trash2,
  ArrowDownCircle,
  Search,
  X,
  CalendarDays,
  FileText,
  Pencil,
  Check,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import {
  adminGetGroupById,
  adminAddMember,
  adminRemoveMember,
  adminDemoteToCHW,
  adminUpdateGroup,
  adminDeleteGroup,
} from "@/services/choGroup.service";
import { getAllStudentsNoPagination, IStudent } from "@/services/students.service";
import { Button } from "@/components/common/Button";
import { formatDate } from "@/utils/formats/formats";
import { ICHOGroupMember } from "@/types";

/* ─── Avatar ────────────────────────────────────────────────────────────────── */
const Avatar = ({
  name,
  photo,
  size = "w-10 h-10",
}: {
  name: string;
  photo: string | null;
  size?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? "??";
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${size} rounded-full object-cover shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-[#EBF0F9] text-[#3363AD] flex items-center justify-center text-sm font-bold shrink-0`}
    >
      {initials}
    </div>
  );
};

/* ─── Student search picker ─────────────────────────────────────────────────── */
const StudentSearchPicker = ({
  placeholder,
  roleFilter = "TRAINEE",
  onSelect,
  onClear,
  selected,
  excludeIds = [],
}: {
  placeholder: string;
  roleFilter?: string;
  onSelect: (s: IStudent) => void;
  onClear: () => void;
  selected: IStudent | null;
  excludeIds?: string[];
}) => {
  const [term, setTerm] = useState(selected?.fullName ?? "");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);

  const debouncedSet = useCallback(debounce((v: string) => setDebounced(v), 350), []);

  const handleChange = (v: string) => {
    setTerm(v);
    debouncedSet(v);
    if (selected) onClear();
  };

  const { data, isFetching } = useQuery({
    queryKey: ["cho-group-picker", debounced, roleFilter],
    queryFn: () =>
      getAllStudentsNoPagination(
        debounced.length > 1
          ? `?searchq=${encodeURIComponent(debounced)}&role=${roleFilter}&noGroup=true&limit=8`
          : `?role=${roleFilter}&noGroup=true&limit=8`,
      ),
    enabled: focused,
  });

  const results: IStudent[] = (data?.data ?? []).filter((s) => !excludeIds.includes(s.id));

  const pick = (s: IStudent) => {
    setTerm(s.fullName);
    setDebounced("");
    setFocused(false);
    onSelect(s);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={term}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#3363AD]/30 border-t-[#3363AD] rounded-full animate-spin" />
        )}
        {selected && (
          <button
            type="button"
            onClick={() => { setTerm(""); onClear(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {focused && results.length > 0 && !selected && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-gray-100 rounded-xl shadow-lg bg-white max-h-48 overflow-y-auto z-20">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
            >
              <Avatar name={s.fullName} photo={null} size="w-8 h-8" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.fullName}</p>
                {s.phoneNumber && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {s.phoneNumber}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────────── */
const AdminCHOGroupDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add / remove members
  const [addStudent, setAddStudent] = useState<IStudent | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ICHOGroupMember | null>(null);

  // Demote CHO
  const [showDemote, setShowDemote] = useState(false);
  const [newCHO, setNewCHO] = useState<IStudent | null>(null);
  const [demoteTargetId, setDemoteTargetId] = useState<string | null>(null);
  const [demoteTargetName, setDemoteTargetName] = useState<string>("");

  // Edit group
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSector, setEditSector] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete group
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: group, isLoading } = useQuery({
    queryKey: ["admin-cho-group-detail", id],
    queryFn: () => adminGetGroupById(id!),
    enabled: !!id,
  });

  const { mutate: addMember, isPending: isAdding } = useMutation({
    mutationFn: () => adminAddMember(id!, addStudent!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cho-group-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success("CHW added to group.");
      setAddStudent(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to add member.");
    },
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: (studentId: string) => adminRemoveMember(id!, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cho-group-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success("CHW removed from group.");
      setPendingRemove(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to remove member.");
      setPendingRemove(null);
    },
  });

  const { mutate: demoteCHO, isPending: isDemoting } = useMutation({
    mutationFn: () => adminDemoteToCHW(group!.cho!.user!.id, demoteTargetId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cho-group-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success(`${data.demotedUser.fullNames} demoted. ${data.newCHO.fullNames} is now the CHO.`);
      setShowDemote(false);
      setNewCHO(null);
      setDemoteTargetId(null);
      setDemoteTargetName("");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to demote CHO.");
    },
  });

  const { mutate: updateGroup, isPending: isUpdating } = useMutation({
    mutationFn: () => adminUpdateGroup(id!, {
      name: editName || undefined,
      sector: editSector,
      description: editDescription,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cho-group-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success("Group updated.");
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to update group.");
    },
  });

  const { mutate: deleteGroup, isPending: isDeleting } = useMutation({
    mutationFn: () => adminDeleteGroup(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success("Group deleted.");
      navigate("/admin/cho-groups");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to delete group.");
    },
  });

  const openEdit = () => {
    setEditName(group?.name ?? "");
    setEditSector(group?.sector ?? "");
    setEditDescription(group?.description ?? "");
    setIsEditing(true);
  };

  const selectMemberAsDemoteTarget = (m: ICHOGroupMember) => {
    setDemoteTargetId(m.studentId);
    setDemoteTargetName(m.student.user.fullNames);
    setNewCHO(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <p className="text-gray-500">Group not found.</p>
        <Button size="sm" variant="ghost" onClick={() => navigate("/admin/cho-groups")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  const members = group.members ?? [];
  const cho = group.cho?.user;
  const totalCount = members.length + (cho ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Title + actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#333333]">{group.name}</h2>
          <p className="text-sm text-gray-500">Group details and management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={openEdit}
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            className="!bg-red-500 hover:!bg-red-600"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete Group
          </Button>
        </div>
      </div>

      {/* Edit group form */}
      {isEditing && (
        <div className="bg-white rounded-2xl border border-[#3363AD]/20 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#3363AD]" /> Edit Group Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Group Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Sector</label>
              <input
                type="text"
                value={editSector}
                onChange={(e) => setEditSector(e.target.value)}
                placeholder="e.g. Nyarugenge"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD] resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => updateGroup()}
              isLoading={isUpdating}
              disabled={!editName.trim() || isUpdating}
            >
              {!isUpdating && <Check className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Info cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Group overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Group Info</p>
          <div className="space-y-2">
            {group.sector && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-[#3363AD] shrink-0" />
                <span>{group.sector}</span>
              </div>
            )}
            {group.description && (
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <FileText className="w-4 h-4 text-[#3363AD] shrink-0 mt-0.5" />
                <span>{group.description}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users className="w-4 h-4 text-[#3363AD] shrink-0" />
              <span>{totalCount} member{totalCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>Created {formatDate(group.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* CHO card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Community Health Officer
          </p>
          {cho ? (
            <div className="flex items-center gap-4">
              <Avatar name={cho.fullNames} photo={cho.photo} size="w-14 h-14" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-lg truncate">{cho.fullNames}</p>
                {cho.phoneNumber && (
                  <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {cho.phoneNumber}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDemote((v) => !v);
                  setDemoteTargetId(null);
                  setDemoteTargetName("");
                  setNewCHO(null);
                }}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                  showDemote
                    ? "bg-amber-500 text-white"
                    : "text-amber-600 hover:bg-amber-50"
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Demote CHO
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No CHO assigned to this group.</p>
          )}

          {/* Demote section */}
          {showDemote && cho && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-4">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Select a replacement CHO for {cho.fullNames}
              </p>

              {/* Group member suggestions */}
              {members.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600 font-medium">Members already in this group:</p>
                  <div className="space-y-1.5">
                    {members.map((m) => {
                      const isSelected = demoteTargetId === m.studentId && !newCHO;
                      return (
                        <button
                          key={m.studentId}
                          type="button"
                          onClick={() => selectMemberAsDemoteTarget(m)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors border ${
                            isSelected
                              ? "bg-amber-100 border-amber-300"
                              : "bg-white border-amber-100 hover:bg-amber-50"
                          }`}
                        >
                          <Avatar
                            name={m.student.user.fullNames}
                            photo={m.student.user.photo}
                            size="w-7 h-7"
                          />
                          <span className="text-sm font-medium text-gray-800 truncate flex-1">
                            {m.student.user.fullNames}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Or search for someone else */}
              <div className="space-y-1.5">
                <p className="text-xs text-amber-600 font-medium">
                  {members.length > 0 ? "Or search any other CHW:" : "Search a CHW:"}
                </p>
                <StudentSearchPicker
                  placeholder="Search CHW by name…"
                  roleFilter="TRAINEE"
                  selected={newCHO}
                  onSelect={(s) => {
                    setNewCHO(s);
                    setDemoteTargetId(s.id);
                    setDemoteTargetName(s.fullName);
                  }}
                  onClear={() => {
                    setNewCHO(null);
                    setDemoteTargetId(null);
                    setDemoteTargetName("");
                  }}
                />
                {newCHO && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-100">
                    <Avatar name={newCHO.fullName} photo={null} size="w-7 h-7" />
                    <span className="text-sm font-medium text-gray-800 truncate">{newCHO.fullName}</span>
                  </div>
                )}
              </div>

              {demoteTargetId && (
                <p className="text-xs text-amber-700 font-medium">
                  New CHO: <span className="font-bold">{demoteTargetName}</span>
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setShowDemote(false);
                    setNewCHO(null);
                    setDemoteTargetId(null);
                    setDemoteTargetName("");
                  }}
                  disabled={isDemoting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 !bg-amber-500 hover:!bg-amber-600"
                  disabled={!demoteTargetId || isDemoting}
                  isLoading={isDemoting}
                  onClick={() => demoteCHO()}
                >
                  {!isDemoting && <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" />}
                  Confirm Demotion
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add CHW */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#3363AD]" />
          Add CHW to Group
        </h3>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <StudentSearchPicker
              placeholder="Search CHW by name…"
              roleFilter="TRAINEE"
              selected={addStudent}
              onSelect={setAddStudent}
              onClear={() => setAddStudent(null)}
              excludeIds={members.map((m) => m.studentId)}
            />
          </div>
          <Button
            size="sm"
            onClick={() => addMember()}
            isLoading={isAdding}
            disabled={!addStudent || isAdding}
            className="shrink-0"
          >
            {!isAdding && <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
            Add
          </Button>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#3363AD]" />
          Members
          <span className="text-xs font-normal text-gray-400">({totalCount})</span>
        </h3>

        {members.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF0F9] flex items-center justify-center">
              <Users className="w-6 h-6 text-[#3363AD]/40" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No members yet</p>
            <p className="text-xs text-gray-400">Use the search above to add CHWs to this group.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
              >
                <Avatar name={m.student.user.fullNames} photo={m.student.user.photo} size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{m.student.user.fullNames}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {m.student.user.phoneNumber && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {m.student.user.phoneNumber}
                      </p>
                    )}
                    {m.student.user.district && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {m.student.user.district}
                        {m.student.user.sector ? ` / ${m.student.user.sector}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 shrink-0 hidden sm:block">
                  Joined {formatDate(m.joinedAt)}
                </p>
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() => setPendingRemove(m)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 shrink-0"
                  title="Remove from group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remove member confirmation modal */}
      <Transition appear show={!!pendingRemove} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isRemoving && setPendingRemove(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">Remove Member</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-1">
                      Remove <span className="font-semibold text-gray-800">{pendingRemove?.student.user.fullNames}</span> from this group?
                      They will lose access to group activities. This cannot be undone.
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPendingRemove(null)}
                    disabled={isRemoving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 !bg-red-500 hover:!bg-red-600"
                    onClick={() => pendingRemove && removeMember(pendingRemove.studentId)}
                    isLoading={isRemoving}
                  >
                    {!isRemoving && <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Remove
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Delete confirmation modal */}
      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isDeleting && setShowDeleteConfirm(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">Delete Group</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-1">
                      Delete <span className="font-semibold text-gray-800">{group.name}</span>?
                      This will remove all members and revoke the CHO role. This cannot be undone.
                    </Dialog.Description>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 !bg-red-500 hover:!bg-red-600"
                    onClick={() => deleteGroup()}
                    isLoading={isDeleting}
                  >
                    {!isDeleting && <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Delete
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default AdminCHOGroupDetailPage;
