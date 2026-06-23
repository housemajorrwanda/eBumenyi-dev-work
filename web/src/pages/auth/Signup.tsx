import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail, User, Phone, Calendar, MapPin,
  Users as UsersIcon, CreditCard, Building2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AuthDecorativePanel } from "@/components/auth/AuthDecorativePanel";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { signup } from "@/services/auth.service";
import { ISignUp } from "@/types/auth";
import { signupSchema } from "@/schemas/users.schema";
import { locations } from "@/hooks/locations";
import { getPublicHospitals } from "@/services/hospitals.service";

// ─── Dark-themed field components ────────────────────────────────────────────

const DarkField: React.FC<{
  label: string;
  placeholder?: string;
  type?: string;
  icon: React.ReactNode;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reg: any;
  disabled?: boolean;
}> = ({ label, placeholder, type = "text", icon, error, reg, disabled }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors ${
          disabled
            ? "bg-[#161922] border-white/[0.04] opacity-50 cursor-not-allowed"
            : error
            ? "border-red-500/50 bg-[#1f1535]"
            : "bg-[#1c1f2e] border-white/[0.08] focus-within:border-[#3363AD]/70"
        }`}
      >
        <span className={`flex-shrink-0 ${error ? "text-red-400" : "text-gray-500"}`}>
          {icon}
        </span>
        <input
          {...reg}
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none min-w-0 disabled:cursor-not-allowed"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
    </div>
  );
};

const DarkSelect: React.FC<{
  label: string;
  icon: React.ReactNode;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reg: any;
  options: { value: string; label: string }[];
  defaultLabel: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}> = ({ label, icon, error, reg, options, defaultLabel, disabled, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    reg.onChange(e);
    onChange?.(e.target.value);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors ${
          disabled
            ? "bg-[#161922] border-white/[0.04] opacity-50 cursor-not-allowed"
            : error
            ? "border-red-500/50 bg-[#1f1535]"
            : "bg-[#1c1f2e] border-white/[0.08] focus-within:border-[#3363AD]/70"
        }`}
      >
        <span className={`flex-shrink-0 ${error ? "text-red-400" : "text-gray-500"}`}>
          {icon}
        </span>
        <select
          {...reg}
          onChange={handleChange}
          disabled={disabled}
          className="flex-1 bg-transparent text-white text-sm outline-none min-w-0 disabled:cursor-not-allowed appearance-none [&>option]:bg-[#1c1f2e] [&>option]:text-white"
        >
          <option value="" className="text-gray-600">{defaultLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
    </div>
  );
};

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
    <span className="flex-1 h-px bg-white/[0.06]" />
    {children}
    <span className="flex-1 h-px bg-white/[0.06]" />
  </h3>
);

