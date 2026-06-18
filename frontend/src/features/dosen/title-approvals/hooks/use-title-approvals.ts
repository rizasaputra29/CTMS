"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Proposal, LecturerProposalFlow, PeriodOption } from '../types';

const PROPOSALS_QUERY_KEY = ['dosen', 'title-approvals'] as const;
const PERIODS_QUERY_KEY = ['periods-list'] as const;

export function useTitleApprovals() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const { data: periods = [], isLoading: periodsLoading } = useQuery({
        queryKey: PERIODS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/periods-list');
            return (response.data?.data || []) as PeriodOption[];
        },
    });

    const { data: proposalsData, isLoading: proposalsLoading } = useQuery({
        queryKey: [...PROPOSALS_QUERY_KEY, selectedPeriod],
        queryFn: async () => {
            const url = selectedPeriod && selectedPeriod !== 'all'
                ? `/dosen/title-approvals?period_id=${selectedPeriod}`
                : '/dosen/title-approvals';
            const response = await api.get(url);
            return {
                proposals: (response.data?.data || []) as Proposal[],
                flow: (response.data.flow || null) as LecturerProposalFlow | null,
            };
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (proposalId: number) => {
            await api.put(`/dosen/title-approvals/${proposalId}/approve`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
            toast.success('Proposal approved! Group has been finalized.');
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to approve proposal'));
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ proposalId, reason }: { proposalId: number; reason: string }) => {
            await api.put(`/dosen/title-approvals/${proposalId}/reject`, {
                rejection_reason: reason,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROPOSALS_QUERY_KEY });
            toast.success('Proposal rejected.');
            setRejectDialogOpen(false);
            setRejectionReason('');
            setSelectedProposal(null);
        },
        onError: (error) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to reject proposal'));
        },
    });

    const handlePeriodChange = useCallback((val: string) => {
        setSelectedPeriod(val);
    }, []);

    const handleApprove = useCallback((proposalId: number) => {
        approveMutation.mutate(proposalId);
    }, [approveMutation]);

    const handleReject = useCallback(() => {
        if (!selectedProposal || !rejectionReason.trim()) return;
        rejectMutation.mutate({ proposalId: selectedProposal.id, reason: rejectionReason });
    }, [rejectMutation, selectedProposal, rejectionReason]);

    const openRejectDialog = useCallback((proposal: Proposal) => {
        setSelectedProposal(proposal);
        setRejectionReason('');
        setRejectDialogOpen(true);
    }, []);

    const filteredProposals = useMemo(() => {
        const proposals = proposalsData?.proposals ?? [];
        if (!searchQuery) return proposals;
        const q = searchQuery.toLowerCase();
        return proposals.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.proposed_by_group?.id.toString().includes(q) ||
            p.proposed_by_group?.members.some(m => m.student.name.toLowerCase().includes(q))
        );
    }, [proposalsData?.proposals, searchQuery]);

    const loading = periodsLoading || proposalsLoading;
    const processing = approveMutation.isPending || rejectMutation.isPending;

    return {
        proposals: proposalsData?.proposals ?? [],
        periods,
        selectedPeriod,
        searchQuery,
        loading,
        rejectDialogOpen,
        selectedProposal,
        rejectionReason,
        processing,
        proposalFlow: proposalsData?.flow ?? null,
        filteredProposals,
        setSearchQuery,
        setRejectDialogOpen,
        setRejectionReason,
        handlePeriodChange,
        handleApprove,
        handleReject,
        openRejectDialog,
    };
}
