export enum Department {
    CSE = "CSE",
    ECE = "ECE",
    ME = "ME",
    CE = "CE",
    EE = "EE",
    IT = "IT",
    // Add other departments as needed
}

export enum Year {
    FIRST = "FIRST",
    SECOND = "SECOND",
    THIRD = "THIRD",
    FOURTH = "FOURTH",
}

export interface Class {
    id: number;
    department: Department;
    year: Year;
    subject: string;
    teacher_id: number;
    teacher?: User | null;
    
    // Relations
    students?: User[];
    attendances?: Attendance[];
    
    // Timestamps
    created_at: Date;
    updated_at: Date;
}

export interface LiveAttendanceResponse {
    id: number;
    live_id: string;
    start_time: Date;
    class: Class;
    already_marked: boolean;
    attendance_record: AttendanceRecord | null;
}

export interface Attendance {
    id: number;
    class_id: number;
    class?: Class;
    live_id: string;
    start_time: Date;
    end_time?: Date | null;
    
    // Relations
    attendance_records?: AttendanceRecord[];
    
    // Timestamps
    created_at: Date;
    updated_at: Date;
}

export interface AttendanceRecord {
    id: number;
    attendance_id: number;
    attendance?: Attendance;
    student_id: number;
    student?: User;
    is_present: boolean;
    marked_manually: boolean;
    
    // Timestamps
    created_at: Date;
    updated_at: Date;
}

// Import User type
import type { User } from "./user";
