import React from 'react';
import { View, Text, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// --- MOCK DATA ---
const studentProfile = {
    name: "Nandani Kadave",
    id: "2023CS007",
    department: "Computer Science & Engineering",
    email: "nandani.k@student.edu",
    
    // >>> ADDED REGISTRATION DETAILS <<<
    course: "B.Tech",
    year: "4th Year",
    semester: "Semester 7",
    dob: "15th June 2003",
    phone: "+91 98765 43210"
};

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
    
    const handleAction = (action: string) => {
        console.log(`Action triggered: ${action}`);
        // For 'Log Out', this is where AsyncStorage/session would be cleared
        if (action === 'Log Out') {
            alert('Logging out...'); // Placeholder for actual logout logic
            // router.replace('/(auth)');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            <ScrollView className="flex-1 mb-20 mt-5" showsVerticalScrollIndicator={false} style={styles.container}>
                
                {/* --- HEADER AND PROFILE INFO --- */}
                <View className="items-center pt-10 pb-6">
                    {/* Profile Picture Placeholder */}
                    <View className="w-24 h-24 rounded-full bg-gray-300 border-4 border-white shadow-md mb-4" />
                    
                    {/* Name and ID */}
                    <Text className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        {studentProfile.name}
                    </Text>
                    <Text className="text-base text-gray-500">{studentProfile.id}</Text>
                </View>

                {/* --- SECTIONS --- */}
                <View className="px-5 mt-4">
                    
                    {/* Section 1: ACADEMIC DETAILS */}
                    <Text className="text-lg font-semibold text-gray-600 mb-2" style={styles.sectionHeader}>
                        Academic Details
                    </Text>
                    <View className="rounded-xl overflow-hidden px-4" style={styles.sectionCard}>
                        <ProfileRow iconName="library-outline" title="Course" value={studentProfile.course} />
                        <ProfileRow iconName="school-outline" title="Department" value={studentProfile.department} />
                        <ProfileRow iconName="calendar-outline" title="Year" value={studentProfile.year} />
                        <ProfileRow iconName="document-text-outline" title="Semester" value={studentProfile.semester} />
                    </View>
                    
                    {/* Section 2: PERSONAL/CONTACT DETAILS */}
                    <Text className="text-lg font-semibold text-gray-600 mb-2 mt-6" style={styles.sectionHeader}>
                        Personal & Contact
                    </Text>
                    <View className="rounded-xl overflow-hidden px-4" style={styles.sectionCard}>
                        <ProfileRow iconName="at-outline" title="Email" value={studentProfile.email} />
                        <ProfileRow iconName="call-outline" title="Phone" value={studentProfile.phone} />
                        <ProfileRow iconName="gift-outline" title="Date of Birth" value={studentProfile.dob} />
                    </View>


                    {/* Section 3: ACTIONS AND LOGOUT */}
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
                                {/* Use red for danger/logout action */}
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