"use client";

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Group, PeriodOption } from '../types';

const GROUPS_QUERY_KEY = ['dosen', 'supervised-groups'] as const;
const PERIODS_QUERY_KEY = ['periods-list'] as const;

export function useSupervisedGroups() {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    const { data: periods = [], isLoading: periodsLoading } = useQuery({
        queryKey: PERIODS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/periods-list');
            return (response.data?.data || []) as PeriodOption[];
        },
    });

    const { data: groups = [], isLoading: groupsLoading, isFetching: groupsFetching } = useQuery({
        queryKey: [...GROUPS_QUERY_KEY, selectedPeriod],
        queryFn: async () => {
            const url = selectedPeriod && selectedPeriod !== 'all'
                ? `/dosen/groups/supervised?period_id=${selectedPeriod}`
                : '/dosen/groups/supervised';
            const response = await api.get(url);
            return (response.data?.data || []) as Group[];
        },
    });

    const handlePeriodChange = useCallback((val: string) => {
        setSelectedPeriod(val);
    }, []);

    const loading = periodsLoading || groupsLoading;
    const refreshing = groupsFetching && !groupsLoading;

    return {
        groups,
        groupsLoading,
        periods,
        selectedPeriod,
        refreshing,
        loading,
        handlePeriodChange,
    };
}
