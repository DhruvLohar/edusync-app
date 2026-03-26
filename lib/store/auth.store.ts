import { create } from 'zustand';
import { fetchFromAPI, postToAPI } from '~/lib/api';
import { getStorageItemAsync, setStorageItemAsync } from '~/lib/useStorageState';
import { Alert } from 'react-native';
import { User, UserType, Department, Year } from '~/type/user';
import { queryClient } from '~/lib/queryClient';

interface APIResponse {
  success: boolean;
  message: any;
  data: any;
}

interface AuthState {
  session: { access_token: string; user_type?: UserType } | null;
  profile: User | null;
  isLoading: boolean;
  isSessionInitialized: boolean;

  getOTP: (email: string) => Promise<APIResponse>;
  verifyOTP: (email: string, otp: string) => Promise<APIResponse>;
  login: (values: any) => Promise<APIResponse>;
  register: (values: any) => Promise<APIResponse>;
  resendOTP: (email: string) => Promise<APIResponse>;
  rehydrateSession: () => Promise<void>;
  logOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkToken: (router: any) => Promise<boolean>;
}

// Key used for SecureStore
const STORAGE_KEY = 'session';

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: false,
  isSessionInitialized: false,

  async getOTP(uid: string) {
    return await postToAPI(`/users/get-email`, { uid }, false, false);
  },

  async verifyOTP(email: string, otp: string) {
    const res: APIResponse = await postToAPI('/users/auth/verify-otp', { email, otp }, false, false);
    
    if (res.success) {
      const sessionData: { access_token: string; user_type?: UserType } = {
        access_token: res.data.access_token,
        user_type: res.data.user_type as UserType,
      };
      set({ session: sessionData });
      await setStorageItemAsync(STORAGE_KEY, sessionData); // Save to SecureStore
      if (res.data.onboarding_done || res.data.user_type === 'teacher') {
        await get().refreshUser();
      } else {
        set({ profile: null });
      }
    }

    return res;
  },

  async login(values: any) {
    return await postToAPI('/users/auth/login', values, false, false);
  },

  async register(values: any) {
    return await postToAPI('/users/register', values, false, false);
  },

  async logOut() {
    await setStorageItemAsync(STORAGE_KEY, null);
    set({ session: null, profile: null, isSessionInitialized: false });
    // Clear all React Query cache to prevent stale data on next login
    queryClient.clear();
  },

  rehydrateSession: async () => {
    set({ isLoading: true });
    try {
      const storedSession: any = await getStorageItemAsync(STORAGE_KEY);
      if (storedSession?.access_token) {
        set({ session: storedSession });
        await get().refreshUser();
      }
    } catch (error) {
      console.error('[rehydrateSession error]', error);
    } finally {
      set({ isLoading: false, isSessionInitialized: true });
    }
  },

  async refreshUser() {
    try {
      const res = await fetchFromAPI('/users/profile');
       set({ profile: res?.data });
    } catch (error) {
      console.error('[refreshUser error]', error);
    }
  },

  async checkToken(router: any) {
    const session = get().session;
    if (!session || !session.access_token) {
      router.replace('/');
      Alert.alert('Authentication Required', 'Please log in to access this page', [
        {
          text: 'OK',
        },
      ]);
      return false;
    }
    return true;
  },

  async resendOTP(email: string) {
    return await postToAPI('/users/auth/resend-otp', { email }, false, false);
  },
}));
