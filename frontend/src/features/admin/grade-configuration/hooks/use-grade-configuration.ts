"use client";

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
    GradeConfig,
    Pdc1Weights,
    Pdc2Weights,
    TaWeights,
    GradeConfigurationPeriod,
} from '@/features/admin/grade-configuration/types';

const QUERY_KEY = ["admin", "grade-configuration"] as const;

const DEFAULT_PDC1: Pdc1Weights = { SEMPRO: 50, BIMBINGAN_SEMPRO: 50 };
const DEFAULT_PDC2: Pdc2Weights = { NILAI_DOSEN: 25, MILESTONE: 25, EXPO: 25, PEER_REVIEW: 25 };
const DEFAULT_TA: TaWeights = { BIMBINGAN_TA: 50, SIDANG_TA: 50 };

const fetchPeriods = async (): Promise<GradeConfigurationPeriod[]> => {
    const res = await api.get('/admin/periods');
    return Array.isArray(res.data?.data) ? res.data.data : [];
};

const fetchConfig = async (periodId: string): Promise<GradeConfig | null> => {
    const res = await api.get(`/admin/grade-configuration/${periodId}`);
    return res.data?.data || res.data || null;
};

function getDefaultPeriodId(periods: GradeConfigurationPeriod[] | undefined): string {
    if (!periods || periods.length === 0) return '';
    const active = periods.find((p) => p.is_active);
    return active ? active.id.toString() : periods[0].id.toString();
}

interface PeriodWeights {
    pdc1: Pdc1Weights;
    pdc2: Pdc2Weights;
    ta: TaWeights;
}

function configToWeights(config: GradeConfig | null | undefined): PeriodWeights {
    return {
        pdc1: config?.pdc1?.weights ?? DEFAULT_PDC1,
        pdc2: config?.pdc2?.weights ?? DEFAULT_PDC2,
        ta: config?.ta?.weights ?? DEFAULT_TA,
    };
}

export function useGradeConfiguration() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [weightsByPeriod, setWeightsByPeriod] = useState<Record<string, PeriodWeights>>({});

    const { data: periods = [], isLoading: isLoadingPeriods } = useQuery({
        queryKey: [...QUERY_KEY, 'periods'],
        queryFn: fetchPeriods,
        staleTime: Infinity,
    });

    const effectivePeriodId = useMemo(
        () => selectedPeriod || getDefaultPeriodId(periods),
        [selectedPeriod, periods]
    );

    const { data: config, isLoading: isLoadingConfig } = useQuery({
        queryKey: [...QUERY_KEY, effectivePeriodId],
        queryFn: () => fetchConfig(effectivePeriodId),
        enabled: !!effectivePeriodId,
    });

    const currentWeights = useMemo(
        () => weightsByPeriod[effectivePeriodId] ?? configToWeights(config),
        [weightsByPeriod, effectivePeriodId, config]
    );

    const saveMutation = useMutation({
        mutationFn: async () => {
            const { pdc1, pdc2, ta } = currentWeights;
            const pdc1Total = Object.values(pdc1).reduce((sum, weight) => sum + weight, 0);
            const pdc2Total = Object.values(pdc2).reduce((sum, weight) => sum + weight, 0);
            const taTotal = Object.values(ta).reduce((sum, weight) => sum + weight, 0);

            if (pdc1Total !== 100) throw new Error(`PDC1 weights must total 100%. Current total: ${pdc1Total}%`);
            if (pdc2Total !== 100) throw new Error(`PDC2 weights must total 100%. Current total: ${pdc2Total}%`);
            if (taTotal !== 100) throw new Error(`TA weights must total 100%. Current total: ${taTotal}%`);

            await api.post(`/admin/grade-configuration/${effectivePeriodId}`, {
                pdc1_weights: pdc1,
                pdc2_weights: pdc2,
                ta_weights: ta,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, effectivePeriodId] });
            toast.success('Grade configuration saved successfully');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to save grade configuration'));
        },
    });

    const resetMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/admin/grade-configuration/${effectivePeriodId}/reset`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, effectivePeriodId] });
            setWeightsByPeriod((prev) => {
                const next = { ...prev };
                delete next[effectivePeriodId];
                return next;
            });
            toast.success('Reset to defaults');
        },
        onError: (error: unknown) => {
            toast.error(api.getApiErrorMessage(error, 'Failed to reset configuration'));
        },
    });

    const updateWeights = (periodId: string, updater: (weights: PeriodWeights) => PeriodWeights) => {
        setWeightsByPeriod((prev) => ({
            ...prev,
            [periodId]: updater(prev[periodId] ?? configToWeights(config)),
        }));
    };

    const updatePdc1Weight = (key: keyof Pdc1Weights, value: string) => {
        const numValue = parseFloat(value) || 0;
        updateWeights(effectivePeriodId, (weights) => ({ ...weights, pdc1: { ...weights.pdc1, [key]: numValue } }));
    };

    const updatePdc2Weight = (key: keyof Pdc2Weights, value: string) => {
        const numValue = parseFloat(value) || 0;
        updateWeights(effectivePeriodId, (weights) => ({ ...weights, pdc2: { ...weights.pdc2, [key]: numValue } }));
    };

    const updateTaWeight = (key: keyof TaWeights, value: string) => {
        const numValue = parseFloat(value) || 0;
        updateWeights(effectivePeriodId, (weights) => ({ ...weights, ta: { ...weights.ta, [key]: numValue } }));
    };

    const isLoading = isLoadingPeriods || isLoadingConfig;

    return {
        periods,
        selectedPeriod: effectivePeriodId,
        setSelectedPeriod,
        pdc1Weights: currentWeights.pdc1,
        pdc2Weights: currentWeights.pdc2,
        taWeights: currentWeights.ta,
        updatePdc1Weight,
        updatePdc2Weight,
        updateTaWeight,
        isLoading,
        isSaving: saveMutation.isPending,
        isResetting: resetMutation.isPending,
        handleSave: () => saveMutation.mutate(),
        handleReset: () => resetMutation.mutate(),
    };
}
