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
    Vibration,
    Platform
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
    type: 'info' | 'success' | 'error' | 'warning';
}

interface CheckInStatusData {
    classId: string;
    studentId: number;
    checkedInAt: number;
}

// ==========================================
// 1. UPDATED PACKET CALCULATOR (Split Logic)
// ==========================================
function calculateBLEPacketSize(classId: string, studentId: number) {
    // Payload Structure: [ClassID Bytes] + "_" (1 byte) + [StudentID (4 bytes)]
    const classIdBytes = new TextEncoder().encode(classId).length;
    const separatorBytes = 1; 
    const studentIdBytes = 4; 
    
    const payloadSize = classIdBytes + separatorBytes + studentIdBytes;

    // Android Legacy Advertising Limit: 31 Bytes
    // Mandatory Overhead:
    // - Flags: 3 bytes
    // - Manufacturer Header: 4 bytes
    // Total Overhead = 7 bytes
    const overhead = 7;
    
    // Available Space for Payload = 31 - 7 = 24 bytes
    const maxPayloadSize = 31 - overhead;

    return {
        payloadSize,
        maxPayloadSize,
        withinLimit: payloadSize <= maxPayloadSize,
        // Max chars for Class ID = 24 - 1 (separator) - 4 (studentId) = 19 chars
        maxClassIdLength: maxPayloadSize - separatorBytes - studentIdBytes 
    };
}

