'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { LecturerWithLoad, LecturersResponse } from '@/types/finalization';

interface UseSupervisorLoadReturn {
  lecturers: LecturerWithLoad[];
  loading: boolean;
  error: string | null;
  getLecturerById: (id: number) => LecturerWithLoad | undefined;
  getAvailableLecturers: () => LecturerWithLoad[];
  refresh: () => void;
}

export function useSupervisorLoad(periodId?: number): UseSupervisorLoadReturn {
  const [lecturers, setLecturers] = useState<LecturerWithLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLecturers = useCallback(async () => {
    if (!periodId) return;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, number> = {};
      if (periodId) {
        params.period_id = periodId;
      }

      const response = await api.get<LecturersResponse>('/admin/finalization/lecturers', {
        params,
      });

      setLecturers(response.data.lecturers);
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to load lecturers'
        : 'An unexpected error occurred';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    fetchLecturers();
  }, [fetchLecturers]);

  const getLecturerById = useCallback(
    (id: number) => {
      return lecturers.find((l) => l.id === id);
    },
    [lecturers]
  );

  const getAvailableLecturers = useCallback(() => {
    return lecturers.filter((l) => !l.is_overloaded);
  }, [lecturers]);

  const refresh = useCallback(() => {
    fetchLecturers();
    toast.success('Lecturer data refreshed');
  }, [fetchLecturers]);

  return {
    lecturers,
    loading,
    error,
    getLecturerById,
    getAvailableLecturers,
    refresh,
  };
}
