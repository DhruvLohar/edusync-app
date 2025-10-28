// import React, { useState, useRef, useEffect } from 'react';
// import {
//   View,
//   Text,
//   SafeAreaView,
//   StatusBar,
//   TouchableOpacity,
//   Dimensions,
//   Animated,
//   Easing,
//   Modal,
//   StyleSheet,
//   ScrollView,
//   Alert, // <<< ADDED
//   Image, // <<< ADDED
// } from 'react-native';
// import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// import {
//   Camera,
//   useCameraDevice,
//   useCameraPermission,
// } from 'react-native-vision-camera'; // <<< ADDED
// import AsyncStorage from '@react-native-async-storage/async-storage'; // <<< ADDED
// import {
//   getFaceEmbedding,
//   loadEmbedding,
//   compareEmbeddings,
// } from '~/lib/ImageChecker'; // <<< ADDED (Assuming path)

// const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// const SIMILARITY_THRESHOLD = 0.6; // <<< ADDED: Confidence threshold

// // --- MOCK DATA ---
// const studentName = 'Nandani Kadave';
// const beaconData = {
//   course: 'Blockchain Lab',
//   time: '10:00 AM',
//   details: 'CSE | SEM 7-A',
//   date: '22 Oct 2025',
//   timeRange: '9:00 - 10:00 AM',
// };

// // --- RESTORED HISTORY DATA ---
// const historyData = [
//   {
//     id: 'h1',
//     course: 'Blockchain Lab',
//     details: 'CSE | SEM 7-A',
//     time: '10:00 AM',
//     date: '22 Oct 2025',
//     status: 'Present',
//   },
//   {
//     id: 'h2',
//     course: 'Data Structures',
//     details: 'IT | SEM 6-B',
//     time: '1:00 PM',
//     date: '21 Oct 2025',
//     status: 'Absent',
//   },
//   {
//     id: 'h3',
//     course: 'Web Development',
//     details: 'CS | SEM 7-A',
//     time: '9:00 AM',
//     date: '20 Oct 2025',
//     status: 'Present',
//   },
// ];

// // Define the four phases of the screen state
// type ScanPhase = 'initial' | 'scanning' | 'detected' | 'faceCapture' | 'confirmed';

// // Define Animated Values outside the component for stability
// const scaleAnim = new Animated.Value(0);
// const opacityAnim = new Animated.Value(1);

// const startPumpingAnimation = (
//   scaleAnim: Animated.Value,
//   opacityAnim: Animated.Value
// ) => {
//   scaleAnim.setValue(0);
//   opacityAnim.setValue(1);
//   Animated.loop(
//     Animated.parallel([
//       Animated.timing(scaleAnim, {
//         toValue: 1,
//         duration: 1500,
//         easing: Easing.out(Easing.ease),
//         useNativeDriver: true,
//       }),
//       Animated.timing(opacityAnim, {
//         toValue: 0,
//         duration: 1500,
//         easing: Easing.out(Easing.ease),
//         useNativeDriver: true,
//       }),
//     ])
//   ).start();
// };

// const stopPumpingAnimation = (
//   scaleAnim: Animated.Value,
//   opacityAnim: Animated.Value
// ) => {
//   scaleAnim.stopAnimation();
//   opacityAnim.stopAnimation();
// };

// // --- RESTORED History Item Component ---
// const HistoryItem: React.FC<typeof historyData[0]> = ({
//   course,
//   details,
//   time,
//   date,
//   status,
// }) => {
//   const barColor = status === 'Present' ? '#0095FF' : 'red';
//   return (
//     <View className="flex-row justify-between items-center bg-white py-3 pr-4 mb-1">
//       {/* Left Status Bar */}
//       <View
//         className="w-1 h-12 rounded-full mr-4"
//         style={{ backgroundColor: barColor }}
//       />

//       {/* Course Details */}
//       <View className="flex-1">
//         <Text className="text-lg font-semibold text-gray-900">{course}</Text>
//         <Text className="text-sm text-gray-500">{details}</Text>
//       </View>

