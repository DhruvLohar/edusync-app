import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import dummyData from '~/assets/dummy.json';
// --- Face detection (commented out) ---
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFaceEmbedding,
  loadEmbedding,
  compareEmbeddings,
  renderAPIImage,
} from '~/lib/ImageChecker';
import { fetchFromAPI } from '~/lib/api';
import { getSocket, disconnectSocket } from '~/lib/socket';
import type { LiveAttendance } from '~/type/LiveAttendance';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIMILARITY_THRESHOLD = 0.6; // Face detection (commented out)

// Type for class details from dummy data
type ClassDetail = {
  id: string;
  subject: string;
  department: string;
  code: string;
  instructor?: string;
  instructor_photo?: string;
  room?: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  description?: string;
  totalStudents?: number;
  presentStudents?: number;
  attendanceRate?: number;
};

// --- RESTORED HISTORY DATA ---
// const historyData = [ ... ]; // REMOVE THIS

// Define the four phases of the screen state
type ScanPhase = 'initial' | 'scanning' | 'detected' | 'faceCapture' | 'confirmed';

// Define Animated Values outside the component for stability
const scaleAnim = new Animated.Value(0);
const opacityAnim = new Animated.Value(1);

const startPumpingAnimation = (
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value
) => {
  scaleAnim.setValue(0);
  opacityAnim.setValue(1);
  Animated.loop(
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  ).start();
};

const stopPumpingAnimation = (
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value
) => {
  scaleAnim.stopAnimation();
  opacityAnim.stopAnimation();
};

