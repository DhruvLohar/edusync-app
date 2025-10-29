import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchFromAPI } from '~/lib/api';
import { useAuthStore } from '~/lib/store/auth.store';

// --- REUSABLE PROFILE ROW COMPONENT ---
interface ProfileRowProps {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    value?: string; // Optional for navigation/action rows
    isAction?: boolean;
    onPress?: () => void;
    color?: string;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ iconName, title, value, isAction = false, onPress, color = '#0095FF' }) => {
    return (
        <TouchableOpacity 
            className="flex-row items-center justify-between py-4 border-b border-gray-100 bg-white"
            onPress={onPress}
            disabled={!onPress}
        >
            <View className="flex-row items-center">
                {/* Icon Circle */}
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4" style={{ backgroundColor: `${color}1A` }}>
                    <Ionicons name={iconName} size={18} color={color} />
                </View>
                {/* Title */}
                <Text className="text-base font-medium text-gray-800">{title}</Text>
            </View>
            {/* Value or Arrow */}
            {value ? (
                <Text className="text-base text-gray-500">{value}</Text>
            ) : isAction ? (
                <Ionicons name="chevron-forward-outline" size={20} color="gray" />
            ) : null}
        </TouchableOpacity>
    );
};

// --- MAIN SCREEN COMPONENT ---
const ProfileScreen: React.FC = () => {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const Authstore = useAuthStore();
    const handleAction = async (action: string) => {
        if (action === 'Log Out') {
            await Authstore.logOut();
            router.replace('/(auth)');
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            const res = await fetchFromAPI<any>('/users/profile');
            if (res && res.success && res.data) {
                setProfile(res.data);
            } else {
                setProfile(null);
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    // Helper to fix local photo URL if needed
    const getProfilePhotoUrl = (url?: string | null) => {
        if (!url) return undefined;
        if (url.startsWith('http://127.0.0.1:8000')) {
            return url.replace('http://127.0.0.1:8000', 'https://d7e21c34a21f.ngrok-free.app');
        }
        return url;
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <StatusBar barStyle="dark-content" />
                <Text className="text-lg text-gray-600">Loading profile...</Text>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <StatusBar barStyle="dark-content" />
                <Text className="text-lg text-gray-600">Profile not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <ScrollView className="flex-1 mb-20 mt-5" showsVerticalScrollIndicator={false} style={styles.container}>
                {/* --- HEADER AND PROFILE INFO --- */}
                <View className="items-center pt-10 pb-6">
                    {/* Profile Picture */}
                    {profile.profile_photo ? (
                        <Image
                            source={{ uri: getProfilePhotoUrl(profile.profile_photo) }}
                            className="w-24 h-24 rounded-full border-4 border-white shadow-md mb-4"
                            style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 16 }}
                        />
                    ) : (
                        <View className="w-24 h-24 rounded-full bg-gray-300 border-4 border-white shadow-md mb-4" />
                    )}
                    {/* Name and ID */}
                    <Text className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        {profile.name || ''}
                    </Text>
                    <Text className="text-base text-gray-500">ID: {profile.id || ''}</Text>
                </View>
                {/* --- SECTIONS --- */}
                <View className="px-5 mt-4">
                    {/* Section 1: BASIC DETAILS */}
                    <Text className="text-lg font-semibold text-gray-600 mb-2" style={styles.sectionHeader}>
                        Profile Details
                    </Text>
                    <View className="rounded-xl overflow-hidden px-4" style={styles.sectionCard}>
                        <ProfileRow iconName="person-outline" title="Name" value={profile.name || ''} />
                        <ProfileRow iconName="at-outline" title="Email" value={profile.email || ''} />
                        <ProfileRow iconName="call-outline" title="Phone" value={profile.phone || ''} />
                        <ProfileRow iconName="school-outline" title="User Type" value={profile.user_type || ''} />
                    </View>
                    {/* Section 2: ACTIONS AND LOGOUT */}
                    <Text className="text-lg font-semibold text-gray-600 mb-2 mt-6" style={styles.sectionHeader}>
                        Settings & Security
                    </Text>
                    <View className="rounded-xl overflow-hidden px-4" style={styles.sectionCard}>
                        <ProfileRow 
                            iconName="notifications-outline" 
                            title="Notifications" 
                            isAction 
                            onPress={() => handleAction('Notifications')} 
                        />
                        {/* LOGOUT BUTTON (Clearly styled and separated) */}
                        <TouchableOpacity 
                            className="flex-row items-center justify-between py-4"
                            onPress={() => handleAction('Log Out')}
                        >
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center mr-4">
                                    <Ionicons name="log-out-outline" size={18} color="red" />
                                </View>
                                <Text className="text-base font-medium text-red-600">Log Out</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
                {/* Spacer */}
                <View className="h-20" /> 
            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLING for Background Aesthetics ---
const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f0f8ff', 
    },
    sectionHeader: {
        color: '#4b5563', 
    },
    sectionCard: {
        backgroundColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        marginBottom: 10, // Added margin for separation between card sections
    }
});

export default ProfileScreen;