import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "~/lib/store/auth.store";

export default function ProtectedLayout() {

    const { profile } = useAuthStore();

    return (
        <Stack initialRouteName={"(tabs)"} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="editprofile" options={{ headerShown: false }} />
        </Stack>
    )
}