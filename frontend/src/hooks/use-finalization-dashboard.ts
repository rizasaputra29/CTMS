'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { isDashboardTab, isOthersSubTab, isSupervisorStatus, isMemberCount } from '@/types/finalization';
import type {
  DashboardTab,
  OthersSubTab,
  DashboardResponse,
  DashboardStats,
  FinalizationFlow,
  Period,
  FilterState,
} from '@/types/finalization';

const QUERY_KEY = ['admin', 'finalization-dashboard'] as const;

interface UseFinalizationDashboardReturn {
  // Data
  period: Period | null;
  periods: Period[];
  stats: DashboardStats | null;
  data: DashboardResponse['data'] | null;
  flow: FinalizationFlow | null;

  // State
  activeTab: DashboardTab;
  activeSubTab: OthersSubTab;
  filters: FilterState;
  loading: boolean;
  isLoadingPeriods: boolean;
  error: string | null;
  periodsError: string | null;
  showPeriodSelector: boolean;

  // Actions
  setActiveTab: (tab: DashboardTab) => void;
  setActiveSubTab: (subTab: OthersSubTab) => void;
  setSearch: (search: string) => void;
  setPerPage: (perPage: number) => void;
  setPage: (page: number) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  refresh: () => void;
  selectPeriod: (periodId: number) => void;
  setShowPeriodSelector: (show: boolean) => void;
  fetchActivePeriods: () => Promise<void>;
}