function BleStudentView() {
    const router = useRouter();
    const [checkedIn, setCheckedIn] = useState(false);
    const [checkInStatus, setCheckInStatus] = useState<CheckInStatusData | null>(null);
    const [alertReceived, setAlertReceived] = useState(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Debug state
    const [debugExpanded, setDebugExpanded] = useState(true);
    const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
    const debugHeight = useRef(new Animated.Value(300)).current; // Start expanded
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const subscriptions = useRef<EventSubscription[]>([]);

    // ==========================================
    // 2. CONFIGURATION - Simple Combined ID
    // ==========================================
    const classYear = "BEA"; 
    const rollNumber = "848";
    const combinedId = `${classYear}${rollNumber}`; // "BEA848"

    const addDebugLog = useCallback((message: string, type: DebugLog['type'] = 'info') => {
        setDebugLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev.slice(0, 99)]);
    }, []);

    const toggleDebug = useCallback(() => {
        setDebugExpanded(prev => {
            const newState = !prev;
            Animated.timing(debugHeight, { 
                toValue: newState ? 300 : 0, 
                duration: 300, 
                useNativeDriver: false 
            }).start();
            return newState;
        });
    }, [debugHeight]);

    // Format timestamp for logs
    const formatTime = (ms: number) => {
        const d = new Date(ms);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    };

    // Animation Effect
    useEffect(() => {
        if (checkedIn && !alertReceived) {
            Animated.loop(Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [checkedIn, alertReceived]);

    // Initialization & Listeners
    useEffect(() => {
        // Log combined ID on mount
        addDebugLog(`Combined ID: "${combinedId}" (${combinedId.length} chars)`, 'info');
        
        if (combinedId.length > 8) {
            addDebugLog(`⚠️ ID too long! Max length: 8 chars`, 'warning');
        }

        // Alert Listener
        const alertSub = addAlertReceivedListener((event) => {
            addDebugLog(`🔔 Alert Received: Type ${event.alertType}`, 'success');
            setAlertReceived(true);
            if (event.alertType === BleConstants.ALERT_TYPE_VIBRATE || event.alertType === BleConstants.ALERT_TYPE_BOTH) {
                Vibration.vibrate([0, 500, 200, 500]);
            }
            Alert.alert('✅ Attendance Verified', 'Your attendance has been marked by the professor.');
        });

        // Bluetooth State Listener
        const btSub = addBluetoothStateChangedListener((event) => {
            setBluetoothEnabled(event.enabled);
            addDebugLog(`Bluetooth is now ${event.enabled ? 'ON' : 'OFF'}`, event.enabled ? 'success' : 'error');
        });

        subscriptions.current = [alertSub, btSub];
        ExpoBleCore.startBluetoothStateListener();

        // Restore State
        const status = ExpoBleCore.getCheckInStatus();
        if (status) {
            setCheckedIn(true);
            setCheckInStatus(status);
            addDebugLog('Session restored: You are checked in.', 'success');
        }

        return () => {
            subscriptions.current.forEach(sub => sub.remove());
            ExpoBleCore.stopBluetoothStateListener();
        };
    }, []);

    const handleCheckIn = useCallback(async () => {
        // Check ID length limit (Kotlin validation)
        if (combinedId.length > 8) {
            Alert.alert("ID Error", `Combined ID is too long. Max allowed: 8 characters. Current: ${combinedId.length}`);
            return;
        }

        const hasPerms = await ExpoBleCore.requestPermissions();
        if (!hasPerms) { 
            addDebugLog("❌ Bluetooth permissions denied", 'error');
            Alert.alert("Permission Required", "Bluetooth permissions are needed for attendance."); 
            return; 
        }
        
        if (!ExpoBleCore.isBluetoothEnabled()) {
             addDebugLog("❌ Bluetooth is disabled", 'error');
             await ExpoBleCore.requestEnableBluetooth();
             return;
        }

        setIsProcessing(true);
        addDebugLog(`Checking in as: ${combinedId}`, 'info');
        
        try {
            // Pass simple string to match Kotlin logic
            const result = await ExpoBleCore.checkIn(combinedId);
            
            if (result.success) {
                addDebugLog('✅ Signal Active! Keep app open.', 'success');
                setCheckedIn(true);
                setCheckInStatus(ExpoBleCore.getCheckInStatus());
            } else {
                addDebugLog(`Error: ${result.error}`, 'error');
                Alert.alert("Check-In Failed", result.error || "Unknown error");
            }
        } catch (e) {
            addDebugLog(`Exception: ${e}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    }, [combinedId]);

    const handleCheckOut = useCallback(() => {
        ExpoBleCore.checkOut();
        setCheckedIn(false);
        setCheckInStatus(null);
        setAlertReceived(false);
        addDebugLog('Checked out successfully.', 'info');
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />
            
            <View className="flex-1 items-center justify-center p-6">
                
                {/* Status Header */}
                <View className="mb-10 items-center">
                    <Text className="text-2xl font-bold text-gray-800 mb-2">
                        {checkedIn ? "You are Checked In" : "Not Checked In"}
                    </Text>
                    <Text className="text-gray-500 text-center">
                        {checkedIn 
                            ? "Keep the app open until you receive the verification alert." 
                            : `Combined ID: ${combinedId}\nClass: ${classYear} | Roll: ${rollNumber}`}
                    </Text>
                </View>

                {/* Main Action Button */}
                <View className="items-center mb-10">
                    <Animated.View style={{ transform: [{ scale: checkedIn && !alertReceived ? pulseAnim : 1 }] }}>
                        <Pressable
                            onPress={checkedIn ? handleCheckOut : handleCheckIn}
                            disabled={isProcessing}
                            className={`h-48 w-48 rounded-full items-center justify-center shadow-xl border-4 ${
                                alertReceived ? 'bg-green-500 border-green-600' :
                                checkedIn ? 'bg-yellow-400 border-yellow-500' :
                                'bg-blue-500 border-blue-600'
                            } ${isProcessing ? 'opacity-80' : ''}`}
                        >
                            <Text className="text-white text-6xl mb-2 shadow-sm">
                                {alertReceived ? '✅' : checkedIn ? '📡' : '👆'}
                            </Text>
                            <Text className="text-white text-xl font-bold shadow-sm uppercase tracking-wider">
                                {isProcessing ? '...' : checkedIn ? 'Check Out' : 'Check In'}
                            </Text>
                        </Pressable>
                    </Animated.View>
                    
                    {checkedIn && !alertReceived && (
                        <Text className="mt-6 text-yellow-600 font-medium animate-pulse">
                            Broadcasting signal...
                        </Text>
                    )}
                </View>

            </View>

            {/* Debug Console (Collapsible) */}
            <View className="bg-gray-900 border-t border-gray-800">
                 <Pressable onPress={toggleDebug} className="p-3 flex-row justify-between items-center bg-gray-800">
                    <Text className="text-white font-mono text-xs font-bold">
                        CONSOLE LOGS ({debugLogs.length})
                    </Text>
                    <Text className="text-gray-400 text-xs">
                        {debugExpanded ? '▼ Collapse' : '▲ Expand'}
                    </Text>
                 </Pressable>
                 
                 <Animated.View style={{ height: debugHeight }} className="w-full">
                    <ScrollView className="p-3" nestedScrollEnabled>
                        {debugLogs.length === 0 ? (
                            <Text className="text-gray-600 text-xs italic">No logs yet...</Text>
                        ) : (
                            debugLogs.map((log, i) => (
                                <View key={i} className="mb-2 flex-row">
                                    <Text className="text-gray-500 text-[10px] font-mono mr-2 mt-0.5">
                                        {formatTime(log.timestamp)}
                                    </Text>
                                    <Text className={`text-xs font-mono flex-1 ${
                                        log.type === 'error' ? 'text-red-400 font-bold' : 
                                        log.type === 'success' ? 'text-green-400 font-bold' : 
                                        log.type === 'warning' ? 'text-yellow-400' :
                                        'text-gray-300'
                                    }`}>
                                        {log.type === 'success' ? '✓ ' : log.type === 'error' ? '✗ ' : '> '} 
                                        {log.message}
                                    </Text>
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