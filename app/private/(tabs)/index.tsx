import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  SafeAreaView,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { 
  getFaceEmbedding, 
  loadEmbedding, 
  compareEmbeddings 
} from '~/lib/ImageChecker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIMILARITY_THRESHOLD = 0.6; // Adjust based on testing (typically 0.5-0.7)

export default function DashboardScreen() {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    similarity: number;
    userId: string;
  } | null>(null);
  const [registeredUser, setRegisteredUser] = useState<string | null>(null);

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    loadRegisteredUser();
  }, []);

  const loadRegisteredUser = async () => {
    try {
      // Get the single registered user from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const embeddingKey = allKeys.find(key => key.startsWith('@face_embedding:'));
      
      if (embeddingKey) {
        const userId = embeddingKey.replace('@face_embedding:', '');
        setRegisteredUser(userId);
        console.log(`📋 Registered user found: ${userId}`);
      } else {
        console.log('📋 No registered user found');
        setRegisteredUser(null);
      }
    } catch (error) {
      console.error('💥 Error loading registered user:', error);
    }
  };

  const captureAndVerify = async () => {
    if (!camera.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    if (!registeredUser) {
      Alert.alert('No User Registered', 'Please register first through the student registration process.');
      return;
    }

    try {
      setIsProcessing(true);
      setVerificationResult(null);
      
      // Take photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const photoUri = `file://${photo.path}`;
      setCapturedImageUri(photoUri);

      // Generate face embedding from captured photo
      console.log('📸 Generating embedding from captured photo...');
      const { embedding: capturedEmbedding } = await getFaceEmbedding(photoUri);
      setEmbedding(capturedEmbedding);

      // Load the stored embedding
      console.log(`🔍 Comparing against registered user: ${registeredUser}`);
      const storedEmbedding = await loadEmbedding(registeredUser);
      
      if (!storedEmbedding) {
        throw new Error('Failed to load stored embedding');
      }

      // Compare embeddings
      const similarity = compareEmbeddings(capturedEmbedding, storedEmbedding);
      const isMatch = similarity >= SIMILARITY_THRESHOLD;

      setVerificationResult({
        success: isMatch,
        similarity: similarity,
        userId: registeredUser,
      });

      if (isMatch) {
        Alert.alert(
          '✅ Verification Successful',
          `Welcome, ${registeredUser}!\n\nSimilarity: ${(similarity * 100).toFixed(2)}%`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Verification Failed',
          `Face not recognized.\n\nUser: ${registeredUser}\nSimilarity: ${(similarity * 100).toFixed(2)}%\nThreshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(2)}%`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('💥 Error in face verification:', error);
      Alert.alert(
        'Error',
        'Failed to verify face. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const clearCapture = () => {
    setCapturedImageUri(null);
    setVerificationResult(null);
    setEmbedding(null);
  };

  const clearRegistration = async () => {
    Alert.alert(
      'Clear Registration',
      `This will delete the registered face data for ${registeredUser}. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (registeredUser) {
                await AsyncStorage.removeItem(`@face_embedding:${registeredUser}`);
                setRegisteredUser(null);
                clearCapture();
                Alert.alert('Success', 'Face registration has been cleared.');
              }
            } catch (error) {
              console.error('💥 Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-gray-600 mb-4 text-base">
            Camera permission is required for face verification
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-blue-500 py-4 px-8 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-base">
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-gray-600 text-base">
            No camera device found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center">
          <Text className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Face Verification
          </Text>
          
          {registeredUser ? (
            <View className="bg-blue-50 px-4 py-2 rounded-full mb-6">
              <Text className="text-sm text-blue-900 font-medium" style={{ fontFamily: 'Poppins_500Medium' }}>
                👤 {registeredUser}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-gray-500 text-center mb-6" style={{ fontFamily: 'Poppins_400Regular' }}>
              No user registered
            </Text>
          )}

          {/* Camera/Image Preview */}
          <View className="w-[300px] h-[300px] rounded-full mb-8 overflow-hidden bg-gray-200 border-2 border-gray-300">
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
                isActive={!capturedImageUri}
                photo={true}
              />
            )}
          </View>

          {/* Verification Result */}
          {verificationResult && (
            <View className={`w-full p-4 rounded-lg mb-6 border ${
              verificationResult.success 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
            }`}>
              <Text className={`font-semibold text-base mb-2 ${
                verificationResult.success ? 'text-green-900' : 'text-red-900'
              }`} style={{ fontFamily: 'Poppins_600SemiBold' }}>
                {verificationResult.success ? '✅ Verified' : '❌ Not Verified'}
              </Text>
              <Text className={`text-sm mb-1 ${
                verificationResult.success ? 'text-green-800' : 'text-red-800'
              }`} style={{ fontFamily: 'Poppins_400Regular' }}>
                Similarity: {(verificationResult.similarity * 100).toFixed(2)}%
              </Text>
              <Text className={`text-xs ${
                verificationResult.success ? 'text-green-700' : 'text-red-700'
              }`} style={{ fontFamily: 'Poppins_400Regular' }}>
                Threshold: {(SIMILARITY_THRESHOLD * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          {/* Embedding Info */}
          {embedding && (
            <View className="w-full bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
              <Text className="font-semibold text-base mb-2 text-blue-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                Embedding Generated
              </Text>
              <Text className="text-sm text-blue-800 mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                Dimensions: {embedding.length}D
              </Text>
              <Text className="text-xs text-blue-700 font-mono">
                Sample: [{embedding.slice(0, 4).map(v => v.toFixed(3)).join(', ')}, ...]
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="w-full gap-3">
            {capturedImageUri ? (
              <TouchableOpacity
                onPress={clearCapture}
                className="bg-gray-500 py-4 px-8 rounded-lg"
              >
                <Text className="text-white text-center font-semibold text-base">
                  Take Another Photo
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={captureAndVerify}
                disabled={isProcessing || !registeredUser}
                className={`py-4 px-8 rounded-lg ${
                  isProcessing || !registeredUser ? 'bg-gray-400' : 'bg-blue-500'
                }`}
              >
                <Text className="text-white text-center font-semibold text-base">
                  {isProcessing ? 'Processing...' : !registeredUser ? 'No User Registered' : 'Capture & Verify'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Clear Registration Button */}
            {registeredUser && (
              <TouchableOpacity
                onPress={clearRegistration}
                className="bg-red-500 py-3 px-8 rounded-lg mt-2"
              >
                <Text className="text-white text-center font-semibold text-sm">
                  Clear Registration
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info Box */}
          <View className="w-full bg-amber-50 p-4 rounded-lg border border-amber-200 mt-6">
            <Text className="text-sm text-amber-900" style={{ fontFamily: 'Poppins_400Regular' }}>
              💡 <Text className="font-semibold">How it works:</Text> The system compares your captured face 
              with the registered face embedding. If similarity is above {(SIMILARITY_THRESHOLD * 100).toFixed(0)}%, 
              verification succeeds. Only one user can be registered per device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}