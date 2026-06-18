"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AssessmentPeriod, AssessmentComponent } from '@/features/admin/assessments/types';

const QUERY_KEY = ["admin", "assessments"] as const;

const EVALUATION_TYPES = [
    { value: 'SEMPRO', label: 'SEMPRO', description: 'Seminar Proposal' },
    { value: 'SIDANG_TA', label: 'SIDANG_TA', description: 'Sidang Tugas Akhir' },
    { value: 'EXPO', label: 'EXPO', description: 'Expo' },
    { value: 'BIMBINGAN_SEMPRO', label: 'BIMBINGAN_SEMPRO', description: 'Penilaian Dosbing SEMPRO' },
    { value: 'BIMBINGAN_TA', label: 'BIMBINGAN_TA', description: 'Penilaian Dosbing Sidang TA' },
    { value: 'NILAI_DOSEN', label: 'NILAI_DOSEN', description: 'Nilai Dosen Pembimbing' },
    { value: 'MILESTONE', label: 'MILESTONE', description: 'Penilaian Milestone' },
];

const fetchPeriods = async (): Promise<AssessmentPeriod[]> => {
    const res = await api.get('/admin/periods');
    return res.data?.data || [];
};

const fetchComponents = async (periodId: string, type: string): Promise<AssessmentComponent[]> => {
    const res = await api.get('/admin/assessment-components', {
        params: { period_id: periodId, type },
    });
    return res.data || [];
};

export function useAssessments() {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('SEMPRO');

    const { data: periods = [], isLoading: isLoadingPeriods } = useQuery({
        queryKey: [...QUERY_KEY, 'periods'],
        queryFn: fetchPeriods,
        staleTime: Infinity,
    });

    const effectivePeriod = useMemo(() => {
        if (selectedPeriod) return selectedPeriod;
        if (periods.length === 0) return '';
        const active = periods.find((p) => p.is_active);
        return active ? active.id.toString() : periods[0].id.toString();
    }, [periods, selectedPeriod]);

    const { data: components = [], isLoading: isLoadingComponents } = useQuery({
        queryKey: [...QUERY_KEY, 'components', effectivePeriod, selectedType],
        queryFn: () => fetchComponents(effectivePeriod, selectedType),
        enabled: !!effectivePeriod && !!selectedType,
    });

    const totalWeight = components.reduce((sum, c) => sum + Number(c.weight), 0);
    const typeLabel = EVALUATION_TYPES.find((t) => t.value === selectedType)?.label || selectedType;

    return {
        periods,
        isLoadingPeriods,
        selectedPeriod: effectivePeriod,
        setSelectedPeriod,
        selectedType,
        setSelectedType,
        evaluationTypes: EVALUATION_TYPES,
        components,
        isLoadingComponents,
        totalWeight,
        typeLabel,
    };
}
