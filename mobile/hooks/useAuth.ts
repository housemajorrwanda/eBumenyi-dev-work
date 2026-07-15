import { useEffect, useState, useCallback } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserData } from '@/types';

export const AUTH_CHANGED_EVENT = 'AUTH_CHANGED';

/**
 * Hook to access authenticated user data.
 * Reactively updates when login/logout events are emitted.
 */
export const useAuth = () => {
  const [user, setUser] = useState<IUserData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData) as IUserData;
        setUser(parsedUser);
        console.log('👤 [useAuth] User loaded:', parsedUser.fullNames);
      } else {
        setUser(null);
        console.log('👤 [useAuth] No user data found');
      }
    } catch (error) {
      console.log('👤 [useAuth] Failed to get user data:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const subscription = DeviceEventEmitter.addListener(AUTH_CHANGED_EVENT, loadUser);

    const handleWebAuthChange = () => {
      loadUser();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('auth-changed', handleWebAuthChange);
      window.addEventListener('storage', handleWebAuthChange);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('auth-changed', handleWebAuthChange);
        window.removeEventListener('storage', handleWebAuthChange);
      }
    };
  }, [loadUser]);

  return { user, loading };
};

export default useAuth;
