import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import { getFaceEmbedding, saveEmbedding } from '~/lib/ImageChecker';
import { postToAPI } from '~/lib/api';
import { RegistrationResponse } from '~/type/auth';
import { useAuthStore } from '~/lib/store/auth.store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Department, Year, DEPARTMENTS, YEARS } from '~/type/user';

// --- CONFIGURATION ---
const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENTS).map(([key, value]) => ({
  key: key as Department,
  label: value,
}));
const YEAR_OPTIONS = Object.entries(YEARS).map(([key, value]) => ({
  key: key as Year,
  label: value,
}));

// --- COMPONENTS ---
interface StepIndicatorProps {
  step: number;
  title: string;
  isActive: boolean;
}

interface SuccessModalProps {
  isVisible: boolean;
  onBackToHome: () => void;
}

const SuccessRegistrationModal: React.FC<SuccessModalProps> = ({ isVisible, onBackToHome }) => (
  <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onBackToHome}>
    <View className="flex-1 justify-center items-center bg-black/50">
      <View className="w-4/5 bg-white rounded-3xl p-8 items-center shadow-2xl">
        <Text className="text-2xl font-bold text-[#1E90FF] mb-3" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Congratulations
        </Text>
        <Text className="text-base text-gray-600 text-center mb-8" style={{ fontFamily: 'Poppins_400Regular' }}>
          Your account is ready to use!
        </Text>
        <Button
          title="Back To Home"
          onPress={onBackToHome}
          className="w-full h-14 bg-[#1E90FF] rounded-xl justify-center items-center"
        />
      </View>
    </View>
  </Modal>
);

