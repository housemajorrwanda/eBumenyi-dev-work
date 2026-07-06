import { FC, Fragment, useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  X,
} from "lucide-react";
import { IStudent, getAllStudentsNoPagination, updateStudent } from "@/services/students.service";
import { adminDemoteToCHW, adminPromoteToCHO } from "@/services/choGroup.service";
import { studentKeys } from "@/utils/constants/queryKeys";
import { Button } from "@/components/common/Button";

type RoleFilter = "TRAINEE" | "TESTER" | "CHO";

interface BulkStudentRoleActionsProps {
  roleFilter: RoleFilter;
  selectedStudents: IStudent[];
  onClear: () => void;
}

const roleLabel: Record<RoleFilter, string> = {
  TRAINEE: "CHW",
  TESTER: "Tester",
  CHO: "CHO",
};

export const BulkStudentRoleActions: FC<BulkStudentRoleActionsProps> = ({
  roleFilter,
  selectedStudents,
  onClear,
}) => {
  const queryClient = useQueryClient();
  const count = selectedStudents.length;

  const [promoteChoOpen, setPromoteChoOpen] = useState(false);
  const [groupNamePrefix, setGroupNamePrefix] = useState("");

  const [demoteOpen, setDemoteOpen] = useState(false);
  const [newCHO, setNewCHO] = useState<IStudent | null>(null);
  const [demoteSearch, setDemoteSearch] = useState("");
  const [demoteDebounced, setDemoteDebounced] = useState("");

  const debouncedSetDemote = useCallback(debounce((v: string) => setDemoteDebounced(v), 350), []);

  const { data: candidatesResp, isFetching: isSearching } = useQuery({
    queryKey: ["bulk-demote-candidate-search", demoteDebounced],
    queryFn: () =>
      getAllStudentsNoPagination(
        demoteDebounced.length > 1
          ? `?searchq=${encodeURIComponent(demoteDebounced)}&role=TRAINEE&limit=8`
          : "?role=TRAINEE&limit=8",
      ),
    enabled: demoteOpen,
  });
  const demoteCandidates: IStudent[] = candidatesResp?.data ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: studentKeys.all });
    queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
    onClear();
  };

  const { mutate: promoteTestersToCHW, isPending: isPromotingTesters } = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedStudents.map((student) =>
          updateStudent(student.id, {
            role: "TRAINEE",
            fullNames: student.fullName,
            phoneNumber: student.phoneNumber,
            district: student.district,
            sector: student.sector,
            cell: student.cell,
            village: student.village,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === results.length) throw new Error("All updates failed");
      return { succeeded: results.length - failed, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      invalidateAll();
      if (failed > 0) {
        toast.success(`Promoted ${succeeded} to CHW. ${failed} failed.`);
      } else {
        toast.success(`Promoted ${succeeded} tester${succeeded !== 1 ? "s" : ""} to CHW.`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to promote testers.");
    },
  });

  const { mutate: promoteCHWsToCHO, isPending: isPromotingCHW } = useMutation({
    mutationFn: async () => {
      const prefix = groupNamePrefix.trim();
      const results = await Promise.allSettled(
        selectedStudents.map((student) =>
          adminPromoteToCHO(
            student.userId,
            prefix ? `${prefix} — ${student.fullName}` : undefined,
          ),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === results.length) throw new Error("All promotions failed");
      return { succeeded: results.length - failed, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      invalidateAll();
      setPromoteChoOpen(false);
      setGroupNamePrefix("");
      if (failed > 0) {
        toast.success(`Promoted ${succeeded} to CHO. ${failed} failed.`);
      } else {
        toast.success(`Promoted ${succeeded} CHW${succeeded !== 1 ? "s" : ""} to CHO.`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to promote to CHO.");
    },
  });

  const { mutate: demoteCHO, isPending: isDemoting } = useMutation({
    mutationFn: () => adminDemoteToCHW(selectedStudents[0].userId, newCHO!.id),
    onSuccess: (data) => {
      invalidateAll();
      setDemoteOpen(false);
      setNewCHO(null);
      setDemoteSearch("");
      toast.success(`${selectedStudents[0].fullName} demoted. ${data.newCHO.fullNames} is now the CHO.`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to demote CHO.");
    },
  });

  if (count === 0) return null;

  const isBusy = isPromotingTesters || isPromotingCHW || isDemoting;

  const handleDemoteClick = () => {
    if (count > 1) {
      toast.error("Demote one CHO at a time — each group needs its own replacement CHO.");
      return;
    }
    setDemoteOpen(true);
  };

  return (
    <>
      <div className="mb-4 bg-[#3363AD]/5 border border-[#3363AD]/20 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-[#3363AD]">
        <span className="text-sm font-medium">
          {count} {roleLabel[roleFilter]}{count !== 1 ? "s" : ""} selected
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={isBusy}
            className="text-xs font-semibold bg-white border border-[#3363AD]/20 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Clear
          </button>

          {roleFilter === "TESTER" && (
            <button
              type="button"
              onClick={() => promoteTestersToCHW()}
              disabled={isBusy}
              className="text-xs font-semibold bg-[#3363AD] text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-[#2a5290] disabled:opacity-50 flex items-center gap-1"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              {isPromotingTesters ? "Promoting…" : "Promote to CHW"}
            </button>
          )}

          {roleFilter === "TRAINEE" && (
            <button
              type="button"
              onClick={() => setPromoteChoOpen(true)}
              disabled={isBusy}
              className="text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Promote to CHO
            </button>
          )}

          {roleFilter === "CHO" && (
            <button
              type="button"
              onClick={handleDemoteClick}
              disabled={isBusy}
              className="text-xs font-semibold bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              Demote to CHW
            </button>
          )}
        </div>
      </div>

      {/* Bulk promote to CHO */}
      <Transition appear show={promoteChoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isPromotingCHW && setPromoteChoOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <Dialog.Title className="text-lg font-bold text-gray-900">Promote to CHO</Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500">
                  Promote {count} CHW{count !== 1 ? "s" : ""} to CHO. A group will be created for each person.
                </Dialog.Description>
                <ul className="max-h-32 overflow-y-auto text-sm text-gray-700 border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {selectedStudents.map((s) => (
                    <li key={s.id} className="px-3 py-2">{s.fullName}</li>
                  ))}
                </ul>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Group name prefix <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={groupNamePrefix}
                    onChange={(e) => setGroupNamePrefix(e.target.value)}
                    placeholder="e.g. Kigali North"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30"
                  />
                  <p className="text-[11px] text-gray-400">
                    Leave empty to use each person&apos;s name (e.g. &quot;Jane&apos;s Group&quot;).
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setPromoteChoOpen(false)} disabled={isPromotingCHW}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1 !bg-amber-500 hover:!bg-amber-600" onClick={() => promoteCHWsToCHO()} isLoading={isPromotingCHW}>
                    Promote {count}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Single CHO demote */}
      <Transition appear show={demoteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isDemoting && setDemoteOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
                <Dialog.Title className="text-lg font-bold text-gray-900">Demote to CHW</Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500">
                  Demote <span className="font-semibold text-gray-700">{selectedStudents[0]?.fullName}</span> back to CHW.
                  Select a replacement CHO for their group.
                </Dialog.Description>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Replacement CHO</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={demoteSearch}
                      onChange={(e) => {
                        setDemoteSearch(e.target.value);
                        setNewCHO(null);
                        debouncedSetDemote(e.target.value);
                      }}
                      placeholder="Search CHW by name…"
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
                    )}
                  </div>
                  {demoteCandidates.length > 0 && !newCHO && (
                    <div className="border border-gray-100 rounded-lg shadow-lg bg-white max-h-44 overflow-y-auto">
                      {demoteCandidates.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setNewCHO(s); setDemoteSearch(s.fullName); }}
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                        >
                          {s.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                  {newCHO && (
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                      <span>{newCHO.fullName}</span>
                      <button type="button" onClick={() => { setNewCHO(null); setDemoteSearch(""); }}>
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setDemoteOpen(false)} disabled={isDemoting}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1 !bg-red-500 hover:!bg-red-600" onClick={() => demoteCHO()} isLoading={isDemoting} disabled={!newCHO}>
                    Demote
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};
