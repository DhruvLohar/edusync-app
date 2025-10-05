import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StatusBar,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '~/components/layout/Container';
import { Button } from '~/components/ui/Button';
import { useAuthStore } from '~/lib/store/auth.store';
import { fetchFromAPI } from '~/lib/api';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { getFaceEmbedding, loadEmbedding, compareEmbeddings } from '~/lib/ImageChecker';


export default function ProfileScreen() {
    const router = useRouter();
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [verification, setVerification] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const devices = useCameraDevices();
    const device = devices.find((d) => d.position === 'front');
    const camera = React.useRef<Camera>(null);

    const verifyIdentity = async () => {
        if (!camera.current || isProcessing) return;
        setIsProcessing(true);
        setSimilarity(null);
        setVerification('');
        try {
            // Take photo
            const photo = await camera.current.takePhoto();
            // Get embedding for new photo
            const { embedding: newEmbedding } = await getFaceEmbedding(`file://${photo.path}`);
            // Load saved embedding
            const savedEmbedding = await loadEmbedding('kamal_jain');
            if (!savedEmbedding) throw new Error('No saved embedding found');
            // Compare
            const sim = compareEmbeddings(newEmbedding, savedEmbedding);
            setSimilarity(sim);
            setVerification(sim > 0.6 ? 'Verified: You are the same person!' : 'Not Verified: Face does not match.');
        } catch (err) {
            setVerification('Error during verification');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <Text>profile screen</Text>
            {device && (
                <Camera
                    ref={camera}
                    style={{ width: 200, height: 200, borderRadius: 100, marginVertical: 16 }}
                    device={device}
                    isActive={true}
                    photo={true}
                />
            )}
            <Button
                title={isProcessing ? 'Verifying...' : 'Verify Face Identity'}
                onPress={verifyIdentity}
                disabled={isProcessing}
            />
            {similarity !== null && (
                <View style={{ marginTop: 16 }}>
                    <Text>Cosine Similarity: {similarity.toFixed(4)}</Text>
                    <Text>{verification}</Text>
                </View>
            )}
        </View>
    );
}
