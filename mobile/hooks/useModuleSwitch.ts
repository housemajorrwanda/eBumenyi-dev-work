import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkValiditOfToken } from '@/services/auth';
import { getWeltelLoginUrl } from '@/services/weltel.api';
import {
  ACTIVE_MODULE_KEY,
  type AppModule,
  moduleFromPathname,
} from '@/constants/modules';

type SelectModuleOptions = {
  skipIfActive?: boolean;
};

type SelectModuleResult = {
  switched: boolean;
};

async function persistActiveModule(module: AppModule) {
  await AsyncStorage.setItem(ACTIVE_MODULE_KEY, module);
}

async function clearInvalidSession() {
  await AsyncStorage.multiRemove(['accessToken', 'userData', 'role']);
}

export function useModuleSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const [loadingModule, setLoadingModule] = useState<AppModule | null>(null);

  const activeModule = useMemo(
    () => moduleFromPathname(pathname),
    [pathname],
  );

  const selectModule = useCallback(
    async (
      key: AppModule,
      options: SelectModuleOptions = {},
    ): Promise<SelectModuleResult> => {
      const { skipIfActive = true } = options;

      if (skipIfActive && key === activeModule) {
        return { switched: false };
      }

      try {
        if (key === 'ebumenyi') {
          setLoadingModule('ebumenyi');
          const token = await AsyncStorage.getItem('accessToken');

          if (token) {
            try {
              const validationResult = await checkValiditOfToken();
              if (validationResult?.valid === true) {
                await persistActiveModule('ebumenyi');
                router.replace('/(tabs)');
                return { switched: true };
              }
              await clearInvalidSession();
            } catch {
              await clearInvalidSession();
            }
          }

          router.replace('/auth/login');
          return { switched: true };
        }

        if (key === 'egenzura') {
          setLoadingModule('egenzura');
          const token = await AsyncStorage.getItem('accessToken');

          if (!token) {
            router.replace('/auth/login');
            return { switched: true };
          }

          try {
            const validationResult = await checkValiditOfToken();
            if (validationResult?.valid !== true) {
              await clearInvalidSession();
              router.replace('/auth/login');
              return { switched: true };
            }

            const weltelAuth = await getWeltelLoginUrl();
            await persistActiveModule('egenzura');
            router.replace({
              pathname: '/egenzura',
              params: {
                loginUrl: weltelAuth.loginUrl,
                jwtKey: weltelAuth.jwtKey,
              },
            });
            return { switched: true };
          } catch {
            router.replace('/auth/login');
            return { switched: true };
          }
        }

        if (key === 'cemr') {
          setLoadingModule('cemr');
          await persistActiveModule('cemr');
          router.replace('/cemr');
          return { switched: true };
        }

        return { switched: false };
      } catch (err) {
        console.log('Error switching module', err);
        router.replace('/auth/login');
        return { switched: true };
      } finally {
        setLoadingModule(null);
      }
    },
    [activeModule, router],
  );

  return {
    activeModule,
    loadingModule,
    isLoading: loadingModule !== null,
    selectModule,
  };
}
