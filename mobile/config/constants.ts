/**
 * Centralized constants for API and asset URLs.
 * Values come from EXPO_PUBLIC_* env vars with app.config.js / app.json extra as fallback.
 */
import Constants from 'expo-constants';

type AppExtra = {
  backendBaseUrl?: string;
  apiBaseUrl?: string;
  narrationApiBaseUrl?: string;
  recommendationsApiBaseUrl?: string;
  assetsBaseUrl?: string;
  weltelWebUrl?: string;
  uploadsVideosPath?: string;
  uploadsDocumentsPath?: string;
  uploadsImagesPath?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

function readEnv(name: string, extraKey: keyof AppExtra): string | undefined {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  return extra[extraKey]?.trim();
}

function resolveBackendUrl(): string {
  const url = readEnv('EXPO_PUBLIC_BACKEND_BASE_URL', 'backendBaseUrl');
  if (!url) {
    return 'https://apitest.ebumenyi.online';
  }
  return url.replace(/\/$/, '');
}

function resolveApiBaseUrl(backendUrl: string): string {
  const url = readEnv('EXPO_PUBLIC_API_BASE_URL', 'apiBaseUrl');
  if (!url) {
    return `${backendUrl}/api`;
  }
  return url.replace(/\/$/, '');
}

export const BACKEND_BASE_URL = resolveBackendUrl();
export const API_BASE_URL = resolveApiBaseUrl(BACKEND_BASE_URL);

function resolveOptionalApiOverride(
  apiBaseUrl: string,
  envName: string,
  extraKey: keyof AppExtra,
): string {
  const explicit = readEnv(envName, extraKey);
  if (explicit) return explicit.replace(/\/$/, '');
  return apiBaseUrl;
}

export const NARRATION_API_BASE_URL = resolveOptionalApiOverride(
  API_BASE_URL,
  'EXPO_PUBLIC_NARRATION_API_BASE_URL',
  'narrationApiBaseUrl',
);

export const RECOMMENDATIONS_API_BASE_URL = resolveOptionalApiOverride(
  API_BASE_URL,
  'EXPO_PUBLIC_RECOMMENDATIONS_API_BASE_URL',
  'recommendationsApiBaseUrl',
);

export const ASSETS_BASE_URL =
  readEnv('EXPO_PUBLIC_ASSETS_BASE_URL', 'assetsBaseUrl') || BACKEND_BASE_URL;

export const UPLOADS_IMAGES_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_IMAGES_PATH', 'uploadsImagesPath') ||
  '/uploads/images';

export const UPLOADS_VIDEOS_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_VIDEOS_PATH', 'uploadsVideosPath') ||
  '/uploads/videos';

export const UPLOADS_DOCUMENTS_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_DOCUMENTS_PATH', 'uploadsDocumentsPath') ||
  '/uploads/documents';

export const WELTEL_WEB_URL =
  readEnv('EXPO_PUBLIC_WELTEL_WEB_URL', 'weltelWebUrl') ||
  'https://rw-chw1.weltelhealth.net';

export const MEETING_BASE_URL = (
  process.env.EXPO_PUBLIC_MEETING_BASE_URL || 'https://meeting.ebumenyi.online'
).replace(/\/$/, '');