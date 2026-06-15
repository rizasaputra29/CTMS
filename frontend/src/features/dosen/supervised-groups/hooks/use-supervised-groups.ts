"use client";

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { Group, PeriodOption } from '../types';

export function useSupervisedGroups() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(true);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setGroupsLoading(true);

        try {
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

            const url = periodId && periodId !== 'all'
                ? `/dosen/groups/supervised?period_id=${periodId}`
                : '/dosen/groups/supervised';

            const res = await api.get(url);
            setGroups(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch supervised groups', err);
        } finally {
            setGroupsLoading(false);
            setRefreshing(false);
        }
    }, [periods.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    return {
        groups,
        groupsLoading,
        periods,
        selectedPeriod,
        refreshing,
        handlePeriodChange,
    };
}
