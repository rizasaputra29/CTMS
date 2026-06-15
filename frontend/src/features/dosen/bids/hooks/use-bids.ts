import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Bid, LecturerBidsFlow, PeriodOption } from '../types';

export function useBids() {
    const [bids, setBids] = useState<Bid[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState<number | null>(null);
    const [bidsFlow, setBidsFlow] = useState<LecturerBidsFlow | null>(null);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setLoading(true);

        try {
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

            const url = periodId && periodId !== 'all'
                ? `/dosen/bids?period_id=${periodId}`
                : '/dosen/bids';

            const res = await api.get(url);
            setBids(res.data.data || []);
            setBidsFlow(res.data.flow || null);
        } catch (err) {
            console.error('Failed to fetch bids', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [periods.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const handleRecommend = async (bidId: number, recommendation: 'ACCEPT' | 'REJECT') => {
        setSubmitting(bidId);
        try {
            await api.put(`/dosen/bids/${bidId}/recommend`, { recommendation });
            toast.success(`Recommendation: ${recommendation}`);
            fetchData(selectedPeriod);
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed to submit recommendation');
        } finally {
            setSubmitting(null);
        }
    };

    const filteredBids = useMemo(() => {
        if (!searchQuery) return bids;
        const q = searchQuery.toLowerCase();
        return bids.filter(bid =>
            bid.title.title.toLowerCase().includes(q) ||
            bid.group_id.toString().includes(q) ||
            bid.group.members.some(m => m.student.name.toLowerCase().includes(q))
        );
    }, [bids, searchQuery]);

    const byTitle = useMemo(() => {
        return filteredBids.reduce((acc, bid) => {
            const key = bid.title.id;
            if (!acc[key]) acc[key] = { title: bid.title, bids: [] };
            acc[key].bids.push(bid);
            return acc;
        }, {} as Record<number, { title: { id: number; title: string }; bids: Bid[] }>);
    }, [filteredBids]);

    return {
        bids,
        periods,
        selectedPeriod,
        searchQuery,
        loading,
        refreshing,
        submitting,
        bidsFlow,
        filteredBids,
        byTitle,
        setSearchQuery,
        handlePeriodChange,
        handleRecommend,
    };
}
