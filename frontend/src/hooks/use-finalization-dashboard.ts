'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
  DashboardTab,
  OthersSubTab,
  DashboardResponse,
  DashboardStats,
  Period,
  FilterState,
} from '@/types/finalization';

interface UseFinalizationDashboardReturn {
  // Data
  period: Period | null;
  periods: Period[];
  stats: DashboardStats | null;
  data: DashboardResponse['data'] | null;

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
  refresh: () => void;
  selectPeriod: (periodId: number) => void;
  setShowPeriodSelector: (show: boolean) => void;
  fetchActivePeriods: () => Promise<void>;
}

export function useFinalizationDashboard(
  initialPeriodId?: number
): UseFinalizationDashboardReturn {
  // State
  const [period, setPeriod] = useState<Period | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('ready');
  const [activeSubTab, setActiveSubTab] = useState<OthersSubTab>('no_group');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    perPage: 20,
    page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(initialPeriodId);

  // Removed LocalStorage on mount to enforce period selection when clicking menu
  useEffect(() => {
    // If we want any initialization code it can go here,
    // but we no longer read from localStorage.
  }, []);

  // Fetch active periods
  const fetchActivePeriods = useCallback(async () => {
    try {
      const response = await api.get<Period[]>('/admin/periods', {
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

      const response = await api.get<DashboardResponse>('/admin/finalization/dashboard', {
        params,
      });

      setPeriod(response.data.period);
      setStats(response.data.stats);
      setData(response.data.data);
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

  const handleRefresh = useCallback(() => {
    fetchData();
    toast.success('Data refreshed');
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
      setSelectedPeriodId(undefined);
      fetchActivePeriods();
    }
  }, [fetchActivePeriods]);

  return {
    period,
    periods,
    stats,
    data,
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
    refresh: handleRefresh,
    selectPeriod: handleSelectPeriod,
    setShowPeriodSelector: handleSetShowPeriodSelector,
    fetchActivePeriods,
  };
}
