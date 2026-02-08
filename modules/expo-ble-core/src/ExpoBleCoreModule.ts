import { NativeModule, requireNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';

import { ExpoBleCoreModuleType } from './ExpoBleCore.types';

// ============== EVENT TYPES ==============
export type BleModuleEvents = {
  onStudentDiscovered(params: {
    studentId: number;
    deviceAddress: string;
    rssi: number;
    classId: string;
    error?: boolean;
    errorCode?: number;
  }): void;

  onAlertProgress(params: {
    current: number;
    total: number;
    deviceAddress: string;
    status: 'connecting' | 'success' | 'failed';
  }): void;

  onAlertReceived(params: { alertType: number; timestamp: number }): void;

  onBluetoothStateChanged(params: { enabled: boolean }): void;
};

// ============== MODULE DECLARATION ==============
declare class ExpoBleCoreModule extends NativeModule<BleModuleEvents> {
  // ============== CORE FUNCTIONS ==============
  hello(): string;
  hasPermissions(): boolean;
  requestPermissions(): Promise<boolean>;
  isBluetoothEnabled(): boolean;
  requestEnableBluetooth(): Promise<boolean>;
  isBleAdvertisingSupported(): boolean;
  startBluetoothStateListener(): boolean;
  stopBluetoothStateListener(): boolean;

  // ============== TEACHER FUNCTIONS ==============
  startStudentScan(classId: string): Promise<{ success: boolean; error?: string }>;
  stopStudentScan(): { success: boolean; error?: string };
  isScanning(): boolean;
  getDiscoveredStudents(): Array<{
    studentId: number;
    deviceAddress: string;
    rssi: number;
    discoveredAt: number;
    verified: boolean;
    verifiedAt: number | null;
  }>;
  clearDiscoveredStudents(): boolean;
  sendAlertToStudent(
    deviceAddress: string,
    alertType: number
  ): Promise<{ success: boolean; error?: string }>;
  sendAlertToAll(
    studentAddresses: string[],
    alertType: number,
    delayMs: number
  ): Promise<{
    success: number;
    failed: number;
    cancelled: boolean;
    results: Array<{ deviceAddress: string; success: boolean; error: string }>;
  }>;
  cancelAlertRollout(): { success: boolean; error?: string };
  isAlertRolloutActive(): boolean;
  markStudentVerified(studentId: number): boolean;
  getAttendanceReport(): Array<{
    studentId: number;
    deviceAddress: string;
    status: 'present' | 'unverified';
    discoveredAt: number;
    verifiedAt: number | null;
  }>;

  // ============== STUDENT FUNCTIONS ==============
  checkIn(
    // classId: string,
    // studentId: number
    combinedId: string
  ): Promise<{ success: boolean; error?: string }>;
  checkOut(): { success: boolean; error?: string };
  isCheckedIn(): boolean;
  getCheckInStatus(): {
    classId: string;
    studentId: number;
    checkedInAt: number;
  } | null;

  // ============== LEGACY ==============
  startAdvertising(): string;
  stopAdvertising(): string;
}

// This call loads the native module object from the JSI.
const BleModule = requireNativeModule<ExpoBleCoreModule>('ExpoBleCore');

// ============== EVENT LISTENER HELPERS ==============

/**
 * Subscribe to student discovered events (Teacher)
 * Fired when a new student is found during scanning
 */
export function addStudentDiscoveredListener(
  listener: (event: {
    studentId: number;
    deviceAddress: string;
    rssi: number;
    classId: string;
    error?: boolean;
    errorCode?: number;
  }) => void
): EventSubscription {
  return BleModule.addListener('onStudentDiscovered', listener);
}

/**
 * Subscribe to alert progress events (Teacher)
 * Fired during sequential alert rollout to track progress
 */
export function addAlertProgressListener(
  listener: (event: {
    current: number;
    total: number;
    deviceAddress: string;
    status: 'connecting' | 'success' | 'failed';
  }) => void
): EventSubscription {
  return BleModule.addListener('onAlertProgress', listener);
}

/**
 * Subscribe to alert received events (Student)
 * Fired when professor sends an alert to this device
 */
export function addAlertReceivedListener(
  listener: (event: { alertType: number; timestamp: number }) => void
): EventSubscription {
  return BleModule.addListener('onAlertReceived', listener);
}

/**
 * Subscribe to Bluetooth state changes
 * Fired when Bluetooth is turned on/off
 */
export function addBluetoothStateChangedListener(
  listener: (event: { enabled: boolean }) => void
): EventSubscription {
  return BleModule.addListener('onBluetoothStateChanged', listener);
}

/**
 * Remove all event listeners
 */
export function removeAllListeners(): void {
  BleModule.removeAllListeners('onStudentDiscovered');
  BleModule.removeAllListeners('onAlertProgress');
  BleModule.removeAllListeners('onAlertReceived');
  BleModule.removeAllListeners('onBluetoothStateChanged');
}

// ============== EXPORT MODULE + HELPERS ==============
export default BleModule;

export {
  addStudentDiscoveredListener as onStudentDiscovered,
  addAlertProgressListener as onAlertProgress,
  addAlertReceivedListener as onAlertReceived,
  addBluetoothStateChangedListener as onBluetoothStateChanged,
};

// ============== CONSTANTS EXPORT ==============
export { BleConstants } from './ExpoBleCore.types';

// ============== TYPE EXPORTS ==============
export type {
  ExpoBleCoreModuleType,
  StudentInfo,
  AttendanceStatus,
  AttendanceRecord,
  AlertResult,
  CheckInStatus,
} from './ExpoBleCore.types';
