'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/error-utils';
import type { EvaluationSummaryData } from '../types';

async function fetchEvaluationSummary(scheduleId: string): Promise<EvaluationSummaryData> {
    const res = await api.get(`/admin/supervisor-evaluation/schedules/${scheduleId}/summary`);
    return res.data;
}

async function exportEvaluationSummary(scheduleId: string) {
    return api.get(`/admin/supervisor-evaluation/schedules/${scheduleId}/export`, {
        responseType: 'blob',
    });
}

export function useEvaluationSummary(scheduleId: string | null) {
    const summaryQuery = useQuery({
        queryKey: ['admin', 'evaluation-summary', scheduleId],
        queryFn: () => fetchEvaluationSummary(scheduleId!),
        enabled: !!scheduleId,
    });

    const exportMutation = useMutation({
        mutationFn: () => exportEvaluationSummary(scheduleId!),
        onSuccess: (res) => {
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `evaluation_summary_schedule_${scheduleId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('CSV exported successfully');
        },
        onError: () => {
            toast.error('Failed to export CSV');
        },
    });

    return {
        data: summaryQuery.data || null,
        loading: summaryQuery.isLoading,
        error: summaryQuery.error,
        refetch: summaryQuery.refetch,
        exportCSV: exportMutation.mutateAsync,
        exporting: exportMutation.isPending,
    };
}
