'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { ExpoEvent, Period, Location } from '../types';
import type { ExpoEventFormData } from '@/lib/validations/expo';

const QUERY_KEY = ['admin', 'expo-events'] as const;

async function fetchExpoEvents(periodId: string): Promise<ExpoEvent[]> {
    const params = periodId && periodId !== 'all' ? { period_id: periodId } : {};
    const res = await api.get('/admin/expo-events', { params });
    return res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
}

async function fetchPeriods(): Promise<Period[]> {
    const res = await api.get('/admin/periods');
    return res.data?.data || [];
}

async function fetchLocations(): Promise<Location[]> {
    const res = await api.get('/locations');
    return res.data?.data || [];
}

async function createExpoEvent(payload: ExpoEventFormData) {
    return api.post('/admin/expo-events', {
        ...payload,
        capacity: Number(payload.capacity),
        period_id: Number(payload.period_id),
        location_id: payload.location_id ? Number(payload.location_id) : null,
    });
}

async function updateExpoEvent(id: number, payload: ExpoEventFormData) {
    return api.put(`/admin/expo-events/${id}`, {
        ...payload,
        capacity: Number(payload.capacity),
        period_id: Number(payload.period_id),
        location_id: payload.location_id ? Number(payload.location_id) : null,
    });
}

async function publishExpoEvent(id: number) {
    return api.put(`/admin/expo-events/${id}/publish`);
}

async function deleteExpoEvent(id: number) {
    return api.delete(`/admin/expo-events/${id}`);
}

export function useExpoEvents(periodId: string) {
    const queryClient = useQueryClient();

    const eventsQuery = useQuery({
        queryKey: ['admin', 'expo-events', { period_id: periodId }],
        queryFn: () => fetchExpoEvents(periodId),
    });

    const periodsQuery = useQuery({
        queryKey: ['admin', 'periods'],
        queryFn: fetchPeriods,
    });

    const locationsQuery = useQuery({
        queryKey: ['admin', 'locations'],
        queryFn: fetchLocations,
    });

    const createMutation = useMutation({
        mutationFn: createExpoEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Event created');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ExpoEventFormData }) => updateExpoEvent(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Event updated');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed'));
        },
    });

    const publishMutation = useMutation({
        mutationFn: publishExpoEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Publication status updated');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteExpoEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Event deleted');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed'));
        },
    });

    return {
        events: eventsQuery.data || [],
        eventsLoading: eventsQuery.isLoading,
        periods: periodsQuery.data || [],
        periodsLoading: periodsQuery.isLoading,
        locations: locationsQuery.data || [],
        locationsLoading: locationsQuery.isLoading,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
        publish: publishMutation.mutateAsync,
        remove: deleteMutation.mutateAsync,
        isPending:
            createMutation.isPending ||
            updateMutation.isPending ||
            publishMutation.isPending ||
            deleteMutation.isPending,
    };
}
