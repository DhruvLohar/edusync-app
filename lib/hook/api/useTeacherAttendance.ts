import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '~/lib/api';
import { queryKeys } from '~/lib/queryClient';

// Re-export shared attendance details query
export { useAttendanceDetails } from './useStudentAttendance';

interface AttendanceRecord {
    roll_no: string;
    status: 'present' | 'absent';
}

interface SubmitAttendancePayload {
    attendance_id: number;
    records: AttendanceRecord[];
}

interface EndAttendancePayload {
    attendance_id: number;
    ended_abnormally: boolean;
}

// --- MUTATIONS ---

export function useSubmitAttendance() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (payload: SubmitAttendancePayload) => {
            const res = await apiClient.post('teachers/submit-attendance', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.teacher.history });
            queryClient.invalidateQueries({ queryKey: queryKeys.teacher.classes });
        },
    });

    const submitAttendance = useCallback(
        (payload: SubmitAttendancePayload) => mutateAsync(payload),
        [mutateAsync]
    );

    return { submitAttendance, isPending };
}

export function useEndAttendance() {
    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (payload: EndAttendancePayload) => {
            const res = await apiClient.post('teachers/end-attendance', payload);
            return res.data;
        },
    });

    const endAttendance = useCallback(
        (payload: EndAttendancePayload) => mutateAsync(payload),
        [mutateAsync]
    );

    return { endAttendance, isPending };
}
