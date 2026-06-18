import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Group } from '@/types/finalization';

const QUERY_KEY = ['admin', 'manual-grouping'] as const;

// Use Group type directly since backend returns full Group objects
type AvailableGroup = Group;

interface AvailableTitle {
  id: number;
  title: string;
  description?: string;
  quota: number;
  lecturer?: {
    id: number;
    name: string;
  };
}

interface Lecturer {
  id: number;
  name: string;
}

interface CreateManualGroupPayload {
  student_ids: number[];
  period_id: number;
  option: 'no_title' | 'assign_title' | 'add_title';
  title_id?: number;
  new_title?: {
    title: string;
    description?: string;
    specializations: string[];
    lecturer_id: number;
  };
}

interface UseManualGroupingReturn {
  availableGroups: AvailableGroup[];
  availableTitles: AvailableTitle[];
  lecturers: Lecturer[];
  loading: boolean;
  creatingGroup: boolean;
  addingMembers: boolean;
  promotingToReady: boolean;
  fetchingGroups: boolean;
  fetchingTitles: boolean;
  fetchingLecturers: boolean;
  fetchAvailableGroups: (periodId?: number) => Promise<void>;
  fetchAvailableTitles: (periodId?: number) => Promise<void>;
  fetchLecturers: (periodId?: number) => Promise<void>;
  createManualGroup: (data: {
    studentIds: number[];
    periodId: number;
    option: 'no_title' | 'assign_title' | 'add_title';
    titleId?: number;
    newTitle?: {
      title: string;
      description?: string;
      specializations: string[];
      lecturerId: number;
    };
  }) => Promise<boolean>;
  addToExistingGroup: (data: {
    groupId: number;
    studentIds: number[];
  }) => Promise<boolean>;
  assignTitle: (data: {
    groupId: number;
    titleId: number;
  }) => Promise<boolean>;
  promoteToReadyForFinalization: (data: {
    groupId: number;
  }) => Promise<boolean>;
}

