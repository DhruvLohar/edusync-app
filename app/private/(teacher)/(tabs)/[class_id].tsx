import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchFromAPI, postToAPI } from '~/lib/api';
import { Attendance } from '~/type/Teacher';
import { useTeacherAttendance } from '~/lib/hook/useTeacherAttendance';
import type { Student as BLEStudent } from '~/lib/hook/useTeacherAttendance';
import { renderAPIImage } from '~/lib/ImageChecker';
import ExitConfirmSheet from '~/components/ExitConfirmSheet';

interface EnrichedStudent {
    roll_no: string;
    name: string;
    profile_photo: string | null;
    deviceAddress: string;
    rssi: number;
    discoveredAt: number;
    verified: boolean;
    attendanceStatus: 'present' | 'absent' | 'unmarked';
}

const TeacherAttendanceScreen: React.FC = () => {
    const router = useRouter();
    const { class_id, live_id } = useLocalSearchParams<{ class_id: string; live_id: string }>();

    const [attendanceDetails, setAttendanceDetails] = useState<Attendance | null>(null);
    const [students, setStudents] = useState<EnrichedStudent[]>([]);
    const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
    const [showExitSheet, setShowExitSheet] = useState(false);
    const allowExitRef = React.useRef(false);

    // BLE Hook
    const {
        scanning,
        bluetoothEnabled,
        isAlerting,
        startScanning,
        stopScanning,
        sendAlerts,
    } = useTeacherAttendance({
        classPrefix: live_id || '',
        onStudentFound: useCallback((bleStudent: BLEStudent) => {
            console.log('[Teacher] BLE Student found:', bleStudent);
            
            const detectedRollNo = bleStudent.rollno.toString();
            
            // Update student with BLE data and mark present
            setStudents((prev) => prev.map(s => {
                if (s.roll_no === detectedRollNo) {
                    return {
                        ...s,
                        deviceAddress: bleStudent.deviceAddress,
                        rssi: bleStudent.rssi,
                        discoveredAt: bleStudent.discoveredAt,
                        verified: bleStudent.verified,
                    };
                }
                return s;
            }));
            
            // Auto-mark as present
            setAttendance((prev) => ({
                ...prev,
                [detectedRollNo]: 'present'
            }));
        }, []),
        onAlertComplete: useCallback((success: number, failed: number) => {
            Alert.alert(
                'Alerts Sent',
                `Successfully alerted ${success} students\nFailed: ${failed}`
            );
        }, []),
    });

    // Intercept hardware back button
    useEffect(() => {
        const onBackPress = () => {
            if (allowExitRef.current) return false;
            setShowExitSheet(true);
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
    }, []);

    const confirmExit = async () => {
        setShowExitSheet(false);
        if (scanning) stopScanning();

        // End the attendance session as abnormal (exited without submitting)
        if (class_id) {
            await postToAPI('teachers/end-attendance', {
                attendance_id: Number(class_id),
                ended_abnormally: true,
            });
        }

        allowExitRef.current = true;
        router.back();
    };

    async function fetchLiveAttendanceDetails() {
        const res = await fetchFromAPI('teachers/attendance/' + class_id);

        if (res && res.success) {
            const data: Attendance = res.data;
            setAttendanceDetails(data);
            console.log('[Teacher] Attendance details loaded:', data.class?.students?.length, 'students');
            
            // Initialize students list from API
            if (data.class?.students) {
                const initialStudents: EnrichedStudent[] = data.class.students
                    .filter(s => s.roll_no && s.name)
                    .map(s => ({
                        roll_no: s.roll_no!,
                        name: s.name!,
                        profile_photo: s.profile_photo || null,
                        deviceAddress: '',
                        rssi: 0,
                        discoveredAt: 0,
                        verified: false,
                        attendanceStatus: 'unmarked' as const,
                    }));
                setStudents(initialStudents);
            }
        }
    }

    useEffect(() => {
        console.log("Teacher  : ", class_id, live_id);
        fetchLiveAttendanceDetails();
    }, [class_id, live_id]);

    const handleToggleAttendance = async () => {
        if (scanning) {
            Alert.alert(
                'Stop Scanning',
                'Are you sure you want to stop scanning for students?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Stop',
                        style: 'destructive',
                        onPress: () => {
                            stopScanning();
                            Alert.alert('Success', 'Scanning stopped');
                        },
                    },
                ]
            );
        } else {
            if (!live_id) {
                Alert.alert('Error', 'Invalid attendance session');
                return;
            }
            const result = await startScanning();
            if (result.success) {
                Alert.alert('Success', 'Started scanning for students');
            }
        }
    };

    const handleRecognizeStudents = async () => {
        const discoveredStudents = students.filter(s => s.deviceAddress);
        
        if (discoveredStudents.length === 0) {
            Alert.alert('No Students', 'No students discovered yet. Start scanning first.');
            return;
        }

        Alert.alert(
            'Send Alerts',
            `Send verification alert to ${discoveredStudents.length} discovered students?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        await sendAlerts();
                        // Update verified status for discovered students
                        setStudents(prev => prev.map(s => 
                            s.deviceAddress ? { ...s, verified: true } : s
                        ));
                    },
                },
            ]
        );
    };

    const toggleAttendance = (roll_no: string) => {
        setAttendance((prev) => {
            const current = prev[roll_no];
            if (!current) return { ...prev, [roll_no]: 'present' };
            if (current === 'present') return { ...prev, [roll_no]: 'absent' };
            // If absent, remove entry (back to unmarked)
            const { [roll_no]: _, ...rest } = prev;
            return rest;
        });
    };

    const handleSubmitAttendance = async () => {
        const presentCount = Object.values(attendance).filter(s => s === 'present').length;
        const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
        const unmarkedCount = students.length - presentCount - absentCount;

        Alert.alert(
            'Submit Attendance',
            `Submit attendance for this session?\n\nPresent: ${presentCount}\nAbsent: ${absentCount}\nUnmarked: ${unmarkedCount}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: async () => {
                        try {
                            if (scanning) {
                                stopScanning();
                            }

                            const records = students.map(student => ({
                                roll_no: student.roll_no,
                                status: attendance[student.roll_no] || 'absent',
                            }));

                            const res = await postToAPI('teachers/submit-attendance', {
                                attendance_id: Number(class_id),
                                records,
                            });

                            if (res?.success) {
                                allowExitRef.current = true;
                                Alert.alert('Success', 'Attendance submitted successfully!', [
                                    {
                                        text: 'OK',
                                        onPress: () => router.back(),
                                    },
                                ]);
                            } else {
                                Alert.alert('Error', res?.message || 'Failed to submit attendance.');
                            }
                        } catch (error) {
                            console.error('Submit attendance error:', error);
                            Alert.alert('Error', 'Failed to submit attendance. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const getAttendanceStatus = (roll_no: string): 'present' | 'absent' | 'unmarked' => {
        return attendance[roll_no] || 'unmarked';
    };

    return (
        <SafeAreaView className="flex-1 bg-[#f0f8ff]">
            {/* Header */}
            <View className="px-5 py-4 flex-row justify-between items-center bg-white border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowExitSheet(true)} className="p-2 -ml-2">
                    <Ionicons name="chevron-back" size={28} color="black" />
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-gray-900">Live Attendance</Text>
                <View className="w-10" />
            </View>

            {/* Class Info Section */}
            {attendanceDetails && attendanceDetails.class && (
                <View className="bg-white px-5 py-4 border-b border-gray-100">
                    <Text className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        {attendanceDetails.class.subject}
                    </Text>
                    <View className="flex-row items-center gap-2 mb-2">
                        <View className="bg-blue-50 px-3 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-[#0095FF]" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                                {attendanceDetails.class.department}
                            </Text>
                        </View>
                        <View className="bg-blue-50 px-3 py-1 rounded-full">
                            <Text className="text-xs font-semibold text-[#0095FF]" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                                {attendanceDetails.class.year}
                            </Text>
                        </View>
                    </View>
                    <Text className="text-sm text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
                        Started: {new Date(attendanceDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            )}

            {/* Fixed Top Section - Buttons */}
            <View className="bg-white px-5 py-4 border-b border-gray-100">
                {/* Bluetooth Status Warning */}
                {!bluetoothEnabled && (
                    <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <Text className="text-red-700 text-sm font-medium">
                            ⚠️ Bluetooth is disabled. Please enable it to scan for students.
                        </Text>
                    </View>
                )}

                {/* Start/Stop Scanning Button */}
                <TouchableOpacity
                    onPress={handleToggleAttendance}
                    className={`w-full py-4 rounded-xl items-center justify-center ${scanning ? 'bg-red-500' : 'bg-[#0095FF]'
                        }`}
                    activeOpacity={0.8}
                    disabled={isAlerting}
                >
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons
                            name={scanning ? 'stop-circle' : 'radar'}
                            size={24}
                            color="white"
                        />
                        <Text className="text-white text-lg font-semibold ml-2">
                            {scanning ? 'Stop Scanning' : 'Start Scanning'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Recognize Students Button */}
                {students.length > 0 && (
                    <TouchableOpacity
                        onPress={handleRecognizeStudents}
                        className="w-full py-4 rounded-xl items-center justify-center bg-green-500 mt-3"
                        activeOpacity={0.8}
                        disabled={isAlerting}
                    >
                        <View className="flex-row items-center">
                            <MaterialCommunityIcons name="bluetooth-connect" size={24} color="white" />
                            <Text className="text-white text-lg font-semibold ml-2">
                                {isAlerting ? 'Sending Alerts...' : 'Send Alerts'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Submit Attendance Button */}
                {students.length > 0 && (
                    <TouchableOpacity
                        onPress={handleSubmitAttendance}
                        className="w-full py-4 rounded-xl items-center justify-center bg-blue-600 mt-3"
                        activeOpacity={0.8}
                    >
                        <View className="flex-row items-center">
                            <MaterialCommunityIcons name="check-circle" size={24} color="white" />
                            <Text className="text-white text-lg font-semibold ml-2">
                                Submit Attendance
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            {/* Scrollable Student List */}
            <ScrollView className="flex-1 px-5 py-4">
                {/* Student List */}
                <View className="bg-white rounded-xl p-4">
                    <Text className="text-base font-semibold text-gray-900 mb-3">
                        Students ({students.length})
                    </Text>

                    {scanning && students.filter(s => s.deviceAddress).length === 0 && (
                        <Text className="text-gray-400 text-center py-4">Scanning for students...</Text>
                    )}

                    {students.length > 0 ? (
                        students.map((student) => {
                            const status = getAttendanceStatus(student.roll_no);
                            const discovered = !!student.deviceAddress;

                            return (
                                <View
                                    key={student.roll_no}
                                    className="flex-row items-center justify-between py-3 border-b border-gray-100"
                                >
                                    <View className="flex-row items-center flex-1">
                                        {student.profile_photo ? (
                                            <Image
                                                source={{ uri: renderAPIImage(student.profile_photo) }}
                                                className="w-10 h-10 rounded-full mr-3"
                                            />
                                        ) : (
                                            <View className="w-10 h-10 rounded-full bg-[#0095FF] items-center justify-center mr-3">
                                                <Text className="text-white font-semibold">{student.name.charAt(0)}</Text>
                                            </View>
                                        )}
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-medium">{student.name}</Text>
                                            <Text className="text-xs text-gray-500">Roll: {student.roll_no}</Text>
                                        </View>
                                        {discovered && (
                                            <View className="bg-green-100 px-2 py-1 rounded-full mr-2">
                                                <Text className="text-green-600 text-xs font-semibold">📡</Text>
                                            </View>
                                        )}
                                        {student.verified && (
                                            <View className="bg-blue-100 px-2 py-1 rounded-full mr-2">
                                                <Text className="text-blue-600 text-xs font-semibold">✓</Text>
                                            </View>
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => toggleAttendance(student.roll_no)}
                                        className={`w-12 h-12 rounded-lg items-center justify-center ${
                                            status === 'present' ? 'bg-green-500' : 
                                            status === 'absent' ? 'bg-red-500' : 'bg-gray-300'
                                        }`}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-white text-xl font-bold">
                                            {status === 'present' ? 'P' : status === 'absent' ? 'A' : '?'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    ) : (
                        <Text className="text-gray-400 text-center py-4">No students in this class</Text>
                    )}
                </View>
            </ScrollView>

            <ExitConfirmSheet
                visible={showExitSheet}
                onCancel={() => setShowExitSheet(false)}
                onConfirm={confirmExit}
                title="End Attendance Session?"
                message="Are you sure you want to leave? If scanning is active it will be stopped. Make sure you have submitted attendance before exiting."
                confirmText="Yes, Exit Session"
            />
        </SafeAreaView>
    );
};

export default React.memo(TeacherAttendanceScreen);
