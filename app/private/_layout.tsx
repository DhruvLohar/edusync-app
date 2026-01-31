import { Stack } from "expo-router";
import { useAuthStore } from "~/lib/store/auth.store";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React from 'react';

export default function ProtectedLayout() {
    // NOTE: This file is simplified to ignore user profile and force the 'student' route.
    
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            {/* 🎯 FIX: REMOVE initialRouteName. Let the first declared Stack.Screen 
               handle the initial route, which is (student) in this case. */}
            <Stack screenOptions={{ headerShown: false }}>
                {/* Student first so /private and /private/(student)/(tabs) open student index */}
                <Stack.Screen name="(student)/(tabs)" />
                <Stack.Screen name="(teacher)/(tabs)" />

                
                {/* Keep other protected screens accessible */}
                <Stack.Screen name="editprofile" options={{ headerShown: false }} />
            </Stack>
        </GestureHandlerRootView>
    );
}