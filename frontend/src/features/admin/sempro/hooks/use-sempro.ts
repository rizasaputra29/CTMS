'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Period, Dosen, Location, Schedule, GroupItem } from '../types';
import type { ScheduleUpdatePayload } from '@/types/schedule';

const QUERY_KEY = ['admin', 'sempro'] as const;

// --- Fetch functions ---

async function fetchPeriods(): Promise<Period[]> {
    const res = await api.get('/admin/periods');
    return res.data?.data || [];
}

async function fetchDosens(): Promise<Dosen[]> {
    const res = await api.get('/admin/users?role=dosen');
    return res.data?.data || [];
}

async function fetchLocations(): Promise<Location[]> {
    const res = await api.get('/locations');
    return res.data?.data || [];
}

async function fetchSchedulesAndGroups(periodId?: string): Promise<{ schedules: Schedule[]; groups: GroupItem[] }> {
    const query = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
    const groupsQuery = periodId && periodId !== 'all' ? `?period_id=${periodId}&per_page=100` : '?per_page=100';
    const [schedulesRes, groupsRes] = await Promise.all([
        api.get(`/admin/sempro/schedules${query}`),
        api.get(`/admin/groups${groupsQuery}`),
    ]);
    return {
        schedules: schedulesRes.data?.data || [],
        groups: groupsRes.data?.data || [],
    };
}

// --- Hook ---

export function useSempro() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const hasInitializedPeriod = useRef(false);

    // Static data queries
    const periodsQuery = useQuery<Period[]>({
        queryKey: [...QUERY_KEY, 'periods'],
        queryFn: fetchPeriods,
    });

    const dosensQuery = useQuery<Dosen[]>({
        queryKey: [...QUERY_KEY, 'dosens'],
        queryFn: fetchDosens,
    });

    const locationsQuery = useQuery<Location[]>({
        queryKey: ['admin', 'locations'],
        queryFn: fetchLocations,
    });

    // Set active period on initial load from periods data
    useEffect(() => {
        if (periodsQuery.data && !hasInitializedPeriod.current) {
            hasInitializedPeriod.current = true;
            const active = periodsQuery.data.find((p) => p.is_active);
            setSelectedPeriod(active?.id.toString() || 'all');
        }
    }, [periodsQuery.data]);

    // Schedules + Groups query (depends on selectedPeriod)
    const schedulesAndGroupsQuery = useQuery({
        queryKey: [...QUERY_KEY, 'schedules', selectedPeriod],
        queryFn: () => fetchSchedulesAndGroups(selectedPeriod),
        enabled: selectedPeriod !== '',
    });

    // Derived data
    const schedules = schedulesAndGroupsQuery.data?.schedules || [];
    const groups = schedulesAndGroupsQuery.data?.groups || [];
    const periods = periodsQuery.data || [];
    const dosens = dosensQuery.data || [];
    const locations = locationsQuery.data || [];
    const isLoading = periodsQuery.isLoading || schedulesAndGroupsQuery.isLoading;

    // --- Mutations ---

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };

    const createMutation = useMutation({
        mutationFn: async (payload: {
            group_id: number;
            date: string;
            start_time: string;
            end_time: string;
            examiner_1_id: number;
            examiner_2_id: number;
            location_id?: number;
        }) => {
            await api.post('/admin/sempro/schedule', payload);
        },
        onSuccess: () => {
            invalidateAll();
        },
    });

    const approveMutation = useMutation({
        mutationFn: async ({
            id,
            payload,
        }: {
            id: number;
            payload: {
                date: string;
                start_time: string;
                end_time: string;
                examiner_1_id: number;
                examiner_2_id: number;
                location_id?: number;
            };
        }) => {
            await api.put(`/admin/sempro/schedules/${id}/approve`, payload);
        },
        onSuccess: () => {
            invalidateAll();
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
            await api.put(`/admin/sempro/schedules/${id}/reject`, {
                rejection_reason: reason,
            });
        },
        onSuccess: () => {
            invalidateAll();
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.put(`/admin/sempro/schedules/${id}/cancel`);
        },
        onSuccess: () => {
            invalidateAll();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({
            id,
            payload,
        }: {
            id: number;
            payload: ScheduleUpdatePayload;
        }) => {
            await api.put(`/admin/sempro/schedules/${id}`, payload);
        },
        onSuccess: () => {
            invalidateAll();
        },
    });

    // --- Wrapped mutation functions with toast feedback ---

    const createSchedule = async (data: {
        group_id: number;
        date: string;
        start_time: string;
        end_time: string;
        examiner_1_id: number;
        examiner_2_id: number;
        location_id?: number;
    }) => {
        await toast.promise(createMutation.mutateAsync(data), {
            loading: 'Creating schedule...',
            success: 'SEMPRO schedule created',
            error: (error) => {
                if (api.isAxiosError(error)) {
                    const msg = error.response?.data?.message || 'Scheduling failed';
                    const conflicts = error.response?.data?.conflicts;
                    return conflicts ? `${msg}\n${conflicts.join('\n')}` : msg;
                }
                return 'Scheduling failed';
            },
        });
    };

    const approveSchedule = async (
        id: number,
        payload: {
            date: string;
            start_time: string;
            end_time: string;
            examiner_1_id: number;
            examiner_2_id: number;
            location_id?: number;
        }
    ) => {
        await toast.promise(approveMutation.mutateAsync({ id, payload }), {
            loading: 'Approving schedule...',
            success: 'Schedule approved',
            error: (error) => {
                if (api.isAxiosError(error)) {
                    const msg = error.response?.data?.message || 'Approval failed';
                    const conflicts = error.response?.data?.conflicts;
                    return conflicts ? `${msg}\n${conflicts.join('\n')}` : msg;
                }
                return 'Approval failed';
            },
        });
    };

    const rejectSchedule = async (id: number, reason: string) => {
        await toast.promise(rejectMutation.mutateAsync({ id, reason }), {
            loading: 'Rejecting schedule...',
            success: 'Schedule request rejected',
            error: (error) =>
                api.getApiErrorMessage(error, 'Rejection failed'),
        });
    };

    const cancelSchedule = async (id: number) => {
        await toast.promise(cancelMutation.mutateAsync(id), {
            loading: 'Cancelling schedule...',
            success: 'Schedule deleted',
            error: (error) =>
                api.getApiErrorMessage(error, 'Failed to delete schedule'),
        });
    };

    const updateSchedule = async (id: number, payload: ScheduleUpdatePayload) => {
        await toast.promise(updateMutation.mutateAsync({ id, payload }), {
            loading: 'Updating schedule...',
            success: 'Schedule updated',
            error: (error) =>
                api.getApiErrorMessage(error, 'Update failed'),
        });
    };

    const isPending =
        createMutation.isPending ||
        updateMutation.isPending ||
        approveMutation.isPending ||
        rejectMutation.isPending ||
        cancelMutation.isPending;

    return {
        // Data
        schedules,
        groups,
        periods,
        dosens,
        locations,

        // Loading
        isLoading,

        // Period filter
        selectedPeriod,
        setSelectedPeriod,

        // Mutations
        createSchedule,
        approveSchedule,
        rejectSchedule,
        cancelSchedule,
        updateSchedule,
        isPending,
    };
}