//       {/* Time and Date */}
//       <View className="items-end">
//         <Text className="text-base text-gray-800">{time}</Text>
//         <Text className="text-xs text-gray-500">{date}</Text>
//       </View>
//     </View>
//   );
// };

// // --- MAIN SCREEN COMPONENT ---
// const StudentHomeScreen: React.FC = () => {
//   const [scanPhase, setScanPhase] = useState<ScanPhase>('initial');
//   const [modalVisible, setModalVisible] = useState<boolean>(false);

//   // --- ADDED FOR CAMERA & VERIFICATION ---
//   const camera = useRef<Camera>(null);
//   const device = useCameraDevice('front');
//   const { hasPermission, requestPermission } = useCameraPermission();
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [registeredUser, setRegisteredUser] = useState<string | null>(null);
//   const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
//   // --- END ADDED ---

//   const mainTitle = scanPhase === 'scanning' ? 'Scanning for Beacon' : 'Tap to Scan';
//   const subline = 'Tap to connect to the class beacon and mark your presence.';

//   useEffect(() => {
//     const isPumping = scanPhase === 'scanning';

//     if (isPumping) {
//       startPumpingAnimation(scaleAnim, opacityAnim);
//     } else {
//       stopPumpingAnimation(scaleAnim, opacityAnim);
//     }
//     return () => stopPumpingAnimation(scaleAnim, opacityAnim);
//   }, [scanPhase]);

//   // --- ADDED: Load registered user on mount ---
//   useEffect(() => {
//     const loadRegisteredUser = async () => {
//       try {
//         const allKeys = await AsyncStorage.getAllKeys();
//         const embeddingKey = allKeys.find((key) =>
//           key.startsWith('@face_embedding:')
//         );

//         if (embeddingKey) {
//           const userId = embeddingKey.replace('@face_embedding:', '');
//           setRegisteredUser(userId);
//           console.log(`📋 Registered user found: ${userId}`);
//         } else {
//           console.log('📋 No registered user found');
//           setRegisteredUser(null);
//         }
//       } catch (error) {
//         console.error('💥 Error loading registered user:', error);
//       }
//     };
//     loadRegisteredUser();
//   }, []);
//   // --- END ADDED ---

//   const handleTapToScan = () => {
//     if (scanPhase !== 'initial') return;
//     setScanPhase('scanning');

//     setTimeout(() => {
//       setScanPhase('detected');
//       setModalVisible(true);
//     }, 2000);
//   };

//   // --- MODIFIED: Check permissions before opening camera ---
//   const handleFaceScan = async () => {
//     if (!hasPermission) {
//       const permissionGranted = await requestPermission();
//       if (!permissionGranted) {
//         Alert.alert('Permission required', 'Camera permission is required to verify your face.');
//         return;
//       }
//     }
//     if (!device) {
//       Alert.alert('Error', 'No front camera device found.');
//       return;
//     }

//     setModalVisible(false); // Close Beacon Modal
//     setScanPhase('faceCapture');
//     setCapturedImageUri(null); // Reset any previous capture
//     setIsProcessing(false);
//     setTimeout(() => setModalVisible(true), 100);
//   };
//   // --- END MODIFIED ---

//   // --- REPLACED: This now performs the full verification ---
//   const handleCaptureAndVerify = async () => {
//     if (!camera.current) {
//       Alert.alert('Error', 'Camera not ready');
//       return;
//     }
//     if (!registeredUser) {
//       Alert.alert(
//         'No User Registered',
//         'Please register your face first via the student registration process.'
//       );
//       return;
//     }

//     try {
//       setIsProcessing(true);

//       // 1. Take photo
//       const photo = await camera.current.takePhoto({
//         flash: 'off',
//         enableShutterSound: false,
//       });
//       const photoUri = `file://${photo.path}`;
//       setCapturedImageUri(photoUri);

//       // 2. Generate embedding from captured photo
//       console.log('📸 Generating embedding from captured photo...');
//       const { embedding: capturedEmbedding } = await getFaceEmbedding(photoUri);

//       // 3. Load stored embedding
//       console.log(`🔍 Comparing against registered user: ${registeredUser}`);
//       const storedEmbedding = await loadEmbedding(registeredUser);

