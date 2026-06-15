'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
    Period,
    Dosen,
    Location,
    TaDefenseSchedule,
    EligibleStudentData,
    SortKey,
    SortDir,
    StatusFilter,
} from '../types';
import type { TaDefenseFormData } from '@/lib/validations/ta-defense';

function isStatusFilter(value: string): value is StatusFilter {
    return ['ALL', 'SCHEDULED', 'DONE', 'CANCELLED'].includes(value);
}

const PAGE_SIZES = [10, 25, 50];

interface UseTaDefenseReturn {
    periods: Period[];
    dosens: Dosen[];
    locations: Location[];
    schedules: TaDefenseSchedule[];
    eligibleGroups: EligibleStudentData[];
    selectedPeriod: string;
    setSelectedPeriod: (value: string) => void;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    statusFilter: StatusFilter;
    setStatusFilter: (value: StatusFilter) => void;
    sortKey: SortKey;
    sortDir: SortDir;
    handleSort: (key: SortKey) => void;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (size: number) => void;
    pageSizes: number[];
    expandedSchedules: Set<number>;
    toggleExpanded: (id: number) => void;
    filteredSchedules: TaDefenseSchedule[];
    isLoading: boolean;
    fetchEligibleGroups: (periodId: string) => Promise<void>;
    createSchedule: (data: TaDefenseFormData) => Promise<void>;
    updateSchedule: (variables: { id: number; data: TaDefenseFormData; periodId: number }) => Promise<void>;
    cancelSchedule: (id: number) => Promise<void>;
    isCreating: boolean;
    isUpdating: boolean;
    isCancelling: boolean;
}

