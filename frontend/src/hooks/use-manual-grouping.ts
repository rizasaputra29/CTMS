import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Group, Student } from '@/types/finalization';

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
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [availableTitles, setAvailableTitles] = useState<AvailableTitle[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [fetchingTitles, setFetchingTitles] = useState(false);
  const [fetchingLecturers, setFetchingLecturers] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [promotingToReady, setPromotingToReady] = useState(false);

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

  const fetchLecturers = useCallback(async (periodId?: number) => {
    setFetchingLecturers(true);
    try {
      const params = periodId ? { period_id: periodId } : {};
      const response = await api.get('/admin/finalization/lecturers', { params });
      setLecturers(response.data.lecturers || []);
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal memuat dosen'
        : 'Terjadi kesalahan';
      toast.error(message);
      setLecturers([]);
    } finally {
      setFetchingLecturers(false);
    }
  }, []);

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
    setCreatingGroup(true);
    try {
      const payload: Record<string, unknown> = {
        student_ids: studentIds,
        period_id: periodId,
        option,
      };

      if (option === 'assign_title' && titleId) {
        payload.title_id = titleId;
      }

      if (option === 'add_title' && newTitle) {
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

  const promoteToReadyForFinalization = useCallback(async ({
    groupId,
  }: {
    groupId: number;
  }): Promise<boolean> => {
    setPromotingToReady(true);
    try {
      await api.post('/admin/finalization/promote-to-ready', {
        group_id: groupId,
      });
      toast.success('Grup berhasil dipromosikan ke Ready for Finalization');
      return true;
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal mempromosikan grup'
        : 'Terjadi kesalahan';
      toast.error(message);
      return false;
    } finally {
      setPromotingToReady(false);
    }
  }, []);

  return {
    availableGroups,
    availableTitles,
    lecturers,
    loading: fetchingGroups || fetchingTitles || fetchingLecturers || creatingGroup || addingMembers || promotingToReady,
    creatingGroup,
    addingMembers,
    promotingToReady,
    fetchingGroups,
    fetchingTitles,
    fetchingLecturers,
    fetchAvailableGroups,
    fetchAvailableTitles,
    fetchLecturers,
    createManualGroup,
    addToExistingGroup,
    assignTitle,
    promoteToReadyForFinalization,
  };
}