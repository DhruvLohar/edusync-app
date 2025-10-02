export interface User {
    id: string; // maps to MongoDB ObjectId (_id)
    name: string;
    email: string;

    // Personal Details
    profile_photo?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    is_active: boolean;
    onboardingDone: boolean;
}