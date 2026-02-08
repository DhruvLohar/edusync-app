import { create } from 'zustand';
import { fetchFromAPI, postToAPI } from '~/lib/api';
import { getStorageItemAsync, setStorageItemAsync } from '~/lib/useStorageState';
import { Alert } from 'react-native';
import { User, UserType, Department, Year } from '~/type/user';

interface APIResponse {
  success: boolean;
  message: any;
  data: any;
}

/** Dummy student profile for development/demo */
// export const DUMMY_STUDENT_PROFILE: User = {
//   id: 1,
//   name: 'Rahul Sharma',
//   email: 'rahul.student@example.com',
//   phone: '+91-9876543210',
//   user_type: UserType.student,
//   gr_no: 'CS2021001',
//   department: Department.CSE,
//   year: Year.BE,
//   profile_photo: 'https://via.placeholder.com/150',
//   is_active: true,
//   onboarding_done: true,
//   created_at: new Date(),
//   updated_at: new Date(),
// };

/** Dummy teacher profile for development/demo */
// export const DUMMY_TEACHER_PROFILE: User = {
//   id: 2,
//   name: 'Prof. Satish Ket',
//   email: 'satish.teacher@example.com',
//   phone: '+91-9876543211',
//   user_type: UserType.teacher,
//   employee_id: 'TCH001',
//   profile_photo: 'https://via.placeholder.com/150',
//   is_active: true,
//   onboarding_done: true,
//   created_at: new Date(),
//   updated_at: new Date(),
// };

interface AuthState {
  session: { access_token: string; user_type?: string } | null;
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
    return await postToAPI(`/users/get-email`, { uid });
    // DUMMY DATA
    // return { success: true, message: 'OTP sent successfully', data: {} };
  },

  async verifyOTP(email: string, otp: string) {
    const res: APIResponse = await postToAPI('/users/auth/verify-otp', { email, otp });
    // DUMMY DATA – use teacher profile if email contains "teacher", otherwise student
    const userType = email.toLowerCase().includes('teacher') ? 'teacher' : 'student';
    // const res: APIResponse = {
    //   success: true,
    //   message: 'OTP verified',
    //   data: {
    //     access_token: 'dummy_access_token_12345',
    //     onboarding_done: true,
    //     user_type: userType,
    //     user_id: userType === 'teacher' ? 2 : 1,
    //   },
    // };

    if (res.success) {
      const sessionData = {
        access_token: res.data.access_token,
        user_type: res.data.user_type,
      };
      set({ session: sessionData });
      await setStorageItemAsync(STORAGE_KEY, sessionData); // Save to SecureStore
      res.data.onboarding_done && (await get().refreshUser());
    }

    return res;
  },

  async login(values: any) {
    return await postToAPI('/users/auth/login', values);
    // DUMMY DATA – returns student by default; use user_type from values to switch
    // const userType = values?.user_type ?? 'student';
    // return {
    //   success: true,
    //   message: 'Login successful',
    //   data: { access_token: 'dummy_access_token_12345', user_type: userType },
    // };
  },

  async register(values: any) {
    return await postToAPI('/users/register', values);
    // DUMMY DATA
    // return { success: true, message: 'Registration successful', data: { user_id: 1 } };
  },

  async logOut() {
    await setStorageItemAsync(STORAGE_KEY, null);
    set({ session: null, profile: null, isSessionInitialized: false });
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
      // DUMMY DATA – use profile matching session.user_type
      // const session = get().session;
      // const userType = (session as any)?.user_type ?? 'student';
      // const profile = userType === 'teacher' ? DUMMY_TEACHER_PROFILE : DUMMY_STUDENT_PROFILE;
      // set({ profile });
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
    return await postToAPI('/users/auth/resend-otp', { email });
    // DUMMY DATA
    // return { success: true, message: 'OTP resent successfully', data: {} };
  },
}));
