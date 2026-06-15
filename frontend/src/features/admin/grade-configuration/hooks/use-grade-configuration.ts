"use client";

import { useState, useEffect } from 'react';
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

export function useGradeConfiguration() {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [pdc1Weights, setPdc1Weights] = useState<Pdc1Weights>(DEFAULT_PDC1);
    const [pdc2Weights, setPdc2Weights] = useState<Pdc2Weights>(DEFAULT_PDC2);
    const [taWeights, setTaWeights] = useState<TaWeights>(DEFAULT_TA);

    const { data: periods = [], isLoading: isLoadingPeriods } = useQuery({
        queryKey: ['admin', 'periods', 'grade-config'],
        queryFn: fetchPeriods,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (periods.length > 0 && !selectedPeriod) {
            const active = periods.find((p) => p.is_active);
            setSelectedPeriod(active ? active.id.toString() : periods[0].id.toString());
        }
    }, [periods, selectedPeriod]);

    const { data: config, isLoading: isLoadingConfig } = useQuery({
        queryKey: ['admin', 'grade-configuration', selectedPeriod],
        queryFn: () => fetchConfig(selectedPeriod),
        enabled: !!selectedPeriod,
    });

    useEffect(() => {
        if (config) {
            if (config.pdc1?.weights) setPdc1Weights(config.pdc1.weights);
            if (config.pdc2?.weights) setPdc2Weights(config.pdc2.weights);
            if (config.ta?.weights) setTaWeights(config.ta.weights);
        }
    }, [config]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const pdc1Total = Object.values(pdc1Weights).reduce((sum, weight) => sum + weight, 0);
            const pdc2Total = Object.values(pdc2Weights).reduce((sum, weight) => sum + weight, 0);
            const taTotal = Object.values(taWeights).reduce((sum, weight) => sum + weight, 0);

            if (pdc1Total !== 100) throw new Error(`PDC1 weights must total 100%. Current total: ${pdc1Total}%`);
            if (pdc2Total !== 100) throw new Error(`PDC2 weights must total 100%. Current total: ${pdc2Total}%`);
            if (taTotal !== 100) throw new Error(`TA weights must total 100%. Current total: ${taTotal}%`);

            await api.post(`/admin/grade-configuration/${selectedPeriod}`, {
                pdc1_weights: pdc1Weights,
                pdc2_weights: pdc2Weights,
                ta_weights: taWeights,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'grade-configuration', selectedPeriod] });
            toast.success('Grade configuration saved successfully');
        },
        onError: (error: unknown) => {
            if (error instanceof Error) toast.error(error.message);
            else toast.error('Failed to save grade configuration');
        },
    });

    const resetMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/admin/grade-configuration/${selectedPeriod}/reset`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'grade-configuration', selectedPeriod] });
            toast.success('Reset to defaults');
        },
        onError: () => {
            toast.error('Failed to reset configuration');
        },
    });

    const updatePdc1Weight = (key: keyof Pdc1Weights, value: string) => {
        const numValue = parseFloat(value) || 0;
        setPdc1Weights((prev) => ({ ...prev, [key]: numValue }));
    };

    const updatePdc2Weight = (key: keyof Pdc2Weights, value: string) => {
        const numValue = parseFloat(value) || 0;
        setPdc2Weights((prev) => ({ ...prev, [key]: numValue }));
    };

    const updateTaWeight = (key: keyof TaWeights, value: string) => {
        const numValue = parseFloat(value) || 0;
        setTaWeights((prev) => ({ ...prev, [key]: numValue }));
    };

    const isLoading = isLoadingPeriods || isLoadingConfig;

    return {
        periods,
        selectedPeriod,
        setSelectedPeriod,
        pdc1Weights,
        pdc2Weights,
        taWeights,
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
