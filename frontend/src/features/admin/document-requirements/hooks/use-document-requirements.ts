'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Period, PhaseSummary, PhaseRequirement } from '../types';

const QUERY_KEY = ["admin", "document-requirements"] as const;

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

const DEFAULT_DOCUMENTS: Record<string, string[]> = {
    PDC1: ['Proposal', 'Gantt Chart'],
    SEMPRO: ['Buku Bimbingan', 'Bukti Kemajuan'],
    PDC2: ['Laporan Kemajuan', 'Bukti Kemajuan'],
    EXPO: ['Poster', 'Laporan TA'],
    TA: ['Draft TA', 'Buku Panduan TA'],
    SIDANG: ['Buku TA Final', 'CD Program'],
};

async function fetchPeriods(): Promise<Period[]> {
    const res = await api.get('/periods-list');
    return res.data?.data || [];
}

async function fetchSummaries(periodId: string): Promise<PhaseSummary[]> {
    const res = await api.get(`/admin/document-requirements/period/${periodId}/summary`);
    const data: PhaseSummary[] = res.data?.data || [];
    const phaseMap = new Map<string, PhaseSummary>(data.map((s) => [s.phase, s]));
    return PHASES.map((phase) => ({
        phase,
        document_count: phaseMap.get(phase)?.document_count || 0,
        required_count: phaseMap.get(phase)?.required_count || 0,
        document_names: phaseMap.get(phase)?.document_names || [],
        has_configured: phaseMap.get(phase)?.has_configured || false,
    }));
}

async function fetchRequirements(periodId: string): Promise<PhaseRequirement[]> {
    const res = await api.get(`/admin/document-requirements/period/${periodId}`);
    return res.data?.data || [];
}

async function saveRequirements(periodId: number, requirements: PhaseRequirement[]) {
    return api.put('/admin/document-requirements/bulk', {
        period_id: periodId,
        requirements,
    });
}

function getDefaultPeriodId(periods: Period[] | undefined): string {
    if (!periods || periods.length === 0) return '';
    const active = periods.find((p) => p.is_active);
    return active?.id?.toString() || periods[0].id.toString();
}

export function useDocumentRequirements() {
    const queryClient = useQueryClient();
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

    const periodsQuery = useQuery({
        queryKey: [...QUERY_KEY, 'periods-list'],
        queryFn: fetchPeriods,
    });

    const effectivePeriodId = useMemo(
        () => selectedPeriodId || getDefaultPeriodId(periodsQuery.data),
        [selectedPeriodId, periodsQuery.data]
    );

    const summariesQuery = useQuery({
        queryKey: [...QUERY_KEY, 'summaries', effectivePeriodId],
        queryFn: () => fetchSummaries(effectivePeriodId),
        enabled: !!effectivePeriodId,
    });

    const requirementsQuery = useQuery({
        queryKey: [...QUERY_KEY, 'requirements', effectivePeriodId],
        queryFn: () => fetchRequirements(effectivePeriodId),
        enabled: !!effectivePeriodId,
    });

    const saveMutation = useMutation({
        mutationFn: ({ periodId, requirements }: { periodId: number; requirements: PhaseRequirement[] }) =>
            saveRequirements(periodId, requirements),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Document requirements saved successfully');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to save requirements'));
        },
    });

    const loadDefaultsMutation = useMutation({
        mutationFn: async (periodId: string) => {
            const requirements = Object.entries(DEFAULT_DOCUMENTS)
                .map(([phase, docs]) =>
                    docs.map((name) => ({
                        phase,
                        name,
                        description: null,
                        is_required: true,
                    }))
                )
                .flat();
            return saveRequirements(parseInt(periodId), requirements);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success('Default documents loaded for all phases');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to load default documents'));
        },
    });

    return {
        periods: periodsQuery.data || [],
        periodsLoading: periodsQuery.isLoading,
        selectedPeriodId: effectivePeriodId,
        setSelectedPeriodId,
        summaries: summariesQuery.data || [],
        summariesLoading: summariesQuery.isLoading,
        requirements: requirementsQuery.data || [],
        requirementsLoading: requirementsQuery.isLoading,
        save: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending,
        loadDefaults: loadDefaultsMutation.mutateAsync,
        isLoadingDefaults: loadDefaultsMutation.isPending,
    };
}

export { PHASES };