//       if (!storedEmbedding) {
//         throw new Error('Failed to load stored embedding for user.');
//       }

//       // 4. Compare embeddings
//       const similarity = compareEmbeddings(capturedEmbedding, storedEmbedding);
//       const isMatch = similarity >= SIMILARITY_THRESHOLD;

//       if (isMatch) {
//         // 5. SUCCESS: Proceed to confirmation
//         console.log(`✅ Verification Successful! Similarity: ${similarity}`);
//         setModalVisible(false); // Close Face Capture Modal
//         setScanPhase('confirmed');

//         setTimeout(() => {
//           setModalVisible(true); // Show Confirmation Modal
//         }, 100);

//         setTimeout(() => {
//           setModalVisible(false);
//           setScanPhase('initial'); // Reset to initial state
//         }, 3000);
//       } else {
//         // 6. FAILURE: Show alert and allow retry
//         console.log(`❌ Verification Failed. Similarity: ${similarity}`);
//         Alert.alert(
//           'Verification Failed',
//           `Face not recognized (Similarity: ${(similarity * 100).toFixed(2)}%). Please try again.`,
//           [{ text: 'OK', onPress: () => setCapturedImageUri(null) }] // Reset for retake
//         );
//       }
//     } catch (error) {
//       console.error('💥 Error in face verification:', error);
//       Alert.alert('Error', 'Failed to verify face. Please try again.', [
//         { text: 'OK', onPress: () => setCapturedImageUri(null) }, // Reset for retake
//       ]);
//     } finally {
//       setIsProcessing(false);
//     }
//   };
//   // --- END REPLACED ---

//   const rippleScale = scaleAnim.interpolate({
//     inputRange: [0, 1],
//     outputRange: [1, 2.5],
//   });
//   const rippleOpacity = opacityAnim.interpolate({
//     inputRange: [0, 1],
//     outputRange: [0, 1],
//   });

//   // --- ADDED: Helper render for camera/permission state ---
//   const renderFaceCaptureContent = () => {
//     if (!hasPermission) {
//       return (
//         <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 items-center justify-center p-4">
//           <Text className="text-center text-gray-700">
//             Waiting for camera permission...
//           </Text>
//         </View>
//       );
//     }
//     if (!device) {
//       return (
//         <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 items-center justify-center p-4">
//           <Text className="text-center text-gray-700">No camera device found.</Text>
//         </View>
//       );
//     }

//     return (
//       <View className="w-60 h-60 rounded-full bg-gray-300 mb-6 overflow-hidden">
//         {capturedImageUri ? (
//           <Image
//             source={{ uri: capturedImageUri }}
//             className="w-full h-full"
//             resizeMode="cover"
//           />
//         ) : (
//           <Camera
//             ref={camera}
//             style={StyleSheet.absoluteFill}
//             device={device}
//             isActive={scanPhase === 'faceCapture' && modalVisible && !capturedImageUri}
//             photo={true}
//           />
//         )}
//       </View>
//     );
//   };
//   // --- END ADDED ---

//   return (
//     <SafeAreaView className="flex-1 bg-white">
//       <StatusBar barStyle="dark-content" />

//       <View className="flex-1" style={styles.container}>
//         {/* --- Scrollable Content (Header, Scan Area, History) --- */}
//         <ScrollView
//           className="flex-1 px-5 mt-5"
//           showsVerticalScrollIndicator={false}
//           contentContainerStyle={styles.scrollContent}
//         >
//           {/* Header (Greeting & Settings Icon) */}
//           <View className="w-full flex-row justify-between items-center py-4 mt-8">
//             <View className="w-12 h-12 rounded-full bg-gray-200" />
//             <View className="flex-1 ml-4">
//               <Text
//                 className="text-lg text-gray-600 mb-0"
//                 style={{ fontFamily: 'Poppins_400Regular' }}
//               >
//                 Good Morning,
//               </Text>
//               <Text
//                 className="text-2xl text-gray-900"
//                 style={{ fontFamily: 'Poppins_600SemiBold' }}
//               >
//                 {studentName}
//               </Text>
//             </View>
//             <TouchableOpacity className="p-2 border border-gray-300 rounded-full">
//               <Ionicons name="settings-outline" size={24} color="black" />
//             </TouchableOpacity>
//           </View>

