import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  MapPin,
  Phone,
  UserPlus,
  ChevronLeft,
  CalendarDays,
  UserMinus,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { getMyGroup, getMyGroupMembers, choRemoveMyMember } from "@/services/choGroup.service";
import { ICHOGroupMember } from "@/types";
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

const CHOGroupMembersPage = () => {
  const [search, setSearch] = useState("");
  const [pendingRemove, setPendingRemove] = useState<ICHOGroupMember | null>(null);
  const queryClient = useQueryClient();

  const { data: group } = useQuery({
    queryKey: ["cho-group-mine"],
    queryFn: getMyGroup,
    retry: false,
  });

  const { data: members = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cho-group-members"],
    queryFn: getMyGroupMembers,
  });

  const cho = group?.cho;

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

  const filtered = members.filter((m: ICHOGroupMember) =>
    m.student.user.fullNames.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/cho-group"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-[#333333]">Group Members</h2>
            <p className="text-sm text-gray-500">
              {isLoading
                ? "Loading…"
                : `${members.length + (cho ? 1 : 0)} member${members.length + (cho ? 1 : 0) !== 1 ? "s" : ""} in your group`}
            </p>
          </div>
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
          <Link to="/cho-group/invite">
            <Button size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Add CHW
            </Button>
          </Link>
        </div>
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 && !(cho && (!search || cho.user.fullNames.toLowerCase().includes(search.toLowerCase()))) ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {search ? "No members match your search" : "No members yet"}
          </p>
          {!search && (
            <Link to="/cho-group/invite">
              <Button size="sm">Add your first CHW</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CHO leader card */}
          {cho && (!search || cho.user.fullNames.toLowerCase().includes(search.toLowerCase())) && (
            <div className="bg-white rounded-xl border border-[#3363AD]/20 shadow-sm p-4 hover:shadow-md transition-shadow">
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
          {filtered.map((member: ICHOGroupMember) => {
            const u = member.student.user;
            return (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
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
                    onClick={() => setPendingRemove(member)}
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
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span>
                      Joined{" "}
                      {new Date(member.joinedAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

export default CHOGroupMembersPage;
