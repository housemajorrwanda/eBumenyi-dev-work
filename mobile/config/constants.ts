/**
 * Centralized constants for API and asset URLs
 * Single source of truth for all backend URLs used across the application
 * 
 * These values are loaded from environment variables (.env.local)
 */

function resolveBackendUrl(): string {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL?.trim();
  if (!backendUrl) {
    throw new Error('EXPO_PUBLIC_BACKEND_BASE_URL is not set in .env.local');
  }
  return backendUrl.replace(/\/$/, "");
}

export const BACKEND_BASE_URL = resolveBackendUrl();

// API endpoint base URL
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://apitest.ebumenyi.online/api";

// Assets and uploads base URL
export const ASSETS_BASE_URL = process.env.EXPO_PUBLIC_ASSETS_BASE_URL || BACKEND_BASE_URL || "https://apitest.ebumenyi.online";

// Common asset paths
export const UPLOADS_VIDEOS_PATH = process.env.EXPO_PUBLIC_UPLOADS_VIDEOS_PATH || '/uploads/videos';
export const UPLOADS_DOCUMENTS_PATH = process.env.EXPO_PUBLIC_UPLOADS_DOCUMENTS_PATH || '/uploads/documents';
export const UPLOADS_IMAGES_PATH = process.env.EXPO_PUBLIC_UPLOADS_IMAGES_PATH || '/uploads/images';

// WelTel in-app web destination
export const WELTEL_WEB_URL = process.env.EXPO_PUBLIC_WELTEL_WEB_URL || 'https://rw-chw1.weltelhealth.net';

// Meeting server base URL
export const MEETING_BASE_URL = (process.env.EXPO_PUBLIC_MEETING_BASE_URL || 'https://meeting.ebumenyi.online').replace(/\/$/, '');
