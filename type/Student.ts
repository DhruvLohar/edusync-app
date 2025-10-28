import type { User, Department, Year } from './user';

export interface Student extends User {
    gr_no?: string | null;
    department?: Department | null;
    year?: Year | null;
    classes?: any[]; // You can replace 'any' with a Class[] type if defined
    attendance_records?: AttendanceRecord[];
}

export interface AttendanceRecord {
    id: number;
    attendance_id: number;
    is_present: boolean;
    marked_manually: boolean;
    marked_at: string | Date;
    class: {
        id: number;
        department: Department;
        year: Year;
        subject: string;
    };
    session: {
        start_time: string | Date;
        end_time?: string | Date | null;
    };
}
