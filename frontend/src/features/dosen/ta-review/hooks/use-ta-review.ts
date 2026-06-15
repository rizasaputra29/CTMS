import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { TaSubmission, PeriodOption } from '../types';

export function useTaReview() {
    const [submissions, setSubmissions] = useState<TaSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<TaSubmission | null>(null);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [periodLoading, setPeriodLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchPeriods = async () => {
            try {
                const res = await api.get('/periods-list');
                setPeriods(res.data?.data || []);
            } catch (err) {
                console.error('Failed to fetch periods', err);
            }
        };
        fetchPeriods();
    }, []);

    const fetchSubmissions = useCallback(async () => {
        setPeriodLoading(true);
        try {
            const periodParam = selectedPeriod !== 'all' ? `&period_id=${selectedPeriod}` : '';
            const groupRes = await api.get(`/dosen/groups/supervised?${periodParam}`);
            const groups = groupRes.data.data || [];

            const allSubs: TaSubmission[] = [];
            for (const group of groups) {
                try {
                    await api.get(`/dosen/documents?group_id=${group.id}`);
                    if (group.ta_submissions) {
                        allSubs.push(...group.ta_submissions.map((s: TaSubmission) => ({
                            ...s,
                            group: { title: group.title },
                        })));
                    }
                } catch {
                    // Skip errors for individual groups
                }
            }
            setSubmissions(allSubs);
        } catch (err) {
            console.error('Failed to fetch TA submissions', err);
        } finally {
            setLoading(false);
            setPeriodLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const filteredSubmissions = useMemo(() => {
        if (!searchQuery) return submissions;
        const q = searchQuery.toLowerCase();
        return submissions.filter(sub =>
            sub.student?.name.toLowerCase().includes(q) ||
            sub.group?.title?.title.toLowerCase().includes(q)
        );
    }, [submissions, searchQuery]);

    const handleReview = async (result: 'APPROVE' | 'REVISE') => {
        if (!selectedSub) return;
        setSubmitting(true);
        try {
            await api.put(`/dosen/ta/${selectedSub.id}/review`, {
                result,
                feedback,
            });
            toast.success(`TA review: ${result}`);
            setReviewOpen(false);
            setSelectedSub(null);
            setFeedback('');
            fetchSubmissions();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Review failed');
            else toast.error('Review failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDefended = async (subId: number) => {
        if (!confirm('Mark this TA as defended? This action is final.')) return;
        try {
            await api.put(`/dosen/ta/${subId}/defended`);
            toast.success('TA marked as defended.');
            fetchSubmissions();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed to mark as defended');
        }
    };

    const openReview = (sub: TaSubmission) => {
        setSelectedSub(sub);
        setFeedback('');
        setReviewOpen(true);
    };

    return {
        submissions,
        filteredSubmissions,
        loading,
        periods,
        selectedPeriod,
        periodLoading,
        reviewOpen,
        selectedSub,
        feedback,
        submitting,
        searchQuery,
        setSearchQuery,
        setSelectedPeriod,
        setReviewOpen,
        setFeedback,
        setSelectedSub,
        fetchSubmissions,
        handleReview,
        handleDefended,
        openReview,
    };
}