// --- MAIN SCREEN COMPONENT ---
const StudentHomeScreen: React.FC = () => {
  const { class_id } = useLocalSearchParams<{ class_id: string }>();
  const router = useRouter();
  const classDetails: ClassDetail | null =
    class_id && (dummyData as { classDetails?: Record<string, ClassDetail> }).classDetails?.[class_id]
      ? (dummyData as { classDetails: Record<string, ClassDetail> }).classDetails[class_id]
      : null;

  const [scanPhase, setScanPhase] = useState<ScanPhase>('initial');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<any>(null);
  const [liveAttendance, setLiveAttendance] = useState<LiveAttendance | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // --- Face detection (commented out) ---
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isProcessing, setIsProcessing] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const mainTitle = scanPhase === 'scanning' ? 'Scanning for Beacon' : 'Tap to Scan';
  const subline = 'Tap to connect to the class beacon and mark your presence.';

  useEffect(() => {
    const isPumping = scanPhase === 'scanning';

    if (isPumping) {
      startPumpingAnimation(scaleAnim, opacityAnim);
    } else {
      stopPumpingAnimation(scaleAnim, opacityAnim);
    }
    return () => stopPumpingAnimation(scaleAnim, opacityAnim);
  }, [scanPhase]);

  // --- Face detection: Load registered user (commented out) ---
  useEffect(() => {
    const loadRegisteredUser = async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const embeddingKey = allKeys.find((key) =>
          key.startsWith('@face_embedding:')
        );
        if (embeddingKey) {
          const userId = embeddingKey.replace('@face_embedding:', '');
          setRegisteredUser(userId);
        } else setRegisteredUser(null);
      } catch (error) {
        console.error('💥 Error loading registered user:', error);
      }
    };
    loadRegisteredUser();
  }, []);

  // --- Fetch student profile on mount ---
  useEffect(() => {
    // Fetch student profile from backend
    const fetchProfile = async () => {
      const res = await fetchFromAPI<any>('/users/profile');
      if (res && res.success && res.data) {
        setProfile(res.data);
      } else {
        setProfile(null);
      }
    };
    fetchProfile();
  }, []);
  // --- END ADDED ---

  // --- SOCKET CLEANUP ON UNMOUNT ---
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // --- MODIFIED: Tap to Scan triggers live attendance fetch and socket connect ---
  const handleTapToScan = async () => {
    if (scanPhase !== 'initial') return;
    setScanPhase('scanning');
    // 1. Fetch live attendance
    const res = await fetchFromAPI<{ id: number; live_id: string; start_time: string; class: any; already_marked: boolean; attendance_record: any }>('/students/live-attendance');
    if (!res || !res.success || !res.data || !res.data.live_id) {
      setScanPhase('initial');
      Alert.alert('No Session', 'No live attendance session found.');
      return;
    }
    setLiveAttendance(res.data);
    // 2. Connect to socket
    const sock = await getSocket();
    setSocket(sock);
    sock.connect();
    sock.on('connect', () => {
      setIsSocketConnected(true);
      // 3. Join attendance session
      sock.emit('join_attendance', { live_id: res.data.live_id });
    });
    sock.on('joined_attendance', (data: any) => {
      setScanPhase('detected');
      setModalVisible(true);
    });
    sock.on('presence_marked', (data: any) => {
      setScanPhase('confirmed');
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        setScanPhase('initial');
        setLiveAttendance(null);
      }, 3000);
    });
    sock.on('auth_error', (data: any) => {
      Alert.alert('Socket Error', data.message || 'Authentication failed');
      setScanPhase('initial');
      setModalVisible(false);
    });
    sock.on('error', (data: any) => {
      Alert.alert('Socket Error', data.message || 'Unknown error');
      setScanPhase('initial');
      setModalVisible(false);
    });
  };

  // --- MODIFIED: Face scan triggers mark_present on socket ---
  const handleCaptureAndVerify = async () => {
    if (!camera.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }
    if (!registeredUser) {
      Alert.alert(
        'No User Registered',
        'Please register your face first via the student registration process.'
      );
      return;
    }
    try {
      setIsProcessing(true);

      // 1. Take photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      const photoUri = `file://${photo.path}`;
      setCapturedImageUri(photoUri);

      // 2. Generate embedding from captured photo
      console.log('📸 Generating embedding from captured photo...');
      const { embedding: capturedEmbedding } = await getFaceEmbedding(photoUri);

      // 3. Load stored embedding
      console.log(`🔍 Comparing against registered user: ${registeredUser}`);
      const storedEmbedding = await loadEmbedding(registeredUser);

      if (!storedEmbedding) {
        throw new Error('Failed to load stored embedding for user.');
      }

      // 4. Compare embeddings
      const similarity = compareEmbeddings(capturedEmbedding, storedEmbedding);
      const isMatch = similarity >= SIMILARITY_THRESHOLD;

      if (isMatch) {
        // 5. SUCCESS: Proceed to confirmation
        if (socket && liveAttendance?.live_id) {
          socket.emit('mark_present', { live_id: liveAttendance.live_id });
        }
        setModalVisible(false); // Close Face Capture Modal
        setScanPhase('confirmed');
        setTimeout(() => {
          setModalVisible(true); // Show Confirmation Modal
        }, 100);
        setTimeout(() => {
          setModalVisible(false);
          setScanPhase('initial'); // Reset to initial state
          setLiveAttendance(null);
        }, 3000);
      } else {
        // 6. FAILURE: Show alert and allow retry
        console.log(`❌ Verification Failed. Similarity: ${similarity}`);
        Alert.alert(
          'Verification Failed',
          `Face not recognized (Similarity: ${(similarity * 100).toFixed(2)}%). Please try again.`,
          [{ text: 'OK', onPress: () => setCapturedImageUri(null) }] // Reset for retake
        );
      }
    } catch (error) {
      console.error('💥 Error in face verification:', error);
      Alert.alert('Error', 'Failed to verify face. Please try again.', [
        { text: 'OK', onPress: () => setCapturedImageUri(null) }, // Reset for retake
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPresent = () => {
    if (socket && liveAttendance?.live_id) {
      socket.emit('mark_present', { live_id: liveAttendance.live_id });
    }
    setModalVisible(false);
    setScanPhase('confirmed');
    setTimeout(() => setModalVisible(true), 100);
    setTimeout(() => {
      setModalVisible(false);
      setScanPhase('initial');
      setLiveAttendance(null);
    }, 3000);
  };

  const handleSomethingWrong = () => {
   console.log('Something went wrong');
  };

  const rippleScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });
  const rippleOpacity = opacityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // --- Face detection: renderFaceCaptureContent (commented out) ---
  const renderFaceCaptureContent = () => {
    if (!hasPermission) {
      return (
        <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 items-center justify-center p-4">
          <Text className="text-center text-gray-700">
            Waiting for camera permission...
          </Text>
        </View>
      );
    }
    if (!device) {
      return (
        <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 items-center justify-center p-4">
          <Text className="text-center text-gray-700">No camera device found.</Text>
        </View>
      );
    }

    return (
      <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 overflow-hidden">
        {capturedImageUri ? (
          <Image
            source={{ uri: capturedImageUri }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={scanPhase === 'faceCapture' && modalVisible && !capturedImageUri}
            photo={true}
          />
        )}
      </View>
    );
  };
  // --- Face detection: handleFaceScan (commented out) ---
  const handleFaceScan = async () => {
    if (!hasPermission) {
      const permissionGranted = await requestPermission();
      if (!permissionGranted) {
        Alert.alert('Permission required', 'Camera permission is required to verify your face.');
        return;
      }
    }
    if (!device) {
      Alert.alert('Error', 'No front camera device found.');
      return;
    }
    setModalVisible(false); // Close Beacon Modal
    setScanPhase('faceCapture');
    setCapturedImageUri(null); // Reset any previous capture
    setIsProcessing(false);
    setTimeout(() => setModalVisible(true), 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      <View className="flex-1" style={styles.container}>
        {/* --- Scrollable Content (Header, Scan Area, History) --- */}
        <ScrollView
          className="flex-1 px-5 mt-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header (Back, Class title & Settings) */}
          <View className="flex-col justify-between py-4 mt-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2 rounded-full mb-3"
            >
              <Ionicons name="chevron-back" size={24} color="black" />
            </TouchableOpacity>
            <View className="flex-row">
            <View className="flex-row items-center flex-1 ml-2">
              
              <View className="flex-1">
                <Text
                  className="text-3xl text-gray-900"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  {classDetails?.subject ?? (liveAttendance?.class?.subject ?? 'Class')}
                </Text>
                <Text
                  className="text-lg text-gray-500 mt-2"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  {classDetails ? `${classDetails.department} | ${classDetails.code}` : liveAttendance?.class ? `${liveAttendance.class.department} | ${liveAttendance.class.year}` : ''}
                </Text>
              </View>
            </View>
            {/* Professor profile photo */}
            <View className="mr-4">
                {classDetails?.instructor_photo ? (
                  <Image
                    source={{ uri: renderAPIImage(classDetails.instructor_photo) }}
                    className="w-14 h-14 rounded-full bg-gray-200"
                    style={{ width: 56, height: 56, borderRadius: 28 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center bg-gray-300"
                    style={{ width: 56, height: 56, borderRadius: 28 }}
                  >
                    <Ionicons name="person" size={28} color="#6b7280" />
                  </View>
                )}
              </View>
              </View>
          </View>

         

          {/* Main Scan Area */}
          <View className="items-center py-10 mb-8 mt-10">
            {/* Dynamic Title */}
            <Text
              className="text-4xl font-light text-gray-900 mb-2"
              style={{ fontFamily: 'Poppins_500Medium' }}
            >
              {mainTitle}
            </Text>
            <Text
              className="text-base text-center text-gray-600 mb-12 opacity-90 max-w-[70%]"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              {subline}
            </Text>

            {/* Beacon Circle and Ripple Effect */}
            <TouchableOpacity
              onPress={handleTapToScan}
              disabled={scanPhase !== 'initial'}
              className="relative items-center justify-center w-60 h-60 "
            >
              {/* Rings are static/hidden/pumping based on phase */}
              {scanPhase === 'initial' && (
                <>
                  <View
                    className="absolute w-72 h-72 rounded-full border-2 border-[#0095FF]"
                    style={{ opacity: 0.2 }}
                  />
                  <View
                    className="absolute w-60 h-60 rounded-full border-2 border-[#0095FF]"
                    style={{ opacity: 0.3 }}
                  />
                  <View
                    className="absolute w-48 h-48 rounded-full border-2 border-[#0095FF]"
                    style={{ opacity: 0.5 }}
                  />
                </>
              )}
              {scanPhase === 'scanning' && (
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
                      transform: [
                        {
                          scale: rippleScale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.2, 2.7],
                          }),
                        },
                      ],
                      opacity: rippleOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.5],
                      }),
                    }}
                  />
                </>
              )}

              <View
                className="w-24 h-24 rounded-full items-center justify-center shadow-lg"
                style={{ backgroundColor: '#0095FF' }}
              >
                <MaterialCommunityIcons name="bluetooth" size={48} color="white" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSomethingWrong} className="mt-32" activeOpacity={0.7}>
              <Text
                className="text-sm text-gray-500 underline"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Something went wrong?
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          className="flex-1 justify-center items-center p-5"
          style={styles.modalOverlay}
        >
          {/* --- Stage 2: BEACON DETECTED --- */}
          {scanPhase === 'detected' && liveAttendance && (
            <View className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl items-center">
              <Text
                className="text-2xl text-[#0095FF] mb-5"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                Beacon Detected
              </Text>

              {/* Class Details */}
              <View className="flex-row justify-between w-full items-center mb-8 px-2">
                <View>
                  <Text className="text-lg font-semibold text-gray-800">
                    {liveAttendance.class.subject}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {liveAttendance.class.department} | {liveAttendance.class.year}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-base text-gray-800 font-medium">
                    {new Date(liveAttendance.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {new Date(liveAttendance.start_time).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {/* Mark Present (face scan commented out) */}
              <TouchableOpacity
                onPress={handleMarkPresent}
                className="w-full h-12 bg-[#0095FF] rounded-lg items-center justify-center shadow-lg"
              >
                <Text className="text-xl font-bold text-white">Mark Present</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* --- Stage 3: FACE CAPTURE (commented out) --- */}
          {scanPhase === 'faceCapture' && (
            <View className="bg-white rounded-2xl w-full max-w-xs p-10 shadow-2xl items-center">
              {/* Camera View Placeholder */}
              {renderFaceCaptureContent()}

              {/* Action Buttons */}
              {capturedImageUri ? (
                // Show Retake button
                <TouchableOpacity
                  onPress={() => setCapturedImageUri(null)}
                  disabled={isProcessing}
                  className="w-full h-12 bg-gray-500 rounded-lg items-center justify-center shadow-lg"
                >
                  <Text className="text-xl font-bold text-white">Retake</Text>
                </TouchableOpacity>
              ) : (
                // Show Capture button
                <TouchableOpacity
                  onPress={handleCaptureAndVerify}
                  disabled={isProcessing || !registeredUser}
                  className={`w-full h-12 rounded-lg items-center justify-center shadow-lg ${isProcessing || !registeredUser
                      ? 'bg-gray-400'
                      : 'bg-[#0095FF]'
                    }`}
                >
                  <Text className="text-xl font-bold text-white">
                    {isProcessing
                      ? 'Verifying...'
                      : !registeredUser
                        ? 'No User Found'
                        : 'Verify'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {/* --- Stage 4: CONFIRMATION --- */}
          {scanPhase === 'confirmed' && (
            <View className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="check-circle"
                  size={32}
                  color="green"
                  className="mb-3"
                />

                <Text
                  className="text-xl text-green-600 mb-2"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Attendance Marked
                </Text>
              </View>
              <Text
                className="text-lg  text-gray-600"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Marked present for {liveAttendance?.class?.subject ?? classDetails?.subject ?? 'Class'} ({liveAttendance?.class?.department ?? classDetails?.department ?? ''})
              </Text>
              <Text
                className="text-base text-gray-500 mt-1"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {liveAttendance ? new Date(liveAttendance.start_time).toLocaleDateString() : classDetails?.date ?? ''}, {liveAttendance ? new Date(liveAttendance.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : classDetails ? `${classDetails.startTime ?? ''} - ${classDetails.endTime ?? ''}` : ''}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// --- STYLING ---
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f8ff',
  },
  scrollContent: {
    // Ensures content fills the height needed for scrolling
    minHeight: SCREEN_HEIGHT - 100,
    paddingBottom: 80,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});

export default StudentHomeScreen;