import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import {
    Pressable,
    StatusBar,
    Text,
    View,
    ScrollView,
    Animated,
    Alert,
    Vibration
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExpoBleCore, {
    BleConstants
} from "modules/expo-ble-core";
import { addAlertReceivedListener, addBluetoothStateChangedListener } from "~/modules/expo-ble-core/src/ExpoBleCoreModule";

import type { EventSubscription } from 'expo-modules-core';

interface DebugLog {
    timestamp: number;
    message: string;
    type: 'info' | 'success' | 'error';
}

interface CheckInStatusData {
    classId: string;
    studentId: number;
    checkedInAt: number;
}

function BleStudentView() {
    const router = useRouter();
    const [checkedIn, setCheckedIn] = useState(false);
    const [checkInStatus, setCheckInStatus] = useState<CheckInStatusData | null>(null);
    const [alertReceived, setAlertReceived] = useState(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Debug state
    const [debugExpanded, setDebugExpanded] = useState(false);
    const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
    const debugHeight = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const subscriptions = useRef<EventSubscription[]>([]);

    // Replace with actual student data
    const studentId = 848;
    const studentName = "John Doe";
    const classId = "CLASS_A_BE";

    const addDebugLog = useCallback((message: string, type: DebugLog['type'] = 'info') => {
        setDebugLogs(prev => [
            { timestamp: Date.now(), message, type },
            ...prev.slice(0, 49)
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

    // Pulse animation for checked-in state
    useEffect(() => {
        if (checkedIn && !alertReceived) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [checkedIn, alertReceived, pulseAnim]);

    useEffect(() => {
        // Setup event listeners
        const alertSub = addAlertReceivedListener((event) => {
            addDebugLog(`Alert received: Type ${event.alertType}`, 'success');

            setAlertReceived(true);

            // Play sound/vibration based on alert type
            if (event.alertType === BleConstants.ALERT_TYPE_BEEP ||
                event.alertType === BleConstants.ALERT_TYPE_BOTH) {
                // Play beep sound here
                addDebugLog('Playing beep sound', 'info');
            }

            if (event.alertType === BleConstants.ALERT_TYPE_VIBRATE ||
                event.alertType === BleConstants.ALERT_TYPE_BOTH) {
                Vibration.vibrate([0, 500, 200, 500]);
                addDebugLog('Vibrating device', 'info');
            }

            // Show alert
            Alert.alert(
                '✅ Attendance Verified',
                'Your presence has been confirmed!',
                [{ text: 'OK' }]
            );
        });

        const bluetoothSub = addBluetoothStateChangedListener((event) => {
            setBluetoothEnabled(event.enabled);
            addDebugLog(
                `Bluetooth ${event.enabled ? 'enabled' : 'disabled'}`,
                event.enabled ? 'success' : 'error'
            );

            if (!event.enabled && checkedIn) {
                Alert.alert(
                    'Bluetooth Disabled',
                    'Please keep Bluetooth on to maintain attendance tracking'
                );
            }
        });

        subscriptions.current = [alertSub, bluetoothSub];
        ExpoBleCore.startBluetoothStateListener();

        // Check if already checked in
        const status = ExpoBleCore.getCheckInStatus();
        if (status) {
            setCheckedIn(true);
            setCheckInStatus(status);
            addDebugLog('Already checked in', 'success');
        }

        return () => {
            subscriptions.current.forEach(sub => sub.remove());
            ExpoBleCore.stopBluetoothStateListener();
        };
    }, [addDebugLog, checkedIn]);

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

    const handleCheckIn = useCallback(async () => {
        const hasPerms = await requestPermissions();
        if (!hasPerms) return;

        if (!ExpoBleCore.isBluetoothEnabled()) {
            Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to check in');
            await ExpoBleCore.requestEnableBluetooth();
            return;
        }

        setIsProcessing(true);
        addDebugLog(`Checking in to ${classId} as student ${studentId}`, 'info');

        try {
            const result = await ExpoBleCore.checkIn(classId, studentId);

            if (result.success) {
                setCheckedIn(true);
                const status = ExpoBleCore.getCheckInStatus();
                setCheckInStatus(status);
                addDebugLog('Check-in successful - Advertising started', 'success');

                Alert.alert(
                    '✅ Checked In',
                    `You are now checked in to ${classId}\n\nWaiting for roll call...`,
                    [{ text: 'OK' }]
                );
            } else {
                addDebugLog(`Check-in failed: ${result.error}`, 'error');
                Alert.alert('Check-in Failed', result.error);
            }
        } catch (error) {
            addDebugLog(`Check-in error: ${error}`, 'error');
            Alert.alert('Error', 'Failed to check in. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    }, [classId, studentId, requestPermissions, addDebugLog]);

    const handleCheckOut = useCallback(() => {
        Alert.alert(
            'Check Out',
            'Are you sure you want to check out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Check Out',
                    style: 'destructive',
                    onPress: () => {
                        const result = ExpoBleCore.checkOut();
                        if (result.success) {
                            setCheckedIn(false);
                            setCheckInStatus(null);
                            setAlertReceived(false);
                            addDebugLog('Checked out - Advertising stopped', 'info');
                        } else {
                            addDebugLog(`Check-out failed: ${result.error}`, 'error');
                        }
                    }
                }
            ]
        );
    }, [addDebugLog]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    const formatDuration = (startTime: number) => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}m ${seconds}s`;
    };

    const getStatusColor = () => {
        if (alertReceived) return 'bg-green-500';
        if (checkedIn) return 'bg-yellow-500';
        return 'bg-gray-300';
    };

    const getStatusText = () => {
        if (alertReceived) return '✅ Attendance Verified';
        if (checkedIn) return '⏳ Waiting for Roll Call...';
        return '📍 Ready to Check In';
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 pt-4 pb-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center justify-between">
                    <Text className="text-2xl font-bold text-gray-900">Attendance</Text>
                    <Pressable
                        onPress={() => router.push("/private/ble-teacher")}
                        className="bg-teal-100 px-3 py-2 rounded-lg"
                    >
                        <Text className="text-teal-700 font-semibold text-xs">
                            Switch to Teacher
                        </Text>
                    </Pressable>
                </View>
                <View className="mt-3 bg-gray-100 rounded-xl p-4">
                    <Text className="text-gray-600 text-sm">Student</Text>
                    <Text className="text-gray-900 text-lg font-semibold mt-0.5">
                        {studentName}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-1">ID: {studentId}</Text>
                </View>

                {/* Bluetooth Status Warning */}
                {!bluetoothEnabled && (
                    <View className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <Text className="text-red-700 text-sm font-medium">
                            ⚠️ Bluetooth is disabled
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
                {/* Class Info */}
                <View className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
                    <Text className="text-gray-600 text-sm">Class</Text>
                    <Text className="text-gray-900 text-xl font-bold mt-1">
                        {classId}
                    </Text>
                </View>

                {/* Main Check-In Button */}
                <View className="items-center mb-6">
                    <Animated.View
                        style={{
                            transform: [{ scale: checkedIn && !alertReceived ? pulseAnim : 1 }],
                        }}
                    >
                        <Pressable
                            onPress={checkedIn ? handleCheckOut : handleCheckIn}
                            disabled={isProcessing}
                            className={`h-48 w-48 rounded-full items-center justify-center shadow-lg ${alertReceived ? 'bg-green-500' :
                                checkedIn ? 'bg-yellow-500' :
                                    'bg-teal-500'
                                } ${isProcessing ? 'opacity-50' : ''}`}
                        >
                            <Text className="text-white text-5xl mb-2">
                                {alertReceived ? '✅' : checkedIn ? '⏳' : '📍'}
                            </Text>
                            <Text className="text-white text-base font-semibold text-center px-6">
                                {isProcessing ? 'Processing...' :
                                    alertReceived ? 'Verified' :
                                        checkedIn ? 'Checked In' :
                                            'Check In'}
                            </Text>
                        </Pressable>
                    </Animated.View>
                </View>

                {/* Status Card */}
                <View className={`rounded-2xl p-5 ${alertReceived ? 'bg-green-50 border-green-200' :
                    checkedIn ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-100 border-gray-200'
                    } border-2`}>
                    <Text className={`text-center font-semibold text-base ${alertReceived ? 'text-green-700' :
                        checkedIn ? 'text-yellow-700' :
                            'text-gray-600'
                        }`}>
                        {getStatusText()}
                    </Text>

                    {checkedIn && checkInStatus && (
                        <View className="mt-4 pt-4 border-t border-gray-200">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-gray-600 text-sm">Checked in at</Text>
                                <Text className="text-gray-900 text-sm font-medium">
                                    {formatTime(checkInStatus.checkedInAt)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Text className="text-gray-600 text-sm">Duration</Text>
                                <Text className="text-gray-900 text-sm font-medium">
                                    {formatDuration(checkInStatus.checkedInAt)}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Instructions */}
                {!checkedIn && !alertReceived && (
                    <View className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <Text className="text-blue-900 font-semibold mb-2">
                            📋 How it works
                        </Text>
                        <Text className="text-blue-700 text-sm leading-5">
                            1. Tap the button to check in{'\n'}
                            2. Keep Bluetooth enabled{'\n'}
                            3. Wait for the teacher's roll call{'\n'}
                            4. Your device will beep when verified
                        </Text>
                    </View>
                )}

                {checkedIn && !alertReceived && (
                    <View className="mt-6 bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                        <Text className="text-yellow-900 font-semibold mb-2">
                            ⚠️ Important
                        </Text>
                        <Text className="text-yellow-700 text-sm leading-5">
                            • Keep this app open{'\n'}
                            • Keep Bluetooth enabled{'\n'}
                            • Stay in the classroom{'\n'}
                            • Wait for the roll call alert
                        </Text>
                    </View>
                )}

                {alertReceived && (
                    <View className="mt-6 bg-green-50 rounded-xl p-4 border border-green-200">
                        <Text className="text-green-900 font-semibold mb-2">
                            ✅ Success!
                        </Text>
                        <Text className="text-green-700 text-sm">
                            Your attendance has been verified. You can now check out or keep the app open.
                        </Text>
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
                        <View className="flex-row gap-4 mt-2">
                            <View>
                                <Text className="text-gray-400 text-xs">Status</Text>
                                <Text className={`text-xs font-medium ${checkedIn ? 'text-green-400' : 'text-gray-400'
                                    }`}>
                                    {checkedIn ? 'Advertising' : 'Idle'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-gray-400 text-xs">BLE</Text>
                                <Text className={`text-xs font-medium ${bluetoothEnabled ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {bluetoothEnabled ? 'ON' : 'OFF'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-gray-400 text-xs">Alert</Text>
                                <Text className={`text-xs font-medium ${alertReceived ? 'text-green-400' : 'text-gray-400'
                                    }`}>
                                    {alertReceived ? 'Received' : 'Waiting'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <ScrollView className="flex-1 p-3">
                        {debugLogs.length === 0 ? (
                            <Text className="text-gray-500 text-xs text-center py-4">
                                No logs yet
                            </Text>
                        ) : (
                            debugLogs.map((log, index) => (
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
                            ))
                        )}
                    </ScrollView>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

export default BleStudentView;
