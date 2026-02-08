import React, { useEffect, useState } from 'react';
import { View, Text, StatusBar, ScrollView, TouchableOpacity, Dimensions, StyleSheet, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchFromAPI } from '~/lib/api';
import { renderAPIImage } from '~/lib/ImageChecker';
import { BottomModal } from '~/components/ui/BottomModal';
import LectureCards from '~/components/custom/teacherHome/LectureCards';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '~/lib/store/auth.store';

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
    const [isAttendanceModalVisible, setIsAttendanceModalVisible] = useState(false);

    const profile = useAuthStore((state) => state.profile);

    const fetchHistory = async () => {
        const res = await fetchFromAPI<any>('/teachers/history');
        if (res && res.success) {
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

    useEffect(() => {
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
            <ScrollView className="flex-1  mt-5 bg-[#D3EDFF]" showsVerticalScrollIndicator={false}>

                <View className="flex-row justify-between items-center py-4 mt-8 px-5">
                    <View className="mb-8">
                        <Text className="text-2xl text-gray-600 mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                            {greeting}
                        </Text>
                        <Text className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                            {profile?.name || 'Teacher'}
                        </Text>
                    </View>
                    {profile?.profile_photo ? (
                        <Image source={{ uri: renderAPIImage(profile.profile_photo) }} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" style={{ width: 48, height: 48, borderRadius: 24 }} />
                    ) : (
                        <View className="w-24 h-24 rounded-full bg-gray-200 border-2 border-white shadow-sm" />
                    )}
                </View>

                <View className="px-5 mt-6 mb-6">
                    <TouchableOpacity
                        onPress={() => setIsAttendanceModalVisible(true)}
                        className="w-full bg-[#0095FF] rounded-full py-4 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <View className="flex-row items-center gap-2">
                            <Text
                                className="text-lg text-white font-semibold"
                                style={{ fontFamily: 'Poppins_600SemiBold' }}
                            >
                                Take Attendance
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>


                {/* Today's Attendance Header */}
                <View className='bg-white rounded-t-[50px] p-4 mt-5 px-7'>
                    <View className="flex-row justify-between items-center mb-4 mt-4 px-5">
                        <Text className="text-xl text-gray-700 mt-3 mb-3" style={{ fontFamily: 'Poppins_500Medium' }}>
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
                </View>
            </ScrollView>
            <BottomModal
                isVisible={isAttendanceModalVisible}
                onClose={() => setIsAttendanceModalVisible(false)}
            >
                <View className="mb-4 px-4">
                    <Text
                        className="text-2xl text-gray-900 mt-4"
                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                        Today's Lectures
                    </Text>
                </View>
                <LectureCards />
            </BottomModal>
        </SafeAreaView>
    );
};



export default HomeScreen;