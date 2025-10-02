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


export default function ProfileScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <Text>profile screen</Text>
        </View>
    );
}
