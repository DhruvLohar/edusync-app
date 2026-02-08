export enum UserType {
    student = "student",
    teacher = "teacher",
}

export enum Department {
    CSE = "CSE",
    AIDS = "AIDS",
    MECH = "MECH",
    EEE = "EEE",
    IT = "IT",
}

export const DEPARTMENTS = {
    CSE: "Computer Science",
    AIDS: "AI/DS",
    MECH: "Mechanical",
    EEE: "Electronics",
    IT: "Information Technology",
} as const;

export const YEARS = {
    FE: "First Year",
    SE: "Second Year",
    TE: "Third Year",
    BE: "Final Year",
} as const;

export enum Year {
    FE = "FE",
    SE = "SE",
    TE = "TE",
    BE = "BE",
}

export interface User {
    id: number;

    // Personal Details
    profile_photo?: string | null;
    name?: string | null;
    email: string;
    phone?: string | null;
    user_type: UserType;

    // college specific
    employee_id?: string | null;
    gr_no?: string | null;
    department?: Department | null;
    year?: Year | null;

    // metadata
    is_active: boolean;
    onboarding_done: boolean;
    access_token?: string | null;
    last_login?: Date | null;
    generated_otp?: number | null;
    otp_generated_at?: Date | null;

    // Relations (use proper types when available)
    classes?: any[];
    taught_classes?: any[];
    attendance_records?: any[];

    // time stamps
    created_at: Date;
    updated_at: Date;
}