// ─── Main Signup Component ────────────────────────────────────────────────────

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSector, setSelectedSector]     = useState("");
  const [selectedCell, setSelectedCell]         = useState("");

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<ISignUp>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "", fullNames: "", phoneNumber: "",
      district: "", sector: "", cell: "", village: "",
      NID: "", birthdate: "", gender: "", hospitalId: "",
    },
  });

  const { data: hospitals = [] } = useQuery({
    queryKey: ["publicHospitals"],
    queryFn: () => getPublicHospitals({ limit: 200 }),
  });

  const hospitalOptions = hospitals.map((h) => ({ value: h.id, label: h.name }));

  const districts = useMemo(() =>
    locations.provinces.flatMap((p) =>
      p.districts.map((d) => ({ value: d.name, label: d.name }))
    ), []);

  const sectors = useMemo(() => {
    if (!selectedDistrict) return [];
    const d = locations.provinces.flatMap((p) => p.districts).find((d) => d.name === selectedDistrict);
    return d ? d.sectors.map((s) => ({ value: s.name, label: s.name })) : [];
  }, [selectedDistrict]);

  const cells = useMemo(() => {
    if (!selectedDistrict || !selectedSector) return [];
    const d = locations.provinces.flatMap((p) => p.districts).find((d) => d.name === selectedDistrict);
    const s = d?.sectors.find((s) => s.name === selectedSector);
    return s ? s.cells.map((c) => ({ value: c.name, label: c.name })) : [];
  }, [selectedDistrict, selectedSector]);

  const villages = useMemo(() => {
    if (!selectedDistrict || !selectedSector || !selectedCell) return [];
    const d = locations.provinces.flatMap((p) => p.districts).find((d) => d.name === selectedDistrict);
    const s = d?.sectors.find((s) => s.name === selectedSector);
    const c = s?.cells.find((c) => c.name === selectedCell);
    return c ? c.villages.map((v) => ({ value: v.name, label: v.name })) : [];
  }, [selectedDistrict, selectedSector, selectedCell]);

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value); setSelectedSector(""); setSelectedCell("");
    setValue("district", value); setValue("sector", ""); setValue("cell", ""); setValue("village", "");
  };
  const handleSectorChange = (value: string) => {
    setSelectedSector(value); setSelectedCell("");
    setValue("sector", value); setValue("cell", ""); setValue("village", "");
  };
  const handleCellChange = (value: string) => {
    setSelectedCell(value);
    setValue("cell", value); setValue("village", "");
  };

  const onSubmit = async (data: ISignUp) => {
    try {
      await signup(data);
      toast.success("Registration successful! Please login.");
      navigate("/auth/login");
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Registration failed";
      toast.error(msg);
    }
  };

  const genderOptions = [{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }, { value: "Other", label: "Other" }];

  return (
    <div className="min-h-screen flex items-center justify-center p-0 lg:p-3" style={{ background: "#0e0a1f" }}>
      <div
        className="w-full min-h-screen lg:min-h-0 lg:h-[calc(100vh-24px)] flex overflow-hidden"
        style={{
          borderRadius: "clamp(0px, (100vw - 768px) * 9999, 18px)",
          background: "#111827",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(51,99,173,0.12)",
        }}
      >
        <AuthDecorativePanel />

        {/* Right panel — scrollable */}
        <div
          className="flex-1 overflow-y-auto px-6 py-10"
          style={{ background: "#111827" }}
        >
          <div className="w-full max-w-[560px] mx-auto">

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-1.5">Create Account</h1>
              <p className="text-base text-gray-500">Join the eBumenyi learning platform</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">

              {/* Personal Information */}
              <div className="space-y-4">
                <SectionHeading>Personal Information</SectionHeading>
                <div className="grid grid-cols-2 gap-4">
                  <DarkField label="Full Names" placeholder="John Doe" icon={<User size={16} />} error={errors.fullNames?.message} reg={register("fullNames")} />
                  <DarkSelect label="Gender" icon={<UsersIcon size={16} />} error={errors.gender?.message} reg={register("gender")} options={genderOptions} defaultLabel="Select Gender" />
                  <DarkField label="Phone Number" placeholder="+250 7XX XXX XXX" type="tel" icon={<Phone size={16} />} error={errors.phoneNumber?.message} reg={register("phoneNumber")} />
                  <DarkField label="Email Address" placeholder="john.doe@example.com" type="email" icon={<Mail size={16} />} error={errors.email?.message} reg={register("email")} />
                  <DarkField label="National ID (NID)" placeholder="1XXXXXXXXXXXXXXXX" icon={<CreditCard size={16} />} error={errors.NID?.message} reg={register("NID")} />
                  <DarkField label="Date of Birth" type="date" icon={<Calendar size={16} />} error={errors.birthdate?.message} reg={register("birthdate")} />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <SectionHeading>Location</SectionHeading>
                <div className="grid grid-cols-2 gap-4">
                  <DarkSelect label="District" icon={<MapPin size={16} />} error={errors.district?.message} reg={register("district")} options={districts} defaultLabel="Select District" onChange={handleDistrictChange} />
                  <DarkSelect label="Sector" icon={<MapPin size={16} />} error={errors.sector?.message} reg={register("sector")} options={sectors} defaultLabel={selectedDistrict ? "Select Sector" : "Select District first"} onChange={handleSectorChange} disabled={!selectedDistrict} />
                  <DarkSelect label="Cell" icon={<MapPin size={16} />} error={errors.cell?.message} reg={register("cell")} options={cells} defaultLabel={selectedSector ? "Select Cell" : "Select Sector first"} onChange={handleCellChange} disabled={!selectedSector} />
                  <DarkSelect label="Village" icon={<MapPin size={16} />} error={errors.village?.message} reg={register("village")} options={villages} defaultLabel={selectedCell ? "Select Village" : "Select Cell first"} disabled={!selectedCell} />
                </div>
              </div>

              {/* Hospital */}
              <div className="space-y-4">
                <SectionHeading>Health Facility</SectionHeading>
                <DarkSelect
                  label="Hospital / Health Center"
                  icon={<Building2 size={16} />}
                  error={errors.hospitalId?.message}
                  reg={register("hospitalId")}
                  options={hospitalOptions}
                  defaultLabel="Select Hospital (optional)"
                />
              </div>

              {/* Terms */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 rounded border-white/20 bg-[#1a2235] accent-[#3363AD]"
                />
                <span className="text-sm text-gray-500">
                  I agree to the{" "}
                  <Link to="/terms" className="text-[#4a90d9] hover:text-[#6aaae8] transition-colors">
                    Terms and Conditions
                  </Link>
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#3363AD] hover:bg-[#2a52a0] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-base rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </button>

              {/* Footer */}
              <div className="pt-2 border-t border-white/[0.05] text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link to="/auth/login" className="text-[#4a90d9] hover:text-[#6aaae8] font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>

            </form>
          </div>
        </div>
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-700 whitespace-nowrap">
        © {new Date().getFullYear()} eBumenyi · Ministry of Health, Rwanda
      </p>
    </div>
  );
};
