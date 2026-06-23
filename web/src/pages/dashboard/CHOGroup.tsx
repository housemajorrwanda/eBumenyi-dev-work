import { useState, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  MapPin,
  Phone,
  UserPlus,
  Activity,
  TrendingUp,
  UserMinus,
  Pencil,
  Check,
  X,
  CheckCircle2,
} from "lucide-react";
import { getDistrictOptions, getSectorOptions, getCellOptions, getVillageOptions } from "@/hooks/locations";
import { Dialog, Transition } from "@headlessui/react";
import { debounce } from "lodash";
import toast from "react-hot-toast";
import {
  getMyGroup,
  getMyGroupMembers,
  getGroupMonitoring,
  choRemoveMyMember,
  choUpdateMyGroup,
  searchCHWCandidates,
  choDirectlyAddMember,
} from "@/services/choGroup.service";
import { ICHOGroupMember, IStudentSearchResult } from "@/types";
import { MetricCard } from "@/components/common/MetricCard";
import { Button } from "@/components/common/Button";

const MemberAvatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const [failed, setFailed] = useState(false);
  const initials = name?.substring(0, 2).toUpperCase() ?? "??";
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[#EBF0F9] text-[#3363AD] flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
};

const CHOGroupPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingRemove, setPendingRemove] = useState<ICHOGroupMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  type LocationRow = { sector: string; cell: string; village: string };
  const [editLocations, setEditLocations] = useState<LocationRow[]>([{ sector: "", cell: "", village: "" }]);

  const updateLocation = (idx: number, field: keyof LocationRow, value: string) =>
    setEditLocations((prev) =>
      prev.map((loc, i) => {
        if (i !== idx) return loc;
        if (field === "sector") return { ...loc, sector: value, cell: "", village: "" };
        if (field === "cell") return { ...loc, cell: value, village: "" };
        return { ...loc, [field]: value };
      }),
    );
  const addLocation = () => setEditLocations((prev) => [...prev, { sector: "", cell: "", village: "" }]);
  const removeLocation = (idx: number) => setEditLocations((prev) => prev.filter((_, i) => i !== idx));

  // Add CHW modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [addDebouncedSearch, setAddDebouncedSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pendingStudent, setPendingStudent] = useState<IStudentSearchResult | null>(null);

  const debouncedSetAddSearch = useCallback(
    debounce((val: string) => setAddDebouncedSearch(val), 400),
    [],
  );

  const handleAddSearchChange = (val: string) => {
    setAddSearchTerm(val);
    debouncedSetAddSearch(val);
  };

  const openAddModal = () => {
    setAddSearchTerm("");
    setAddDebouncedSearch("");
    setShowAddModal(true);
  };

  const { data: group, isLoading, isError } = useQuery({
    queryKey: ["cho-group-mine"],
    queryFn: getMyGroup,
    retry: false,
  });

  const { data: members = [], isLoading: membersLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cho-group-members"],
    queryFn: getMyGroupMembers,
  });

  const { data: monitoring } = useQuery({
    queryKey: ["cho-group-monitoring"],
    queryFn: getGroupMonitoring,
    retry: false,
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: (studentId: string) => choRemoveMyMember(studentId),
    onSuccess: () => {
      setPendingRemove(null);
      queryClient.invalidateQueries({ queryKey: ["cho-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["cho-chw-candidates"] });
      toast.success("Member removed from your group.");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? "Failed to remove member.";
      toast.error(msg);
    },
  });

  const { mutate: updateGroup, isPending: isUpdating } = useMutation({
    mutationFn: () => {
      const filled = editLocations.filter((l) => l.sector);
      return choUpdateMyGroup({
        name: editName || undefined,
        district: editDistrict || undefined,
        sectors: filled.map((l) => l.sector),
        cells: filled.map((l) => l.cell),
        villages: filled.map((l) => l.village),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cho-group-mine"] });
      toast.success("Group updated.");
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to update group.");
    },
  });

  const { data: chwCandidates = [], isLoading: candidatesLoading, isFetching: candidatesFetching } = useQuery({
    queryKey: ["cho-chw-candidates", addDebouncedSearch],
    queryFn: () => searchCHWCandidates(addDebouncedSearch || undefined),
    enabled: showAddModal,
  });

  const { mutate: addMember, isPending: isAdding } = useMutation({
    mutationFn: (studentId: string) => choDirectlyAddMember(studentId),
    onSuccess: (_, studentId) => {
      setAddedIds((prev) => new Set([...prev, studentId]));
      setPendingStudent(null);
      queryClient.invalidateQueries({ queryKey: ["cho-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["cho-chw-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["cho-group-mine"] });
      toast.success("CHW added to your group successfully.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to add CHW.");
    },
  });

  const openEdit = () => {
    setEditName(group?.name ?? "");
    setEditDistrict(group?.district ?? "");
    const sectors = group?.sectors ?? [];
    const cells = group?.cells ?? [];
    const villages = group?.villages ?? [];
    setEditLocations(
      sectors.length > 0
        ? sectors.map((s, i) => ({ sector: s, cell: cells[i] ?? "", village: villages[i] ?? "" }))
        : [{ sector: "", cell: "", village: "" }],
    );
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3363AD]" />
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
        <Users className="w-12 h-12 text-gray-300" />
        <p className="text-gray-600 font-semibold">No group assigned yet</p>
        <p className="text-gray-400 text-sm max-w-xs">
          You don't have a CHO group yet. Contact an administrator to set one up.
        </p>
      </div>
    );
  }

  const cho = group.cho;
  const monitoringMembers = monitoring?.members ?? [];
  const memberCount = (group._count?.members ?? 0) + 1;

  const avgProgress =
    monitoringMembers.length > 0
      ? Math.round(
          monitoringMembers.reduce((s, m) => {
            const a = m.courseProgress.length
              ? m.courseProgress.reduce((x, c) => x + c.progress, 0) / m.courseProgress.length
              : 0;
            return s + a;
          }, 0) / monitoringMembers.length,
        )
      : 0;

  const activeCount = monitoringMembers.filter((m) =>
    m.courseProgress.some((c) => c.progress > 0 && !c.isCompleted),
  ).length;

  const filtered = members.filter((m: ICHOGroupMember) =>
    m.student.user.fullNames.toLowerCase().includes(search.toLowerCase()),
  );

  const choMatchesSearch =
    !!cho &&
    (!search || cho.user.fullNames.toLowerCase().includes(search.toLowerCase()));

  const isEmpty = filtered.length === 0 && !choMatchesSearch;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold text-[#333333]">{group.name}</h2>
            <button
              onClick={openEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#3363AD] hover:bg-[#EBF0F9] transition-colors"
              title="Edit group"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          {(group.district || (group.sectors && group.sectors.length > 0)) && (
            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {[group.district, ...(group.sectors ?? [])].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Button size="sm" onClick={openAddModal}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add CHW
          </Button>
        </div>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="bg-white rounded-xl border border-[#3363AD]/20 shadow-sm p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Edit Group</p>

          {/* Group Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Group Name *</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
            />
          </div>

          {/* District */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">District</label>
            <select
              value={editDistrict}
              onChange={(e) => {
                setEditDistrict(e.target.value);
                setEditLocations([{ sector: "", cell: "", village: "" }]);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD] bg-white"
            >
              <option value="">Select District</option>
              {getDistrictOptions().map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Dynamic sector / cell / village rows */}
          <div className="space-y-2">
            {editLocations.map((loc, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  {idx === 0 && <label className="text-xs font-semibold text-gray-500">Sector</label>}
                  <select
                    value={loc.sector}
                    onChange={(e) => updateLocation(idx, "sector", e.target.value)}
                    disabled={!editDistrict}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Sector</option>
                    {getSectorOptions(editDistrict).map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  {idx === 0 && <label className="text-xs font-semibold text-gray-500">Cell</label>}
                  <select
                    value={loc.cell}
                    onChange={(e) => updateLocation(idx, "cell", e.target.value)}
                    disabled={!loc.sector}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Cell</option>
                    {loc.sector && getCellOptions(loc.sector).map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  {idx === 0 && <label className="text-xs font-semibold text-gray-500">Village</label>}
                  <select
                    value={loc.village}
                    onChange={(e) => updateLocation(idx, "village", e.target.value)}
                    disabled={!loc.cell}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Village</option>
                    {loc.cell && getVillageOptions(loc.cell).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                {editLocations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocation(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remove this sector"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addLocation}
              disabled={!editDistrict}
              className="flex items-center gap-1 text-sm font-medium text-[#3363AD] hover:text-[#2252a0] disabled:text-gray-300 disabled:cursor-not-allowed transition-colors mt-1"
            >
              <span className="text-base leading-none">+</span> Add Sector
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isUpdating}
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <Button
              size="sm"
              onClick={() => updateGroup()}
              isLoading={isUpdating}
              disabled={!editName.trim() || isUpdating}
            >
              {!isUpdating && <Check className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Total Members"
          value={memberCount}
          icon={<Users size={18} />}
          iconBg="bg-[#EBF0F9]"
          iconColor="text-[#3363AD]"
        />
        <MetricCard
          title="Actively Learning"
          value={activeCount}
          icon={<Activity size={18} />}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <MetricCard
          title="Avg Progress"
          value={`${avgProgress}%`}
          icon={<TrendingUp size={18} />}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
        />
      </div>

      {/* Members grid */}
      {membersLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {search ? "No members match your search" : "No members yet"}
          </p>
          {!search && (
            <Button size="sm" onClick={openAddModal}>Add your first CHW</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CHO leader card */}
          {choMatchesSearch && cho && (
            <div
              onClick={() => navigate(`/students/${cho.id}`)}
              className="bg-white rounded-xl border border-[#3363AD]/20 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <MemberAvatar name={cho.user.fullNames} photo={cho.user.photo} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{cho.user.fullNames}</p>
                  <span className="text-[10px] font-semibold text-[#3363AD] bg-[#EBF0F9] rounded-full px-2 py-0.5">
                    Leader (CHO)
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 border-t border-gray-50 pt-3">
                {cho.user.phoneNumber && (
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span>{cho.user.phoneNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHW member cards */}
          {filtered.map((member: ICHOGroupMember) => {
            const u = member.student.user;
            return (
              <div
                key={member.id}
                onClick={() => navigate(`/students/${member.student.id}`)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <MemberAvatar name={u.fullNames} photo={u.photo} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{u.fullNames}</p>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                      Active
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingRemove(member);
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Remove from group"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 border-t border-gray-50 pt-3">
                  {u.phoneNumber && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span>{u.phoneNumber}</span>
                    </div>
                  )}
                  {(u.district || u.sector) && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="truncate">
                        {[u.district, u.sector].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add CHW modal */}
      <Transition appear show={showAddModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EBF0F9] flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-[#3363AD]" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-bold text-gray-900">Add CHW</Dialog.Title>
                      <p className="text-xs text-gray-500">Search by name or phone to find a CHW</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter by name or phone number…"
                      value={addSearchTerm}
                      onChange={(e) => handleAddSearchChange(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
                      autoFocus
                    />
                    {candidatesFetching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#3363AD]/30 border-t-[#3363AD] rounded-full animate-spin" />
                    )}
                  </div>
                </div>

                {/* Candidates list */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
                  {candidatesLoading ? (
                    <div className="space-y-3 animate-pulse">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                      ))}
                    </div>
                  ) : chwCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <Users className="w-10 h-10 text-gray-300" />
                      <p className="text-gray-500 font-medium text-sm">No available CHWs found</p>
                      <p className="text-gray-400 text-xs">
                        {addDebouncedSearch
                          ? "No match — try a different name or phone number"
                          : "No unassigned CHWs in your area yet"}
                      </p>
                    </div>
                  ) : (
                    chwCandidates.map((student: IStudentSearchResult) => {
                      const alreadyAdded = addedIds.has(student.id);
                      return (
                        <div
                          key={student.id}
                          className="bg-gray-50 rounded-xl p-3 flex items-center gap-3"
                        >
                          <MemberAvatar name={student.user.fullNames} photo={student.user.photo} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {student.user.fullNames}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {student.user.phoneNumber && (
                                <span className="flex items-center gap-1 text-gray-500 text-xs">
                                  <Phone className="w-3 h-3" />
                                  {student.user.phoneNumber}
                                </span>
                              )}
                              {(student.user.district || student.user.sector) && (
                                <span className="flex items-center gap-1 text-gray-500 text-xs">
                                  <MapPin className="w-3 h-3" />
                                  {[student.user.district, student.user.sector].filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          {alreadyAdded ? (
                            <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                              Added
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isAdding}
                              onClick={() => setPendingStudent(student)}
                            >
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Add CHW confirmation modal */}
      <Transition appear show={!!pendingStudent} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setPendingStudent(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-[#3363AD]" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      Add CHW to Group
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-1">
                      Add{" "}
                      <span className="font-semibold text-gray-800">
                        {pendingStudent?.user.fullNames}
                      </span>{" "}
                      directly to your group?
                    </Dialog.Description>
                  </div>

                  {pendingStudent && (
                    <div className="w-full bg-gray-50 rounded-xl p-3 text-left flex items-center gap-3">
                      <MemberAvatar
                        name={pendingStudent.user.fullNames}
                        photo={pendingStudent.user.photo}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {pendingStudent.user.fullNames}
                        </p>
                        {pendingStudent.user.phoneNumber && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {pendingStudent.user.phoneNumber}
                          </p>
                        )}
                        {(pendingStudent.user.district || pendingStudent.user.sector) && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[pendingStudent.user.district, pendingStudent.user.sector]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPendingStudent(null)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => pendingStudent && addMember(pendingStudent.id)}
                    isLoading={isAdding}
                  >
                    {!isAdding && <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
                    Add
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Remove confirmation modal */}
      <Transition appear show={!!pendingRemove} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPendingRemove(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <UserMinus className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      Remove Member
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-1">
                      Remove{" "}
                      <span className="font-semibold text-gray-800">
                        {pendingRemove?.student.user.fullNames}
                      </span>{" "}
                      from your group? They can be re-added later.
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
                    onClick={() => pendingRemove && removeMember(pendingRemove.student.id)}
                    isLoading={isRemoving}
                  >
                    {!isRemoving && <UserMinus className="w-3.5 h-3.5 mr-1.5" />}
                    Remove
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

export default CHOGroupPage;