//           {/* Main Scan Area */}
//           <View className="items-center py-10 mb-8 mt-20">
//             {/* Dynamic Title */}
//             <Text
//               className="text-4xl font-light text-gray-900 mb-2"
//               style={{ fontFamily: 'Poppins_500Medium' }}
//             >
//               {mainTitle}
//             </Text>
//             <Text
//               className="text-base text-center text-gray-600 mb-12 opacity-90 max-w-[70%]"
//               style={{ fontFamily: 'Poppins_400Regular' }}
//             >
//               {subline}
//             </Text>

//             {/* Beacon Circle and Ripple Effect */}
//             <TouchableOpacity
//               onPress={handleTapToScan}
//               disabled={scanPhase !== 'initial'}
//               className="relative items-center justify-center w-60 h-60 "
//             >
//               {/* Rings are static/hidden/pumping based on phase */}
//               {scanPhase === 'initial' && (
//                 <>
//                   <View
//                     className="absolute w-72 h-72 rounded-full border-2 border-[#0095FF]"
//                     style={{ opacity: 0.2 }}
//                   />
//                   <View
//                     className="absolute w-60 h-60 rounded-full border-2 border-[#0095FF]"
//                     style={{ opacity: 0.3 }}
//                   />
//                   <View
//                     className="absolute w-48 h-48 rounded-full border-2 border-[#0095FF]"
//                     style={{ opacity: 0.5 }}
//                   />
//                 </>
//               )}
//               {scanPhase === 'scanning' && (
//                 <>
//                   <Animated.View
//                     className="absolute w-40 h-40 rounded-full border-2 border-blue-400"
//                     style={{
//                       transform: [{ scale: rippleScale }],
//                       opacity: rippleOpacity,
//                     }}
//                   />
//                   <Animated.View
//                     className="absolute w-32 h-32 rounded-full border-2 border-blue-400"
//                     style={{
//                       transform: [
//                         {
//                           scale: rippleScale.interpolate({
//                             inputRange: [0, 1],
//                             outputRange: [1.2, 2.7],
//                           }),
//                         },
//                       ],
//                       opacity: rippleOpacity.interpolate({
//                         inputRange: [0, 1],
//                         outputRange: [0, 0.5],
//                       }),
//                     }}
//                   />
//                 </>
//               )}

//               <View
//                 className="w-24 h-24 rounded-full items-center justify-center shadow-lg"
//                 style={{ backgroundColor: '#0095FF' }}
//               >
//                 <MaterialCommunityIcons name="bluetooth" size={48} color="white" />
//               </View>
//             </TouchableOpacity>
//           </View>

//           {/* --- Attendance History Section --- */}
//           <View
//             className="bg-white rounded-t-3xl -mx-5 pb-5 pt-3"
//             style={styles.historyContainer}
//           >
//             {/* History Header */}
//             <Text
//               className="text-lg text-gray-600 mb-4 px-5 mt-5 "
//               style={{ fontFamily: 'Poppins_400Regular' }}
//             >
//               Attendance History
//             </Text>

//             {/* History List */}
//             {historyData.map((item) => (
//               <View key={item.id} className="px-5">
//                 <HistoryItem {...item} />
//               </View>
//             ))}
//           </View>
//         </ScrollView>
//       </View>

//       <Modal
//         animationType="fade"
//         transparent={true}
//         visible={modalVisible}
//         onRequestClose={() => setModalVisible(false)}
//       >
//         <View
//           className="flex-1 justify-center items-center p-5"
//           style={styles.modalOverlay}
//         >
//           {/* --- Stage 2: BEACON DETECTED --- */}
//           {scanPhase === 'detected' && (
//             <View className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl items-center">
//               <Text
//                 className="text-2xl text-[#0095FF] mb-5"
//                 style={{ fontFamily: 'Poppins_600SemiBold' }}
//               >
//                 Beacon Detected
//               </Text>

