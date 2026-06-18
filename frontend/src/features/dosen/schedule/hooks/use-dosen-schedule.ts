'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { DosenScheduleGroup, DosenScheduleLocation, DosenScheduleEvent, DosenSchedulePeriod } from '../types';
import type { DosenScheduleFormData } from '@/lib/validations/schedule';

interface DosenSchedulePayload {
    group_id: string;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room?: string;
    mode?: string | null;
    notes?: string | null;
}

const fetchPeriods = async (): Promise<DosenSchedulePeriod[]> => {
    const res = await api.get('/periods-list');
    return res.data?.data || [];
};

const fetchLocations = async (): Promise<DosenScheduleLocation[]> => {
    const res = await api.get('/locations');
    return res.data?.data || [];
};

interface DosenScheduleData {
    schedules: DosenScheduleEvent[];
    groups: DosenScheduleGroup[];
}

const fetchData = async (periodId?: string): Promise<DosenScheduleData> => {
    const queryParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
    const [schedulesRes, groupsRes] = await Promise.all([
        api.get(`/dosen/all-schedules${queryParam}`),
        api.get(`/dosen/groups/supervised${queryParam}`),
    ]);
    return {
        schedules: schedulesRes.data?.data || [],
        groups: groupsRes.data?.data || [],
    };
};

export function useDosenSchedule(periodId?: string) {
    const queryClient = useQueryClient();

    const periodsQuery = useQuery({
        queryKey: ['periods-list'],
        queryFn: fetchPeriods,
    });

    const locationsQuery = useQuery({
        queryKey: ['dosen-schedule-locations'],
        queryFn: fetchLocations,
    });

    const dataQuery = useQuery({
        queryKey: ['dosen-schedule', periodId],
        queryFn: () => fetchData(periodId),
    });

    const saveMutation = useMutation({
        mutationFn: async ({ data, editingId }: { data: DosenScheduleFormData; editingId: number | null }) => {
            const payload: DosenSchedulePayload = {
                group_id: data.group_id,
                type: data.type,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
            };
            if (data.room) payload.room = data.room;
            if (data.type === 'BIMBINGAN' && data.mode) payload.mode = data.mode;
            if (data.notes) payload.notes = data.notes;

            if (editingId) {
                await api.put(`/schedules/${editingId}`, payload);
            } else {
                await api.post('/schedules', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dosen-schedule'] });
        },
        onError: (error) => {
            const message = api.getApiErrorMessage(error, 'Failed to save schedule');
            const axiosError = api.isAxiosError(error) ? error : null;
            const conflicts = axiosError?.response?.data?.conflicts;
            if (conflicts && conflicts.length > 0) {
                toast.error(`${message}: ${conflicts.join(', ')}`);
            } else {
                toast.error(message);
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number | string) => {
            await api.delete(`/schedules/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dosen-schedule'] });
            toast.success('Schedule deleted');
        },
        onError: () => {
            toast.error('Failed to delete schedule');
        },
    });

    return {
        periods: periodsQuery.data ?? [],
        locations: locationsQuery.data ?? [],
        schedules: dataQuery.data?.schedules ?? [],
        groups: dataQuery.data?.groups ?? [],
        isLoading: dataQuery.isLoading || periodsQuery.isLoading,
        isRefetching: dataQuery.isRefetching,
        saveSchedule: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending,
        deleteSchedule: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
    };
}
