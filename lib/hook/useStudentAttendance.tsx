import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Vibration } from 'react-native';
import ExpoBleCore, { BleConstants } from 'modules/expo-ble-core';
import { addAlertReceivedListener, addBluetoothStateChangedListener } from '~/modules/expo-ble-core/src/ExpoBleCoreModule';
import type { EventSubscription } from 'expo-modules-core';

interface CheckInStatusData {
    classId: string;
    studentId: number;
    checkedInAt: number;
}

interface UseStudentAttendanceProps {
    onAlertReceived?: () => void;
    onCheckInSuccess?: () => void;
    onCheckOutSuccess?: () => void;
}

export function useStudentAttendance({
    onAlertReceived,
    onCheckInSuccess,
    onCheckOutSuccess,
}: UseStudentAttendanceProps) {
    // State
    const [checkedIn, setCheckedIn] = useState(false);
    const [checkInStatus, setCheckInStatus] = useState<CheckInStatusData | null>(null);
    const [alertReceived, setAlertReceived] = useState(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const subscriptions = useRef<EventSubscription[]>([]);


    // Request Bluetooth permissions
    const requestPermissions = useCallback(async () => {
        try {
            const hasPerms = await ExpoBleCore.requestPermissions();
            if (!hasPerms) {
                Alert.alert('Permission Required', 'Bluetooth permissions are needed for attendance.');
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    }, []);

    // Request Bluetooth enable
    const requestEnableBluetooth = useCallback(async () => {
        try {
            if (!ExpoBleCore.isBluetoothEnabled()) {
                await ExpoBleCore.requestEnableBluetooth();
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    }, []);

    // Check if Bluetooth is enabled
    const isBluetoothEnabled = useCallback(() => {
        return ExpoBleCore.isBluetoothEnabled();
    }, []);

    // Handle check-in
    const handleCheckIn = useCallback(async (combinedId: string) => {
        // Validate ID length
        if (combinedId.length > 8) {
            Alert.alert(
                'ID Error',
                `Combined ID is too long. Max allowed: 8 characters. Current: ${combinedId.length}`
            );
            return { success: false, error: 'ID too long' };
        }

        // Request permissions
        const hasPerms = await requestPermissions();
        if (!hasPerms) {
            return { success: false, error: 'Permissions denied' };
        }

        // Check Bluetooth state
        const btEnabled = await requestEnableBluetooth();
        if (!btEnabled) {
            return { success: false, error: 'Bluetooth disabled' };
        }

        setIsProcessing(true);

        try {
            const result = await ExpoBleCore.checkIn(combinedId);

            if (result.success) {
                setCheckedIn(true);
                setCheckInStatus(ExpoBleCore.getCheckInStatus());
                onCheckInSuccess?.();
                return { success: true };
            } else {
                Alert.alert('Check-In Failed', result.error || 'Unknown error');
                return { success: false, error: result.error };
            }
        } catch (e) {
            const errorMsg = String(e);
            return { success: false, error: errorMsg };
        } finally {
            setIsProcessing(false);
        }
    }, [requestPermissions, requestEnableBluetooth, onCheckInSuccess]);

    // Handle check-out
    const handleCheckOut = useCallback(() => {
        try {
            ExpoBleCore.checkOut();
            setCheckedIn(false);
            setCheckInStatus(null);
            setAlertReceived(false);
            onCheckOutSuccess?.();
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }, [onCheckOutSuccess]);

    // Get current check-in status
    const getCheckInStatus = useCallback(() => {
        return ExpoBleCore.getCheckInStatus();
    }, []);

    // Initialize listeners and restore state
    useEffect(() => {

        // Alert Listener
        const alertSub = addAlertReceivedListener((event) => {
            setAlertReceived(true);

            if (
                event.alertType === BleConstants.ALERT_TYPE_VIBRATE ||
                event.alertType === BleConstants.ALERT_TYPE_BOTH
            ) {
                Vibration.vibrate([0, 500, 200, 500]);
            }

            Alert.alert('✅ Attendance Verified', 'Your attendance has been marked by the professor.');
            onAlertReceived?.();
        });

        // Bluetooth State Listener
        const btSub = addBluetoothStateChangedListener((event) => {
            setBluetoothEnabled(event.enabled);
        });

        subscriptions.current = [alertSub, btSub];
        ExpoBleCore.startBluetoothStateListener();

        // Restore State
        const status = ExpoBleCore.getCheckInStatus();
        if (status) {
            setCheckedIn(true);
            setCheckInStatus(status);
        }

        return () => {
            subscriptions.current.forEach((sub) => sub.remove());
            ExpoBleCore.stopBluetoothStateListener();
        };
    }, [onAlertReceived]);

    return {
        // State
        checkedIn,
        checkInStatus,
        alertReceived,
        bluetoothEnabled,
        isProcessing,

        // Functions
        handleCheckIn,
        handleCheckOut,
        requestPermissions,
        requestEnableBluetooth,
        isBluetoothEnabled,
        getCheckInStatus,
    };
}