export default function StudentRegistrationScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const authStore = useAuthStore();

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Academic Details
  const [grNumber, setGrNumber] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<Year | null>(null);
  const [division, setDivision] = useState(''); 

  // Face Recognition
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [embeddingSaved, setEmbeddingSaved] = useState(false);
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (currentStep === 3 && !hasPermission) {
      requestPermission();
    }
  }, [currentStep, hasPermission]);

  // Logic to scroll to position when focusing inputs
  const scrollToInput = (y: number) => {
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!fullName.trim() || !phoneNumber.trim()) {
        Alert.alert('Error', 'Please fill in all personal information fields');
        return;
      }
    }
    if (currentStep === 2) {
      if (!grNumber.trim() || !selectedDepartment || !selectedAcademicYear || !division) {
        Alert.alert('Error', 'Please complete all academic details');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleFinalRegister();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      router.back();
    }
  };

  const captureAndProcess = async () => {
    if (!camera.current) return;
    try {
      setIsProcessing(true);
      const photo = await camera.current.takePhoto({ flash: 'off', enableShutterSound: false });
      const photoUri = `file://${photo.path}`;
      setCapturedImageUri(photoUri);
      const { embedding } = await getFaceEmbedding(photoUri);
      const userId = `${fullName.trim()} - ${grNumber.trim()}`;
      await saveEmbedding(userId, embedding);
      setEmbeddingSaved(true);
      Alert.alert('Success', 'Face registered successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to capture face.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalRegister = async () => {
    if (!embeddingSaved) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', fullName);
      formData.append('phone', phoneNumber);
      formData.append('div', division);
      formData.append('user_type', 'student');
      formData.append('department', selectedDepartment || '');
      formData.append('year', selectedAcademicYear || '');
      formData.append('gr_no', grNumber);
      if (capturedImageUri) {
        formData.append('profile_photo', { uri: capturedImageUri, name: 'profile.jpg', type: 'image/jpeg' } as any);
      }

      const response = await postToAPI<RegistrationResponse>('/users/onboard', formData, true);
      if (response && response.success) {
        await authStore.refreshUser();
        setShowSuccessModal(true);
      } else {
        Alert.alert('Registration Failed', response?.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    setShowSuccessModal(false);
    router.replace('/private/(student)/(tabs)');
  };

  const StepIndicator: React.FC<StepIndicatorProps> = ({ step, title, isActive }) => (
    <View className="flex-row items-center">
      <View className={`w-6 h-6 rounded-full justify-center items-center mr-2 border ${isActive ? 'bg-[#1E90FF] border-[#1E90FF]' : 'bg-white border-gray-400'}`}>
        <Text className="text-white text-xs font-bold text-center leading-6">{isActive ? '✓' : ''}</Text>
      </View>
      <Text className={`text-sm font-medium ${isActive ? 'text-[#1E90FF]' : 'text-gray-400'}`} style={{ fontFamily: 'Poppins_500Medium' }}>
        {title}
      </Text>
      {step < 3 && <View className="w-4 h-px bg-gray-300 mx-2.5" />}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-8 ">
            {/* <TouchableOpacity onPress={handleBack} className="self-start pr-4 py-1 mb-2.5">
              <Image source={require('../../../assets/arrow.png')} className="w-10 h-10 mb-5" resizeMode="contain" />
            </TouchableOpacity> */}
            <Text className="text-3xl font-bold text-black mt-8" style={{ fontFamily: 'Poppins_600SemiBold' }}>
              Student's Onboarding
            </Text>
          </View>

          {/* Stepper */}
          <View className="flex-row items-center justify-start mb-12 mt-5">
            <StepIndicator step={1} title="Personal Info." isActive={currentStep >= 1} />
            <StepIndicator step={2} title="Academic Info" isActive={currentStep >= 2} />
            <StepIndicator step={3} title="Face ID" isActive={currentStep === 3} />
          </View>

          {/* Step Contents */}
          <View className="flex-1">
            {currentStep === 1 && (
              <>
                <View className="mb-8 mt-2">
                  <Text className="text-2xl font-bold text-black mb-1 max-w-[50%]" style={{ fontFamily: 'Poppins_600SemiBold' }}>Personal Information</Text>
                </View>
                <View className="gap-5 mb-12">
                  <InputField placeholder="Enter Full Name" label="Full Name" value={fullName} onChangeText={setFullName} />
                  <InputField 
                    placeholder="Enter Phone Number" 
                    label="Phone No." 
                    value={phoneNumber} 
                    onChangeText={setPhoneNumber} 
                    keyboardType="phone-pad" 
                    onFocus={() => scrollToInput(250)}
                  />
                </View>
                <Button title="Next" onPress={handleNext} className="h-14 bg-[#1E90FF] rounded-xl" />
              </>
            )}

            {currentStep === 2 && (
              <>
                <View className="mb-8 mt-2">
                  <Text className="text-2xl font-bold text-black mb-1 max-w-[50%]" style={{ fontFamily: 'Poppins_600SemiBold' }}>Academic Details</Text>
                </View>
                <View className="gap-5 mb-12">
                  <View>
                  <Text className="text-base text-black font-medium -mb-3" style={{ fontFamily: 'Poppins_500Medium' }}>Roll no.</Text>
                  <InputField placeholder="Enter Roll Number" value={grNumber} onChangeText={setGrNumber} onFocus={() => scrollToInput(150)} />
</View>
<View>
                  <Text className="text-base text-black font-medium -mb-3" style={{ fontFamily: 'Poppins_500Medium' }}>Division</Text>
                  <InputField placeholder="Enter Division" value={division} onChangeText={setDivision} onFocus={() => scrollToInput(150)} />
</View>
                  <Text className="text-base text-black font-medium" style={{ fontFamily: 'Poppins_500Medium' }}>Department</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <TouchableOpacity
                        key={dept.key}
                        className={`px-4 py-2.5 rounded-lg border ${selectedDepartment === dept.key ? 'border-[#1E90FF] bg-[#E8F2FF]' : 'border-gray-300 bg-white'}`}
                        onPress={() => setSelectedDepartment(dept.key)}
                      >
                        <Text className={`text-sm ${selectedDepartment === dept.key ? 'text-[#1E90FF] font-bold' : 'text-gray-700'}`}>{dept.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-base text-black font-medium mt-5" style={{ fontFamily: 'Poppins_500Medium' }}>Academic Year</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {YEAR_OPTIONS.map((year) => (
                      <TouchableOpacity
                        key={year.key}
                        className={`px-4 py-2.5 rounded-lg border ${selectedAcademicYear === year.key ? 'border-[#1E90FF] bg-[#E8F2FF]' : 'border-gray-300 bg-white'}`}
                        onPress={() => setSelectedAcademicYear(year.key)}
                      >
                        <Text className={`text-sm ${selectedAcademicYear === year.key ? 'text-[#1E90FF] font-bold' : 'text-gray-700'}`}>{year.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <Button title="Next" onPress={handleNext} className="h-14 bg-[#1E90FF] rounded-xl" />
              </>
            )}

            {currentStep === 3 && (
              <View className="items-center">
                <View className="w-[280px] h-[280px] rounded-full mb-8 overflow-hidden bg-gray-200">
                  {capturedImageUri ? (
                    <Image source={{ uri: capturedImageUri }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    device && <Camera ref={camera} style={{ width: '100%', height: '100%' }} device={device} isActive={true} photo={true} />
                  )}
                </View>
                <Button 
                  title={embeddingSaved ? 'Captured ✓' : 'Capture Face'} 
                  onPress={captureAndProcess} 
                  loading={isProcessing} 
                  disabled={embeddingSaved}
                  className={`h-16 w-full rounded-xl ${embeddingSaved ? 'bg-green-500' : 'bg-[#1E90FF]'}`} 
                />
                <Button title="Complete Registration" loading={loading} onPress={handleNext} disabled={!embeddingSaved} className="h-14 w-full rounded-xl mt-5 bg-[#1E90FF]" />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessRegistrationModal isVisible={showSuccessModal} onBackToHome={handleBackToHome} />
    </SafeAreaView>
  );
}