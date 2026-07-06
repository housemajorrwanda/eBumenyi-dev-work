import { FC, Fragment, useState, useCallback } from "react";
import { Eye, Pencil, ArrowUpCircle, ArrowDownCircle, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import { IStudent, getStudentById, updateStudent, getAllStudentsNoPagination } from "@/services/students.service";
import { adminPromoteToCHO, adminDemoteToCHW } from "@/services/choGroup.service";
import { studentKeys } from "@/utils/constants/queryKeys";
import EditUserModal, { EditUserFormData } from "@/components/common/EditUserModal";
import { StudentData } from "@/types";
import { Button } from "@/components/common/Button";

const STUDENT_ROLE_OPTIONS = [
  { label: "Trainee (CHW)", value: "TRAINEE" },
  { label: "Tester", value: "TESTER" },
];

interface StudentTableActionsProps {
  item: IStudent;
  showPromote?: boolean;
  showDemote?: boolean;
  showPromoteToCHW?: boolean;
}

const StudentTableActions: FC<StudentTableActionsProps> = ({
  item,
  showPromote = false,
  showDemote = false,
  showPromoteToCHW = false,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [groupName, setGroupName] = useState("");

  // Demote state
  const [demoteOpen, setDemoteOpen] = useState(false);
  const [newCHO, setNewCHO] = useState<IStudent | null>(null);
  const [demoteSearch, setDemoteSearch] = useState("");
  const [demoteDebounced, setDemoteDebounced] = useState("");
  const [demotePickerKey, setDemotePickerKey] = useState(0);

  const debouncedSetDemote = useCallback(debounce((v: string) => setDemoteDebounced(v), 350), []);

  const { data: candidatesResp, isFetching: isSearching } = useQuery({
    queryKey: ["demote-candidate-search", demoteDebounced, demotePickerKey],
    queryFn: () =>
      getAllStudentsNoPagination(
        demoteDebounced.length > 1
          ? `?searchq=${encodeURIComponent(demoteDebounced)}&role=TRAINEE&limit=8`
          : `?role=TRAINEE&limit=8`
      ),
    enabled: demoteOpen,
  });
  const demoteCandidates: IStudent[] = candidatesResp?.data ?? [];

  const { mutate: demote, isPending: isDemoting } = useMutation({
    mutationFn: () => adminDemoteToCHW(item.userId, newCHO!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success(`${item.fullName} demoted. ${data.newCHO.fullNames} is now the CHO.`);
      setDemoteOpen(false);
      setNewCHO(null);
      setDemoteSearch("");
      setDemotePickerKey((k) => k + 1);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to demote CHO.");
    },
  });

  const handleView = () => {
    navigate(`/students/${item.id}`);
  };

  const handleEditClick = async () => {
    setLoadingEdit(true);
    try {
      const res = await getStudentById(item.id);
      setStudentData(res.data ?? null);
      setEditOpen(true);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSubmit = async (data: EditUserFormData) => {
    await updateStudent(item.id, { ...data });
    queryClient.invalidateQueries({ queryKey: studentKeys.all });
    toast.success("CHW info updated successfully");
  };

  const { mutate: promote, isPending: isPromoting } = useMutation({
    mutationFn: () => adminPromoteToCHO(item.userId, groupName.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin-cho-groups"] });
      toast.success(`${item.fullName} promoted to CHO successfully.`);
      setPromoteOpen(false);
      setGroupName("");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to promote user.");
    },
  });

  const { mutate: promoteToCHW, isPending: isPromotingToCHW } = useMutation({
    mutationFn: () =>
      updateStudent(item.id, {
        role: "TRAINEE",
        fullNames: item.fullName,
        phoneNumber: item.phoneNumber,
        district: item.district,
        sector: item.sector,
        cell: item.cell,
        village: item.village,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
      toast.success(`${item.fullName} promoted to CHW.`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? "Failed to promote to CHW.");
    },
  });

  const initialData = studentData
    ? {
        fullNames: studentData.studentInfo.fullName,
        email: "",
        phoneNumber: studentData.studentInfo.phoneNumber,
        gender: studentData.studentInfo.gender ?? "",
        NID: studentData.studentInfo.NID ?? "",
        birthdate: "",
        district: studentData.studentInfo.district,
        sector: studentData.studentInfo.sector,
        cell: studentData.studentInfo.cell,
        village: studentData.studentInfo.village,
        role: studentData.studentInfo.role ?? "",
      }
    : {
        fullNames: item.fullName,
        phoneNumber: item.phoneNumber,
        district: item.district,
        sector: item.sector,
      };

  return (
    <>
      <div className='w-full'>
        <div
          className='flex gap-2 py-1 px-2 hover:bg-gray-100 cursor-pointer'
          onClick={handleView}
        >
          <Eye className='w-4 text-green-600' /> View
        </div>
        <div
          className='flex gap-2 py-1 px-2 hover:bg-gray-100 cursor-pointer'
          onClick={handleEditClick}
        >
          <Pencil className='w-4 text-[#3363AD]' />
          {loadingEdit ? "Loading..." : "Edit"}
        </div>
        {showPromoteToCHW && (
          <div
            className='flex gap-2 py-1 px-2 hover:bg-[#3363AD]/5 cursor-pointer text-[#3363AD]'
            onClick={() => promoteToCHW()}
          >
            <ArrowUpCircle className='w-4' />
            {isPromotingToCHW ? "Promoting…" : "Promote to CHW"}
          </div>
        )}
        {showPromote && (
          <div
            className='flex gap-2 py-1 px-2 hover:bg-amber-50 cursor-pointer text-amber-600'
            onClick={() => setPromoteOpen(true)}
          >
            <ArrowUpCircle className='w-4' />
            Promote to CHO
          </div>
        )}
        {showDemote && (
          <div
            className='flex gap-2 py-1 px-2 hover:bg-red-50 cursor-pointer text-red-500'
            onClick={() => setDemoteOpen(true)}
          >
            <ArrowDownCircle className='w-4' />
            Demote to CHW
          </div>
        )}
      </div>

      <EditUserModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title='Edit CHW Info'
        initialData={initialData}
        roleOptions={STUDENT_ROLE_OPTIONS}
        onSubmit={handleSubmit}
      />

      {/* Promote to CHO modal */}
      <Transition appear show={promoteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isPromoting && setPromoteOpen(false)}>
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
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <ArrowUpCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">Promote to CHO</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-0.5">
                      Promote <span className="font-semibold text-gray-700">{item.fullName}</span> to
                      Community Health Officer. A CHO group will be created automatically.
                    </Dialog.Description>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Group Name{" "}
                    <span className="font-normal text-gray-400">
                      (optional — defaults to "{item.fullName}'s Group")
                    </span>
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder={`${item.fullName}'s Group`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3363AD]/30 focus:border-[#3363AD]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setPromoteOpen(false); setGroupName(""); }}
                    disabled={isPromoting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 !bg-amber-500 hover:!bg-amber-600"
                    onClick={() => promote()}
                    isLoading={isPromoting}
                  >
                    {!isPromoting && <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" />}
                    Promote
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Demote to CHW modal */}
      <Transition appear show={demoteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !isDemoting && setDemoteOpen(false)}>
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
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <ArrowDownCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold text-gray-900">Demote to CHW</Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-500 mt-0.5">
                      Demote <span className="font-semibold text-gray-700">{item.fullName}</span> back to CHW. You must assign a replacement CHO for their group.
                    </Dialog.Description>
                  </div>
                </div>

                {/* Replacement search */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Select replacement CHO</label>
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
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
                    )}
                    {newCHO && (
                      <button
                        type="button"
                        onClick={() => { setNewCHO(null); setDemoteSearch(""); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {demoteCandidates.length > 0 && !newCHO && (
                    <div className="border border-gray-100 rounded-lg shadow-lg bg-white max-h-44 overflow-y-auto">
                      {demoteCandidates.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setNewCHO(s); setDemoteSearch(s.fullName); setDemoteDebounced(""); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#3363AD]/10 text-[#3363AD] flex items-center justify-center text-xs font-bold shrink-0">
                            {s.fullName?.substring(0, 2).toUpperCase() ?? "??"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{s.fullName}</p>
                            {s.phoneNumber && <p className="text-xs text-gray-400">{s.phoneNumber}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {demoteDebounced.length > 1 && demoteCandidates.length === 0 && !isSearching && (
                    <p className="text-xs text-gray-400 px-1">No CHWs found.</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setDemoteOpen(false); setNewCHO(null); setDemoteSearch(""); setDemotePickerKey((k) => k + 1); }}
                    disabled={isDemoting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 !bg-red-500 hover:!bg-red-600"
                    onClick={() => demote()}
                    isLoading={isDemoting}
                    disabled={!newCHO}
                  >
                    {!isDemoting && <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" />}
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

export default StudentTableActions;
