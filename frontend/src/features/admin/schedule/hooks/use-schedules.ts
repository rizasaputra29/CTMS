'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Period, ApiSchedule, ApiTaDefenseSchedule, ScheduleView } from '../types';
import type { ScheduleEvent } from '@/components/schedule/ScheduleCalendar';

const QUERY_KEY = ['admin', 'schedules'] as const;

async function fetchSchedules() {
    const [perRes, semproRes, expoRes, taRes, bimbinganRes] = await Promise.all([
        api.get('/admin/periods'),
        api.get('/admin/sempro/schedules'),
        api.get('/admin/expo/schedules'),
        api.get('/admin/ta-defense-schedules'),
        api.get('/admin/schedules'),
    ]);

    return {
        periods: (perRes.data?.data || []) as Period[],
        semproSchedules: (semproRes.data?.data || []) as ApiSchedule[],
        expoSchedules: (expoRes.data?.data || []) as ApiSchedule[],
        taDefenseSchedules: (taRes.data?.data || []) as ApiTaDefenseSchedule[],
        bimbinganSchedules: (bimbinganRes.data?.data || []) as ApiSchedule[],
    };
}

export function useSchedules() {
    const queryClient = useQueryClient();
    const [view, setView] = useState<ScheduleView>('calendar');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [isProcessing, setIsProcessing] = useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: [...QUERY_KEY],
        queryFn: fetchSchedules,
    });

    const periods = data?.periods || [];
    const semproSchedules = data?.semproSchedules || [];
    const expoSchedules = data?.expoSchedules || [];
    const taDefenseSchedules = data?.taDefenseSchedules || [];
    const bimbinganSchedules = data?.bimbinganSchedules || [];

    const allSchedules = useMemo((): ScheduleEvent[] => {
        const mapped: ScheduleEvent[] = [];

        for (const s of [...semproSchedules, ...expoSchedules]) {
            if (!s.date) continue;
            const dateOnly = s.date.split('T')[0];
            const dateStr = s.start_time
                ? `${dateOnly}T${s.start_time}`
                : `${dateOnly}T00:00:00`;

            mapped.push({
                id: s.id,
                group_id: s.group_id,
                type: s.type as 'SEMPRO' | 'EXPO',
                date: dateStr,
                room: s.room || '',
                status: s.status,
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.group?.period?.name || '',
                examiner1: s.examiner1 ? { name: s.examiner1.name } : null,
                examiner2: s.examiner2 ? { name: s.examiner2.name } : null,
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                    members: [],
                },
                online_link: s.online_link || undefined,
                notes: s.notes ?? null,
            });
        }

        for (const s of taDefenseSchedules) {
            if (!s.date) continue;
            const dateOnly = s.date.split('T')[0];
            const dateStr = s.start_time
                ? `${dateOnly}T${s.start_time}`
                : `${dateOnly}T00:00:00`;

            const students = s.students?.map((st) => ({
                id: st.id,
                name: st.name,
                nim: st.nim,
                email: st.email,
            })) || [];

            const studentName = students.length > 1
                ? `${students[0].name} +${students.length - 1} more`
                : (students[0]?.name || s.student?.name || 'N/A');

            mapped.push({
                id: `ta_${s.id}`,
                group_id: s.group.id,
                student_id: s.student?.id,
                type: 'TA_DEFENSE',
                date: dateStr,
                room: s.room || '',
                status: s.status,
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.group?.period?.name || '',
                student_name: studentName,
                students,
                examiner1: s.examiner1 ? { name: s.examiner1.name } : null,
                examiner2: s.examiner2 ? { name: s.examiner2.name } : null,
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                },
            });
        }

        for (const s of bimbinganSchedules) {
            mapped.push({
                id: `bim_${s.id}`,
                group_id: s.group_id,
                type: 'BIMBINGAN',
                date: s.date,
                room: s.room || '',
                mode: s.mode || '',
                notes: s.notes || '',
                status: s.status || 'SCHEDULED',
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.group?.period?.name || '',
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                },
            });
        }

        return mapped;
    }, [semproSchedules, expoSchedules, taDefenseSchedules, bimbinganSchedules]);

    const filteredSchedules = useMemo(() => {
        if (selectedPeriod === 'all') {
            return allSchedules;
        }
        return allSchedules.filter(
            (s) => s.period_name === periods.find((p) => p.id.toString() === selectedPeriod)?.name
        );
    }, [allSchedules, selectedPeriod, periods]);

    const approveMutation = useMutation({
        mutationFn: async ({
            sid,
            type,
        }: {
            sid: number | string;
            type: string;
        }) => {
            const scheduleType = type as 'SEMPRO' | 'EXPO' | 'TA_DEFENSE';
            let rawId: number;
            let rawSchedule: ApiSchedule | ApiTaDefenseSchedule | undefined;

            if (typeof sid === 'string' && sid.startsWith('ta_')) {
                rawId = Number(sid.substring(3));
                rawSchedule = taDefenseSchedules.find((s) => s.id === rawId);
            } else {
                rawId = Number(sid);
                rawSchedule = [...semproSchedules, ...expoSchedules].find((s) => s.id === rawId);
            }

            if (!rawSchedule) return;

            const endpoint =
                scheduleType === 'TA_DEFENSE'
                    ? `/admin/ta-defense-schedules/${rawId}`
                    : scheduleType === 'SEMPRO'
                      ? `/admin/sempro/schedules/${rawId}/approve`
                      : `/admin/expo/schedules/${rawId}/approve`;

            if (scheduleType === 'TA_DEFENSE') {
                await api.put(endpoint, {
                    status: 'SCHEDULED',
                    date: (rawSchedule as ApiTaDefenseSchedule).date,
                    start_time: (rawSchedule as ApiTaDefenseSchedule).start_time,
                    end_time: (rawSchedule as ApiTaDefenseSchedule).end_time,
                    room: (rawSchedule as ApiTaDefenseSchedule).room,
                    examiner_1_id: (rawSchedule as ApiTaDefenseSchedule).examiner1?.id,
                    examiner_2_id: (rawSchedule as ApiTaDefenseSchedule).examiner2?.id,
                });
            } else {
                await api.put(endpoint, {
                    date: (rawSchedule as ApiSchedule).date,
                    start_time: (rawSchedule as ApiSchedule).start_time,
                    end_time: (rawSchedule as ApiSchedule).end_time,
                    room: (rawSchedule as ApiSchedule).room,
                    examiner_1_id: (rawSchedule as ApiSchedule).examiner1?.id,
                    examiner_2_id: (rawSchedule as ApiSchedule).examiner2?.id,
                });
            }
        },
        onSuccess: () => {
            toast.success('Schedule approved!');
            queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Approval failed.'));
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ sid, type, reason }: { sid: number | string; type: string; reason: string }) => {
            const id = typeof sid === 'string' && sid.startsWith('ta_')
                ? Number(sid.substring(3))
                : Number(sid);

            const endpoint =
                type === 'TA_DEFENSE'
                    ? `/admin/ta-defense-schedules/${id}/cancel`
                    : type === 'SEMPRO'
                      ? `/admin/sempro/schedules/${id}/reject`
                      : `/admin/expo/schedules/${id}/reject`;

            await api.put(endpoint, { rejection_reason: reason });
        },
        onSuccess: () => {
            toast.success('Schedule request rejected.');
            queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Rejection failed.'));
        },
    });

    const handleApprove = useCallback(
        async (sid: number | string, type: string) => {
            setIsProcessing(true);
            try {
                await approveMutation.mutateAsync({ sid, type });
            } finally {
                setIsProcessing(false);
            }
        },
        [approveMutation]
    );

    const handleReject = useCallback(
        async (sid: number | string, type: string, reason: string) => {
            setIsProcessing(true);
            try {
                await rejectMutation.mutateAsync({ sid, type, reason });
            } finally {
                setIsProcessing(false);
            }
        },
        [rejectMutation]
    );

    return {
        periods,
        schedules: allSchedules,
        filteredSchedules,
        view,
        setView,
        selectedPeriod,
        setSelectedPeriod,
        isLoading,
        isProcessing,
        refresh: refetch,
        handleApprove,
        handleReject,
    };
}
