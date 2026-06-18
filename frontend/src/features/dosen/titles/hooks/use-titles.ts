'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Title, GroupSummary, TitleFormDialogState, WithdrawDialogState, HistoryDialogState } from '../types';
import type { TitleFormData } from '@/lib/validations/title';

const fetchPeriods = async () => {
    const res = await api.get('/periods-list');
    return (res.data?.data || []).filter((p: { is_active: boolean }) => p.is_active);
};

export function useTitles() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [formDialog, setFormDialog] = useState<TitleFormDialogState>({ open: false, editingId: null });
    const [withdrawDialog, setWithdrawDialog] = useState<WithdrawDialogState>({ open: false, reason: '', loading: false });
    const [historyDialog, setHistoryDialog] = useState<HistoryDialogState>({
        open: false,
        title: undefined,
        loading: false,
        approvalHistory: [],
        deletionHistory: [],
    });

    const periodsQuery = useQuery({
        queryKey: ['dosen-periods'],
        queryFn: fetchPeriods,
        staleTime: 5 * 60 * 1000,
    });

    const periods = periodsQuery.data || [];

    const titlesQuery = useQuery({
        queryKey: ['dosen-titles', selectedPeriod],
        queryFn: async () => {
            if (!selectedPeriod) return [];
            const res = await api.get(`/dosen/titles?period_id=${selectedPeriod}`);
            return (res.data || []) as Title[];
        },
        enabled: !!selectedPeriod,
    });

    const availableGroupsQuery = useQuery({
        queryKey: ['dosen-available-groups', selectedPeriod],
        queryFn: async () => {
            if (!selectedPeriod) return [];
            const res = await api.get('/dosen/groups', { params: { period_id: selectedPeriod } });
            return (res.data?.data || []).filter((group: GroupSummary) => group.period_id?.toString() === selectedPeriod);
        },
        enabled: !!selectedPeriod && formDialog.open,
    });

    const createMutation = useMutation({
        mutationFn: async (data: TitleFormData & { period_id?: number }) => {
            const res = await api.post('/dosen/titles', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Title created successfully');
            queryClient.invalidateQueries({ queryKey: ['dosen-titles', selectedPeriod] });
            setFormDialog({ open: false, editingId: null });
        },
        onError: () => toast.error('Failed to create title'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: TitleFormData }) => {
            const res = await api.put(`/dosen/titles/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Title updated successfully');
            queryClient.invalidateQueries({ queryKey: ['dosen-titles', selectedPeriod] });
            setFormDialog({ open: false, editingId: null });
        },
        onError: () => toast.error('Failed to update title'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/dosen/titles/${id}`);
        },
        onSuccess: () => {
            toast.success('Title deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['dosen-titles', selectedPeriod] });
        },
        onError: () => toast.error('Failed to delete title'),
    });

    const withdrawMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
            await api.post(`/dosen/titles/${id}/withdraw-approval`, { reason: reason || null });
        },
        onSuccess: () => {
            toast.success('Approval withdrawn successfully');
            setWithdrawDialog({ open: false, reason: '', loading: false });
            queryClient.invalidateQueries({ queryKey: ['dosen-titles', selectedPeriod] });
        },
        onError: (error) => {
            const message = api.isAxiosError(error) ? error.response?.data?.message : 'Failed to withdraw approval';
            toast.error(message || 'Failed to withdraw approval');
            setWithdrawDialog(prev => ({ ...prev, loading: false }));
        },
    });

    const handlePeriodChange = useCallback((val: string) => {
        setSelectedPeriod(val);
    }, []);

    const handleSubmit = useCallback((data: TitleFormData) => {
        if (formDialog.editingId) {
            updateMutation.mutate({ id: formDialog.editingId, data });
        } else {
            createMutation.mutate({ ...data, period_id: selectedPeriod ? parseInt(selectedPeriod) : undefined });
        }
    }, [formDialog.editingId, selectedPeriod, updateMutation, createMutation]);

    const handleDelete = useCallback((id: number) => {
        if (confirm('Are you sure you want to delete this title?')) {
            deleteMutation.mutate(id);
        }
    }, [deleteMutation]);

    const handleWithdraw = useCallback(() => {
        if (!withdrawDialog.title) return;
        setWithdrawDialog(prev => ({ ...prev, loading: true }));
        withdrawMutation.mutate({ id: withdrawDialog.title.id, reason: withdrawDialog.reason });
    }, [withdrawDialog, withdrawMutation]);

    const handleViewHistory = useCallback(async (title: Title) => {
        setHistoryDialog({ open: true, title, loading: true, approvalHistory: [], deletionHistory: [] });
        try {
            const [approvalRes, deletionRes] = await Promise.all([
                api.get(`/dosen/titles/${title.id}/approval-history`),
                api.get(`/dosen/titles/${title.id}/deletion-history`),
            ]);
            setHistoryDialog(prev => ({
                ...prev,
                loading: false,
                approvalHistory: approvalRes.data || [],
                deletionHistory: deletionRes.data || [],
            }));
        } catch (error) {
            console.error('Failed to fetch history', error);
            toast.error('Failed to fetch title history');
            setHistoryDialog(prev => ({ ...prev, loading: false }));
        }
    }, []);

    return {
        periods,
        periodsLoading: periodsQuery.isLoading,
        selectedPeriod,
        setSelectedPeriod: handlePeriodChange,
        titles: titlesQuery.data || [],
        titlesLoading: titlesQuery.isLoading,
        availableGroups: availableGroupsQuery.data || [],
        formDialog,
        setFormDialog,
        withdrawDialog,
        setWithdrawDialog,
        historyDialog,
        setHistoryDialog,
        handleSubmit,
        handleDelete,
        handleWithdraw,
        handleViewHistory,
    };
}
