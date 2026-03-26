import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import ExpoBleCore, { BleConstants } from 'modules/expo-ble-core';
import { 
    onStudentDiscovered, 
    onAlertProgress, 
    onBluetoothStateChanged 
} from '~/modules/expo-ble-core/src/ExpoBleCoreModule';
import type { EventSubscription } from 'expo-modules-core';

export interface Student {
    rollno: number;
    name: string;
    deviceAddress: string;
    rssi: number;
    discoveredAt: number;
    verified: boolean;
    verifiedAt: number | null;
}

interface UseTeacherAttendanceProps {
    classPrefix: string;
    onStudentFound?: (student: Student) => void;
    onAlertComplete?: (success: number, failed: number) => void;
}

export function useTeacherAttendance({
    classPrefix,
    onStudentFound,
    onAlertComplete,
}: UseTeacherAttendanceProps) {
    // State
    const [scanning, setScanning] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [alertProgress, setAlertProgress] = useState({ current: 0, total: 0 });
    const [isAlerting, setIsAlerting] = useState(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
    const [verifyingAddress, setVerifyingAddress] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const verificationCancelledRef = useRef(false);
    const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const subscriptions = useRef<EventSubscription[]>([]);

    // Setup event listeners
    useEffect(() => {
        const studentSub = onStudentDiscovered((event) => {
            if (event.error) {
                return;
            }

            const studentLabel = event.studentId.toString();

            // Filter by class prefix
            if (!studentLabel.startsWith(classPrefix)) {
                return;
            }

            const roll = parseInt(studentLabel.replace(classPrefix, ''));

            setStudents(prev => {
                const exists = prev.find(s => s.rollno === roll);
                if (exists) {
                    return prev;
                }

                const newStudent: Student = {
                    rollno: roll,
                    name: studentLabel,
                    deviceAddress: event.deviceAddress,
                    rssi: event.rssi,
                    discoveredAt: Date.now(),
                    verified: false,
                    verifiedAt: null
                };

                onStudentFound?.(newStudent);
                return [...prev, newStudent];
            });
        });

        const progressSub = onAlertProgress((event) => {
            setAlertProgress({ current: event.current, total: event.total });

            if (event.status === 'success') {
                setStudents(prev => prev.map(s =>
                    s.deviceAddress === event.deviceAddress
                        ? { ...s, verified: true, verifiedAt: Date.now() }
                        : s
                ));
            }
        });

        const bluetoothSub = onBluetoothStateChanged((event) => {
            setBluetoothEnabled(event.enabled);
        });

        subscriptions.current = [studentSub, progressSub, bluetoothSub];
        ExpoBleCore.startBluetoothStateListener();

        return () => {
            subscriptions.current.forEach(sub => sub.remove());
            ExpoBleCore.stopBluetoothStateListener();
        };
    }, [classPrefix, onStudentFound]);

    // Request permissions
    const requestPermissions = useCallback(async () => {
        const hasPerms = ExpoBleCore.hasPermissions();
        if (hasPerms) {
            return true;
        }

        const granted = await ExpoBleCore.requestPermissions();
        if (!granted) {
            Alert.alert('Permissions Required', 'Please enable Bluetooth permissions');
            return false;
        }
        return true;
    }, []);

    // Start scanning
    const startScanning = useCallback(async () => {
        const hasPerms = await requestPermissions();
        if (!hasPerms) return { success: false, error: 'Permissions denied' };

        if (!ExpoBleCore.isBluetoothEnabled()) {
            Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan');
            await ExpoBleCore.requestEnableBluetooth();
            return { success: false, error: 'Bluetooth disabled' };
        }

        ExpoBleCore.clearDiscoveredStudents();
        setStudents([]);

        const result = await ExpoBleCore.startStudentScan(classPrefix);
        if (result.success) {
            setScanning(true);
        } else {
            Alert.alert('Scan Failed', result.error);
        }
        return result;
    }, [classPrefix, requestPermissions]);

    // Stop scanning
    const stopScanning = useCallback(() => {
        const result = ExpoBleCore.stopStudentScan();
        if (result.success) {
            setScanning(false);
        }
        return result;
    }, []);

    // Send alerts to all students
    const sendAlerts = useCallback(async () => {
        if (students.length === 0) {
            Alert.alert('No Students', 'No students discovered yet');
            return { success: 0, failed: 0 };
        }

        setIsAlerting(true);

        const addresses = students.map(s => s.deviceAddress);
        const result = await ExpoBleCore.sendAlertToAll(
            addresses,
            BleConstants.ALERT_TYPE_BEEP,
            2000
        );

        setIsAlerting(false);
        onAlertComplete?.(result.success, result.failed);

        return result;
    }, [students, onAlertComplete]);

    // Send alert to a single student
    const sendAlertToOne = useCallback(async (deviceAddress: string) => {
        const result = await ExpoBleCore.sendAlertToStudent(
            deviceAddress,
            BleConstants.ALERT_TYPE_BEEP
        );
        return result;
    }, []);

    // Sequentially verify present students one by one
    const verifyStudentsSequentially = useCallback(async (
        studentsToVerify: Array<{ rollno: number; deviceAddress: string }>
    ) => {
        setIsVerifying(true);
        verificationCancelledRef.current = false;

        for (const student of studentsToVerify) {
            if (verificationCancelledRef.current) break;

            setVerifyingAddress(student.deviceAddress);
            await sendAlertToOne(student.deviceAddress);

            if (verificationCancelledRef.current) break;

            // Pause between students so teacher can observe
            await new Promise<void>(resolve => {
                verificationTimeoutRef.current = setTimeout(() => {
                    verificationTimeoutRef.current = null;
                    resolve();
                }, 1500);
            });
        }

        setVerifyingAddress(null);
        setIsVerifying(false);
    }, [sendAlertToOne]);

    // Cancel ongoing verification
    const cancelVerification = useCallback(() => {
        verificationCancelledRef.current = true;
        if (verificationTimeoutRef.current) {
            clearTimeout(verificationTimeoutRef.current);
            verificationTimeoutRef.current = null;
        }
        setVerifyingAddress(null);
        setIsVerifying(false);
    }, []);

    // Cleanup verification on unmount
    useEffect(() => {
        return () => {
            verificationCancelledRef.current = true;
            if (verificationTimeoutRef.current) {
                clearTimeout(verificationTimeoutRef.current);
                verificationTimeoutRef.current = null;
            }
        };
    }, []);

    // Get attendance report
    const getAttendanceReport = useCallback(() => {
        const report = ExpoBleCore.getDiscoveredStudents();
        const total = report.length;
        const verified = report.filter(s => s.verified).length;

        return {
            total,
            verified,
            unverified: total - verified
        };
    }, []);

    // Check if Bluetooth is enabled
    const isBluetoothEnabled = useCallback(() => {
        return ExpoBleCore.isBluetoothEnabled();
    }, []);

    // Clear all discovered students
    const clearStudents = useCallback(() => {
        ExpoBleCore.clearDiscoveredStudents();
        setStudents([]);
    }, []);

    return {
        // State
        scanning,
        students,
        alertProgress,
        isAlerting,
        bluetoothEnabled,
        verifyingAddress,
        isVerifying,

        // Functions
        requestPermissions,
        startScanning,
        stopScanning,
        sendAlerts,
        sendAlertToOne,
        verifyStudentsSequentially,
        cancelVerification,
        getAttendanceReport,
        isBluetoothEnabled,
        clearStudents,
    };
}
