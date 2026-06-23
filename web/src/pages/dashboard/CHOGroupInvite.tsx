import { useState, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  UserPlus,
  MapPin,
  Phone,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import { debounce } from "lodash";
import toast from "react-hot-toast";
import { searchCHWCandidates, choDirectlyAddMember } from "@/services/choGroup.service";
import { IStudentSearchResult } from "@/types";
import { Button } from "@/components/common/Button";

const StudentAvatar = ({ name, photo }: { name: string; photo: string | null }) => {
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

const CHOGroupInvitePage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pendingStudent, setPendingStudent] = useState<IStudentSearchResult | null>(null);
  const queryClient = useQueryClient();

  const debouncedSetSearch = useCallback(
    debounce((val: string) => setDebouncedSearch(val), 400),
    [],
  );

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    debouncedSetSearch(val);
  };

  const { data: students = [], isLoading, isFetching } = useQuery({
    queryKey: ["cho-chw-candidates", debouncedSearch],
    queryFn: () => searchCHWCandidates(debouncedSearch || undefined),
  });

  const { mutate: addMember, isPending } = useMutation({
    mutationFn: (studentId: string) => choDirectlyAddMember(studentId),
    onSuccess: (_, studentId) => {
      setAddedIds((prev) => new Set([...prev, studentId]));
      setPendingStudent(null);
      queryClient.invalidateQueries({ queryKey: ["cho-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["cho-chw-candidates"] });
      toast.success("CHW added to your group successfully.");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? "Failed to add CHW.";
      toast.error(msg);
    },
  });

  const handleAdd = (student: IStudentSearchResult) => {
    if (addedIds.has(student.id)) return;
    setPendingStudent(student);
  };

  const confirmAdd = () => {
    if (pendingStudent) addMember(pendingStudent.id);
  };

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
            <h2 className="text-3xl font-bold text-[#333333]">Add CHW</h2>
            <p className="text-sm text-gray-500">
              Suggestions from your area — or search by name/phone to find anyone.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by name or phone number…"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#3363AD]/30 border-t-[#3363AD] rounded-full animate-spin" />
        )}
      </div>

      {/* States */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">No available CHWs found</p>
          <p className="text-gray-400 text-sm">
            {debouncedSearch
              ? "No match — try a different name or phone number"
              : "No unassigned CHWs in your area yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student: IStudentSearchResult) => {
            const alreadyAdded = addedIds.has(student.id);

            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <StudentAvatar name={student.user.fullNames} photo={student.user.photo} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{student.user.fullNames}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {student.user.phoneNumber && (
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Phone className="w-3 h-3" />
                        <span>{student.user.phoneNumber}</span>
                      </div>
                    )}
                    {(student.user.district || student.user.sector) && (
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {[student.user.district, student.user.sector].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {alreadyAdded ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    Added
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isPending}
                    onClick={() => handleAdd(student)}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add confirmation modal */}
      <Transition appear show={!!pendingStudent} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPendingStudent(null)}>
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
                      <StudentAvatar
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
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={confirmAdd}
                    isLoading={isPending}
                  >
                    {!isPending && <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
                    Add
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

export default CHOGroupInvitePage;
