'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DosenEvaluation, DosenEvaluationPeriod, DosenEvaluationSeminarData } from '../types';

const fetchPeriods = async (): Promise<DosenEvaluationPeriod[]> => {
    const res = await api.get('/periods-list');
    return res.data?.data || [];
};

const normalizeEvaluationStatus = (status?: string): DosenEvaluation['status'] => {
    const normalized = (status ?? 'PENDING').toUpperCase();
    if (normalized === 'COMPLETED' || normalized === 'SUBMITTED') {
        return normalized;
    }
    return 'PENDING';
};

const fetchEvaluations = async (periodId?: string): Promise<DosenEvaluation[]> => {
    const periodParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
    const res = await api.get(`/dosen/seminar-schedules/examiner${periodParam}`);
    const responseData = res.data?.data ?? res.data;
    const seminars: DosenEvaluationSeminarData[] = responseData?.seminars ?? [];
    const taDefenses: DosenEvaluationSeminarData[] = responseData?.ta_defenses ?? [];
    const mapped: DosenEvaluation[] = [];

    (seminars ?? []).forEach((s) => {
        const myEval = s.evaluations?.[0];
        if (myEval) {
            mapped.push({
                id: myEval.id,
                type: 'SEMINAR',
                schedule_type: s.type,
                schedule_id: s.id,
                date: s.date,
                start_time: s.start_time,
                end_time: s.end_time,
                room: s.room,
                status: normalizeEvaluationStatus(myEval.status),
                points: myEval.score,
                notes: myEval.feedback || '',
                deadline: s.evaluation_deadline || null,
                updated_at: myEval.updated_at ?? '',
                group: s.group,
                student: null,
            });
        }
    });

    (taDefenses ?? []).forEach((t) => {
        if (t.evaluations && t.evaluations.length > 0) {
            (t.evaluations ?? []).forEach((evalItem) => {
                let student = t.student;
                if (t.students && t.students.length > 0) {
                    student = t.students.find((s) => s.id === evalItem.student_id) || t.student;
                }
                mapped.push({
                    id: evalItem.id,
                    type: 'TA_DEFENSE',
                    schedule_type: 'SIDANG_TA',
                    schedule_id: t.id,
                    date: t.date,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    room: t.room,
                    status: normalizeEvaluationStatus(evalItem.status),
                    points: evalItem.score || 0,
                    notes: evalItem.feedback || '',
                    deadline: t.evaluation_deadline || null,
                    updated_at: evalItem.updated_at ?? '',
                    group: t.group,
                    student: student || null,
                });
            });
        } else {
            const students = t.students && t.students.length > 0 ? t.students : t.student ? [t.student] : [];
            students.forEach((student) => {
                mapped.push({
                    id: t.id,
                    type: 'TA_DEFENSE',
                    schedule_type: 'SIDANG_TA',
                    schedule_id: t.id,
                    date: t.date,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    room: t.room,
                    status: 'PENDING',
                    points: 0,
                    notes: '',
                    deadline: t.evaluation_deadline || null,
                    updated_at: '',
                    group: t.group,
                    student: student || null,
                });
            });
        }
    });

    return mapped;
};

export function useEvaluation(periodId?: string) {
    const periodsQuery = useQuery({
        queryKey: ['periods-list'],
        queryFn: fetchPeriods,
    });

    const evaluationsQuery = useQuery({
        queryKey: ['dosen-evaluations', periodId],
        queryFn: () => fetchEvaluations(periodId),
    });

    return {
        periods: periodsQuery.data ?? [],
        evaluations: evaluationsQuery.data ?? [],
        isLoading: evaluationsQuery.isLoading || periodsQuery.isLoading,
        isRefetching: evaluationsQuery.isRefetching,
    };
}
