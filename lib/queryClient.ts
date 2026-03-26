import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2,      // 2 min — data considered fresh
            gcTime: 1000 * 60 * 10,         // 10 min — cache garbage collected after
            retry: 2,
            refetchOnWindowFocus: false,     // React Native has no window focus
        },
    },
});

export const queryKeys = {
    student: {
        history: ['student', 'attendance-history'] as const,
        liveAttendance: ['student', 'live-attendance'] as const,
    },
    teacher: {
        classes: ['teacher', 'classes'] as const,
        history: ['teacher', 'attendance-history'] as const,
    },
    attendance: {
        details: (id: string) => ['attendance', 'details', id] as const,
    },
    user: {
        profile: ['user', 'profile'] as const,
    },
};
