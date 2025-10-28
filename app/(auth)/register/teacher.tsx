import React, { useState } from 'react';
import { SafeAreaView, View, Text, StatusBar, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { InputField } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';

const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Mechanical', 'Electronics', 'AI/DS'];

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
    <Modal
        animationType="fade"
        transparent={true}
        visible={isVisible}
        onRequestClose={onBackToHome}
    >
        <View style={teacherStyles.modalOverlay}>
            <View style={teacherStyles.modalContent}>
                <Text style={teacherStyles.modalTitle}>Congratulations</Text>
                <Text style={teacherStyles.modalSubtitle}>Your account is ready to use !</Text>
                <Button 
                    title="Back to Home" 
                    onPress={onBackToHome} 
                    style={teacherStyles.modalButton as any}
                />
            </View>
        </View>
    </Modal>
);


export default function TeacherRegistrationScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1); 
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string | null>(null);

    const handleNext = () => {
        if (currentStep === 1) {
            setCurrentStep(2);
        } else {
            handleFinalRegister();
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
        router.replace('/private/(teacher)/(tabs)'); 
    };

    const StepIndicator: React.FC<StepIndicatorProps> = ({ step, title, isActive }) => (
        <View style={teacherStyles.stepItem}>
            <View style={[
                teacherStyles.checkboxContainer, 
                isActive ? teacherStyles.checkboxActive : teacherStyles.checkboxInactive
            ]}>
                <Text style={teacherStyles.checkboxIcon}>{isActive ? '✓' : ''}</Text>
            </View>
            <Text style={[
                teacherStyles.stepText, 
                isActive ? teacherStyles.stepTextActive : teacherStyles.stepTextInactive
            ]}>{title}</Text>
            {step === 1 && <View style={teacherStyles.stepDivider} />}
        </View>
    );

    const renderPersonalInfo = () => (
        <>
            <View style={teacherStyles.sectionHeader}>
                <Text style={teacherStyles.sectionTitle}>Personal Information</Text>
                <Text style={teacherStyles.sectionSubtitle}>Let's start with basic details</Text>
            </View>

            <View style={teacherStyles.formContainer}>
                {/* @ts-ignore */}
                <InputField placeholder="Enter Full Name" label="Full Name" containerStyle={teacherStyles.input} />
                {/* @ts-ignore */}
                <InputField placeholder="Enter Email Address" label="Email Address" keyboardType="email-address" containerStyle={teacherStyles.input} />
                {/* @ts-ignore */}
                <InputField placeholder="Enter Phone Number" label="Phone No." keyboardType="phone-pad" containerStyle={teacherStyles.input} />
            </View>

            <Button title="Next" onPress={handleNext} style={teacherStyles.nextButton} />
        </>
    );

    const renderProfessionalInfo = () => (
        <>
            <View style={teacherStyles.sectionHeader}>
                <Text style={teacherStyles.sectionTitle}>Professional Information</Text>
                <Text style={teacherStyles.sectionSubtitle}>Tell us about your teaching role</Text>
            </View>

            <View style={teacherStyles.formContainer}>
                {/* @ts-ignore */}
                <InputField placeholder="Enter Employee ID" label="Employee ID" containerStyle={teacherStyles.input} />
                
                <Text style={teacherStyles.fieldLabel}>Department</Text>
                <View style={teacherStyles.chipContainer}>
                    {DEPARTMENTS.map((dept) => (
                        <TouchableOpacity
                            key={dept}
                            style={[
                                teacherStyles.chip,
                                selectedDepartment === dept && teacherStyles.chipSelected,
                            ]}
                            onPress={() => setSelectedDepartment(dept)}
                        >
                            <Text style={[
                                teacherStyles.chipText,
                                selectedDepartment === dept && teacherStyles.chipTextSelected,
                            ]}>
                                {dept}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </View>

            <Button title="Register" loading={loading} onPress={handleNext} style={teacherStyles.nextButton} />
        </>
    );


    return (
        <SafeAreaView style={teacherStyles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <ScrollView contentContainerStyle={teacherStyles.scrollViewContent} keyboardShouldPersistTaps="handled">
                
                <View style={teacherStyles.headerContainer}>
                    <TouchableOpacity 
                        onPress={() => currentStep === 1 ? router.back() : setCurrentStep(1)} 
                        style={teacherStyles.backArrowButton}
                    >
                       <Image
                        source={require('../../../assets/arrow.png')} 
                        style={teacherStyles.backArrow}
                    />
                    </TouchableOpacity>
                    
                    <Text style={teacherStyles.pageTitle}>Teacher's Onboarding</Text>
                </View>

                <View style={teacherStyles.onboardingStepsContainer}>
                    <StepIndicator step={1} title="Personal Info." isActive={currentStep >= 1} />
                    <StepIndicator step={2} title="Professional Info" isActive={currentStep === 2} />
                </View>
                
                {currentStep === 1 ? renderPersonalInfo() : renderProfessionalInfo()}

            </ScrollView>

            <SuccessRegistrationModal 
                isVisible={showSuccessModal} 
                onBackToHome={handleBackToHome} 
            />
        </SafeAreaView>
    );
}

const teacherStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollViewContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    
    headerContainer: { 
        marginBottom: 30,
        marginTop: 40,
    },
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
    pageTitle: { 
        fontSize: 28, 
        color: '#000', 
        fontFamily: 'Poppins_600SemiBold',
    },
    
    onboardingStepsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 40, width: '100%' },
    stepItem: { flexDirection: 'row', alignItems: 'center' },
    checkboxContainer: {
        width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 8,
    },
    checkboxActive: { backgroundColor: '#1E90FF', borderColor: '#1E90FF', borderWidth: 1 },
    checkboxInactive: { backgroundColor: '#FFFFFF', borderColor: '#A0A0A0', borderWidth: 1 },
    checkboxIcon: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', lineHeight: 22, textAlign: 'center' },
    stepText: { fontSize: 13,  fontFamily: 'Poppins_400Regular' },
    stepTextActive: { color: '#1E90FF' },
    stepTextInactive: { color: '#A0A0A0', fontWeight: 'normal' },
    stepDivider: { width: 80, height: 1, backgroundColor: '#D0D0D0', marginHorizontal: 10 },
    
    sectionHeader: { marginBottom: 30, marginTop: 10 },
    sectionTitle: { fontSize: 28, color: '#000', fontFamily: 'Poppins_600SemiBold', marginBottom: 5, maxWidth: '80%' },
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
    },
    
    nextButton: {
        height: 55, 
        backgroundColor: '#1E90FF',
        borderRadius: 12, 
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },

    fieldLabel: {
        fontSize: 16,
        color: '#000',
        fontFamily: 'Poppins_500Medium',
        marginBottom: 8,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
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
        backgroundColor: '#E8F2FF',
    },
    chipText: {
        fontSize: 14,
        color: '#333',
        fontFamily: 'Poppins_400Regular',
    },
    chipTextSelected: {
        color: '#1E90FF',
        fontWeight: 'bold',
    },

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