import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StatusBar,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '~/components/layout/Container';
import { Button } from '~/components/ui/Button';
import { useAuthStore } from '~/lib/store/auth.store';
import { fetchFromAPI } from '~/lib/api';
// Camera disabled for Expo Go: commented out react-native-vision-camera imports
// import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { getFaceEmbedding, loadEmbedding, compareEmbeddings } from '~/lib/ImageChecker';


export default function ProfileScreen() {
    const router = useRouter();
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [verification, setVerification] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    // Camera APIs disabled for Expo Go. The device/ref lines are commented out so the
    // file can run inside Expo Go without native camera support.
    // const devices = useCameraDevices();
    // const device = devices.find((d) => d.position === 'front');
    // const camera = React.useRef<Camera>(null);

    const verifyIdentity = async () => {
        // Camera-based verification is disabled in Expo Go. Inform the user.
        Alert.alert('Camera disabled', 'Face verification is unavailable in Expo Go. Build a standalone or use a bare workflow to enable it.');
        setVerification('Camera disabled in Expo Go');
        return;
    };

    return (
        <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <Text>profile screen</Text>
            {/* Camera removed for Expo Go */}
            <Text style={{ marginVertical: 16, color: '#6B7280' }}>Camera disabled in Expo Go</Text>
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
