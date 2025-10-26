import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  Alert,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import type { PropsWithChildren } from 'react';

// --- TYPE DEFINITIONS FOR MODAL COMPONENTS ---
interface ModalProps extends PropsWithChildren {
  isVisible: boolean;
  onClose: () => void;
}

interface OTPFormProps {
  onSubmit: (data: { otp: string }) => void;
  loading: boolean;
}

// --- MODAL AND OTP COMPONENT PLACEHOLDERS ---

// Simplified BottomModal component, using RN Modal for reliable overlay
const BottomModal = ({ isVisible, onClose, children }: ModalProps) => {
  return (
    <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="absolute inset-0 bg-black/50 justify-end items-center">
        <View className="w-full bg-white rounded-t-3xl pt-2.5 min-h-[300px]">
          <TouchableOpacity onPress={onClose} className="self-end px-5 pb-2.5">
            <Text className="text-2xl font-bold">×</Text>
          </TouchableOpacity>
          {children}
        </View>
      </View>
    </Modal>
  );
};

// Simplified OTPForm component
const OTPForm = ({ onSubmit, loading }: OTPFormProps) => {
  const [otp, setOtp] = useState('');
  return (
    <View className="p-5">
      <Text className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
        Enter OTP
      </Text>
      <Text className="text-sm text-gray-500 text-center mb-8" style={{ fontFamily: 'Poppins_400Regular' }}>
        A 6-digit code has been sent to your email.
      </Text>
      <InputField
        placeholder="0 0 0 0 0 0"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
        containerStyle="h-16 border border-gray-300 rounded-lg mx-5 mb-5 text-center text-2xl tracking-[10px]"
      />
      <Button
        title="Verify OTP"
        loading={loading}
        onPress={() => onSubmit({ otp })}
        className="h-12 bg-[#1E90FF] rounded-lg mx-5 mt-2.5"
      />
    </View>
  );
};
// ----------------------------------------------

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginScreen = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  const onSubmitStatic = (data: LoginFormData) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Only proceed to modal if email is valid (handled by Zod/RHF)
      setModalVisible(true);
    }, 1500);
  };

  const handleVerifyOTP = ({ otp }: { otp: string }) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setModalVisible(false);
      Alert.alert('Success! 🎉', `OTP ${otp} verified.`);
      // FIXED: Navigate to the tabs root or specific tab
      // Option 1: Navigate to tabs root (will show the initial route - index)
      router.replace('/private/(tabs)');
      
      // Option 2: Navigate to a specific tab
      // router.replace('/(tabs)/analytics');
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={{ 
          flexGrow: 1, 
          paddingHorizontal: 24, 
          paddingTop: 0, 
          paddingBottom: 20, 
          justifyContent: 'center' 
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-0 self-stretch">
          <Image 
            source={require('../../assets/logo.png')} 
            className="w-20 h-20 mb-5 -mt-10"
            resizeMode="contain"
          />

          <Text className="text-4xl text-black mb-0 font-normal" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Welcome Back
          </Text>
          <Text className="text-4xl text-black mb-2.5 font-bold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            To <Text className="text-[#1E90FF]" style={{ fontFamily: 'Poppins_600SemiBold' }}>EduSync</Text>
          </Text>
          <Text className="text-base text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
            Hello there, Login to continue
          </Text>

          <View className="mb-4 relative mt-8">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
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
                  containerStyle={`border ${
                    isEmailFocused ? 'border-[#1E90FF]' : 'border-gray-300'
                  } rounded-lg px-0 bg-white h-12`}
                  style={{ paddingHorizontal: 15, fontSize: 16, color: '#333' }}
                />
              )}
            />
            <TouchableOpacity className="absolute right-0 -bottom-6 py-1">
              <Text className="text-[#1E90FF] text-sm font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                Need Help?
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Send OTP"
            loading={loading}
            onPress={handleSubmit(onSubmitStatic)}
            className="mt-9 h-12 py-2 bg-[#1E90FF] rounded-lg"
          />

          <View className="flex-row items-center my-8">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="mx-4 text-gray-500 text-sm" style={{ fontFamily: 'Poppins_400Regular' }}>
              OR
            </Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center h-12 bg-white border border-gray-300 rounded-lg mb-5"
            onPress={() => Alert.alert('Google Login', 'This would initiate Google Sign-in')}
          >
            <Text className="text-xl font-bold text-[#4285F4] mr-2.5">G</Text>
            <Text className="text-lg text-gray-600 font-medium" style={{ fontFamily: 'Poppins_500Medium' }}>
              Google
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center items-center py-2.5 mt-2.5">
            <Text className="text-gray-600 text-base" style={{ fontFamily: 'Poppins_400Regular' }}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-[#1E90FF] text-base ml-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                Register
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomModal isVisible={isModalVisible} onClose={() => setModalVisible(false)}>
        <OTPForm onSubmit={handleVerifyOTP} loading={loading} />
      </BottomModal>
    </SafeAreaView>
  );
};

export default LoginScreen;