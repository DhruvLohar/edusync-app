import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import { getFaceEmbedding, saveEmbedding } from '~/lib/ImageChecker';

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Mechanical',
  'Electronics',
  'AI/DS',
];
const ACADEMIC_YEARS = ['First Year', 'Second Year', 'Third Year', 'Final Year'];

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
          Your account is ready to use !
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
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Academic Details
  const [grNumber, setGrNumber] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string | null>(null);

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
  }, [currentStep]);

  const handleNext = () => {
    // Validation for step 1
    if (currentStep === 1) {
      if (!fullName.trim() || !email.trim() || !phoneNumber.trim()) {
        Alert.alert('Error', 'Please fill in all personal information fields');
        return;
      }
    }

    // Validation for step 2
    if (currentStep === 2) {
      if (!grNumber.trim() || !selectedDepartment || !selectedAcademicYear) {
        Alert.alert('Error', 'Please complete all academic details');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinalRegister();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const captureAndProcess = async () => {
    if (!camera.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Take photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const photoUri = `file://${photo.path}`;
      setCapturedImageUri(photoUri);

      // Generate face embedding
      const { embedding } = await getFaceEmbedding(photoUri);

      // Create unique identifier: "FullName - GRNumber"
      const userId = `${fullName.trim()} - ${grNumber.trim()}`;

      // Save embedding with user identifier
      await saveEmbedding(userId, embedding);

      setEmbeddingSaved(true);
      Alert.alert(
        'Success',
        `Face registered successfully for ${fullName}!`,
        [{ text: 'OK' }]
      );

      console.log(`✅ Face embedding saved for: ${userId}`);
      console.log(`📊 Embedding dimensions: ${embedding.length}D`);

    } catch (error) {
      console.error('💥 Error in face capture/processing:', error);
      Alert.alert(
        'Error',
        'Failed to capture or process face. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalRegister = () => {
    if (!embeddingSaved) {
      Alert.alert('Error', 'Please capture your face before registering');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowSuccessModal(true);
    }, 1500);
  };

  const handleBackToHome = () => {
    setShowSuccessModal(false);
    router.replace('/private/(tabs)/analytics');
  };

  const StepIndicator: React.FC<StepIndicatorProps> = ({ step, title, isActive }) => (
    <View className="flex-row items-center">
      <View className={`w-6 h-6 rounded-full justify-center items-center mr-2 border ${
        isActive ? 'bg-[#1E90FF] border-[#1E90FF]' : 'bg-white border-gray-400'
      }`}>
        <Text className="text-white text-xs font-bold text-center leading-6">
          {isActive ? '✓' : ''}
        </Text>
      </View>
      <Text 
        className={`text-sm font-medium max-w-[70px] ${
          isActive ? 'text-[#1E90FF]' : 'text-gray-400'
        }`}
        style={{ fontFamily: 'Poppins_500Medium' }}
      >
        {title}
      </Text>
      {step < 3 && <View className="w-4 h-px bg-gray-300 mx-2.5" />}
    </View>
  );

  const renderPersonalInfo = () => (
    <>
      <View className="mb-8 mt-2">
        <Text className="text-3xl font-bold text-black mb-1 max-w-[60%]" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Personal Information
        </Text>
        <Text className="text-base text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
          Let's start with basic details
        </Text>
      </View>

      <View className="gap-5 mb-12">
        <InputField
          placeholder="Enter Full Name"
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          containerStyle="h-14 border border-gray-300 rounded-xl px-4 bg-white"
        />
        <InputField
          placeholder="Enter Email Address"
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          containerStyle="h-14 border border-gray-300 rounded-xl px-4 bg-white"
        />
        <InputField
          placeholder="Enter Phone Number"
          label="Phone No."
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          containerStyle="h-14 border border-gray-300 rounded-xl px-4 bg-white"
        />
      </View>

      <Button 
        title="Next" 
        onPress={handleNext} 
        className="h-14 bg-[#1E90FF] rounded-xl justify-center items-center mt-5"
      />
    </>
  );

  const renderAcademicDetails = () => (
    <>
      <View className="mb-8 mt-2">
        <Text className="text-3xl font-bold text-black mb-1 max-w-[60%]" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Academic Details
        </Text>
        <Text className="text-base text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
          Tell us about your course
        </Text>
      </View>

      <View className="gap-5 mb-12">
        <InputField
          placeholder="Enter GR Number"
          label="GR No."
          value={grNumber}
          onChangeText={setGrNumber}
          containerStyle="h-14 border border-gray-300 rounded-xl px-4 bg-white"
        />

        <Text className="text-base text-black font-medium mb-2" style={{ fontFamily: 'Poppins_500Medium' }}>
          Department
        </Text>
        <View className="flex-row flex-wrap gap-2.5 mb-5">
          {DEPARTMENTS.map((dept) => (
            <TouchableOpacity
              key={dept}
              className={`px-4 py-2.5 rounded-lg border ${
                selectedDepartment === dept
                  ? 'border-[#1E90FF] bg-[#E8F2FF]'
                  : 'border-gray-300 bg-white'
              }`}
              onPress={() => setSelectedDepartment(dept)}
            >
              <Text 
                className={`text-sm ${
                  selectedDepartment === dept ? 'text-[#1E90FF] font-bold' : 'text-gray-700'
                }`}
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-base text-black font-medium mb-2" style={{ fontFamily: 'Poppins_500Medium' }}>
          Academic Year
        </Text>
        <View className="flex-row flex-wrap gap-2.5 mb-5">
          {ACADEMIC_YEARS.map((year) => (
            <TouchableOpacity
              key={year}
              className={`px-4 py-2.5 rounded-lg border ${
                selectedAcademicYear === year
                  ? 'border-[#1E90FF] bg-[#E8F2FF]'
                  : 'border-gray-300 bg-white'
              }`}
              onPress={() => setSelectedAcademicYear(year)}
            >
              <Text 
                className={`text-sm ${
                  selectedAcademicYear === year ? 'text-[#1E90FF] font-bold' : 'text-gray-700'
                }`}
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Button 
        title="Next" 
        onPress={handleNext} 
        className="h-14 bg-[#1E90FF] rounded-xl justify-center items-center mt-5"
      />
    </>
  );

  const renderFaceRegistration = () => {
    if (!hasPermission) {
      return (
        <View className="flex-1 items-center justify-center py-24">
          <Text className="text-base text-gray-500 mb-5 text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
            Camera permission is required
          </Text>
          <Button
            title="Grant Permission"
            onPress={requestPermission}
            className="h-14 bg-[#1E90FF] rounded-xl justify-center items-center"
          />
        </View>
      );
    }

    if (!device) {
      return (
        <View className="flex-1 items-center justify-center py-24">
          <Text className="text-base text-gray-500 text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
            No camera device found
          </Text>
        </View>
      );
    }

    return (
      <>
        <View className="mb-8 mt-2">
          <Text className="text-3xl font-bold text-black mb-1 max-w-[60%]" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Face Registration
          </Text>
          <Text className="text-base text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
            For your secure, touchless attendance verification
          </Text>
        </View>

        <View className="flex-1 items-center justify-center mb-12 mt-8">
          {/* Camera/Image Container with proper overflow handling */}
          <View className="w-[280px] h-[280px] rounded-full mb-8 overflow-hidden bg-gray-200">
            {capturedImageUri ? (
              <Image 
                source={{ uri: capturedImageUri }} 
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Camera
                ref={camera}
                style={{ width: '100%', height: '100%' }}
                device={device}
                isActive={currentStep === 3 && !capturedImageUri}
                photo={true}
              />
            )}
          </View>
          
          <View className="flex-row gap-2.5 mb-5">
            {capturedImageUri && (
              <Button
                title="Retake"
                onPress={() => {
                  setCapturedImageUri(null);
                  setEmbeddingSaved(false);
                }}
                className="h-16 w-36 bg-gray-500 rounded-xl justify-center items-center"
              />
            )}
            <Button
              title={embeddingSaved ? 'Captured ✓' : 'Capture Face'}
              onPress={captureAndProcess}
              disabled={isProcessing || embeddingSaved}
              loading={isProcessing}
              className={`h-16 w-36 rounded-xl justify-center items-center ${
                embeddingSaved ? 'bg-green-500' : 'bg-[#1E90FF]'
              }`}
            />
          </View>

          {embeddingSaved && (
            <View className="bg-green-50 px-5 py-2.5 rounded-2xl border border-green-500">
              <Text className="text-green-900 font-semibold text-sm" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                ✓ Face registered successfully
              </Text>
            </View>
          )}
        </View>

        <Button
          title="Complete Registration"
          loading={loading}
          onPress={handleNext}
          disabled={!embeddingSaved}
          className={`h-14 rounded-xl justify-center items-center ${
            embeddingSaved ? 'bg-[#1E90FF]' : 'bg-gray-300'
          }`}
        />
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8 mt-10">
          <TouchableOpacity onPress={handleBack} className="self-start pr-4 py-1 mb-2.5">
            <Image 
              source={require('../../../assets/arrow.png')} 
              className="w-10 h-10 mb-5"
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-black" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Student's Onboarding
          </Text>
        </View>

        <View className="flex-row items-center justify-start mb-10">
          <StepIndicator step={1} title="Personal Info." isActive={currentStep >= 1} />
          <StepIndicator step={2} title="Academic Info" isActive={currentStep >= 2} />
          <StepIndicator step={3} title="Face ID" isActive={currentStep === 3} />
        </View>

        {currentStep === 1 && renderPersonalInfo()}
        {currentStep === 2 && renderAcademicDetails()}
        {currentStep === 3 && renderFaceRegistration()}
      </ScrollView>

      <SuccessRegistrationModal isVisible={showSuccessModal} onBackToHome={handleBackToHome} />
    </SafeAreaView>
  );
}