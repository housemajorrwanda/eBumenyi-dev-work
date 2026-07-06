/**
 * Centralized configuration for API and Socket connections
 * Ensures consistent base URL handling across the application
 */

// Get the base backend URL from environment variable
const getBackendBaseURL = (): string => {
  const envBaseURL = import.meta.env.VITE_BASE_URL as string;
  
  if (envBaseURL) {
    // Remove trailing /api if present to get the base backend URL
    return envBaseURL.replace(/\/api$/i, "");
  }
  
  // Fallback for development
  return "http://localhost:9000";
};

// Get the API base URL (backend URL + /api)
export const getApiBaseURL = (): string => {
  const backendURL = getBackendBaseURL();
  return `${backendURL}/api`;
};

/** Optional direct upload API (e.g. http://10.10.119.36:9000/api) bypassing Traefik/socat. */
export const getUploadApiBaseURL = (): string => {
  const uploadUrl = import.meta.env.VITE_UPLOAD_BASE_URL as string | undefined;
  if (uploadUrl) {
    return uploadUrl.replace(/\/api\/?$/i, "") + "/api";
  }
  return getApiBaseURL();
};

// Get the Socket base URL (backend URL without /api)
export const getSocketBaseURL = (): string => {
  return getBackendBaseURL();
};

// Export the backend base URL for other uses
export const getBackendURL = (): string => {
  return getBackendBaseURL();
};

// Default export for backwards compatibility
export default {
  apiBaseURL: getApiBaseURL(),
  socketBaseURL: getSocketBaseURL(),
  backendBaseURL: getBackendBaseURL(),
};