import axios, { AxiosError } from "axios";
import toast from "react-hot-toast";
import { getApiBaseURL } from "@/config/api.config";
import { clearCookiesFromAllDomains } from "@/utils/cookieHelper";
import { broadcastAuthChange } from "@/utils/authSync";

const ApiClient = () => {
  const instance = axios.create({
    baseURL: getApiBaseURL(),
    headers: {
      'Content-Type': 'application/json',
    },
    // Enable sending cookies with cross-origin requests
    withCredentials: true,
  });
  
  instance.interceptors.request.use(async (request) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      request.headers.Authorization = token;
      request.headers.Accept = "application/json";
    } else {
      console.warn("No token found in localStorage. Using cookie-based auth.");
    }
    // Let the browser set multipart boundary — manual Content-Type breaks file uploads
    if (request.data instanceof FormData) {
      delete request.headers["Content-Type"];
    }
    return request;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const errorObj = error as AxiosError;
      if (errorObj.response?.status === 401) {
        const errorData = errorObj.response?.data as Record<string, string>;
        const errorMessage = errorData?.message || "Unauthorized access.";
        toast.error(errorMessage);
        // Clear all authentication data on 401
        localStorage.removeItem("accessToken");
        localStorage.removeItem("chw");
        localStorage.removeItem("auth_user");
        clearCookiesFromAllDomains();
        broadcastAuthChange('logout');
        window.location.href = "/auth/login";
      } else {
        const errorData = errorObj.response?.data as Record<string, string>;
        const errorMessage = errorData
          ? errorData.message || errorData.error || errorObj.message
          : "";
        if (errorMessage.length) {
          toast.error(errorMessage);
        }
      }
      return Promise.reject(error);
    },
  );
  return instance;
};

export default ApiClient();
