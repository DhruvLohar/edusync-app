import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StatusBar,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';

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
    <View style={studentStyles.modalOverlay}>
      <View style={studentStyles.modalContent}>
        <Text style={studentStyles.modalTitle}>Congratulations</Text>
        <Text style={studentStyles.modalSubtitle}>Your account is ready to use !</Text>
        <Button
          title="Back to Home"
          onPress={onBackToHome}
          style={studentStyles.modalButton as any}
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

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string | null>(null);

  const handleNext = () => {
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

  const handleFinalRegister = () => {
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
    <View style={studentStyles.stepItem}>
      <View
        style={[
          studentStyles.checkboxContainer,
          isActive ? studentStyles.checkboxActive : studentStyles.checkboxInactive,
        ]}>
        <Text style={studentStyles.checkboxIcon}>{isActive ? '✓' : ''}</Text>
      </View>
      <Text
        style={[
          studentStyles.stepText,
          isActive ? studentStyles.stepTextActive : studentStyles.stepTextInactive,
        ]}>
        {title}
      </Text>
      {step < 3 && <View style={studentStyles.stepDivider} />}
    </View>
  );

  const renderPersonalInfo = () => (
    <>
      <View style={studentStyles.sectionHeader}>
        <Text style={studentStyles.sectionTitle}>Personal Information</Text>
        <Text style={studentStyles.sectionSubtitle}>Let's start with basic details</Text>
      </View>

      <View style={studentStyles.formContainer}>
        {/* @ts-ignore */}
        <InputField
          placeholder="Enter Full Name"
          label="Full Name"
          containerStyle={studentStyles.input as any}
        />
        {/* @ts-ignore */}
        <InputField
          placeholder="Enter Email Address"
          label="Email Address"
          keyboardType="email-address"
          containerStyle={studentStyles.input as any}
        />
        {/* @ts-ignore */}
        <InputField
          placeholder="Enter Phone Number"
          label="Phone No."
          keyboardType="phone-pad"
          containerStyle={studentStyles.input as any}
        />
      </View>

      <Button title="Next" onPress={handleNext} style={studentStyles.nextButton} />
    </>
  );

  const renderAcademicDetails = () => (
    <>
      <View style={studentStyles.sectionHeader}>
        <Text style={studentStyles.sectionTitle}>Academic Details</Text>
        <Text style={studentStyles.sectionSubtitle}>Tell us about your course</Text>
      </View>

      <View style={studentStyles.formContainer}>
        {/* @ts-ignore */}
        <InputField
          placeholder="Enter GR Number"
          label="GR No."
          containerStyle={studentStyles.input as any}
        />

        <Text style={studentStyles.fieldLabel}>Department</Text>
        <View style={studentStyles.chipContainer}>
          {DEPARTMENTS.map((dept) => (
            <TouchableOpacity
              key={dept}
              style={[
                studentStyles.chip,
                selectedDepartment === dept && studentStyles.chipSelected,
              ]}
              onPress={() => setSelectedDepartment(dept)}>
              <Text
                style={[
                  studentStyles.chipText,
                  selectedDepartment === dept && studentStyles.chipTextSelected,
                ]}>
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={studentStyles.fieldLabel}>Academic Year</Text>
        <View style={studentStyles.chipContainer}>
          {ACADEMIC_YEARS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                studentStyles.chip,
                selectedAcademicYear === year && studentStyles.chipSelected,
              ]}
              onPress={() => setSelectedAcademicYear(year)}>
              <Text
                style={[
                  studentStyles.chipText,
                  selectedAcademicYear === year && studentStyles.chipTextSelected,
                ]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Button title="Next" onPress={handleNext} style={studentStyles.nextButton} />
    </>
  );

  const renderFaceRegistration = () => (
    <>
      <View style={studentStyles.sectionHeader}>
        <Text style={studentStyles.sectionTitle}>Face Registration</Text>
        <Text style={studentStyles.sectionSubtitle}>
          For your secure, touchless attendance verification
        </Text>
      </View>

      <View style={studentStyles.faceCaptureContainer}>
        <View style={studentStyles.faceCaptureArea} />
        <Button
          title="Capture"
          onPress={() => Alert.alert('Capture', 'Camera function triggered!')}
          style={studentStyles.captureButton}
        />
      </View>

      <Button
        title="Register"
        loading={loading}
        onPress={handleNext}
        style={studentStyles.nextButton}
      />
    </>
  );

  return (
    <SafeAreaView style={studentStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={studentStyles.scrollViewContent}
        keyboardShouldPersistTaps="handled">
        <View style={studentStyles.headerContainer}>
          <TouchableOpacity onPress={handleBack} style={studentStyles.backArrowButton}>
            <Image source={require('../../../assets/arrow.png')} style={studentStyles.backArrow} />
          </TouchableOpacity>
          <Text style={studentStyles.pageTitle}>Student's Onboarding</Text>
        </View>

        <View style={studentStyles.onboardingStepsContainer}>
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

const studentStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollViewContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  headerContainer: { marginBottom: 30, marginTop: 40 },
  backArrowButton: {
    alignSelf: 'flex-start',
    paddingRight: 15,
    paddingVertical: 5,
    marginBottom: 10,
  },
  backArrow: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#000', fontFamily: 'Poppins_600SemiBold' },

  onboardingStepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 40,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxActive: { backgroundColor: '#1E90FF', borderColor: '#1E90FF', borderWidth: 1 },
  checkboxInactive: { backgroundColor: '#FFFFFF', borderColor: '#A0A0A0', borderWidth: 1 },
  checkboxIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 22,
    textAlign: 'center',
  },
  stepText: { fontSize: 13, fontWeight: '500', fontFamily: 'Poppins_500Medium', maxWidth: 70 },
  stepTextActive: { color: '#1E90FF' },
  stepTextInactive: { color: '#A0A0A0', fontWeight: 'normal' },
  stepDivider: { width: 15, height: 1, backgroundColor: '#D0D0D0', marginHorizontal: 10 },

  sectionHeader: { marginBottom: 30, marginTop: 10 },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 5,
    maxWidth: '60%',
  },
  sectionSubtitle: { fontSize: 16, color: '#777', fontFamily: 'Poppins_400Regular' },
  formContainer: { gap: 20, marginBottom: 50 },

  input: {
    height: 55,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    shadowColor: 'transparent',
  } as any,

  nextButton: {
    height: 55,
    backgroundColor: '#1E90FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    fontFamily: 'Poppins_600SemiBold',
  },

  fieldLabel: { fontSize: 16, color: '#000', fontFamily: 'Poppins_500Medium', marginBottom: 8 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { 
    borderColor: '#1E90FF', 
    backgroundColor: '#E8F2FF' 
},
  chipText: { fontSize: 14, color: '#333', fontFamily: 'Poppins_400Regular' },
  chipTextSelected: { color: '#1E90FF', fontWeight: 'bold' },

  faceCaptureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
    marginTop: 50,
  },
  faceCaptureArea: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E0E0E0',
    marginBottom: 30,
  },
  captureButton: {
    height: 50,
    width: 150,
    backgroundColor: '#1E90FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E90FF',
    marginBottom: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: 'Poppins_400Regular',
  },
  modalButton: {
    width: '100%',
    height: 55,
    backgroundColor: '#1E90FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
