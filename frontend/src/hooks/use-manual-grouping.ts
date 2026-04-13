import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Group, Student, GroupMember, GroupStatus } from '@/types/finalization';

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

interface UseManualGroupingReturn {
  availableGroups: AvailableGroup[];
  availableTitles: AvailableTitle[];
  loading: boolean;
  creatingGroup: boolean;
  addingMembers: boolean;
  fetchingGroups: boolean;
  fetchingTitles: boolean;
  fetchAvailableGroups: (periodId?: number) => Promise<void>;
  fetchAvailableTitles: (periodId?: number) => Promise<void>;
  createManualGroup: (data: {
    studentIds: number[];
    periodId: number;
    titleId?: number;
    newTitle?: {
      title: string;
      description?: string;
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
}

export function useManualGrouping(): UseManualGroupingReturn {
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [availableTitles, setAvailableTitles] = useState<AvailableTitle[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [fetchingTitles, setFetchingTitles] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  const fetchAvailableGroups = useCallback(async (periodId?: number) => {
    setFetchingGroups(true);
    try {
      const params = periodId ? { period_id: periodId } : {};
      const response = await api.get('/admin/finalization/available-groups', { params });
      setAvailableGroups(response.data.groups || []);
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal memuat grup yang tersedia'
        : 'Terjadi kesalahan';
      toast.error(message);
      setAvailableGroups([]);
    } finally {
      setFetchingGroups(false);
    }
  }, []);

  const fetchAvailableTitles = useCallback(async (periodId?: number) => {
    setFetchingTitles(true);
    try {
      const params = periodId ? { period_id: periodId } : {};
      const response = await api.get('/admin/finalization/available-titles', { params });
      setAvailableTitles(response.data.titles || []);
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal memuat judul yang tersedia'
        : 'Terjadi kesalahan';
      toast.error(message);
      setAvailableTitles([]);
    } finally {
      setFetchingTitles(false);
    }
  }, []);

  const createManualGroup = useCallback(async ({
    studentIds,
    periodId,
    titleId,
    newTitle,
  }: {
    studentIds: number[];
    periodId: number;
    titleId?: number;
    newTitle?: {
      title: string;
      description?: string;
    };
  }): Promise<boolean> => {
    setCreatingGroup(true);
    try {
      const payload: Record<string, unknown> = {
        student_ids: studentIds,
        period_id: periodId,
      };

      if (titleId) {
        payload.title_id = titleId;
      }

      if (newTitle) {
        payload.new_title = newTitle;
      }

      await api.post('/admin/finalization/create-manual-group', payload);
      toast.success('Grup berhasil dibuat');
      return true;
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal membuat grup'
        : 'Terjadi kesalahan';
      toast.error(message);
      return false;
    } finally {
      setCreatingGroup(false);
    }
  }, []);

  const addToExistingGroup = useCallback(async ({
    groupId,
    studentIds,
  }: {
    groupId: number;
    studentIds: number[];
  }): Promise<boolean> => {
    setAddingMembers(true);
    try {
      await api.post('/admin/finalization/add-to-existing-group', {
        group_id: groupId,
        student_ids: studentIds,
      });
      toast.success('Anggota berhasil ditambahkan ke grup');
      return true;
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal menambahkan anggota'
        : 'Terjadi kesalahan';
      toast.error(message);
      return false;
    } finally {
      setAddingMembers(false);
    }
  }, []);

  const assignTitle = useCallback(async ({
    groupId,
    titleId,
  }: {
    groupId: number;
    titleId: number;
  }): Promise<boolean> => {
    try {
      await api.post('/admin/finalization/assign-title', {
        group_id: groupId,
        title_id: titleId,
      });
      toast.success('Judul berhasil ditetapkan');
      return true;
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal menetapkan judul'
        : 'Terjadi kesalahan';
      toast.error(message);
      return false;
    }
  }, []);

  return {
    availableGroups,
    availableTitles,
    loading: fetchingGroups || fetchingTitles || creatingGroup || addingMembers,
    creatingGroup,
    addingMembers,
    fetchingGroups,
    fetchingTitles,
    fetchAvailableGroups,
    fetchAvailableTitles,
    createManualGroup,
    addToExistingGroup,
    assignTitle,
  };
}