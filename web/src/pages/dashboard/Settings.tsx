import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  User,
  Bell,
  Shield,
  Globe,
  Palette,
  Monitor,
  Smartphone,
  Mail,
  Phone,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  ChevronRight,
  Moon,
  Sun,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import NotificationsPage from "./NotificationsPage";
import Help from "./Help";
import { getProfile, updateAvatar } from "@/services/profile.api";
import api from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { registerPushToken } from "@/hooks/usePushNotifications";
import { getSettings, updateSettings, type UpdateSettingsPayload, type NotificationCategories } from "@/services/settings.api";

// ── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullNames: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z.string().min(9, "Invalid phone number"),
  district: z.string().optional().default(""),
  sector: z.string().optional().default(""),
  cell: z.string().optional().default(""),
  village: z.string().optional().default(""),
  gender: z.string().optional(),
  NID: z.string().optional(),
  birthdate: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

// ── Small helpers ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400";
const errCls = "text-xs text-red-500 mt-1";

// ── Component ─────────────────────────────────────────────────────────────────

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "profile");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Theme from context (reactive, applies dark class to <html>)
  const { theme, setTheme } = useTheme();

  // Preferences — seeded from localStorage for instant paint, overridden when API loads
  const [emailNotif, setEmailNotif] = useState(() => JSON.parse(localStorage.getItem("st_email") ?? "true"));
  const [pushNotif, setPushNotif] = useState(() => JSON.parse(localStorage.getItem("st_push") ?? "true"));
  const [smsNotif, setSmsNotif] = useState(() => JSON.parse(localStorage.getItem("st_sms") ?? "false"));
  const [language, setLanguage] = useState(() => localStorage.getItem("st_lang") ?? "en");
  const [timezone, setTimezone] = useState(() => localStorage.getItem("st_tz") ?? "Africa/Kigali");
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem("st_datefmt") ?? "DD/MM/YYYY");
  const [categories, setCategories] = useState<NotificationCategories>(() => {
    const stored = localStorage.getItem("st_notif_categories");
    return stored
      ? JSON.parse(stored)
      : { courseUpdates: true, assignmentReminders: true, certificates: true, systemUpdates: false };
  });

  // ── Load settings from API ──────────────────────────────────────────────────

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["userSettings"],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });

  // When API settings arrive, sync all local state + localStorage
  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData;
    setTheme(s.theme as "light" | "dark" | "auto");
    setEmailNotif(s.emailNotif);
    setPushNotif(s.pushNotif);
    setSmsNotif(s.smsNotif);
    setLanguage(s.language);
    setTimezone(s.timezone);
    setDateFormat(s.dateFormat);
    setCategories(s.categories);
    i18n.changeLanguage(s.language);
    // Keep localStorage in sync as cache
    localStorage.setItem("st_theme", s.theme);
    localStorage.setItem("st_email", JSON.stringify(s.emailNotif));
    localStorage.setItem("st_push", JSON.stringify(s.pushNotif));
    localStorage.setItem("st_sms", JSON.stringify(s.smsNotif));
    localStorage.setItem("st_lang", s.language);
    localStorage.setItem("st_tz", s.timezone);
    localStorage.setItem("st_datefmt", s.dateFormat);
    localStorage.setItem("st_notif_categories", JSON.stringify(s.categories));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  // ── Save settings to API ────────────────────────────────────────────────────

  const settingsMut = useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => updateSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["userSettings"] }),
    onError: () => toast.error(t("notifications.failedToSave")),
  });

  const saveSetting = (payload: UpdateSettingsPayload) => settingsMut.mutate(payload);

  // ── Notification categories helpers ─────────────────────────────────────────

  const toggleCategory = (key: keyof NotificationCategories) => {
    const next = { ...categories, [key]: !categories[key] };
    setCategories(next);
    localStorage.setItem("st_notif_categories", JSON.stringify(next));
    saveSetting({ categories: next });
  };

  // ── Browser push permission status (live) ───────────────────────────────────

  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "default"),
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const id = setInterval(() => setPushPermission(Notification.permission), 3000);
    return () => clearInterval(id);
  }, []);

  const [pushLoading, setPushLoading] = useState(false);

  const handlePushToggle = async (enabled: boolean) => {
    if (!enabled) {
      setPushNotif(false);
      localStorage.setItem("st_push", "false");
      saveSetting({ pushNotif: false });
      toast(t("notifications.pushDisabled"), { icon: "ℹ️" });
      return;
    }
    if (pushPermission === "denied") {
      toast.error(t("notifications.pushBlocked"));
      return;
    }
    setPushLoading(true);
    const result = await registerPushToken();
    setPushLoading(false);
    setPushPermission(Notification.permission);
    if (result === "granted") {
      setPushNotif(true);
      localStorage.setItem("st_push", "true");
      saveSetting({ pushNotif: true });
      toast.success(t("notifications.pushEnabled"));
    } else if (result === "denied") {
      toast.error(t("notifications.pushBlockedShort"));
    } else {
      toast.error(t("notifications.pushError"));
    }
  };

  // ── Profile query ───────────────────────────────────────────────────────────

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (profileRes as any)?.data;

  // ── Profile form ────────────────────────────────────────────────────────────

  const {
    register: rp,
    handleSubmit: hsp,
    formState: { errors: ep },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          fullNames: profile.fullNames ?? "",
          email: profile.email ?? "",
          phoneNumber: profile.phoneNumber ?? "",
          district: profile.district ?? "",
          sector: profile.sector ?? "",
          cell: profile.cell ?? "",
          village: profile.village ?? "",
          gender: profile.gender ?? "",
          NID: profile.NID ?? "",
          birthdate: profile.birthdate?.substring(0, 10) ?? "",
        }
      : undefined,
  });

  const profileMut = useMutation({
    mutationFn: (data: ProfileFormData) => api.put("/auth/profile", data),
    onSuccess: (res) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = (res.data as any)?.data;
      if (updated) {
        const stored = JSON.parse(localStorage.getItem("chw") ?? "{}");
        localStorage.setItem("chw", JSON.stringify({ ...stored, ...updated }));
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      resetProfile();
      toast.success("Profile updated successfully");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  // ── Password form ───────────────────────────────────────────────────────────

  const {
    register: rpw,
    handleSubmit: hspw,
    formState: { errors: epw },
    reset: resetPw,
  } = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) });

  const passwordMut = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put("/auth/update-password", data),
    onSuccess: () => {
      toast.success("Password changed successfully");
      resetPw();
    },
    onError: (e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((e as any)?.response?.data?.message ?? "Failed to change password");
    },
  });

  // ── Avatar upload ───────────────────────────────────────────────────────────

  const avatarMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("photo", file);
      return updateAvatar(fd);
    },
    onSuccess: (res) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const photo = (res as any)?.data?.photo ?? (res as any)?.photo;
      if (photo) {
        const stored = JSON.parse(localStorage.getItem("chw") ?? "{}");
        localStorage.setItem("chw", JSON.stringify({ ...stored, photo }));
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Photo updated");
    },
    onError: () => toast.error("Failed to upload photo"),
  });

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "profile", label: t("tabs.profile"), icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: t("tabs.security"), icon: Shield },
    { id: "appearance", label: t("tabs.appearance"), icon: Palette },
    { id: "language", label: t("tabs.language"), icon: Globe },
    { id: "data", label: t("tabs.data"), icon: Download },
    { id: "help", label: "Help & Support", icon: HelpCircle },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t("settings.title")}</h1>
        <p className="text-gray-600 dark:text-slate-400">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-card-bg rounded-lg shadow p-4">
            <nav className="space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    activeTab === id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400"
                      : "text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium text-sm">{label}</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-card-bg rounded-lg shadow">

            {/* ── PROFILE ────────────────────────────────────────────────── */}
            {activeTab === "profile" && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                  <User className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{t("profile.title")}</h2>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <form onSubmit={hsp((data) => profileMut.mutate(data))}>
                    {/* Avatar */}
                    <div className="mb-8">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                        {t("profile.photo")}
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                          {profile?.photo ? (
                            <img
                              src={profile.photo}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>
                              {profile?.fullNames?.[0]?.toUpperCase() ?? "U"}
                            </span>
                          )}
                        </div>
                        <div>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              avatarMut.mutate(e.target.files[0])
                            }
                          />
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={avatarMut.isPending}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-300 text-sm disabled:opacity-50"
                          >
                            {avatarMut.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4" />
                            )}
                            {t("profile.changePhoto")}
                          </button>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {t("profile.photoHint")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Personal info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.fullName")} *
                        </label>
                        <input {...rp("fullNames")} className={inputCls} />
                        {ep.fullNames && (
                          <p className={errCls}>{ep.fullNames.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.email")}
                        </label>
                        <input {...rp("email")} type="email" className={inputCls} />
                        {ep.email && (
                          <p className={errCls}>{ep.email.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.phone")} *
                        </label>
                        <input {...rp("phoneNumber")} type="tel" className={inputCls} />
                        {ep.phoneNumber && (
                          <p className={errCls}>{ep.phoneNumber.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.gender")}
                        </label>
                        <select {...rp("gender")} className={inputCls}>
                          <option value="">{t("profile.genderSelect")}</option>
                          <option value="Male">{t("profile.male")}</option>
                          <option value="Female">{t("profile.female")}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.dob")}
                        </label>
                        <input
                          {...rp("birthdate")}
                          type="date"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("profile.nid")}
                        </label>
                        <input
                          {...rp("NID")}
                          className={inputCls}
                          placeholder={t("profile.nidPlaceholder")}
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                        {t("profile.location")}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(
                          [
                            { name: "district", key: "profile.district" },
                            { name: "sector",   key: "profile.sector" },
                            { name: "cell",     key: "profile.cell" },
                            { name: "village",  key: "profile.village" },
                          ] as const
                        ).map(({ name, key }) => (
                          <div key={name}>
                            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                              {t(key)}
                            </label>
                            <input
                              {...rp(name)}
                              className={inputCls}
                              placeholder={t(key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                      <button
                        type="submit"
                        disabled={profileMut.isPending}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {profileMut.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {t("profile.saveChanges")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ── NOTIFICATIONS ──────────────────────────────────────────── */}
            {activeTab === "notifications" && (
              <div className="p-6">
                <NotificationsPage embedded />
              </div>
            )}

            {/* ── SECURITY ───────────────────────────────────────────────── */}
            {activeTab === "security" && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                  <Shield className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    {t("security.title")}
                  </h2>
                </div>

                <form
                  onSubmit={hspw((data) =>
                    passwordMut.mutate({
                      currentPassword: data.currentPassword,
                      newPassword: data.newPassword,
                    }),
                  )}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-6"
                >
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">
                    {t("security.changePassword")}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        {t("security.currentPassword")}
                      </label>
                      <div className="relative">
                        <input
                          {...rpw("currentPassword")}
                          type={showCurrent ? "text" : "password"}
                          className={`${inputCls} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500"
                        >
                          {showCurrent ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {epw.currentPassword && (
                        <p className={errCls}>{epw.currentPassword.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("security.newPassword")}
                        </label>
                        <div className="relative">
                          <input
                            {...rpw("newPassword")}
                            type={showNew ? "text" : "password"}
                            className={`${inputCls} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500"
                          >
                            {showNew ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {epw.newPassword && (
                          <p className={errCls}>{epw.newPassword.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {t("security.confirmPassword")}
                        </label>
                        <div className="relative">
                          <input
                            {...rpw("confirmPassword")}
                            type={showConfirm ? "text" : "password"}
                            className={`${inputCls} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500"
                          >
                            {showConfirm ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {epw.confirmPassword && (
                          <p className={errCls}>{epw.confirmPassword.message}</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={passwordMut.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {passwordMut.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      {t("security.updatePassword")}
                    </button>
                  </div>
                </form>

                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">
                    {t("security.activeSessions")}
                  </h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {t("security.currentBrowser")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{t("security.activeNow")}</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      {t("security.currentSession")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── APPEARANCE ─────────────────────────────────────────────── */}
            {activeTab === "appearance" && (
              <div className="p-6 space-y-8">
                {/* Theme */}
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                    <Palette className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                      {t("appearance.title")}
                    </h2>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3">
                    {t("appearance.theme")}
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {(
                      [
                        { value: "light", label: t("appearance.light"), icon: Sun, preview: "bg-white border" },
                        { value: "dark",  label: t("appearance.dark"),  icon: Moon, preview: "bg-gray-800" },
                        { value: "auto",  label: t("appearance.auto"),  icon: Monitor, preview: "bg-gradient-to-r from-white to-gray-800" },
                      ] as const
                    ).map(({ value, label, icon: Icon, preview }) => (
                      <button
                        key={value}
                        onClick={() => { setTheme(value); saveSetting({ theme: value }); }}
                        className={`border-2 rounded-lg p-4 text-left transition-colors ${
                          theme === value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 dark:text-slate-300" />
                          <span className="text-sm font-medium dark:text-slate-300">{label}</span>
                        </div>
                        <div className={`w-full h-12 ${preview} rounded`} />
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500 dark:text-slate-400">
                    {theme === "auto"
                      ? t("appearance.autoDesc")
                      : theme === "dark"
                      ? t("appearance.darkDesc")
                      : t("appearance.lightDesc")}
                  </p>
                </div>

                {/* Notification Preferences */}
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                    <Bell className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                      Notification Preferences
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {/* Email */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/40 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{t("notifications.email")}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{t("notifications.emailDesc")}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={emailNotif}
                        onChange={(v) => {
                          setEmailNotif(v);
                          localStorage.setItem("st_email", JSON.stringify(v));
                          saveSetting({ emailNotif: v });
                          toast.success(`${t("notifications.email")} ${v ? t("notifications.enabled") : t("notifications.disabled")}`);
                        }}
                      />
                    </div>

                    {/* Push */}
                    <div className="p-4 bg-gray-50 dark:bg-slate-700/40 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{t("notifications.push")}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{t("notifications.pushDesc")}</p>
                          </div>
                        </div>
                        {pushLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : (
                          <Toggle checked={pushNotif} onChange={handlePushToggle} />
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {pushPermission === "granted" && (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-xs text-green-600 dark:text-green-400">{t("notifications.permGranted")}</span>
                          </>
                        )}
                        {pushPermission === "denied" && (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            <span className="text-xs text-red-600 dark:text-red-400">{t("notifications.permDenied")}</span>
                          </>
                        )}
                        {pushPermission === "default" && (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">{t("notifications.permDefault")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* SMS */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/40 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{t("notifications.sms")}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{t("notifications.smsDesc")}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={smsNotif}
                        onChange={(v) => {
                          setSmsNotif(v);
                          localStorage.setItem("st_sms", JSON.stringify(v));
                          saveSetting({ smsNotif: v });
                          toast.success(`${t("notifications.sms")} ${v ? t("notifications.enabled") : t("notifications.disabled")}`);
                        }}
                      />
                    </div>
                  </div>

                  {/* Notification categories */}
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3">
                      {t("notifications.categories")}
                    </h3>
                    <div className="space-y-1 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      {(
                        [
                          { key: "courseUpdates",       labelKey: "notifications.courseUpdates",       descKey: "notifications.courseUpdatesDesc" },
                          { key: "assignmentReminders", labelKey: "notifications.assignmentReminders", descKey: "notifications.assignmentRemindersDesc" },
                          { key: "certificates",        labelKey: "notifications.certificates",        descKey: "notifications.certificatesDesc" },
                          { key: "systemUpdates",       labelKey: "notifications.systemUpdates",       descKey: "notifications.systemUpdatesDesc" },
                        ] as const
                      ).map(({ key, labelKey, descKey }) => (
                        <label
                          key={key}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 border-b border-gray-100 dark:border-slate-700 last:border-0 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{t(labelKey)}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{t(descKey)}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={categories[key]}
                            onChange={() => toggleCategory(key)}
                            className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LANGUAGE ───────────────────────────────────────────────── */}
            {activeTab === "language" && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                  <Globe className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    {t("language.title")}
                  </h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      {t("language.language")}
                    </label>
                    <select
                      value={language}
                      onChange={(e) => {
                        const lang = e.target.value;
                        setLanguage(lang);
                        i18n.changeLanguage(lang);
                        localStorage.setItem("st_lang", lang);
                        saveSetting({ language: lang });
                      }}
                      className={inputCls}
                    >
                      <option value="en">English</option>
                      <option value="rw">Kinyarwanda</option>
                      {/* <option value="fr">Français</option> */}
                      {/* <option value="sw">Kiswahili</option> */}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      {t("language.timezone")}
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => {
                        setTimezone(e.target.value);
                        localStorage.setItem("st_tz", e.target.value);
                        saveSetting({ timezone: e.target.value });
                      }}
                      className={inputCls}
                    >
                      <option value="Africa/Kigali">(UTC+02:00) Africa/Kigali</option>
                      <option value="UTC">(UTC+00:00) UTC</option>
                      <option value="Europe/London">(UTC+00:00) Europe/London</option>
                      <option value="America/New_York">(UTC-05:00) America/New_York</option>
                      <option value="Asia/Tokyo">(UTC+09:00) Asia/Tokyo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      {t("language.dateFormat")}
                    </label>
                    <select
                      className={inputCls}
                      value={dateFormat}
                      onChange={(e) => {
                        setDateFormat(e.target.value);
                        localStorage.setItem("st_datefmt", e.target.value);
                        saveSetting({ dateFormat: e.target.value });
                      }}
                    >
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── HELP & SUPPORT ─────────────────────────────────────────── */}
            {activeTab === "help" && (
              <div className="p-6">
                <Help />
              </div>
            )}

            {/* ── DATA & STORAGE ─────────────────────────────────────────── */}
            {activeTab === "data" && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-slate-700">
                  <Download className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    {t("data.title")}
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("data.clearCache")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                      {t("data.clearCacheDesc")}
                    </p>
                    <button
                      onClick={() => {
                        ["st_email", "st_push", "st_sms", "st_theme", "st_lang", "st_tz"].forEach((k) =>
                          localStorage.removeItem(k),
                        );
                        toast.success(t("data.cacheCleared"));
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-300 text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t("data.clearCacheBtn")}
                    </button>
                  </div>

                  <div className="border border-red-200 dark:border-red-900/50 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
                    <h3 className="font-medium text-red-900 dark:text-red-400 mb-2">
                      {t("data.deleteAccount")}
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400/80 mb-3">
                      {t("data.deleteAccountDesc")}
                    </p>
                    <button
                      onClick={() => toast.error(t("data.deleteAccountContact"))}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("data.deleteAccountBtn")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
