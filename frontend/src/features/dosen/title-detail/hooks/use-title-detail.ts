'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { TitleDetail } from '../types';

const QUERY_KEY = ['dosen', 'titles'] as const;

export function useTitleDetail(titleId: string) {
    const { data: title, isLoading: loading } = useQuery<TitleDetail>({
        queryKey: [...QUERY_KEY, titleId],
        queryFn: async () => {
            const res = await api.get(`/dosen/titles/${titleId}`);
            return res.data;
        },
        enabled: !!titleId,
    });

    const refetch = async () => {
        try {
            await api.get(`/dosen/titles/${titleId}`);
        } catch (error) {
            toast.error('Failed to refresh title details');
            console.error(error);
        }
    };

    return { title: title ?? null, loading, refetch };
}
