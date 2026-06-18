"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { PeerReviewGroupProgress } from '@/features/admin/peer-review-dashboard/types';

const QUERY_KEY = ['admin', 'peer-review-dashboard'] as const;

const fetchGroups = async (selectedPeriod: string): Promise<PeerReviewGroupProgress[]> => {
    const params = selectedPeriod !== 'all' ? { period_id: selectedPeriod } : {};
    const res = await api.get('/admin/peer-review-dashboard/groups', { params });
    return res.data;
};

export function usePeerReviewDashboard() {
    const queryClient = useQueryClient();
    const [selectedPeriod] = useState<string>('all');
    const [sendingReminderGroupId, setSendingReminderGroupId] = useState<number | null>(null);

    const { data: groups = [], isLoading } = useQuery({
        queryKey: [...QUERY_KEY, 'groups', selectedPeriod],
        queryFn: () => fetchGroups(selectedPeriod),
    });

    const reminderMutation = useMutation({
        mutationFn: async (groupId: number) => {
            setSendingReminderGroupId(groupId);
            await api.post(`/admin/peer-review-dashboard/send-reminder/${groupId}`);
        },
        onSuccess: () => {
            toast.success('Reminder sent successfully');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to send reminder'));
        },
        onSettled: () => {
            setSendingReminderGroupId(null);
        },
    });

    const sendReminder = (groupId: number) => {
        reminderMutation.mutate(groupId);
    };

    return {
        groups,
        isLoading,
        selectedPeriod,
        sendingReminderGroupId,
        sendReminder,
    };
}
