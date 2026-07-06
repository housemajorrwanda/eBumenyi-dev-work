import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { AUTH_CHANGED_EVENT } from '@/hooks/useAuth';

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_DATA_KEY = 'userData';
const ROLE_KEY = 'role';

export function normalizeAuthToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return trimmed;
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

export async function getAccessToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? normalizeAuthToken(token) : null;
}

export async function persistAuthSession(data: {
  token: string;
  roles?: string[];
  [key: string]: unknown;
}): Promise<void> {
  const { token, roles, ...userData } = data;
  const normalizedToken = normalizeAuthToken(token);

  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, normalizedToken);
  if (roles?.length) {
    await AsyncStorage.setItem(ROLE_KEY, roles[0]);
  }
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify({ ...userData, token: normalizedToken, roles }));

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, normalizedToken);
    window.localStorage.setItem(USER_DATA_KEY, JSON.stringify({ ...userData, token: normalizedToken, roles }));
    window.dispatchEvent(new Event('auth-changed'));
  }

  DeviceEventEmitter.emit(AUTH_CHANGED_EVENT);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_DATA_KEY, ROLE_KEY]);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(USER_DATA_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.dispatchEvent(new Event('auth-changed'));
  }

  DeviceEventEmitter.emit(AUTH_CHANGED_EVENT);
}
