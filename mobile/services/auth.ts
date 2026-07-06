import { IUserData } from '@/types';
import httpClient from './httpClient';
import { SocketService } from './socket.service';
import { persistAuthSession, getAccessToken } from '@/utils/authSession';

export interface ISignupRequest {
  email?: string;
  fullNames: string;
  phoneNumber: string;
  photo?: string;
  video?: string;
  audio?: string;
  bio?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  NID?: string;
  birthdate?: string;
  hospitalId?: string;
  role?: string;
  gender?: string;
}

async function completeLogin(data: Record<string, unknown> & { token: string; roles?: string[] }) {
  await persistAuthSession(data);

  try {
    console.log('🔌 [AUTH] Initializing socket after login...');
    await SocketService.initialize();
    console.log('🔌 [AUTH] Socket initialized successfully');
  } catch (error) {
    console.log('🔌 [AUTH] Failed to initialize socket:', error);
  }
}

export const login = async (
  fullNames: string,
  phoneNumber: string,
): Promise<any> => {
  // Traditional signin using full name and phone (maintains existing flow)
  const response = await httpClient.post('/auth/signin/student', {
    fullNames,
    phoneNumber,
  });
  const data = (response as any).data?.data;
  if (data?.token) {
    await completeLogin(data);
  }
  return response;
};

export const loginWithIdAndPhone = async (
  nid: string,
  phoneNumber: string,
): Promise<any> => {
  // Sign in using National ID and phone number (no OTP required)
  const response = await httpClient.post('/auth/signin/student/id-phone', {
    nid,
    phoneNumber,
  });
  const data = (response as any).data?.data;
  if (data?.token) {
    await completeLogin(data);
  }
  return response;
};

export const signup = async (
  payload: ISignupRequest | FormData,
): Promise<any> => {
  let response;
  if (
    typeof payload === 'object' &&
    typeof (payload as any).append === 'function'
  ) {
    // FormData (file upload)
    response = await httpClient.post('/auth/signup', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } else {
    // JSON
    response = await httpClient.post('/auth/signup', payload);
  }
  return response;
};

export const verifyLogin = async (
  otp: string,
  phoneNumber: string,
): Promise<any> => {
  const response = await httpClient.post('/auth/verify-login', {
    otp,
    phoneNumber,
  });
  const data = (response as any).data?.data;
  if (data?.token) {
    await completeLogin(data);
  }
  return response;
};

export const getMe = async (): Promise<IUserData> => {
  const response = await httpClient.get('/auth/me/');
  const data = (response as any).data.data;
  return data;
};

export const updateProfile = async (data: FormData): Promise<IUserData> => {
  const response = await httpClient.put('/auth/profile', data);
  console.log(response);
  return (response as any).data.data;
};

export const updateAvatar = async (
  data: FormData,
): Promise<{ photo: string }> => {
  const response = await httpClient.put('/auth/profile/avatar', data);
  return (response as any).data.data;
};

export const deleteAvatar = async (): Promise<{ photo: string }> => {
  const response = await httpClient.delete('/auth/profile/avatar');
  return (response as any).data.data;
};

export const checkValiditOfToken = async (): Promise<any> => {
  const response = await httpClient.get('/auth/validate-token/');
  const data = (response as any).data.data;
  return data;
};

/**
 * Initialize socket for already authenticated users
 * Call this when app starts and user is already logged in
 */
export const initializeSocketForExistingUser = async (): Promise<boolean> => {
  try {
    const token = await getAccessToken();
    if (token) {
      console.log(
        '🔌 [AUTH] User already authenticated, initializing socket...',
      );
      const socket = await SocketService.initialize();
      if (socket) {
        console.log('🔌 [AUTH] Socket initialized for existing user');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.log(
      '🔌 [AUTH] Failed to initialize socket for existing user:',
      error,
    );
    return false;
  }
};