export function useFinalizationDashboard(
  initialPeriodId?: number
): UseFinalizationDashboardReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL params
  const parseUrlParams = useCallback(() => {
    const tabParam = searchParams.get('tab');
    const subTabParam = searchParams.get('sub_tab');
    const svStatusParam = searchParams.get('supervisor_status');
    const memberCountParam = searchParams.get('member_count');

    return {
      tab: isDashboardTab(tabParam || '') ? (tabParam as DashboardTab) : 'ready',
      subTab: isOthersSubTab(subTabParam || '') ? (subTabParam as OthersSubTab) : 'no_group',
      search: searchParams.get('search') || '',
      page: parseInt(searchParams.get('page') || '1', 10),
      perPage: parseInt(searchParams.get('per_page') || '20', 10),
      supervisorStatus: isSupervisorStatus(svStatusParam || 'all')
        ? (svStatusParam as FilterState['supervisorStatus'])
        : 'all',
      memberCount: isMemberCount(memberCountParam || 'all')
        ? (memberCountParam as FilterState['memberCount'])
        : 'all',
      periodId: searchParams.get('period_id')
        ? parseInt(searchParams.get('period_id')!, 10)
        : initialPeriodId,
    };
  }, [searchParams, initialPeriodId]);

  const urlParams = parseUrlParams();

  // ── State ──────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<DashboardTab>(urlParams.tab);
  const [activeSubTab, setActiveSubTab] = useState<OthersSubTab>(urlParams.subTab);
  const [filters, setFilters] = useState<FilterState>({
    search: urlParams.search,
    perPage: urlParams.perPage,
    page: urlParams.page,
    ...(urlParams.supervisorStatus ? { supervisorStatus: urlParams.supervisorStatus } : {}),
    ...(urlParams.memberCount ? { memberCount: urlParams.memberCount } : {}),
  });
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(urlParams.periodId);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Debounced search ───────────────────────────────────────────────

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // ── Queries ────────────────────────────────────────────────────────

  const periodsQuery = useQuery<Period[]>({
    queryKey: [...QUERY_KEY, 'periods'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; message: string; data: Period[] }>(
        '/admin/periods',
        { params: { is_active: true } }
      );
      return response.data?.data || [];
    },
  });

  const dashboardQuery = useQuery({
    queryKey: [
      ...QUERY_KEY,
      'dashboard',
      selectedPeriodId,
      activeTab,
      activeSubTab,
      debouncedSearch,
      filters.page,
      filters.perPage,
      filters.supervisorStatus,
      filters.memberCount,
    ] as const,
    queryFn: async (): Promise<DashboardResponse> => {
      const params: Record<string, string | number> = {
        tab: activeTab,
        per_page: filters.perPage,
        page: filters.page,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedPeriodId) params.period_id = selectedPeriodId;
      if (activeTab === 'others') params.sub_tab = activeSubTab;
      if (filters.supervisorStatus && filters.supervisorStatus !== 'all') {
        params.supervisor_status = filters.supervisorStatus;
      }
      if (filters.memberCount && filters.memberCount !== 'all') {
        params.member_count = filters.memberCount;
      }
      const response = await api.get('/admin/finalization/dashboard', { params });
      return (response.data?.data ?? response.data) as DashboardResponse;
    },
    enabled: !!selectedPeriodId,
  });

  // Refs so callbacks stay stable across renders
  const periodsQueryRef = useRef(periodsQuery);
  const dashboardQueryRef = useRef(dashboardQuery);

  useEffect(() => {
    periodsQueryRef.current = periodsQuery;
    dashboardQueryRef.current = dashboardQuery;
  });

  // ── Effects ────────────────────────────────────────────────────────

  // Clear error on new fetch; surface errors once fetch settles
  useEffect(() => {
    if (dashboardQuery.isFetching) {
      setError(null);
    } else if (dashboardQuery.error) {
      const message = api.getApiErrorMessage(dashboardQuery.error, 'Failed to load dashboard data');
      if (message.includes('Multiple active periods exist')) {
        setError('Multiple active periods exist. Please select a period.');
        setShowPeriodSelector(true);
      } else {
        setError(message);
        toast.error(message);
      }
    }
  }, [dashboardQuery.isFetching, dashboardQuery.error]);

  // Auto-show period selector when no period is selected
  useEffect(() => {
    if (!selectedPeriodId) {
      setShowPeriodSelector(true);
    }
  }, [selectedPeriodId]);

  // Auto-hide period selector once dashboard data loads successfully
  useEffect(() => {
    if (dashboardQuery.isSuccess && selectedPeriodId) {
      setShowPeriodSelector(false);
    }
  }, [dashboardQuery.isSuccess, selectedPeriodId]);

  // Sync state → URL params
  useEffect(() => {
    if (selectedPeriodId) {
      const params = new URLSearchParams();
      params.set('period_id', selectedPeriodId.toString());
      params.set('tab', activeTab);
      if (activeTab === 'others') {
        params.set('sub_tab', activeSubTab);
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.page > 1) {
        params.set('page', filters.page.toString());
      }
      if (filters.perPage !== 20) {
        params.set('per_page', filters.perPage.toString());
      }
      if (filters.supervisorStatus && filters.supervisorStatus !== 'all') {
        params.set('supervisor_status', filters.supervisorStatus);
      }
      if (filters.memberCount && filters.memberCount !== 'all') {
        params.set('member_count', filters.memberCount);
      }
      const queryString = params.toString();
      const newUrl = queryString ? `?${queryString}` : '';
      router.replace(newUrl, { scroll: false });
    }
  }, [
    router,
    selectedPeriodId,
    activeTab,
    activeSubTab,
    filters.perPage,
    filters.page,
    filters.supervisorStatus,
    filters.memberCount,
    filters.search,
  ]);

  // ── Actions ────────────────────────────────────────────────────────

  const handleSetActiveTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleSetActiveSubTab = useCallback((subTab: OthersSubTab) => {
    setActiveSubTab(subTab);
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleSetSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleSetPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  const handleSetPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleSetFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handleRefresh = useCallback(() => {
    // Bypass debounce and refetch immediately
    setDebouncedSearch(filters.search);
    dashboardQueryRef.current.refetch();
  }, [filters.search]);

  const handleSelectPeriod = useCallback((periodId: number) => {
    setSelectedPeriodId(periodId);
    setShowPeriodSelector(false);
    setFilters((prev) => ({
      ...prev,
      search: '',
      page: 1,
      supervisorStatus: 'all',
      memberCount: 'all',
    }));
  }, []);

  const handleSetShowPeriodSelector = useCallback((show: boolean) => {
    setShowPeriodSelector(show);
    if (show) {
      // Clear period selection so the page shows the period selector full-screen
      setSelectedPeriodId(undefined);
      periodsQueryRef.current.refetch();
    }
  }, []);

  const fetchActivePeriods = useCallback(async (): Promise<void> => {
    await periodsQueryRef.current.refetch();
  }, []);

  // ── Derived data ───────────────────────────────────────────────────

  const periods = periodsQuery.data || [];
  const isLoadingPeriods = periodsQuery.isLoading;
  const periodsError = periodsQuery.error
    ? api.getApiErrorMessage(periodsQuery.error, 'Failed to load periods')
    : null;

  return {
    period: showPeriodSelector ? null : (dashboardQuery.data?.period ?? null),
    periods,
    stats: showPeriodSelector ? null : (dashboardQuery.data?.stats ?? null),
    data: showPeriodSelector ? null : (dashboardQuery.data?.data ?? null),
    flow: showPeriodSelector ? null : (dashboardQuery.data?.flow ?? null),
    activeTab,
    activeSubTab,
    filters,
    loading: dashboardQuery.isFetching,
    isLoadingPeriods,
    error,
    periodsError,
    showPeriodSelector,
    setActiveTab: handleSetActiveTab,
    setActiveSubTab: handleSetActiveSubTab,
    setSearch: handleSetSearch,
    setPerPage: handleSetPerPage,
    setPage: handleSetPage,
    setFilters: handleSetFilters,
    refresh: handleRefresh,
    selectPeriod: handleSelectPeriod,
    setShowPeriodSelector: handleSetShowPeriodSelector,
    fetchActivePeriods,
  };
}
