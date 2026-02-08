export type ExpoBleCoreModuleType = {
  // ============== CORE FUNCTIONS ==============
  hello(): string;

  hasPermissions(): boolean;

  requestPermissions(): Promise<boolean>;

  isBluetoothEnabled(): boolean;

  requestEnableBluetooth(): Promise<boolean>;

  isBleAdvertisingSupported(): boolean;

  startBluetoothStateListener(): boolean;

  stopBluetoothStateListener(): boolean;

  // ============== TEACHER FUNCTIONS (BleBeacon) ==============

  startStudentScan(classId: string): Promise<{
    success: boolean;
    error?: string;
  }>;

  stopStudentScan(): {
    success: boolean;
    error?: string;
  };

  isScanning(): boolean;

  getDiscoveredStudents(): {
    studentId: number;
    deviceAddress: string;
    rssi: number;
    discoveredAt: number;
    verified: boolean;
    verifiedAt: number | null;
  }[];

  clearDiscoveredStudents(): boolean;

  sendAlertToStudent(
    deviceAddress: string,
    alertType: number
  ): Promise<{
    success: boolean;
    error?: string;
  }>;

  sendAlertToAll(
    studentAddresses: string[],
    alertType: number,
    delayMs: number
  ): Promise<{
    success: number;
    failed: number;
    cancelled: boolean;
    results: {
      deviceAddress: string;
      success: boolean;
      error: string;
    }[];
  }>;

  cancelAlertRollout(): {
    success: boolean;
    error?: string;
  };

  isAlertRolloutActive(): boolean;

  markStudentVerified(studentId: number): boolean;

  getAttendanceReport(): {
    studentId: number;
    deviceAddress: string;
    status: 'present' | 'unverified';
    discoveredAt: number;
    verifiedAt: number | null;
  }[];

  // ============== STUDENT FUNCTIONS (BleAttendee) ==============

  checkIn(
    classId: string,
    studentId: number
  ): Promise<{
    success: boolean;
    error?: string;
  }>;

  checkOut(): {
    success: boolean;
    error?: string;
  };

  isCheckedIn(): boolean;

  getCheckInStatus(): {
    classId: string;
    studentId: number;
    checkedInAt: number;
  } | null;

  // ============== LEGACY (for backward compatibility) ==============

  startAdvertising(): string;

  stopAdvertising(): string;
};

// ============== EVENT TYPES ==============

export type BleEventMap = {
  onStudentDiscovered: {
    studentId: number;
    deviceAddress: string;
    rssi: number;
    classId: string;
    error?: boolean;
    errorCode?: number;
  };

  onAlertProgress: {
    current: number;
    total: number;
    deviceAddress: string;
    status: 'connecting' | 'success' | 'failed';
  };

  onAlertReceived: {
    alertType: number;
    timestamp: number;
  };

  onBluetoothStateChanged: {
    enabled: boolean;
  };
};

// ============== CONSTANTS ==============

export const BleConstants = {
  // Alert Types
  ALERT_TYPE_BEEP: 1,
  ALERT_TYPE_VIBRATE: 2,
  ALERT_TYPE_BOTH: 3,

  // Service & Characteristic UUIDs
  ATTENDANCE_SERVICE_UUID: '0c287abd-eb75-4dd3-afc6-b3f3368307fa',
  ALERT_CHARACTERISTIC_UUID: '0c287abd-eb75-4dd3-afc6-b3f3368307fb',

  // Timeouts
  CONNECTION_TIMEOUT_MS: 10000,
  DEFAULT_ALERT_DELAY_MS: 2000,

  // Manufacturer ID
  MANUFACTURER_ID: 0xffff,
} as const;

// ============== HELPER TYPES ==============

export type StudentInfo = {
  studentId: number;
  deviceAddress: string;
  rssi: number;
  discoveredAt: number;
  verified: boolean;
  verifiedAt: number | null;
};

export type AttendanceStatus = 'present' | 'unverified' | 'absent';

export type AttendanceRecord = {
  studentId: number;
  deviceAddress: string;
  status: AttendanceStatus;
  discoveredAt: number;
  verifiedAt?: number;
};

export type AlertResult = {
  deviceAddress: string;
  success: boolean;
  error?: string;
};

export type CheckInStatus = {
  classId: string;
  studentId: number;
  checkedInAt: number;
};
