import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { getFaceEmbedding, saveEmbedding } from '~/lib/ImageChecker';// Corrected import path to be relative

export default function DashboardScreen() {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'front');
  const camera = useRef<Camera>(null);

  useEffect(() => {
    requestPermission();
  }, []);

  const requestPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    setHasPermission(permission === 'granted');
  };

  const captureAndProcess = async () => {
    if (!camera.current || !hasPermission || isProcessing) return;

    try {
      setIsProcessing(true);
      setEmbedding(null);
      
      console.log('📸 Taking photo...');
      const photo = await camera.current.takePhoto();
      console.log('✅ Photo captured:', photo.path);

      console.log('🤖 Processing with FaceNet...');
      // Process the saved photo file
      const { embedding: resultEmbedding } = await getFaceEmbedding(`file://${photo.path}`);

      await saveEmbedding('kamal_jain', resultEmbedding);
      
      console.log('✅ Face embedding extracted!');
      setEmbedding(resultEmbedding);
      Alert.alert('Success!', `Embedding extracted with ${resultEmbedding.length} dimensions.`);

    } catch (error) {
      console.error('💥 Failed to capture or process photo:', error);
      Alert.alert('Error', 'Could not process the image.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (hasPermission === null || !device) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          {hasPermission === null ? 'Requesting permissions...' : 'No front camera found.'}
        </Text>
      </View>
    );
  }
  
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.content}>
        <Text style={styles.title}>FaceNet Face Recognition</Text>
        
        <View style={styles.cameraWrapper}>
          <Camera
            ref={camera}
            style={styles.camera}
            device={device}
            isActive={true}
            photo={true} // Enable photo mode
          />
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