export function useManualGrouping(): UseManualGroupingReturn {
  const queryClient = useQueryClient();

  // Period state per query — distinguishes "never called" from "called with no period"
  const [groupsPeriodId, setGroupsPeriodId] = useState<number | undefined>(undefined);
  const [titlesPeriodId, setTitlesPeriodId] = useState<number | undefined>(undefined);
  const [lecturersPeriodId, setLecturersPeriodId] = useState<number | undefined>(undefined);

  // Enabled flags — queries only fire after their fetch function is called
  const [groupsEnabled, setGroupsEnabled] = useState(false);
  const [titlesEnabled, setTitlesEnabled] = useState(false);
  const [lecturersEnabled, setLecturersEnabled] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────

  const groupsQuery = useQuery<AvailableGroup[]>({
    queryKey: [...QUERY_KEY, 'groups', groupsPeriodId],
    queryFn: async () => {
      const params = groupsPeriodId ? { period_id: groupsPeriodId } : {};
      const response = await api.get('/admin/finalization/available-groups', { params });
      return response.data.groups || [];
    },
    enabled: groupsEnabled,
  });

  const titlesQuery = useQuery<AvailableTitle[]>({
    queryKey: [...QUERY_KEY, 'titles', titlesPeriodId],
    queryFn: async () => {
      const params = titlesPeriodId ? { period_id: titlesPeriodId } : {};
      const response = await api.get('/admin/finalization/available-titles', { params });
      return response.data.titles || [];
    },
    enabled: titlesEnabled,
  });

  const lecturersQuery = useQuery<Lecturer[]>({
    queryKey: [...QUERY_KEY, 'lecturers', lecturersPeriodId],
    queryFn: async () => {
      const params = lecturersPeriodId ? { period_id: lecturersPeriodId } : {};
      const response = await api.get('/admin/finalization/lecturers', { params });
      return response.data.lecturers || [];
    },
    enabled: lecturersEnabled,
  });

  // ── Fetch functions (set periodId + enable query) ──────────────────

  const fetchAvailableGroups = useCallback(async (periodId?: number) => {
    setGroupsPeriodId(periodId);
    setGroupsEnabled(true);
  }, []);

  const fetchAvailableTitles = useCallback(async (periodId?: number) => {
    setTitlesPeriodId(periodId);
    setTitlesEnabled(true);
  }, []);

  const fetchLecturers = useCallback(async (periodId?: number) => {
    setLecturersPeriodId(periodId);
    setLecturersEnabled(true);
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────

  const createManualGroupMutation = useMutation({
    mutationFn: async (payload: CreateManualGroupPayload) => {
      await api.post('/admin/finalization/create-manual-group', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Grup berhasil dibuat');
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Gagal membuat grup'));
    },
  });

  const addToExistingGroupMutation = useMutation({
    mutationFn: async (payload: { group_id: number; student_ids: number[] }) => {
      await api.post('/admin/finalization/add-to-existing-group', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Anggota berhasil ditambahkan ke grup');
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Gagal menambahkan anggota'));
    },
  });

  const assignTitleMutation = useMutation({
    mutationFn: async (payload: { group_id: number; title_id: number }) => {
      await api.post('/admin/finalization/assign-title', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Judul berhasil ditetapkan');
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Gagal menetapkan judul'));
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (payload: { group_id: number }) => {
      await api.post('/admin/finalization/promote-to-ready', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Grup berhasil dipromosikan ke Ready for Finalization');
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Gagal mempromosikan grup'));
    },
  });

  // ── Wrapped mutation functions (preserve original return type) ─────

  const createManualGroup = useCallback(async ({
    studentIds,
    periodId,
    option,
    titleId,
    newTitle,
  }: {
    studentIds: number[];
    periodId: number;
    option: 'no_title' | 'assign_title' | 'add_title';
    titleId?: number;
    newTitle?: {
      title: string;
      description?: string;
      specializations: string[];
      lecturerId: number;
    };
  }): Promise<boolean> => {
    try {
      const payload: CreateManualGroupPayload = {
        student_ids: studentIds,
        period_id: periodId,
        option,
      };
      if (option === 'assign_title' && titleId) {
        payload.title_id = titleId;
      }
      if (option === 'add_title' && newTitle) {
        payload.new_title = {
          title: newTitle.title,
          description: newTitle.description,
          specializations: newTitle.specializations,
          lecturer_id: newTitle.lecturerId,
        };
      }
      await createManualGroupMutation.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }, [createManualGroupMutation]);

  const addToExistingGroup = useCallback(async ({
    groupId,
    studentIds,
  }: {
    groupId: number;
    studentIds: number[];
  }): Promise<boolean> => {
    try {
      await addToExistingGroupMutation.mutateAsync({
        group_id: groupId,
        student_ids: studentIds,
      });
      return true;
    } catch {
      return false;
    }
  }, [addToExistingGroupMutation]);

  const assignTitle = useCallback(async ({
    groupId,
    titleId,
  }: {
    groupId: number;
    titleId: number;
  }): Promise<boolean> => {
    try {
      await assignTitleMutation.mutateAsync({
        group_id: groupId,
        title_id: titleId,
      });
      return true;
    } catch {
      return false;
    }
  }, [assignTitleMutation]);

  const promoteToReadyForFinalization = useCallback(async ({
    groupId,
  }: {
    groupId: number;
  }): Promise<boolean> => {
    try {
      await promoteMutation.mutateAsync({ group_id: groupId });
      return true;
    } catch {
      return false;
    }
  }, [promoteMutation]);

  // ── Return ─────────────────────────────────────────────────────────

  return {
    availableGroups: groupsQuery.data || [],
    availableTitles: titlesQuery.data || [],
    lecturers: lecturersQuery.data || [],
    loading:
      groupsQuery.isFetching ||
      titlesQuery.isFetching ||
      lecturersQuery.isFetching ||
      createManualGroupMutation.isPending ||
      addToExistingGroupMutation.isPending ||
      promoteMutation.isPending,
    creatingGroup: createManualGroupMutation.isPending,
    addingMembers: addToExistingGroupMutation.isPending,
    promotingToReady: promoteMutation.isPending,
    fetchingGroups: groupsQuery.isFetching,
    fetchingTitles: titlesQuery.isFetching,
    fetchingLecturers: lecturersQuery.isFetching,
    fetchAvailableGroups,
    fetchAvailableTitles,
    fetchLecturers,
    createManualGroup,
    addToExistingGroup,
    assignTitle,
    promoteToReadyForFinalization,
  };
}
