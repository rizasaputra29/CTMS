"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { AuditLog, AuditLogPeriod, AuditLogPagination } from '@/features/admin/audit-logs/types';

const QUERY_KEY = ['admin', 'audit-logs'] as const;

const PER_PAGE_OPTIONS = [15, 30, 50, 100];

const fetchActionTypes = async (): Promise<string[]> => {
    const response = await api.get('/admin/audit-logs/action-types');
    return response.data?.data || [];
};

const fetchPeriods = async (): Promise<AuditLogPeriod[]> => {
    const response = await api.get('/periods-list');
    return response.data?.data || [];
};

interface FetchLogsParams {
    page: number;
    perPage: number;
    selectedAction: string;
    selectedPeriod: string;
    searchQuery: string;
    dateFrom?: Date;
    dateTo?: Date;
}

const fetchLogs = async (params: FetchLogsParams): Promise<{ logs: AuditLog[]; pagination: AuditLogPagination }> => {
    const apiParams: Record<string, string | number> = {
        page: params.page,
        per_page: params.perPage,
    };

    if (params.selectedAction !== 'all') {
        apiParams.action = params.selectedAction;
    }
    if (params.selectedPeriod !== 'all') {
        apiParams.period_id = params.selectedPeriod;
    }
    if (params.searchQuery) {
        apiParams.search = params.searchQuery;
    }
    if (params.dateFrom) {
        apiParams.date_from = format(params.dateFrom, 'yyyy-MM-dd');
    }
    if (params.dateTo) {
        apiParams.date_to = format(params.dateTo, 'yyyy-MM-dd');
    }

    const response = await api.get('/admin/audit-logs', { params: apiParams });
    return {
        logs: response.data?.data || [],
        pagination: {
            current_page: response.data?.pagination?.current_page || 1,
            last_page: response.data?.pagination?.last_page || 1,
            per_page: response.data?.pagination?.per_page || 10,
            total: response.data?.pagination?.total || 0,
        },
    };
};

export function useAuditLogs() {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [selectedAction, setSelectedAction] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    useEffect(() => {
        const debounce = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const { data: actionTypes = [] } = useQuery({
        queryKey: [...QUERY_KEY, 'action-types'],
        queryFn: fetchActionTypes,
        staleTime: Infinity,
    });

    const { data: periods = [] } = useQuery({
        queryKey: [...QUERY_KEY, 'periods'],
        queryFn: fetchPeriods,
        staleTime: Infinity,
    });

    const { data, isLoading, error } = useQuery({
        queryKey: [...QUERY_KEY, page, perPage, selectedAction, selectedPeriod, debouncedSearchQuery, dateFrom, dateTo],
        queryFn: () => fetchLogs({ page, perPage, selectedAction, selectedPeriod, searchQuery: debouncedSearchQuery, dateFrom, dateTo }),
    });

    useEffect(() => {
        if (error) {
            console.error('Failed to fetch audit logs', error);
            toast.error('Failed to load audit logs');
        }
    }, [error]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setPage(1);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedAction('all');
        setSelectedPeriod('all');
        setDateFrom(undefined);
        setDateTo(undefined);
        setPage(1);
    };

    const hasActiveFilters =
        selectedAction !== 'all' ||
        selectedPeriod !== 'all' ||
        dateFrom !== undefined ||
        dateTo !== undefined ||
        searchQuery !== '';

    return {
        logs: data?.logs || [],
        pagination: data?.pagination || { current_page: 1, last_page: 1, per_page: 10, total: 0 },
        isLoading,
        actionTypes,
        periods,
        searchQuery,
        setSearchQuery,
        selectedAction,
        setSelectedAction,
        selectedPeriod,
        setSelectedPeriod,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        page,
        perPage,
        perPageOptions: PER_PAGE_OPTIONS,
        handlePageChange,
        handlePerPageChange,
        clearFilters,
        hasActiveFilters,
    };
}
