import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StatusBar,
  Alert,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import type { PropsWithChildren } from 'react';
import { useAuthStore } from '~/lib/store/auth.store';

// --- TYPE DEFINITIONS ---
interface ModalProps extends PropsWithChildren {
  isVisible: boolean;
  onClose: () => void;
}

interface OTPFormProps {
  onSubmit: (data: { otp: string }) => void;
  loading: boolean;
}

const CenteredModal = memo(({ isVisible, onClose, children }: ModalProps) => {
  return (
    <Modal 
      visible={isVisible} 
      animationType="fade" 
      transparent={true} 
      onRequestClose={onClose}
    >
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="w-full max-w-[400px] bg-white rounded-[30px] p-8 shadow-2xl relative">
            <TouchableOpacity 
              onPress={onClose} 
              className="absolute right-6 top-6 z-10 w-8 h-8 items-center justify-center bg-gray-100 rounded-full"
            >
              <Text className="text-gray-500 text-xl font-bold">×</Text>
            </TouchableOpacity>
            
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
// --- OTP FORM COMPONENT ---
const OTPForm = memo(({ onSubmit, loading }: OTPFormProps) => {
  const [otp, setOtp] = useState('');

  const handleOtpChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setOtp(cleaned);
  };

  return (
    <View className="w-full">
      <Text className="text-2xl text-black mb-2 text-left" style={{ fontFamily: 'Poppins_600SemiBold' }}>
        Check Your Email
      </Text>
      
      <Text className="text-sm text-gray-500  leading-5" style={{ fontFamily: 'Poppins_400Regular' }}>
        We've sent a 6-digit verification code to your inbox.
      </Text>

      <View className="w-full items-center justify-center">
  <InputField
    placeholder="000000"
    keyboardType="number-pad"
    value={otp}
    onChangeText={handleOtpChange}
    maxLength={6}
    className="w-full h-16 border border-gray-100 bg-gray-50 rounded-2xl text-center text-3xl tracking-[15px] text-[#1E90FF]"
    style={{ 
      fontFamily: 'Poppins_600SemiBold',
      textAlignVertical: 'center',
      paddingLeft: 15, 
    }}
    autoFocus={true}
  />
</View>

      <Button
        title="Verify Code"
        loading={loading}
        onPress={() => onSubmit({ otp })}
        className="w-full h-14 bg-[#1E90FF] rounded-xl mt-5  shadow-lg shadow-blue-300"
      />
      
      <TouchableOpacity className="mt-3 py-2">
        <Text className="text-gray-400 font-medium text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
          Didn't get it? <Text className="text-[#1E90FF] font-bold">Resend OTP</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// --- LOGIN SCHEMA ---
const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

type LoginFormData = z.infer<typeof loginSchema>;


// --- MAIN LOGIN SCREEN ---
const LoginScreen = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string>('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  const onSubmitStatic = useCallback(async (data: LoginFormData) => {
    setLoading(true);
    const email = data.email.toLowerCase().trim();
    try {
      const response = await authStore.login({ email });
      if (response?.success) {
        setLoginEmail(email);
        setModalVisible(true);
      } else {
        Alert.alert('Login Failed', response?.message || 'Unable to send OTP.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while logging in.');
    } finally {
      setLoading(false);
    }
  }, [authStore]);

  const handleVerifyOTP = useCallback(async ({ otp }: { otp: string }) => {
    setLoading(true);
    try {
      const response = await authStore.verifyOTP(loginEmail, otp);
      if (response?.success) {
        setModalVisible(false);
        if (response.data.user_type === 'teacher') {
          router.replace('/private/(teacher)/(tabs)');
        } else if (!response.data.onboarding_done) {
          router.push('/register/student');
        } else {
          router.replace('/private/(student)/(tabs)');
        }
      } else {
        Alert.alert('Verification Failed', response?.message || 'Invalid OTP.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while verifying OTP.');
    } finally {
      setLoading(false);
    }
  }, [authStore, loginEmail, router]);

  const closeModal = useCallback(() => setModalVisible(false), []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView 
  // Disable the background avoidance when the modal is open
  enabled={!isModalVisible} 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
  style={{ flex: 1 }}
>
  <ScrollView
    contentContainerStyle={{ 
      flexGrow: 1, 
      paddingHorizontal: 24, 
      justifyContent: 'center'

    }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="self-stretch">
            <Image 
              source={require('../../assets/logo.png')} 
              className="w-20 h-20 mb-7 -mt-20"
              resizeMode="contain"
            />

            <Text className="text-4xl text-black" style={{ fontFamily: 'Poppins_600SemiBold' }}>
              Welcome Back
            </Text>
            <Text className="text-4xl text-black mb-5" style={{ fontFamily: 'Poppins_600SemiBold' }}>
              To <Text className="text-[#1E90FF]">EduSync</Text>
            </Text>
            <Text className="text-base text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
              Hello there, Login to continue
            </Text>

            <View className="mb-4 relative mt-10">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <InputField
                    label='Email Address'
                    placeholder="Enter Email Address"
                    onBlur={() => {
                      onBlur();
                      setIsEmailFocused(false);
                    }}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    onFocus={() => setIsEmailFocused(true)}
                    className={`border ${
                      isEmailFocused ? 'border-[#1E90FF]' : 'border-gray-200'
                    } rounded-xl px-4 bg-white h-14`}
                    style={{ fontSize: 14 }}
                  />
                )}
              />
            </View>

            <Button
              title="Send OTP"
              loading={loading}
              onPress={handleSubmit(onSubmitStatic)}
              className="h-14 bg-[#1E90FF] rounded-xl shadow-md shadow-blue-400"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CenteredModal isVisible={isModalVisible} onClose={closeModal}>
        <OTPForm onSubmit={handleVerifyOTP} loading={loading} />
      </CenteredModal>
    </SafeAreaView>
  );
};

export default React.memo(LoginScreen);