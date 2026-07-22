import { FC, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal from "./Modal";
import { getPublicHospitals } from "@/services/hospitals.service";

export interface EditUserFormData {
  fullNames: string;
  email: string;
  phoneNumber: string;
  gender: string;
  NID: string;
  birthdate: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  role: string;
  hospitalId: string;
}

interface RoleOption {
  label: string;
  value: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialData: Partial<EditUserFormData>;
  onSubmit: (data: EditUserFormData) => Promise<void>;
  roleOptions?: RoleOption[];
}

const EMPTY_FORM: EditUserFormData = {
  fullNames: "",
  email: "",
  phoneNumber: "",
  gender: "",
  NID: "",
  birthdate: "",
  district: "",
  sector: "",
  cell: "",
  village: "",
  role: "",
  hospitalId: "",
};

const EditUserModal: FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  title,
  initialData,
  onSubmit,
  roleOptions,
}) => {
  const [form, setForm] = useState<EditUserFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: hospitals = [] } = useQuery({
    queryKey: ["publicHospitals"],
    queryFn: () => getPublicHospitals(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY_FORM, ...initialData });
    }
  }, [isOpen, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // An empty selection means "leave unchanged" — sending "" would try to
      // set a literal empty-string foreign key and fail on the backend.
      await onSubmit({ ...form, hospitalId: form.hospitalId || undefined } as EditUserFormData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#3363AD] focus:border-[#3363AD]";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input
              name="fullNames"
              value={form.fullNames}
              onChange={handleChange}
              required
              placeholder="Full name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email address"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone Number *</label>
            <input
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              required
              placeholder="Phone number"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {roleOptions && roleOptions.length > 0 && (
            <div>
              <label className={labelClass}>Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select role</option>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>NID</label>
            <input
              name="NID"
              value={form.NID}
              onChange={handleChange}
              placeholder="National ID"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Birthdate</label>
            <input
              name="birthdate"
              type="date"
              value={form.birthdate}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>District *</label>
            <input
              name="district"
              value={form.district}
              onChange={handleChange}
              required
              placeholder="District"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sector *</label>
            <input
              name="sector"
              value={form.sector}
              onChange={handleChange}
              required
              placeholder="Sector"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cell *</label>
            <input
              name="cell"
              value={form.cell}
              onChange={handleChange}
              required
              placeholder="Cell"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Village *</label>
            <input
              name="village"
              value={form.village}
              onChange={handleChange}
              required
              placeholder="Village"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Hospital / Health Center</label>
            <select
              name="hospitalId"
              value={form.hospitalId}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select hospital (optional)</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3363AD] rounded-lg hover:bg-[#2a529a] disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditUserModal;
