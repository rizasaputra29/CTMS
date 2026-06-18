"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { TaSubmission, PeriodOption } from '../types';

const SUBMISSIONS_QUERY_KEY = ['dosen', 'ta-submissions'] as const;
const PERIODS_QUERY_KEY = ['periods-list'] as const;

export function useTaReview() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<TaSubmission | null>(null);
    const [feedback, setFeedback] = useState('');

    const { data: periods = [], isLoading: periodsLoading } = useQuery({
        queryKey: PERIODS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/periods-list');
            return (response.data?.data || []) as PeriodOption[];
        },
    });

    const { data: submissions = [], isLoading: submissionsLoading, isFetching: submissionsFetching } = useQuery({
        queryKey: [...SUBMISSIONS_QUERY_KEY, selectedPeriod],
        queryFn: async () => {
            const periodParam = selectedPeriod !== 'all' ? `&period_id=${selectedPeriod}` : '';
            const groupRes = await api.get(`/dosen/groups/supervised?${periodParam}`);
            const groups = groupRes.data?.data || [];

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
            return allSubs;
        },
    });

    const reviewMutation = useMutation({
        mutationFn: async ({ submissionId, result, feedback }: { submissionId: number; result: 'APPROVE' | 'REVISE'; feedback: string }) => {
            await api.put(`/dosen/ta/${submissionId}/review`, { result, feedback });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
            toast.success(`TA review: ${variables.result}`);
            setReviewOpen(false);
            setSelectedSub(null);
            setFeedback('');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Review failed'));
        },
    });

    const defendedMutation = useMutation({
        mutationFn: async (submissionId: number) => {
            await api.put(`/dosen/ta/${submissionId}/defended`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
            toast.success('TA marked as defended.');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to mark as defended'));
        },
    });

    const filteredSubmissions = useMemo(() => {
        if (!searchQuery) return submissions;
        const q = searchQuery.toLowerCase();
        return submissions.filter(sub =>
            sub.student?.name.toLowerCase().includes(q) ||
            sub.group?.title?.title.toLowerCase().includes(q)
        );
    }, [submissions, searchQuery]);

    const handleReview = useCallback((result: 'APPROVE' | 'REVISE') => {
        if (!selectedSub) return;
        reviewMutation.mutate({ submissionId: selectedSub.id, result, feedback });
    }, [reviewMutation, selectedSub, feedback]);

    const handleDefended = useCallback((subId: number) => {
        if (!confirm('Mark this TA as defended? This action is final.')) return;
        defendedMutation.mutate(subId);
    }, [defendedMutation]);

    const openReview = useCallback((sub: TaSubmission) => {
        setSelectedSub(sub);
        setFeedback('');
        setReviewOpen(true);
    }, []);

    const loading = periodsLoading || submissionsLoading;
    const periodLoading = submissionsFetching && !submissionsLoading;
    const submitting = reviewMutation.isPending;

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
        handleReview,
        handleDefended,
        openReview,
    };
}
