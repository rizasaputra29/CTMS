'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LecturerWithLoad, LecturersResponse } from '@/types/finalization';

const QUERY_KEY = ['admin', 'supervisor-load'] as const;

const fetchLecturers = async (periodId: number): Promise<LecturerWithLoad[]> => {
  const res = await api.get<LecturersResponse>('/admin/finalization/lecturers', {
    params: { period_id: periodId },
  });
  return res.data.lecturers;
};

interface UseSupervisorLoadReturn {
  lecturers: LecturerWithLoad[];
  loading: boolean;
  error: string | null;
  getLecturerById: (id: number) => LecturerWithLoad | undefined;
  getAvailableLecturers: () => LecturerWithLoad[];
  refresh: () => void;
}

export function useSupervisorLoad(periodId?: number): UseSupervisorLoadReturn {
  const {
    data: lecturers = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...QUERY_KEY, periodId],
    queryFn: () => fetchLecturers(periodId as number),
    enabled: !!periodId,
  });

  const getLecturerById = useCallback(
    (id: number) => {
      return lecturers.find((l) => l.id === id);
    },
    [lecturers]
  );

  const getAvailableLecturers = useCallback(() => {
    return lecturers.filter((l) => !l.is_overloaded);
  }, [lecturers]);

  return {
    lecturers,
    loading: isLoading,
    error: error ? api.getApiErrorMessage(error, 'Failed to load lecturers') : null,
    getLecturerById,
    getAvailableLecturers,
    refresh: refetch,
  };
}
