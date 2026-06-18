'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { BimbinganDocument, BimbinganGroup, BimbinganPeriod } from '../types';

const fetchPeriods = async (): Promise<BimbinganPeriod[]> => {
    const res = await api.get('/periods-list');
    return res.data?.data || [];
};

interface BimbinganData {
    documents: BimbinganDocument[];
    groups: BimbinganGroup[];
}

const fetchData = async (periodId?: string, groupId?: string): Promise<BimbinganData> => {
    const periodParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
    const [groupsRes, docsRes] = await Promise.all([
        api.get(`/dosen/groups/supervised${periodParam}`),
        api.get('/dosen/documents', {
            params: {
                period_id: periodId && periodId !== 'all' ? periodId : undefined,
                group_id: groupId && groupId !== 'all' ? groupId : undefined,
            },
        }),
    ]);
    return {
        groups: groupsRes.data?.data || [],
        documents: docsRes.data?.data || [],
    };
};

export function useBimbingan(periodId?: string, groupId?: string) {
    const queryClient = useQueryClient();

    const periodsQuery = useQuery({
        queryKey: ['periods-list'],
        queryFn: fetchPeriods,
    });

    const dataQuery = useQuery({
        queryKey: ['dosen-bimbingan', periodId, groupId],
        queryFn: () => fetchData(periodId, groupId),
    });

    const reviewMutation = useMutation({
        mutationFn: async ({ docId, status, feedback }: { docId: number; status: 'APPROVED' | 'REJECTED'; feedback: string }) => {
            await api.put(`/dosen/documents/${docId}`, { status, feedback });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dosen-bimbingan'] });
            toast.success('Document reviewed successfully');
        },
        onError: (error: unknown) => {
            const message = api.isAxiosError(error)
                ? (error.response?.data?.message || error.message || 'Failed to submit review')
                : 'Failed to submit review';
            toast.error(message);
        },
    });

    return {
        periods: periodsQuery.data ?? [],
        groups: dataQuery.data?.groups ?? [],
        documents: dataQuery.data?.documents ?? [],
        isLoading: dataQuery.isLoading || periodsQuery.isLoading,
        isRefetching: dataQuery.isRefetching,
        reviewDocument: reviewMutation.mutateAsync,
        isReviewing: reviewMutation.isPending,
    };
}
