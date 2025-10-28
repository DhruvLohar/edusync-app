export interface OtpVerifyResponse {
  data: {
    access_token: string;
    email: string;
    id: number;
    name: string | null;
    onboarding_done: boolean;
    user_type: string;
  };
  message: string;
  success: boolean;
}

export interface RegistrationResponse {
  data: {
    id: number;
    email: string;
    name: string;
    user_type: string;
    onboarding_done: boolean;
    [key: string]: any;
  };
  message: string;
  success: boolean;
}
