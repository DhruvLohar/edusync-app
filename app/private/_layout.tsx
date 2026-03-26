import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "~/lib/store/auth.store";
import CustomSplashScreen from '~/components/layout/SplashScreen';

export default function ProtectedLayout() {
    const router = useRouter();
    const segments = useSegments();
    const profile = useAuthStore((state) => state.profile);

    const isTeacher = profile?.user_type === 'teacher';

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

    if (!profile) {
        return <CustomSplashScreen message="Loading..." />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {isTeacher ? (
                <>
                    <Stack.Screen name="(teacher)/(tabs)" />
                    <Stack.Screen name="(student)/(tabs)" />
                </>
            ) : (
                <>
                    <Stack.Screen name="(student)/(tabs)" />
                    <Stack.Screen name="(teacher)/(tabs)" />
                </>
            )}

            {/* Keep other protected screens accessible */}
            <Stack.Screen name="editprofile" options={{ headerShown: false }} />

            <Stack.Screen name="ble-student" />
            <Stack.Screen name="ble-teacher" />
        </Stack>
    );
}