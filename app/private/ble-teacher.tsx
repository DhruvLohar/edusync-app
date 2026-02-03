import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import {
    Pressable,
    StatusBar,
    Text,
    View,
    ScrollView,
    ActivityIndicator,
    Animated,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExpoBleCore, {
    BleConstants
} from "modules/expo-ble-core";
import { onAlertProgress, onBluetoothStateChanged, onStudentDiscovered } from "~/modules/expo-ble-core/src/ExpoBleCoreModule";

import type { EventSubscription } from 'expo-modules-core';
<<<<<<< HEAD
=======
// REMOVE THIS IMPORT
// import { generateShortClassId } from "~/lib/bleHash"; 
>>>>>>> f918ffb (data too large issue resolution)

interface Student {
    studentId: number;
    deviceAddress: string;
    rssi: number;
    discoveredAt: number;
    verified: boolean;
    verifiedAt: number | null;
    name?: string;
}

interface DebugLog {
    timestamp: number;
    message: string;
    type: 'info' | 'success' | 'error';
}

function BleTeacherView() {
    const router = useRouter();
    const [scanning, setScanning] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [alertProgress, setAlertProgress] = useState({ current: 0, total: 0 });
    const [isAlerting, setIsAlerting] = useState(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState(true);

    // Debug state
    const [debugExpanded, setDebugExpanded] = useState(false);
    const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
    const debugHeight = useRef(new Animated.Value(0)).current;
    const subscriptions = useRef<EventSubscription[]>([]);

<<<<<<< HEAD
    const classId = "CLASS_A_BE"; // Replace with dynamic class ID
=======
    // === CRITICAL FIX ===
    // Use the Raw ID. Do NOT hash it.
    const classId = "CSE_BE_SECTION_A"; 
    // ====================
>>>>>>> f918ffb (data too large issue resolution)

    const addDebugLog = useCallback((message: string, type: DebugLog['type'] = 'info') => {
        setDebugLogs(prev => [
            { timestamp: Date.now(), message, type },
            ...prev.slice(0, 49) // Keep last 50 logs
        ]);
    }, []);

    const toggleDebug = useCallback(() => {
        setDebugExpanded(prev => {
            const newState = !prev;
            Animated.timing(debugHeight, {
                toValue: newState ? 300 : 0,
                duration: 300,
                useNativeDriver: false,
            }).start();
            return newState;
        });
    }, [debugHeight]);

    useEffect(() => {
        // Setup event listeners
        const studentSub = onStudentDiscovered((event) => {
            if (event.error) {
                addDebugLog(`Scan error: ${event.errorCode}`, 'error');
                return;
            }

<<<<<<< HEAD
=======
            subscriptions.current = [studentSub, progressSub, bluetoothSub];

            // Logic to verify class ID matches is handled in Native, 
            // but we can double check here
            if (event.classId !== classId) {
                 // Ignore stray packets if any leak through
                 return;
            }

>>>>>>> f918ffb (data too large issue resolution)
            addDebugLog(
                `Discovered: ID ${event.studentId}, RSSI ${event.rssi}dBm`,
                'success'
            );

            setStudents(prev => {
                const exists = prev.find(s => s.studentId === event.studentId);
<<<<<<< HEAD
                if (exists) return prev;
=======
                if (exists) {
                    // Update RSSI if needed, but don't duplicate
                    return prev;
                }
>>>>>>> f918ffb (data too large issue resolution)

                return [...prev, {
                    studentId: event.studentId,
                    deviceAddress: event.deviceAddress,
                    rssi: event.rssi,
                    discoveredAt: Date.now(),
                    verified: false,
                    verifiedAt: null,
<<<<<<< HEAD
                    name: `Student ${event.studentId}` // Replace with DB lookup
=======
                    name: `Student ${event.studentId}` 
>>>>>>> f918ffb (data too large issue resolution)
                }];
            });
        });

        const progressSub = onAlertProgress((event) => {
            setAlertProgress({ current: event.current, total: event.total });

            if (event.status === 'success') {
                addDebugLog(`Alerted ${event.deviceAddress}`, 'success');

                // Update student verified status
                setStudents(prev => prev.map(s =>
                    s.deviceAddress === event.deviceAddress
                        ? { ...s, verified: true, verifiedAt: Date.now() }
                        : s
                ));
            } else if (event.status === 'failed') {
                addDebugLog(`Failed to alert ${event.deviceAddress}`, 'error');
            }
        });

        const bluetoothSub = onBluetoothStateChanged((event) => {
            setBluetoothEnabled(event.enabled);
            addDebugLog(
                `Bluetooth ${event.enabled ? 'enabled' : 'disabled'}`,
                event.enabled ? 'success' : 'error'
            );
        });

        subscriptions.current = [studentSub, progressSub, bluetoothSub];

        // Start Bluetooth state listener
        ExpoBleCore.startBluetoothStateListener();

        return () => {
            subscriptions.current.forEach(sub => sub.remove());
            ExpoBleCore.stopBluetoothStateListener();
        };
    }, [addDebugLog]);

    const requestPermissions = useCallback(async () => {
        const hasPerms = ExpoBleCore.hasPermissions();
        if (hasPerms) {
            addDebugLog('Permissions already granted', 'success');
            return true;
        }

        addDebugLog('Requesting BLE permissions...', 'info');
        const granted = await ExpoBleCore.requestPermissions();

        if (granted) {
            addDebugLog('Permissions granted', 'success');
            return true;
        } else {
            addDebugLog('Permissions denied', 'error');
            Alert.alert('Permissions Required', 'Please enable Bluetooth permissions');
            return false;
        }
    }, [addDebugLog]);

    const startScanning = useCallback(async () => {
        const hasPerms = await requestPermissions();
        if (!hasPerms) return;

        if (!ExpoBleCore.isBluetoothEnabled()) {
            Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan');
            await ExpoBleCore.requestEnableBluetooth();
            return;
        }

        ExpoBleCore.clearDiscoveredStudents();
        setStudents([]);
        addDebugLog(`Starting scan for class: ${classId}`, 'info');

        const result = await ExpoBleCore.startStudentScan(classId);
        if (result.success) {
            setScanning(true);
            addDebugLog('Scanning started', 'success');
        } else {
            addDebugLog(`Scan failed: ${result.error}`, 'error');
            Alert.alert('Scan Failed', result.error);
        }
    }, [classId, requestPermissions, addDebugLog]);

    const stopScanning = useCallback(() => {
        const result = ExpoBleCore.stopStudentScan();
        if (result.success) {
            setScanning(false);
            addDebugLog('Scanning stopped', 'info');
        }
    }, [addDebugLog]);

    const sendAlerts = useCallback(async () => {
        if (students.length === 0) {
            Alert.alert('No Students', 'No students discovered yet');
            return;
        }

        Alert.alert(
            'Send Roll Call Alerts',
            `Send beep alert to ${students.length} students?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        setIsAlerting(true);
                        addDebugLog(`Starting alert rollout to ${students.length} students`, 'info');

                        const addresses = students.map(s => s.deviceAddress);
                        const result = await ExpoBleCore.sendAlertToAll(
                            addresses,
                            BleConstants.ALERT_TYPE_BEEP,
                            2000
                        );

                        setIsAlerting(false);
                        addDebugLog(
                            `Alert complete: ${result.success} success, ${result.failed} failed`,
                            result.failed > 0 ? 'error' : 'success'
                        );

                        Alert.alert(
                            'Alert Complete',
                            `${result.success} students alerted successfully\n${result.failed} failed`
                        );
                    }
                }
            ]
        );
    }, [students, addDebugLog]);

    const getAttendanceReport = useCallback(() => {
<<<<<<< HEAD
        const report = ExpoBleCore.getAttendanceReport();
        const present = report.filter(s => s.status === 'present').length;
        const unverified = report.filter(s => s.status === 'unverified').length;

        Alert.alert(
            'Attendance Report',
            `Present: ${present}\nUnverified: ${unverified}\nTotal: ${report.length}`
=======
        const report = ExpoBleCore.getDiscoveredStudents(); // FIXED: Function name
        // const present = report.filter(s => s.status === 'present').length;
        // Simple logic for report
        const total = report.length;
        const verified = report.filter(s => s.verified).length;

        Alert.alert(
            'Attendance Report',
            `Verified: ${verified}\nTotal Found: ${total}`
>>>>>>> f918ffb (data too large issue resolution)
        );
    }, []);

    const getRssiStrength = (rssi: number) => {
        if (rssi > -50) return { text: 'Excellent', color: 'bg-green-500' };
        if (rssi > -70) return { text: 'Good', color: 'bg-yellow-500' };
        if (rssi > -85) return { text: 'Fair', color: 'bg-orange-500' };
        return { text: 'Weak', color: 'bg-red-500' };
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
<<<<<<< HEAD
            <View className="px-6 pt-4 pb-3 bg-white border-b border-gray-200">
=======
            <View className="px-6 pt-3 pb-3 bg-white border-b border-gray-200">
>>>>>>> f918ffb (data too large issue resolution)
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className="text-2xl font-bold text-gray-900">Roll Call</Text>
                        <Text className="text-sm text-gray-500 mt-0.5">{classId}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
<<<<<<< HEAD
=======
                        {/* NOTE: For testing, you usually cannot scan and advertise on the 
                          SAME device at the same time efficiently. 
                          You need two phones to test this properly. 
                        */}
>>>>>>> f918ffb (data too large issue resolution)
                        <Pressable
                            onPress={() => router.push("/private/ble-student")}
                            className="bg-teal-100 px-3 py-2 rounded-lg"
                        >
                            <Text className="text-teal-700 font-semibold text-xs">
                                Switch to Student
                            </Text>
                        </Pressable>
                        <View className="bg-teal-100 px-3 py-1.5 rounded-full">
                            <Text className="text-teal-700 font-semibold">
                                {students.length} student{students.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                </View>

<<<<<<< HEAD
                {/* Bluetooth Status Warning */}
=======
>>>>>>> f918ffb (data too large issue resolution)
                {!bluetoothEnabled && (
                    <View className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <Text className="text-red-700 text-sm font-medium">
                            ⚠️ Bluetooth is disabled
                        </Text>
                    </View>
                )}
            </View>

            {/* Main Control Button */}
            <View className="px-6 py-6 bg-white">
                <Pressable
                    onPress={scanning ? stopScanning : startScanning}
                    disabled={isAlerting}
                    className={`h-20 rounded-2xl items-center justify-center shadow-sm ${scanning ? 'bg-red-500' : 'bg-teal-500'
                        } ${isAlerting ? 'opacity-50' : ''}`}
                >
                    <Text className="text-white text-lg font-semibold">
                        {scanning ? '⏹ Stop Scanning' : '📡 Start Scanning'}
                    </Text>
                </Pressable>

                {/* Action Buttons */}
                {students.length > 0 && (
                    <View className="flex-row gap-3 mt-3">
                        <Pressable
                            onPress={sendAlerts}
                            disabled={isAlerting || scanning}
                            className={`flex-1 h-14 rounded-xl items-center justify-center border-2 border-teal-500 ${isAlerting || scanning ? 'opacity-50' : ''
                                }`}
                        >
                            {isAlerting ? (
                                <ActivityIndicator color="#14b8a6" />
                            ) : (
                                <Text className="text-teal-600 font-semibold">
                                    🔔 Send Alerts
                                </Text>
                            )}
                        </Pressable>

                        <Pressable
                            onPress={getAttendanceReport}
                            className="flex-1 h-14 rounded-xl items-center justify-center border-2 border-gray-300"
                        >
                            <Text className="text-gray-700 font-semibold">📊 Report</Text>
                        </Pressable>
                    </View>
                )}

                {/* Alert Progress */}
                {isAlerting && (
                    <View className="mt-3 bg-teal-50 rounded-lg p-3">
                        <Text className="text-teal-700 text-sm font-medium">
                            Alerting: {alertProgress.current} / {alertProgress.total}
                        </Text>
                    </View>
                )}
            </View>

            {/* Students List */}
            <ScrollView className="flex-1 px-6">
                {students.length === 0 ? (
                    <View className="items-center justify-center py-12">
                        <Text className="text-6xl mb-3">👥</Text>
                        <Text className="text-gray-400 text-base">
                            {scanning ? 'Scanning for students...' : 'No students discovered yet'}
                        </Text>
                    </View>
                ) : (
                    <View className="pb-6">
                        {students.map((student) => {
                            const rssiInfo = getRssiStrength(student.rssi);
                            return (
                                <View
                                    key={student.studentId}
                                    className="bg-white rounded-xl p-4 mb-3 border border-gray-200 shadow-sm"
                                >
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-lg font-semibold text-gray-900">
                                                    {student.name || `Student ${student.studentId}`}
                                                </Text>
                                                {student.verified && (
                                                    <View className="bg-green-100 rounded-full px-2 py-0.5">
                                                        <Text className="text-green-700 text-xs font-medium">
                                                            ✓ Verified
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-sm text-gray-500 mt-0.5">
                                                ID: {student.studentId}
                                            </Text>
                                            <View className="flex-row items-center gap-2 mt-2">
                                                <View className={`h-2 w-2 rounded-full ${rssiInfo.color}`} />
                                                <Text className="text-xs text-gray-600">
                                                    {student.rssi} dBm • {rssiInfo.text}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text className="text-xs text-gray-400">
                                            {formatTime(student.discoveredAt)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Floating Debug Panel */}
            <View className="absolute bottom-4 right-4">
                <Pressable
                    onPress={toggleDebug}
                    className="bg-gray-900 rounded-full px-4 py-3 shadow-lg mb-2"
                >
                    <Text className="text-white text-xs font-mono font-medium">
                        {debugExpanded ? '▼' : '▲'} DEBUG
                    </Text>
                </Pressable>

                <Animated.View
                    style={{ height: debugHeight, overflow: 'hidden' }}
                    className="bg-gray-900 rounded-2xl shadow-2xl w-80"
                >
                    <View className="p-4 border-b border-gray-700">
                        <Text className="text-white font-semibold text-sm">Debug Console</Text>
                        <Text className="text-gray-400 text-xs mt-0.5">
                            {debugLogs.length} logs
                        </Text>
                    </View>
                    <ScrollView className="flex-1 p-3">
                        {debugLogs.map((log, index) => (
                            <View key={index} className="mb-2">
                                <View className="flex-row items-start gap-2">
                                    <Text className={`text-xs ${log.type === 'success' ? 'text-green-400' :
                                            log.type === 'error' ? 'text-red-400' :
                                                'text-blue-400'
                                        }`}>
                                        {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : 'ℹ'}
                                    </Text>
                                    <View className="flex-1">
                                        <Text className="text-gray-300 text-xs font-mono leading-4">
                                            {log.message}
                                        </Text>
                                        <Text className="text-gray-500 text-[10px] font-mono mt-0.5">
                                            {formatTime(log.timestamp)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

<<<<<<< HEAD
export default BleTeacherView;
=======
export default BleTeacherView;
>>>>>>> f918ffb (data too large issue resolution)
