import { ISignup,  IResponse, User } from "@/types";
import api from "./api";
import { ILoginFormData, IStudentLoginFormData } from "@/types/auth";
import { AuthState } from "@/types/common";
import { broadcastAuthChange } from "@/utils/authSync";
import { setCookieForAllDomains, clearCookiesFromAllDomains } from "@/utils/cookieHelper";

export const login = async (formData: ILoginFormData): Promise<AuthState> => {
  const { data } = await api.post("/auth/signin/staff", formData);
  const { token, roles, permissions, industry, ...userData } = data.data;
  localStorage.setItem(
    "chw",
    JSON.stringify({ ...userData, roles, permissions, industry }),
  );
  localStorage.setItem("accessToken", token);
  // Also store auth_user for cross-app compatibility
  localStorage.setItem("auth_user", JSON.stringify(userData));
  
  // Set cookies for both www.ebumenyi.online and meeting.ebumenyi.online
  setCookieForAllDomains(token);
  
  // Broadcast login to other tabs/ports
  broadcastAuthChange('login');
  
  return {
    ...userData,
    token,
    roles,
    permissions,
    industry,
  };
};

export const loginStudent = async (formData: IStudentLoginFormData): Promise<AuthState> => {
  const { data } = await api.post("/auth/signin/student/id-phone", formData);
  const { token, roles, permissions, industry, ...userData } = data.data;
  localStorage.setItem("chw", JSON.stringify({ ...userData, roles, permissions, industry }));
  localStorage.setItem("accessToken", token);
  localStorage.setItem("auth_user", JSON.stringify(userData));
  setCookieForAllDomains(token);
  broadcastAuthChange("login");
  return { ...userData, token, roles, permissions, industry };
};

export const signup = async (data: ISignup): Promise<IResponse<User>> => {
  return (await api.post("/auth/signup", data)).data;
};

export const forgotPassword = async (email: string): Promise<IResponse<null>> => {
  return (await api.post("/auth/request-password-reset", { email })).data;
};

export const resetPassword = async (
  token: string,
  password: string
): Promise<IResponse<null>> => {
  return (await api.post("/auth/reset-password", { token, newPassword: password })).data;
};

export const logout = async (): Promise<void> => {
  // Clear localStorage
  localStorage.removeItem("accessToken");
  localStorage.removeItem("chw");
  localStorage.removeItem("auth_user");
  
  // Clear cookies from all domains
  clearCookiesFromAllDomains();
  
  // Broadcast logout to other tabs/ports
  broadcastAuthChange('logout');
  
  window.location.href = "/auth/login";
};

export const getCurrentUser = async (): Promise<IResponse<User>> => {
  return (await api.get("/auth/me")).data;
};

export const updateProfile = async (
  userId: string,
  data: Partial<User>
): Promise<IResponse<User>> => {
  return (await api.put(`/auth/profile/${userId}`, data)).data;
};
