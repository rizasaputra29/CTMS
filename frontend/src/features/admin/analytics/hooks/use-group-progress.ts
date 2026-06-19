"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
    GroupProgress,
    GroupProgressMeta,
    GroupProgressPeriod,
} from '@/features/admin/analytics/types';

const QUERY_KEY = ['admin', 'group-progress'] as const;

const STATUS_ORDER = [
    'FORMING',
    'FORMING_SOLO',
    'READY_FOR_BIDDING',
    'TITLE_PROPOSED',
    'TITLE_APPROVED',
    'READY_FOR_FINALIZATION',
    'KELOMPOK_FINAL',
    'PDC1_ACTIVE',
    'READY_FOR_SEMPRO',
    'SEMPRO_DONE',
    'PDC2_ACTIVE',
    'TA_DRAFT',
    'PDC2_READY_FOR_EXPO',
    'EXPO_REGISTERED',
    'EXPO_DONE',
    'READY_FOR_TA_INDIVIDUAL',
    'TA_IN_PROGRESS',
    'CLOSED',
    'DISSOLVED',
];

function calculateProgressPercentage(status: string): number {
    const statusIndex = STATUS_ORDER.indexOf(status);
    if (statusIndex === -1) return 0;
    return Math.min(Math.round((statusIndex / STATUS_ORDER.length) * 100), 100);
}

const fetchPeriods = async (): Promise<GroupProgressPeriod[]> => {
    const res = await api.get('/admin/periods?per_page=100');
    return res.data?.data || [];
};

interface FetchProgressParams {
    page: number;
    perPage: number;
    selectedPeriod: string;
    status: string;
    searchQuery: string;
}

const fetchProgress = async (params: FetchProgressParams): Promise<{ groups: GroupProgress[]; meta: GroupProgressMeta | null }> => {
    const apiParams: Record<string, string | number> = {
        page: params.page,
        per_page: params.perPage,
    };

    if (params.selectedPeriod !== 'all') {
        apiParams.period_id = params.selectedPeriod;
    }
    if (params.status !== 'all') {
        apiParams.status = params.status;
    }
    if (params.searchQuery) {
        apiParams.search = params.searchQuery;
    }

    try {
        const res = await api.get('/admin/analytics/group-progress', { params: apiParams });
        return {
            groups: res.data?.data || [],
            meta: res.data?.meta || null,
        };
    } catch (error) {
        console.error('Failed to fetch group progress', error);
        toast.error('Failed to load group progress data');

        // Fallback to regular groups endpoint
        try {
            const fallbackParams: Record<string, string | number> = {
                page: params.page,
                per_page: params.perPage,
            };
            if (params.selectedPeriod !== 'all') {
                fallbackParams.period_id = params.selectedPeriod;
            }
            if (params.status !== 'all') {
                fallbackParams.status = params.status;
            }
            if (params.searchQuery) {
                fallbackParams.search = params.searchQuery;
            }
            const res = await api.get('/admin/groups', { params: fallbackParams });
            const transformedData = (res.data?.data || []).map((group: GroupProgress) => ({
                ...group,
                progress: null,
                progress_percentage: calculateProgressPercentage(group.status),
            }));
            return {
                groups: transformedData,
                meta: res.data.meta,
            };
        } catch (fallbackError) {
            console.error('Fallback also failed', fallbackError);
            return { groups: [], meta: null };
        }
    }
};

export function useGroupProgress(initialPeriodId?: string | null) {
    const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriodId || 'all');
    const [status, setStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const debounce = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const { data: periods = [] } = useQuery({
        queryKey: [...QUERY_KEY, 'periods'],
        queryFn: fetchPeriods,
        staleTime: Infinity,
    });

    const { data: progressData, isLoading } = useQuery({
        queryKey: [...QUERY_KEY, page, perPage, selectedPeriod, status, debouncedSearchQuery],
        queryFn: () => fetchProgress({ page, perPage, selectedPeriod, status, searchQuery: debouncedSearchQuery }),
    });

    const groups = progressData?.groups || [];
    const meta = progressData?.meta;

    const completedGroups = groups.filter(g => g.status === 'CLOSED').length;
    const activeGroups = groups.filter(g =>
        ['PDC1_ACTIVE', 'PDC2_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE', 'READY_FOR_TA_INDIVIDUAL', 'TA_IN_PROGRESS'].includes(g.status)
    ).length;
    const avgProgress = groups.length > 0
        ? Math.round(groups.reduce((acc, g) => acc + (g.progress_percentage || 0), 0) / groups.length)
        : 0;

    const handleExport = async () => {
        setDownloading(true);
        try {
            const params: Record<string, string | number> = {
                format: 'csv',
            };

            if (selectedPeriod !== 'all') {
                params.period_id = selectedPeriod;
            }
            if (status !== 'all') {
                params.status = status;
            }
            if (debouncedSearchQuery) {
                params.search = debouncedSearchQuery;
            }

            const res = await api.get('/admin/analytics/group-progress', {
                params,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'group_progress_report.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Progress report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

    return {
        groups,
        meta,
        periods,
        isLoading,
        selectedPeriod,
        setSelectedPeriod,
        status,
        setStatus,
        searchQuery,
        setSearchQuery,
        page,
        setPage,
        perPage,
        setPerPage,
        downloading,
        handleExport,
        completedGroups,
        activeGroups,
        avgProgress,
    };
}
