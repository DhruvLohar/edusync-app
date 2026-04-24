import { useQuery } from '@tanstack/react-query';
import { apiClient } from '~/lib/api';
import { queryKeys } from '~/lib/queryClient';
import type { AttendanceRecord } from '~/type/Student';
import type { Attendance } from '~/type/Teacher';

// --- QUERIES ---

export function useStudentHistory() {
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: queryKeys.student.history,
        queryFn: async () => {
            const res = await apiClient.get('/students/history');
            if (res.data?.success && Array.isArray(res.data.data?.records)) {
                return res.data.data.records as AttendanceRecord[];
            }
            return [] as AttendanceRecord[];
        },
        refetchInterval: 30_000,
        staleTime: 20_000,
    });

    return { data: data ?? [], isLoading, isRefetching, refetch };
}

export function useAttendanceDetails(classId: string) {
    const { data, isLoading } = useQuery({
        queryKey: queryKeys.attendance.details(classId),
        queryFn: async () => {
            const res = await apiClient.get(`teachers/attendance/${classId}`);
            return res.data?.success ? (res.data.data as Attendance) : null;
        },
        enabled: !!classId,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
    });

    return { data: data ?? null, isLoading };
}
