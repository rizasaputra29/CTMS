"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Proposal, LecturerProposalFlow, PeriodOption } from '../types';

export function useTitleApprovals() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [proposalFlow, setProposalFlow] = useState<LecturerProposalFlow | null>(null);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId && periodId !== 'all') setRefreshing(true);
        else if (!periodId && !selectedPeriod) setLoading(true);
        else setRefreshing(true);

        try {
            let currentPeriodId = periodId || selectedPeriod;

            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                const fetchedPeriods = periodsRes.data?.data || [];
                setPeriods(fetchedPeriods);

                if (!currentPeriodId || currentPeriodId === 'all') {
                    const active = fetchedPeriods.find((p: { is_active: boolean }) => p.is_active);
                    if (active) {
                        currentPeriodId = active.id.toString();
                        setSelectedPeriod(currentPeriodId);
                    } else if (fetchedPeriods.length > 0) {
                        currentPeriodId = fetchedPeriods[0].id.toString();
                        setSelectedPeriod(currentPeriodId);
                    }
                }
            }

            const url = currentPeriodId && currentPeriodId !== 'all'
                ? `/dosen/title-approvals?period_id=${currentPeriodId}`
                : '/dosen/title-approvals';

            const response = await api.get(url);
            setProposals(response.data.data || []);
            setProposalFlow(response.data.flow || null);
        } catch (error) {
            console.error('Failed to fetch proposals', error);
            toast.error('Failed to load title proposals');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [periods.length, selectedPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const handleApprove = async (proposalId: number) => {
        setProcessing(true);
        try {
            await api.put(`/dosen/title-approvals/${proposalId}/approve`);
            toast.success('Proposal approved! Group has been finalized.');
            fetchData(selectedPeriod);
        } catch (error) {
            console.error('Failed to approve', error);
            toast.error('Failed to approve proposal');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedProposal || !rejectionReason.trim()) return;
        setProcessing(true);
        try {
            await api.put(`/dosen/title-approvals/${selectedProposal.id}/reject`, {
                rejection_reason: rejectionReason,
            });
            toast.success('Proposal rejected.');
            setRejectDialogOpen(false);
            setRejectionReason('');
            setSelectedProposal(null);
            fetchData(selectedPeriod);
        } catch (error) {
            console.error('Failed to reject', error);
            toast.error('Failed to reject proposal');
        } finally {
            setProcessing(false);
        }
    };

    const openRejectDialog = (proposal: Proposal) => {
        setSelectedProposal(proposal);
        setRejectionReason('');
        setRejectDialogOpen(true);
    };

    const filteredProposals = useMemo(() => {
        if (!searchQuery) return proposals;
        const q = searchQuery.toLowerCase();
        return proposals.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.proposed_by_group?.id.toString().includes(q) ||
            p.proposed_by_group?.members.some(m => m.student.name.toLowerCase().includes(q))
        );
    }, [proposals, searchQuery]);

    return {
        proposals,
        periods,
        selectedPeriod,
        searchQuery,
        loading,
        refreshing,
        rejectDialogOpen,
        selectedProposal,
        rejectionReason,
        processing,
        proposalFlow,
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