export function useTaDefense(): UseTaDefenseReturn {
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedSchedules, setExpandedSchedules] = useState<Set<number>>(new Set());

    const isEnabled = typeof window !== 'undefined';

    const { data: periods = [], isLoading: isLoadingPeriods } = useQuery<Period[]>({
        queryKey: ['admin', 'periods'],
        queryFn: async () => {
            const res = await api.get('/admin/periods');
            return res.data.data || [];
        },
        enabled: isEnabled,
    });

    const { data: dosens = [], isLoading: isLoadingDosens } = useQuery<Dosen[]>({
        queryKey: ['admin', 'users', 'dosen'],
        queryFn: async () => {
            const res = await api.get('/admin/users?role=dosen');
            const data = res.data?.data || res.data || [];
            return Array.isArray(data) ? data : data.data || [];
        },
        enabled: isEnabled,
    });

    const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
        queryKey: ['locations'],
        queryFn: async () => {
            const res = await api.get('/locations');
            return res.data?.data || [];
        },
        enabled: isEnabled,
    });

    const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery<TaDefenseSchedule[]>({
        queryKey: ['admin', 'ta-defense-schedules', selectedPeriod],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (selectedPeriod) {
                params.period_id = selectedPeriod;
            }
            const res = await api.get('/admin/ta-defense-schedules', { params });
            return res.data.data || [];
        },
        enabled: isEnabled,
    });

    const { data: eligibleGroups = [], isLoading: isLoadingEligible } = useQuery<EligibleStudentData[]>({
        queryKey: ['admin', 'ta-defense-schedules', 'eligible-students', selectedPeriod],
        queryFn: async () => {
            if (!selectedPeriod || selectedPeriod === 'all') return [];
            const res = await api.get('/admin/ta-defense-schedules/eligible-students', {
                params: { period_id: selectedPeriod },
            });
            return res.data.data || [];
        },
        enabled: isEnabled && !!selectedPeriod && selectedPeriod !== 'all',
    });

    const fetchEligibleGroups = useCallback(async (periodId: string) => {
        if (!periodId || periodId === 'all') return;
        await queryClient.fetchQuery({
            queryKey: ['admin', 'ta-defense-schedules', 'eligible-students', periodId],
            queryFn: async () => {
                const res = await api.get('/admin/ta-defense-schedules/eligible-students', {
                    params: { period_id: periodId },
                });
                return res.data.data || [];
            },
        });
    }, [queryClient]);

    const invalidateSchedules = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'ta-defense-schedules'] });
    }, [queryClient]);

    const createMutation = useMutation({
        mutationFn: async (data: TaDefenseFormData) => {
            const res = await api.post('/admin/ta-defense-schedules', {
                student_ids: data.student_ids.map(id => parseInt(id)),
                group_id: parseInt(data.group_id),
                period_id: parseInt(data.period_id),
                examiner_1_id: parseInt(data.examiner_1_id),
                examiner_2_id: parseInt(data.examiner_2_id),
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                location_id: data.location_id ? parseInt(data.location_id) : null,
                notes: data.notes || null,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('TA Defense schedule created');
            invalidateSchedules();
        },
        onError: (error: unknown) => {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to create schedule'
                : 'Failed to create schedule';
            toast.error(message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data, periodId }: { id: number; data: TaDefenseFormData; periodId: number }) => {
            const res = await api.put(`/admin/ta-defense-schedules/${id}`, {
                period_id: periodId,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                location_id: parseInt(data.location_id),
                examiner_1_id: parseInt(data.examiner_1_id),
                examiner_2_id: parseInt(data.examiner_2_id),
                notes: data.notes || null,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('TA Defense schedule updated');
            invalidateSchedules();
        },
        onError: (error: unknown) => {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to update schedule'
                : 'Failed to update schedule';
            toast.error(message);
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await api.put(`/admin/ta-defense-schedules/${id}/cancel`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Schedule cancelled');
            invalidateSchedules();
        },
        onError: () => {
            toast.error('Failed to cancel schedule');
        },
    });

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(prevKey => {
            setSortDir(prevDir => (prevKey === key ? (prevDir === 'asc' ? 'desc' : 'asc') : 'asc'));
            return key;
        });
        setPage(1);
    }, []);

    const handleStatusFilterChange = useCallback((status: string) => {
        if (isStatusFilter(status)) {
            setStatusFilter(status);
            setPage(1);
        }
    }, []);

    const handlePageSizeChange = useCallback((size: number) => {
        setPageSize(size);
        setPage(1);
    }, []);

    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
        setPage(1);
    }, []);

    const toggleExpanded = useCallback((id: number) => {
        setExpandedSchedules(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const filteredAndSorted = useMemo(() => {
        const result = schedules.filter(s => {
            const q = searchQuery.toLowerCase();
            const studentMatch = s.students?.some(
                st => st.name?.toLowerCase().includes(q) || st.nim?.toLowerCase().includes(q)
            ) || s.student?.name?.toLowerCase().includes(q);
            const locationName = locations.find(l => l.id === s.location_id)?.name || s.room || '';
            return (
                studentMatch ||
                s.group?.id?.toString().includes(q) ||
                locationName.toLowerCase().includes(q)
            );
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                const aName = a.students?.[0]?.name || a.student?.name || '';
                const bName = b.students?.[0]?.name || b.student?.name || '';
                cmp = aName.localeCompare(bName);
            } else if (sortKey === 'date') {
                cmp = (a.date || '').localeCompare(b.date || '');
            } else if (sortKey === 'status') {
                cmp = (a.status || '').localeCompare(b.status || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [schedules, searchQuery, sortKey, sortDir, locations]);

    const filteredSchedules = useMemo(() => {
        if (statusFilter === 'ALL') return filteredAndSorted;
        return filteredAndSorted.filter(s => s.status === statusFilter);
    }, [filteredAndSorted, statusFilter]);

    const isLoading = isLoadingPeriods || isLoadingDosens || isLoadingLocations || isLoadingSchedules || isLoadingEligible;

    return {
        periods,
        dosens,
        locations,
        schedules,
        eligibleGroups,
        selectedPeriod,
        setSelectedPeriod,
        searchQuery,
        setSearchQuery: handleSearchChange,
        statusFilter,
        setStatusFilter: handleStatusFilterChange,
        sortKey,
        sortDir,
        handleSort,
        page,
        setPage,
        pageSize,
        setPageSize: handlePageSizeChange,
        pageSizes: PAGE_SIZES,
        expandedSchedules,
        toggleExpanded,
        filteredSchedules,
        isLoading,
        fetchEligibleGroups,
        createSchedule: createMutation.mutateAsync,
        updateSchedule: updateMutation.mutateAsync,
        cancelSchedule: cancelMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isCancelling: cancelMutation.isPending,
    };
}
