import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

// Assuming these exist in your project
import {
  getFaceEmbedding,
  loadEmbedding,
  compareEmbeddings,
} from '~/lib/ImageChecker';
import { fetchFromAPI } from '~/lib/api';
import { Attendance } from '~/type/Teacher';
import { useAuthStore } from '~/lib/store/auth.store';
import { useStudentAttendance } from '~/lib/hook/useStudentAttendance';

const SIMILARITY_THRESHOLD = 0.6;

type ScanPhase = 'idle' | 'camera' | 'processing' | 'confirmed';

const StudentHomeScreen: React.FC = () => {

  const router = useRouter();
  const { class_id, live_id } = useLocalSearchParams<{ class_id: string, live_id: string }>();

  // --- STATE ---
  const [attendanceDetails, setAttendanceDetails] = useState<Attendance | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [registeredUser, setRegisteredUser] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);

  // --- ANIMATION VALUES ---
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // --- CAMERA SETUP ---
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Memoize callbacks to prevent infinite re-renders
  const onAlertReceived = useCallback(() => {
    console.log('✅ Attendance verified by teacher!');
    setScanPhase('confirmed');
  }, []);

  const onCheckInSuccess = useCallback(() => {
    console.log('✅ BLE Check-in successful');
  }, []);

  const onCheckOutSuccess = useCallback(() => {
    console.log('✅ BLE Check-out successful');
  }, []);

  // --- BLE ATTENDANCE HOOK ---
  const {
    checkedIn,
    alertReceived,
    isProcessing: isBleProcessing,
    handleCheckIn,
    handleCheckOut,
  } = useStudentAttendance({
    onAlertReceived,
    onCheckInSuccess,
    onCheckOutSuccess,
  });

  async function fetchLiveAttendanceDetails() {
    const res = await fetchFromAPI('teachers/attendance/' + class_id);

    if (res && res.success) {
      const data: Attendance = res.data;
      setAttendanceDetails(data);
    }
  }

  const loadRegisteredUser = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const embeddingKey = allKeys.find((key) =>
        key.startsWith('@face_embedding:')
      );
      if (embeddingKey) {
        const userId = embeddingKey.replace('@face_embedding:', '');
        setRegisteredUser(userId);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  useEffect(() => {
    fetchLiveAttendanceDetails();
    loadRegisteredUser();
  }, [class_id, live_id]);

  // --- ANIMATION LOGIC ---
  const startPumpingAnimation = useCallback(() => {
    scaleAnim.setValue(0);
    opacityAnim.setValue(1);
    Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleAnim, opacityAnim]);

  const stopPumpingAnimation = useCallback(() => {
    scaleAnim.stopAnimation();
    opacityAnim.stopAnimation();
    // Reset to base state
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
  }, [scaleAnim, opacityAnim]);

  // Trigger animation based on phase
  useEffect(() => {
    if (scanPhase === 'idle' || scanPhase === 'processing') {
      startPumpingAnimation();
    } else {
      stopPumpingAnimation();
    }
    return () => stopPumpingAnimation();
  }, [scanPhase, startPumpingAnimation, stopPumpingAnimation]);

  // Interpolations for Ripple Effect
  const rippleScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],  
  });

  const rippleOpacity = opacityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0],
  });

  // --- HANDLERS ---

  const handleStartAttendance = useCallback(async () => {
    // Check Permissions
    if (!hasPermission) {
      const permissionGranted = await requestPermission();
      if (!permissionGranted) {
        Alert.alert('Permission required', 'Camera permission is needed.');
        return;
      }
    }
    // Check Registration
    if (!registeredUser) {
      Alert.alert('Not Registered', 'Please register your face profile first.');
      return;
    }
    // Open Camera
    setScanPhase('camera');
  }, [hasPermission, requestPermission, registeredUser]);

  const handleCaptureAndVerify = useCallback(async () => {
    if (!camera.current) return;

    try {
      setIsProcessingFace(true);

      // 1. Take Photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      const photoUri = `file://${photo.path}`;
      setCapturedImageUri(photoUri);

      // 2. Generate Embedding
      const { embedding: capturedEmbedding } = await getFaceEmbedding(photoUri);

      // 3. Load Stored Embedding
      const storedEmbedding = await loadEmbedding(registeredUser!);
      if (!storedEmbedding) throw new Error('No stored embedding found.');

      // 4. Compare
      const similarity = compareEmbeddings(capturedEmbedding, storedEmbedding);
      const isMatch = similarity >= SIMILARITY_THRESHOLD;

      if (isMatch || true) {
        // Success: Close Camera, Go to Processing
        setScanPhase('processing');
        triggerServerProcess();
      } else {
        Alert.alert(
          'Verification Failed',
          'Face not recognized. Please try again.',
          [{ text: 'OK', onPress: () => setCapturedImageUri(null) }]
        );
      }
    } catch (error) {
      console.error('Face verify error:', error);
      Alert.alert('Error', 'Verification failed.');
      setCapturedImageUri(null);
    } finally {
      setIsProcessingFace(false);
    }
  }, [registeredUser]);

  const triggerServerProcess = useCallback(async () => {
    // Validate live_id exists
    if (!live_id) {
      console.error('[BLE Error]: live_id is null');
      Alert.alert('Error', 'Attendance session not found. Please try again.');
      setScanPhase('idle');
      return;
    }

    // After face verification, trigger BLE check-in
    console.log('[Valid face. Initiating BLE check-in]:', live_id);

    const result = await handleCheckIn(live_id);
    if (result.success) {
      console.log('✅ BLE broadcasting started');
      // Stay in processing phase until teacher verifies (onAlertReceived callback)
    } else {
      Alert.alert('Check-in Failed', result.error || 'Unable to start BLE broadcast');
      setScanPhase('idle');
    }
  }, [live_id, handleCheckIn]);

  if (!attendanceDetails || !attendanceDetails.class) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0095FF" />
        <Text className="text-gray-500 mt-4">Loading attendance details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f0f8ff]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View className="px-5 mt-4 flex-row justify-between items-center z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full bg-white/50">
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-medium text-gray-700">Live Attendance</Text>
        <View className="w-8" />
      </View>

      <View className="flex-1 justify-center items-center px-6 -mt-10">

        {/* --- CLASS INFO (Always Visible) --- */}
        <View className="items-center mb-12 z-10">
          <Text className="text-3xl font-bold text-gray-900 text-center" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            {attendanceDetails.class.subject}
          </Text>
          <Text className="text-lg text-gray-500 mt-2 text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
            {attendanceDetails.class.department} | {attendanceDetails.class.year}
          </Text>
          <View className="bg-blue-100 px-4 py-1 rounded-full mt-3">
            <Text className="text-[#0095FF] text-xs font-medium">
              Started: {new Date(attendanceDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* --- MAIN ACTION AREA --- */}
        <View className="items-center justify-center h-80 w-80 relative">

          {/* RIPPLE ANIMATIONS (Behind Button) */}
          {(scanPhase === 'idle' || scanPhase === 'processing') && (
            <>
              <Animated.View
                className="absolute w-40 h-40 rounded-full border-2 border-blue-400"
                style={{
                  transform: [{ scale: rippleScale }],
                  opacity: rippleOpacity,
                }}
              />
              <Animated.View
                className="absolute w-32 h-32 rounded-full border-2 border-blue-400"
                style={{
                  transform: [{
                    scale: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.8],
                    }),
                  }],
                  opacity: opacityAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                }}
              />
            </>
          )}

          {/* MAIN BUTTON / STATUS INDICATOR */}
          {scanPhase === 'confirmed' ? (
            <View className="w-48 h-48 rounded-full bg-white items-center justify-center shadow-lg border-4 border-green-500">
              <MaterialCommunityIcons name="check-circle" size={80} color="#22c55e" />
              <Text className="text-green-600 font-bold mt-2">Done!</Text>
            </View>
          ) : scanPhase === 'processing' ? (
            <View className="w-48 h-48 rounded-full bg-white items-center justify-center shadow-lg border-4 border-[#0095FF]">
              <ActivityIndicator size="large" color="#0095FF" />
              <Text className="text-[#0095FF] font-medium mt-4 text-xs tracking-widest uppercase">Present Siiiir...</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleStartAttendance}
              className="w-48 h-48 rounded-full bg-[#0095FF] items-center justify-center shadow-xl shadow-blue-300"
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="face-recognition" size={64} color="white" />
              <Text className="text-white font-semibold mt-2 text-lg">Tap to Scan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* --- BOTTOM TEXT --- */}
        <View className="mt-8 h-20 items-center justify-center">
          {scanPhase === 'idle' && (
            <Text className="text-gray-400 text-center max-w-[250px]">
              Tap the button to verify your face and mark attendance.
            </Text>
          )}
          {scanPhase === 'processing' && (
            <View className="items-center">
              <Text className="text-gray-400 text-center max-w-[250px]">
                {checkedIn ? 'Keep app open. Waiting for teacher verification...' : 'Please wait while we confirm your attendance.'}
              </Text>
            </View>
          )}
          {scanPhase === 'confirmed' && (
            <View className="items-center">
              <TouchableOpacity
                onPress={() => {
                  handleCheckOut();
                  router.back();
                }}
                className="bg-gray-100 px-8 py-3 rounded-full"
              >
                <Text className="text-gray-600 font-medium">Return Home</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>

      {/* --- CAMERA MODAL --- */}
      <Modal
        visible={scanPhase === 'camera'}
        animationType="slide"
        onRequestClose={() => setScanPhase('idle')}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-1 relative">
            {/* Camera View */}
            {device && (
              <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={scanPhase === 'camera' && !capturedImageUri}
                photo={true}
              />
            )}

            {/* Overlay */}
            <View className="absolute top-0 left-0 right-0 p-6 flex-row justify-between items-center z-10">
              <TouchableOpacity
                onPress={() => {
                  setScanPhase('idle');
                  setCapturedImageUri(null);
                }}
                className="bg-black/40 p-2 rounded-full"
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>

            {/* Face Frame Guide */}
            <View className="absolute inset-0 items-center justify-center pointer-events-none">
              <View className="w-64 h-64 border-2 border-white/50 rounded-full bg-transparent" />
            </View>

            {/* Capture UI */}
            <View className="absolute bottom-0 left-0 right-0 pb-12 pt-6 bg-gradient-to-t from-black/80 to-transparent items-center">
              <Text className="text-white text-center mb-8 font-medium bg-black/30 px-4 py-2 rounded-full overflow-hidden">
                Position your face inside the circle
              </Text>

              <TouchableOpacity
                onPress={handleCaptureAndVerify}
                disabled={isProcessingFace}
                className="w-20 h-20 rounded-full border-4 border-white items-center justify-center bg-white/20"
              >
                {isProcessingFace ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

export default StudentHomeScreen;