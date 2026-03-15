import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { postToAPI } from '~/lib/api';
import { useAuthStore } from '~/lib/store/auth.store';
import { TeacherClass } from '~/app/private/(teacher)/(tabs)';


function AllClasses({ classes }: { classes: TeacherClass[] }) {
    const router = useRouter();
    const profile = useAuthStore((state) => state.profile);

    const handleCardPress = async (classId: number, attendanceExists: number | null, attendanceLiveId: string | null) => {

        if (attendanceExists && attendanceLiveId) {
            router.push({
                pathname: '/private/(teacher)/(tabs)/[class_id]',
                params: { class_id: attendanceExists, live_id: attendanceLiveId },
            });
        }

        try {
            const res = await postToAPI('teachers/start-attendance', { class_id: classId });

            if (res && res.success) {
                router.push({
                    pathname: '/private/(teacher)/(tabs)/[class_id]',
                    params: { class_id: res.data.id, live_id: res.data.live_id },
                });
            } else {
                Alert.alert('Error', res?.message || 'Failed to start attendance session. Please try again.');
            }
        } catch (error) {
            console.error('Navigation error:', error);
        }
    };

    const LectureCard = ({ lecture }: { lecture: TeacherClass }) => {

        return (
            <TouchableOpacity
                onPress={() => handleCardPress(lecture.id, lecture.attendance_exists, lecture.attendance_live_id)}
                activeOpacity={0.7}
            >
                <View
                    className="w-full rounded-2xl p-6 bg-white"
                    style={{
                        borderLeftWidth: 5,
                        borderLeftColor: '#3b82f6',
                    }}
                >
                    {/* Header */}
                    <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                            <Text
                                className="text-xl font-semibold text-gray-900 mb-1"
                                style={{ fontFamily: 'Poppins_600SemiBold' }}
                            >
                                {lecture.subject}
                            </Text>
                        </View>
                    </View>

                    {/* Details */}
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                            <Text
                                className="text-sm text-gray-600 mb-1"
                                style={{ fontFamily: 'Poppins_400Regular' }}
                            >
                                {lecture.department} | {lecture.year}
                            </Text>
                            <View className="flex-row items-center gap-2 mt-2">
                                <View className="bg-blue-50 px-3 py-1 rounded-full">
                                    <Text
                                        className="text-xs font-semibold text-[#0095FF]"
                                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                                    >
                                        {lecture.total_students} Students
                                    </Text>
                                </View>
                                <View className="bg-gray-100 px-3 py-1 rounded-full">
                                    <Text
                                        className="text-xs font-semibold text-gray-600"
                                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                                    >
                                        {lecture.total_attendance_sessions} Sessions
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="gap-4 px-4 pb-4">
            {classes && classes.length > 0 ? (
                classes.map((lecture) => (
                    <LectureCard key={lecture.id} lecture={lecture} />
                ))
            ) : (
                <View className="w-full bg-white rounded-2xl p-6 items-center justify-center" style={{ borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text
                        className="text-base text-gray-600 text-center mb-1"
                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                        No Classes Found
                    </Text>
                    <Text
                        className="text-sm text-gray-500 text-center"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                    >
                        You don't have any classes assigned yet
                    </Text>
                </View>
            )}
        </View>
    );
}

export default React.memo(AllClasses);
