import { FC, useState } from "react";
import { Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { IStaff } from "@/types";
import { updateStaffInfo } from "@/services/staff.service";
import EditUserModal, { EditUserFormData } from "@/components/common/EditUserModal";

const STAFF_ROLE_OPTIONS = [
  { label: "Admin", value: "ADMIN" },
  { label: "Trainer", value: "TRAINER" },
  { label: "CEHO", value: "CEHO" },
  { label: "Staff", value: "STAFF" },
  { label: "Developer", value: "DEVELOPER" },
];

interface StaffTableActionsProps {
  item: IStaff;
}

const StaffTableActions: FC<StaffTableActionsProps> = ({ item }) => {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const handleSubmit = async (data: EditUserFormData) => {
    await updateStaffInfo(item.id, { ...data });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    toast.success("Staff info updated successfully");
  };

  const initialData = {
    fullNames: item.user.fullNames,
    email: item.user.email ?? "",
    phoneNumber: item.user.phoneNumber ?? "",
    gender: item.user.gender ?? "",
    NID: item.user.NID ?? "",
    birthdate: item.user.birthdate
      ? new Date(item.user.birthdate).toISOString().split("T")[0]
      : "",
    district: item.user.district ?? "",
    sector: item.user.sector ?? "",
    cell: item.user.cell ?? "",
    village: item.user.village ?? "",
    role: item.role ?? "",
    hospitalId: item.user.hospitalId ?? "",
  };

  return (
    <>
      <div className="w-full">
        <div
          className="flex gap-2 py-1 px-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="w-4 text-[#3363AD]" /> Edit
        </div>
      </div>

      <EditUserModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Staff Info"
        initialData={initialData}
        roleOptions={STAFF_ROLE_OPTIONS}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default StaffTableActions;
