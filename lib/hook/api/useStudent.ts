import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '~/lib/api';
import { queryKeys } from '~/lib/queryClient';
import type { LiveAttendanceResponse } from '~/type/Teacher';
import type { User } from '~/type/user';

// --- QUERIES ---

export function useStudentLiveAttendance() {
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: queryKeys.student.liveAttendance,
        queryFn: async () => {
            const res = await apiClient.get('students/live-attendance');
            return res.data?.success ? (res.data.data as LiveAttendanceResponse) : null;
        },
        refetchInterval: 15_000,
        staleTime: 10_000,
    });

    return { data: data ?? null, isLoading, isRefetching, refetch };
}

export function useProfile() {
    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: queryKeys.user.profile,
        queryFn: async () => {
            const res = await apiClient.get('/users/profile');
            return res.data?.success ? (res.data.data as User) : null;
        },
        staleTime: 5 * 60 * 1000, // 5 min — profile rarely changes
    });

    return { data: data ?? null, isLoading, isRefetching, refetch };
}

// --- MUTATIONS ---

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await apiClient.post('/users/update-profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.user.profile });
        },
    });

    const updateProfile = useCallback(
        (formData: FormData) => mutateAsync(formData),
        [mutateAsync]
    );

    return { updateProfile, isPending };
}
