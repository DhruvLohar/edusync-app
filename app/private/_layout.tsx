import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "~/lib/store/auth.store";

export default function ProtectedLayout() {

    const { profile } = useAuthStore();

    return (
        <Stack initialRouteName={profile?.onboardingDone ? "(tabs)" : "onboarding"} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />

            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="editprofile" options={{ headerShown: false }} />
        </Stack>
    )
}