//               {/* Class Details */}
//               <View className="flex-row justify-between w-full items-center mb-8 px-2">
//                 <View>
//                   <Text className="text-lg font-semibold text-gray-800">
//                     {beaconData.course}
//                   </Text>
//                   <Text className="text-sm text-gray-500">
//                     {beaconData.details}
//                   </Text>
//                 </View>
//                 <View className="items-end">
//                   <Text className="text-base text-gray-800 font-medium">
//                     {beaconData.time}
//                   </Text>
//                   <Text className="text-xs text-gray-500">
//                     {beaconData.date}
//                   </Text>
//                 </View>
//               </View>

//               {/* Face Scan Button */}
//               <TouchableOpacity
//                 onPress={handleFaceScan}
//                 className="w-full h-12 bg-[#0095FF] rounded-lg items-center justify-center shadow-lg"
//               >
//                 <Text className="text-xl font-bold text-white">Face Scan</Text>
//               </TouchableOpacity>
//             </View>
//           )}

//           {/* --- Stage 3: FACE CAPTURE (MODIFIED) --- */}
//           {scanPhase === 'faceCapture' && (
//             <View className="bg-white rounded-2xl w-full max-w-xs p-10 shadow-2xl items-center">
//               {/* Camera View Placeholder */}
//               {renderFaceCaptureContent()}

//               {/* Action Buttons */}
//               {capturedImageUri ? (
//                 // Show Retake button
//                 <TouchableOpacity
//                   onPress={() => setCapturedImageUri(null)}
//                   disabled={isProcessing}
//                   className="w-full h-12 bg-gray-500 rounded-lg items-center justify-center shadow-lg"
//                 >
//                   <Text className="text-xl font-bold text-white">Retake</Text>
//                 </TouchableOpacity>
//               ) : (
//                 // Show Capture button
//                 <TouchableOpacity
//                   onPress={handleCaptureAndVerify}
//                   disabled={isProcessing || !registeredUser}
//                   className={`w-full h-12 rounded-lg items-center justify-center shadow-lg ${
//                     isProcessing || !registeredUser
//                       ? 'bg-gray-400'
//                       : 'bg-[#0095FF]'
//                   }`}
//                 >
//                   <Text className="text-xl font-bold text-white">
//                     {isProcessing
//                       ? 'Verifying...'
//                       : !registeredUser
//                       ? 'No User Found'
//                       : 'Verify'}
//                   </Text>
//                 </TouchableOpacity>
//               )}
//             </View>
//           )}
//           {/* --- END MODIFIED --- */}

//           {/* --- Stage 4: CONFIRMATION --- */}
//           {scanPhase === 'confirmed' && (
//             <View className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
//               <View className="flex-row items-center gap-2">
//                 <MaterialCommunityIcons
//                   name="check-circle"
//                   size={32}
//                   color="green"
//                   className="mb-3"
//                 />

//                 <Text
//                   className="text-xl text-green-600 mb-2"
//                   style={{ fontFamily: 'Poppins_600SemiBold' }}
//                 >
//                   Attendance Marked
//                 </Text>
//               </View>
//               <Text
//                 className="text-lg  text-gray-600"
//                 style={{ fontFamily: 'Poppins_400Regular' }}
//               >
//                 Marked present for {beaconData.course} ({beaconData.details})
//               </Text>
//               <Text
//                 className="text-base text-gray-500 mt-1"
//                 style={{ fontFamily: 'Poppins_400Regular' }}
//               >
//                 {beaconData.date}, {beaconData.timeRange}
//               </Text>
//             </View>
//           )}
//         </View>
//       </Modal>
//     </SafeAreaView>
//   );
// };

// // --- STYLING ---
// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: '#f0f8ff',
//   },
//   historyContainer: {
//     borderTopLeftRadius: 30,
//     borderTopRightRadius: 30,
//     backgroundColor: '#FFFFFF', // Set to white for the contrast
//     marginTop: 10,
//   },
//   scrollContent: {
//     // Ensures content fills the height needed for scrolling
//     minHeight: SCREEN_HEIGHT - 100,
//     paddingBottom: 80,
//   },
//   modalOverlay: {
//     backgroundColor: 'rgba(0, 0, 0, 0.4)',
//   },
// });

// export default StudentHomeScreen;