import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '~/lib/api';
import { queryKeys } from '~/lib/queryClient';
import type { TeacherClass } from '~/app/private/(teacher)/(tabs)';

interface ClassAttendance {
    id: string;
    name: string;
    department: string;
    time: string;
    date: string;
    presentCount: number;
    totalCapacity: number;
    progress: number;
}

interface StartAttendancePayload {
    class_id: number;
    division: 'A' | 'B';
    lecture_time: string;
}

interface StartAttendanceResult {
    id: number;
    live_id: string;
}

// --- QUERIES ---

export function useTeacherClasses() {
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: queryKeys.teacher.classes,
        queryFn: async () => {
            const res = await apiClient.get('teachers/fetch-classes');
            return res.data?.success ? (res.data.data as TeacherClass[]) : ([] as TeacherClass[]);
        },
        staleTime: 60_000, // classes list doesn't change often
    });

    return { data: data ?? [], isLoading, isRefetching, refetch };
}

export function useTeacherHistory() {
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: queryKeys.teacher.history,
        queryFn: async () => {
            const res = await apiClient.get('/teachers/history');
            if (!res.data?.success || !Array.isArray(res.data.data)) return [] as ClassAttendance[];

            return res.data.data.map((attendance: any): ClassAttendance => {
                const classInfo = attendance.class || {};
                const presentCount = attendance.summary?.total_present || 0;
                const totalCapacity = attendance.summary?.total_students || 0;
                const progress = totalCapacity > 0 ? presentCount / totalCapacity : 0;
                const start = attendance.start_time ? new Date(attendance.start_time) : null;
                const end = attendance.end_time ? new Date(attendance.end_time) : null;
                const time =
                    start && end
                        ? `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : '';
                const date = start ? start.toLocaleDateString() : '';
                return {
                    id: attendance.id.toString(),
                    name: classInfo.subject || '',
                    department: classInfo.department || '',
                    time,
                    date,
                    presentCount,
                    totalCapacity,
                    progress,
                };
            });
        },
        staleTime: 60_000,
    });

    return { data: data ?? [], isLoading, isRefetching, refetch };
}

// Re-export shared profile hook
export { useProfile } from './useStudent';

// --- MUTATIONS ---

export function useStartAttendance() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (payload: StartAttendancePayload) => {
            const res = await apiClient.post('teachers/start-attendance', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.teacher.classes });
        },
    });

    const startAttendance = useCallback(
        (payload: StartAttendancePayload) => mutateAsync(payload),
        [mutateAsync]
    );

    return { startAttendance, isPending };
}
