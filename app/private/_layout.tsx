import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "~/lib/store/auth.store";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function ProtectedLayout() {
    const router = useRouter();
    const segments = useSegments();
    const profile = useAuthStore((state) => state.profile);

    useEffect(() => {
        if (!profile) return;

        const inTeacherRoute = segments[1] === '(teacher)';
        const inStudentRoute = segments[1] === '(student)';

        if (profile.user_type === 'teacher' && !inTeacherRoute) {
            router.replace('/private/(teacher)/(tabs)');
        } else if (profile.user_type === 'student' && !inStudentRoute) {
            router.replace('/private/(student)/(tabs)');
        }
    }, [profile?.user_type, segments]);
    
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(student)/(tabs)" />
                <Stack.Screen name="(teacher)/(tabs)" />

                
                {/* Keep other protected screens accessible */}
                <Stack.Screen name="editprofile" options={{ headerShown: false }} />

                <Stack.Screen name="ble-student" />
                <Stack.Screen name="ble-teacher" />
                {/* <Stack.Screen name="editprofile" options={{ headerShown: false }} /> */}
            </Stack>
        </GestureHandlerRootView>
    );
}