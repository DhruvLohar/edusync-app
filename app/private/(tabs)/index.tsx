import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
// Camera disabled for Expo Go: commented out react-native-vision-camera imports
// import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { getFaceEmbedding, saveEmbedding } from '~/lib/ImageChecker';// Corrected import path to be relative

export default function DashboardScreen() {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // We're running inside Expo Go which doesn't support react-native-vision-camera.
  // Keep the permission state but default to false and show a helpful message.
  const [hasPermission, setHasPermission] = useState<boolean | null>(false);

  // Camera APIs are disabled in this build. The following lines are intentionally
  // commented out so the app remains runnable in Expo Go.
  // const devices = useCameraDevices();
  // const device = devices.find((d) => d.position === 'front');
  // const camera = useRef<Camera>(null);

  // Don't request native camera permission in Expo Go. Provide a message instead.
  useEffect(() => {
    // noop: camera is disabled
  }, []);

  const requestPermission = async () => {
    // In the Expo Go workflow the native vision camera is not available.
    // Inform the user if they try to enable camera functionality.
    Alert.alert('Camera disabled', 'Camera features are disabled in Expo Go. Use a bare/standalone build to enable them.');
    setHasPermission(false);
  };

  const captureAndProcess = async () => {
    // Camera functionality is disabled in Expo Go. Provide a helpful message.
    Alert.alert('Camera disabled', 'Capture is unavailable in Expo Go. Build a standalone/bare app to use the camera.');
    return;
  };

  // When using Expo Go we don't have a device; show explanatory UI instead.
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{'Requesting permissions...'}</Text>
      </View>
    );
  }
  
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera features are disabled while running in Expo Go.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Why?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.content}>
        <Text style={styles.title}>FaceNet Face Recognition</Text>
        
        <View style={styles.cameraWrapper}>
          {/* Camera component removed for Expo Go. Replace with placeholder. */}
          <Text style={{ color: '#6B7280' }}>Camera disabled in Expo Go</Text>
        </View>

        <TouchableOpacity
          onPress={captureAndProcess}
          disabled={isProcessing}
          style={[styles.button, isProcessing && styles.disabledButton]}
        >
          <Text style={styles.buttonText}>
            {isProcessing ? 'Processing...' : 'Capture & Process Face'}
          </Text>
        </TouchableOpacity>

        {embedding && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Success</Text>
            <Text style={styles.resultsText}>Dimensions: {embedding.length}D</Text>
            <Text style={styles.resultsTextSmall}>
              Preview: [{embedding.slice(0, 4).map(v => v.toFixed(2)).join(', ')}, ...]
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
  },
  message: {
    textAlign: 'center',
    color: '#4B5563',
    marginBottom: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  cameraWrapper: {
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
    marginBottom: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  resultsContainer: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderColor: '#A7F3D0',
    borderWidth: 1,
    width: '100%',
  },
  resultsTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 16,
    color: '#065F46',
  },
  resultsText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#047857',
  },
  resultsTextSmall: {
    fontSize: 12,
    color: '#065F46',
    fontFamily: 'monospace', // Use a monospaced font for numbers
  },
});