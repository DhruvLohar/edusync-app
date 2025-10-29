import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StatusBar, ScrollView, TouchableOpacity, Dimensions, StyleSheet, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; 
import { fetchFromAPI } from '~/lib/api';

// --- MOCK DATA ---
interface ClassAttendance {
    id: string;
    name: string;
    department: string;
    time: string;
    date: string;
    presentCount: number;
    totalCapacity: number;
    progress: number; // 0.0 to 1.0
}

const mockClasses: ClassAttendance[] = [
    {
        id: 'c1',
        name: 'Blockchain',
        department: 'CSE',
        time: '9:00 - 10:00 AM',
        date: '22 Oct 2025',
        presentCount: 42,
        totalCapacity: 60,
        progress: 0.7,
    },
    {
        id: 'c2',
        name: 'Data Structures',
        department: 'IT',
        time: '11:00 - 12:00 AM',
        date: '28 Oct 2025',
        presentCount: 58,
        totalCapacity: 75,
        progress: 0.8,
    },
];

// --- REUSABLE ATTENDANCE CARD COMPONENT ---
const AttendanceCard: React.FC<ClassAttendance> = ({ name, department, time, date, presentCount, progress }) => {
    const progressWidth = `${progress * 100}%`;
    
    // Define gradient colors to match the light blue fade (from image analysis)
    const gradientColors: [string, string, string] = ['#f0f8ff', '#e0f0ff', '#cce6ff']; // Very light to slightly darker blue

    return (
        <View className="rounded-3xl p-0 mb-4  overflow-hidden border border-gray-100">
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0.0, y: 0.0 }} // Start top-left
                end={{ x: 1.0, y: 1.0 }}   // End bottom-right
                className="p-5"
            >
                
                {/* Top Right Icon */}
                <View className="absolute top-4 right-4 p-2 rounded-full bg-white">
                    <MaterialCommunityIcons name="download" size={20} color="#0095FF" />
                </View>

                {/* Class Title */}
                <Text className="text-3xl  text-gray-900 mb-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                    {name}
                </Text>

                {/* Metadata (CSE • 9:00 - 10:00 AM • 22 Oct 2025) */}
                <View className="flex-row items-center gap-2 text-gray-600 mb-6">
                    <Text className="text-sm">{department}</Text>
                    <Text className="text-xl text-gray-700">•</Text>
                    <Text className="text-sm">{time}</Text>
                    <Text className="text-xl text-gray-700">•</Text>
                    <Text className="text-sm">{date}</Text>
                </View>

                {/* --- Attendance Progress Section (Two Columns) --- */}
                <View className="flex-row  items-center justify-between items-end">
                    
                    {/* Progress Bar (Left Column) */}
                    <View className="flex-1 mr-4">
                        <View className="w-full h-1 bg-gray-300 rounded-full overflow-hidden">
                            <View 
                                className="h-full bg-blue-500 rounded-full" 
                                style={{ width: progressWidth as any, backgroundColor: '#0095FF' }} // Ensure exact blue color
                            />
                        </View>
                    </View>

                    {/* Attendance Count (Right Column) */}
                    <View className="flex-row items-baseline">
                        <Text className="text-5xl font-light text-gray-900 leading-none" style={{ fontFamily: 'Poppins_500Medium' }}>
                            {presentCount}
                        </Text>
                        <Text className="text-base text-gray-600 ml-1 leading-none" style={{ fontFamily: 'Poppins_400Regular' }}>
                            Present
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};


// --- MAIN SCREEN COMPONENT ---
const HomeScreen: React.FC = () => {
    const [classes, setClasses] = useState<ClassAttendance[]>([]);
    const [teacherName, setTeacherName] = useState<string>('');
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

    useEffect(() => {
        // Fetch teacher profile for name and photo
        const fetchProfile = async () => {
            const res = await fetchFromAPI<any>('/users/profile');
            if (res && res.success && res.data) {
                setTeacherName(res.data.name || 'Teacher');
                let url = res.data.profile_photo;
                if (url && url.startsWith('http://127.0.0.1:8000')) {
                    url = url.replace('http://127.0.0.1:8000', 'https://d7e21c34a21f.ngrok-free.app');
                }
                setProfilePhoto(url || null);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        // Fetch teacher attendance history
        const fetchHistory = async () => {
            const res = await fetchFromAPI<any>('/teachers/history');
            if (res && res.success && Array.isArray(res.data)) {
                // Map backend data to ClassAttendance[]
                const mapped = res.data.map((attendance: any) => {
                    const classInfo = attendance.class || {};
                    const presentCount = attendance.summary?.total_present || 0;
                    const totalCapacity = attendance.summary?.total_students || 0;
                    const progress = totalCapacity > 0 ? presentCount / totalCapacity : 0;
                    // Format time and date
                    const start = attendance.start_time ? new Date(attendance.start_time) : null;
                    const end = attendance.end_time ? new Date(attendance.end_time) : null;
                    const time = start && end ? `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
                    const date = start ? start.toLocaleDateString() : '';
                    return {
                        id: attendance.id.toString(),
                        name: classInfo.subject || '',
                        department: classInfo.department || '',
                        time,
                        date,
                        presentCount,
                        totalCapacity,
                        progress,
                    };
                });
                setClasses(mapped);
            } else {
                setClasses([]);
            }
        };
        fetchHistory();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning,';
        if (hour < 18) return 'Good Afternoon,';
        return 'Good Evening,';
    };
    const greeting = getGreeting();

    return (
        <SafeAreaView className="flex-1 bg-white"> 
            <StatusBar barStyle="dark-content" />
            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                {/* Header (Greeting & Settings Icon) */}
                <View className="flex-row justify-between items-center py-4 mt-8">
                    {/* User Profile Photo */}
                    {profilePhoto ? (
                        <Image source={{ uri: profilePhoto }} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" style={{ width: 48, height: 48, borderRadius: 24 }} />
                    ) : (
                        <View className="w-12 h-12 rounded-full bg-gray-200 border-2 border-white shadow-sm" />
                    )}
                    <TouchableOpacity className="p-2 border border-gray-300 rounded-full">
                        <Ionicons name="settings-outline" size={24} color="black" />
                    </TouchableOpacity>
                </View>

                {/* Greeting Text */}
                <View className="mb-8">
                    <Text className="text-2xl text-gray-600 mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                        {greeting}
                    </Text>
                    <Text className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        {teacherName}
                    </Text>
                </View>

                {/* Today's Attendance Header */}
                <View className="flex-row justify-between items-center mb-4 mt-4">
                    <Text className="text-lg text-gray-700" style={{ fontFamily: 'Poppins_500Medium' }}>
                        Attendance History
                    </Text>
                </View>

                {/* List of Attendance Cards */}
                {classes.length > 0 ? (
                    classes.map(classData => (
                        <AttendanceCard key={classData.id} {...classData} />
                    ))
                ) : (
                    <Text className="text-gray-500">No attendance records found.</Text>
                )}

                {/* Extra padding to ensure last card is visible above the tab bar */}
                <View className="h-20" /> 
            </ScrollView>
        </SafeAreaView>
    );
};



export default HomeScreen;