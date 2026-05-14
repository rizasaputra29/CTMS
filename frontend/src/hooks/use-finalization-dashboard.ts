'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
  DashboardTab,
  OthersSubTab,
  DashboardResponse,
  DashboardStats,
  FinalizationFlow,
  Period,
  FilterState,
} from '@/types/finalization';

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
  error: string | null;
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
    return {
      tab: (searchParams.get('tab') as DashboardTab) || 'ready',
      subTab: (searchParams.get('sub_tab') as OthersSubTab) || 'no_group',
      search: searchParams.get('search') || '',
      page: parseInt(searchParams.get('page') || '1', 10),
      perPage: parseInt(searchParams.get('per_page') || '20', 10),
      supervisorStatus: (searchParams.get('supervisor_status') as FilterState['supervisorStatus']) || 'all',
      memberCount: (searchParams.get('member_count') as FilterState['memberCount']) || 'all',
      periodId: searchParams.get('period_id')
        ? parseInt(searchParams.get('period_id')!, 10)
        : initialPeriodId,
    };
  }, [searchParams, initialPeriodId]);

  const urlParams = parseUrlParams();

  // State
  const [period, setPeriod] = useState<Period | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [flow, setFlow] = useState<FinalizationFlow | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(urlParams.tab);
  const [activeSubTab, setActiveSubTab] = useState<OthersSubTab>(urlParams.subTab);
  const [filters, setFilters] = useState<FilterState>({
    search: urlParams.search,
    perPage: urlParams.perPage,
    page: urlParams.page,
    supervisorStatus: urlParams.supervisorStatus,
    memberCount: urlParams.memberCount,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(urlParams.periodId);

  // Update URL params when state changes
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    if (selectedPeriodId) {
      params.set('period_id', selectedPeriodId.toString());
    }
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
  }, [router, selectedPeriodId, activeTab, activeSubTab, filters]);

  // Fetch active periods
  const fetchActivePeriods = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; message: string; data: Period[] }>('/admin/periods', {
        params: { is_active: true },
      });
      setPeriods(response.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch active periods', err);
    }
  }, []);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {
        tab: activeTab,
        per_page: filters.perPage,
        page: filters.page,
      };

      if (filters.search) {
        params.search = filters.search;
      }

      if (selectedPeriodId) {
        params.period_id = selectedPeriodId;
      }

      if (activeTab === 'others') {
        params.sub_tab = activeSubTab;
      }

      // Add advanced filters
      if (filters.supervisorStatus && filters.supervisorStatus !== 'all') {
        params.supervisor_status = filters.supervisorStatus;
      }
    if (filters.memberCount && filters.memberCount !== 'all') {
      params.member_count = filters.memberCount;
    }

      const response = await api.get<DashboardResponse>('/admin/finalization/dashboard', {
        params,
      });

      setPeriod(response.data.period);
      setStats(response.data.stats);
      setData(response.data.data);
      setFlow(response.data.flow || null);
      setShowPeriodSelector(false);
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load dashboard data'
        : 'An unexpected error occurred';

      // Handle "Multiple active periods" error
      if (message.includes('Multiple active periods exist')) {
        setError('Multiple active periods exist. Please select a period.');
        setShowPeriodSelector(true);
        // Fetch available periods
        await fetchActivePeriods();
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeSubTab, filters, selectedPeriodId, fetchActivePeriods]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    // If no period selected, show selector first
    if (!selectedPeriodId) {
      setShowPeriodSelector(true);
      fetchActivePeriods();
    } else {
      fetchData();
    }
  }, [fetchData, selectedPeriodId, fetchActivePeriods]);

  // Reset page when tab or subtab changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [activeTab, activeSubTab]);

  // Debounced search - hanya fetch kalau sudah ada period terpilih
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (filters.search !== undefined && selectedPeriodId) {
        fetchData();
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [filters.search, selectedPeriodId, fetchData]);

  // Update URL params when state changes (excluding search which has debounce)
  useEffect(() => {
    if (selectedPeriodId) {
      updateUrlParams();
    }
  }, [selectedPeriodId, activeTab, activeSubTab, filters.perPage, filters.page, filters.supervisorStatus, filters.memberCount, updateUrlParams]);

  // Actions
  const handleSetActiveTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
  }, []);

  const handleSetActiveSubTab = useCallback((subTab: OthersSubTab) => {
    setActiveSubTab(subTab);
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
    fetchData();
  }, [fetchData]);

  const handleSelectPeriod = useCallback((periodId: number) => {
    setSelectedPeriodId(periodId);
  }, []);

  const handleSetShowPeriodSelector = useCallback((show: boolean) => {
    setShowPeriodSelector(show);
    if (show) {
      // Clear current selection so page shows period selector full-screen
      setPeriod(null);
      setStats(null);
      setData(null);
      setFlow(null);
      setSelectedPeriodId(undefined);
      fetchActivePeriods();
    }
  }, [fetchActivePeriods]);

  return {
    period,
    periods,
    stats,
    data,
    flow,
    activeTab,
    activeSubTab,
    filters,
    loading,
    error,
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
