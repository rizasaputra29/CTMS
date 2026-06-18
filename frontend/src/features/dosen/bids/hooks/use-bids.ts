"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Bid, LecturerBidsFlow, PeriodOption } from '../types';

const BIDS_QUERY_KEY = ['dosen', 'bids'] as const;
const PERIODS_QUERY_KEY = ['periods-list'] as const;

export function useBids() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: periods = [], isLoading: periodsLoading } = useQuery({
        queryKey: PERIODS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/periods-list');
            return (response.data?.data || []) as PeriodOption[];
        },
    });

    const { data: bidsData, isLoading: bidsLoading } = useQuery({
        queryKey: [...BIDS_QUERY_KEY, selectedPeriod],
        queryFn: async () => {
            const url = selectedPeriod && selectedPeriod !== 'all'
                ? `/dosen/bids?period_id=${selectedPeriod}`
                : '/dosen/bids';
            const response = await api.get(url);
            return {
                bids: (response.data?.data || []) as Bid[],
                flow: (response.data.flow || null) as LecturerBidsFlow | null,
            };
        },
    });

    const recommendMutation = useMutation({
        mutationFn: async ({ bidId, recommendation }: { bidId: number; recommendation: 'ACCEPT' | 'REJECT' }) => {
            await api.put(`/dosen/bids/${bidId}/recommend`, { recommendation });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: BIDS_QUERY_KEY });
            toast.success(`Recommendation: ${variables.recommendation}`);
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to submit recommendation'));
        },
    });

    const handlePeriodChange = useCallback((val: string) => {
        setSelectedPeriod(val);
    }, []);

    const handleRecommend = useCallback((bidId: number, recommendation: 'ACCEPT' | 'REJECT') => {
        recommendMutation.mutate({ bidId, recommendation });
    }, [recommendMutation]);

    const filteredBids = useMemo(() => {
        if (!searchQuery) return bidsData?.bids ?? [];
        const q = searchQuery.toLowerCase();
        return (bidsData?.bids ?? []).filter(bid =>
            bid.title.title.toLowerCase().includes(q) ||
            bid.group_id.toString().includes(q) ||
            bid.group.members.some(m => m.student.name.toLowerCase().includes(q))
        );
    }, [bidsData?.bids, searchQuery]);

    const byTitle = useMemo(() => {
        return filteredBids.reduce((acc, bid) => {
            const key = bid.title.id;
            if (!acc[key]) acc[key] = { title: bid.title, bids: [] };
            acc[key].bids.push(bid);
            return acc;
        }, {} as Record<number, { title: { id: number; title: string }; bids: Bid[] }>);
    }, [filteredBids]);

    return {
        periods,
        selectedPeriod,
        searchQuery,
        loading: periodsLoading || bidsLoading,
        refreshing: recommendMutation.isPending,
        submitting: recommendMutation.isPending ? recommendMutation.variables?.bidId ?? null : null,
        bidsFlow: bidsData?.flow ?? null,
        filteredBids,
        byTitle,
        setSearchQuery,
        handlePeriodChange,
        handleRecommend,
    };
}
