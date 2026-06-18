/**
 * Centralized constants for API and asset URLs.
 * Values come from EXPO_PUBLIC_* env vars (inlined at build time) with
 * app.config.js / app.json extra as fallback so production APKs never crash
 * on the splash screen when env vars are missing.
 */
import Constants from 'expo-constants';

type AppExtra = {
  backendBaseUrl?: string;
  apiBaseUrl?: string;
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
    console.warn(
      '[config] EXPO_PUBLIC_BACKEND_BASE_URL missing — using app extra fallback',
    );
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

export const ASSETS_BASE_URL =
  readEnv('EXPO_PUBLIC_ASSETS_BASE_URL', 'assetsBaseUrl') || BACKEND_BASE_URL;

export const UPLOADS_VIDEOS_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_VIDEOS_PATH', 'uploadsVideosPath') ||
  '/uploads/videos';

export const UPLOADS_DOCUMENTS_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_DOCUMENTS_PATH', 'uploadsDocumentsPath') ||
  '/uploads/documents';

export const UPLOADS_IMAGES_PATH =
  readEnv('EXPO_PUBLIC_UPLOADS_IMAGES_PATH', 'uploadsImagesPath') ||
  '/uploads/images';

export const WELTEL_WEB_URL =
  readEnv('EXPO_PUBLIC_WELTEL_WEB_URL', 'weltelWebUrl') ||
  'https://rw-chw1.weltelhealth.net';
