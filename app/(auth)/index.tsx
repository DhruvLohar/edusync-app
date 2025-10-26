import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  Alert,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Modal, // Added Modal from react-native for better modal behavior
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
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modalContent}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>×</Text>
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
    <View style={{ padding: 20 }}>
      <Text style={modalStyles.title}>Enter OTP</Text>
      <Text style={modalStyles.subtitle}>A 6-digit code has been sent to your email.</Text>
      <InputField
        placeholder="0 0 0 0 0 0"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
        containerStyle={[
          modalStyles.otpContainer,
          // Note: These styles are now applied to the container, not the input text itself.
          { height: 60, textAlign: 'center', fontSize: 24, letterSpacing: 10 } as any,
        ]}
      />
      <Button
        title="Verify OTP"
        loading={loading}
        onPress={() => onSubmit({ otp })}
        style={modalStyles.verifyButton}
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
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        // Style to center content vertically
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />

          <Text style={styles.welcomeBackText}>Welcome Back</Text>
          <Text style={styles.appNameText}>
            To <Text style={styles.eduSyncHighlight}>EduSync</Text>
          </Text>
          <Text style={styles.taglineText}>Hello there, Login to continue</Text>

          <View style={styles.inputFieldWrapper}>
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
                  containerStyle={[
                    styles.inputContainer,
                    isEmailFocused && styles.inputContainerFocused,
                    styles.inputStyle as any,
                  ]}
                />
              )}
            />
            <TouchableOpacity style={styles.needHelpButton}>
              <Text style={styles.needHelpText}>Need Help?</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Send OTP"
            loading={loading}
            onPress={handleSubmit(onSubmitStatic)}
            style={styles.otpButton}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => Alert.alert('Google Login', 'This would initiate Google Sign-in')}>
            <Text style={styles.googleIconText}>G</Text>
            <Text style={styles.googleButtonText}>Google</Text>
          </TouchableOpacity>

          {/* Register container moved slightly up and cleaned up for centering */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Register</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 20,
    justifyContent: 'center', 
  },
  container: {
    flex: 0,
    alignSelf: 'stretch',
  },
  logoImage: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 20, marginTop: -40 },
  welcomeBackText: {
    fontSize: 32,
    color: '#000',
    marginBottom: 0,
    fontWeight: 'normal',
    fontFamily: 'Poppins_600SemiBold',
  },
  appNameText: {
    fontSize: 32,
    color: '#000',
    marginBottom: 10,
    fontWeight: 'bold',
    fontFamily: 'Poppins_600SemiBold',
  },
  eduSyncHighlight: { color: '#1E90FF', fontFamily: 'Poppins_600SemiBold' },
  taglineText: { fontSize: 16, color: '#777', fontFamily: 'Poppins_400Regular' },
  inputFieldWrapper: { marginBottom: 15, position: 'relative' },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 0,
    backgroundColor: '#fff',
    height: 50,
  },
  inputContainerFocused: { borderColor: '#1E90FF' },
  inputStyle: { paddingHorizontal: 15, fontSize: 16, color: '#333' } as any,
  needHelpButton: { position: 'absolute', right: 0, bottom: -25, paddingVertical: 5 },
  needHelpText: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  otpButton: { marginTop: 35, height: 50, backgroundColor: '#1E90FF', borderRadius: 8 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 15, color: '#888', fontSize: 14 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 20, // Reduced bottom margin
  },
  googleIconText: { fontSize: 20, fontWeight: 'bold', color: '#4285F4', marginRight: 10 },
  googleButtonText: { fontSize: 18, color: '#555', fontWeight: '500' },
  // **FIXED: Positioning for Centering**
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10, // Uses simple padding/margin now
    marginTop: 10,
  },
  registerText: { color: '#555', fontSize: 16 , fontFamily: 'Poppins_400Regular' },
  registerLink: {         color: '#1E90FF',
        fontSize: 16,
        fontFamily: 'Poppins_600SemiBold',
        marginLeft: 5,
    },
});

// --- Styles for Modal ---
const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end', // Keeps modal pinned to the bottom
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    minHeight: 300,
  },
  closeButton: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 30 },
  otpContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  otpInput: { height: 60, textAlign: 'center', fontSize: 24, letterSpacing: 10 },
  verifyButton: {
    height: 50,
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
});

export default LoginScreen;
