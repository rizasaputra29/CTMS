'use client';

import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
  BatchSupervisorRequest,
  BatchSupervisorResult,
  ExecuteFinalizationRequest,
  RollbackFinalizationRequest,
  CancelKelompokFinalRequest,
  ExportRequest,
} from '@/types/finalization';

interface UseFinalizationActionsReturn {
  // Loading states
  settingSupervisor: boolean;
  executingFinalization: boolean;
  rollingBack: boolean;
  cancelingKelompokFinal: boolean;
  exporting: boolean;

  // Actions
  batchSetSupervisor: (data: BatchSupervisorRequest) => Promise<BatchSupervisorResult | null>;
  executeFinalization: (data: ExecuteFinalizationRequest) => Promise<boolean>;
  rollbackFinalization: (data: RollbackFinalizationRequest) => Promise<boolean>;
  cancelKelompokFinal: (data: CancelKelompokFinalRequest) => Promise<boolean>;
  exportReport: (data: ExportRequest) => Promise<void>;
}

export function useFinalizationActions(): UseFinalizationActionsReturn {
  const batchSetSupervisorMutation = useMutation({
    mutationFn: async (data: BatchSupervisorRequest) => {
      const response = await api.post<{
        message: string;
        results: BatchSupervisorResult;
        success_count: number;
        failed_count: number;
      }>('/admin/finalization/batch-set-supervisor', data);

      if (response.data.success_count > 0) {
        toast.success(
          `Supervisor assigned to ${response.data.success_count} group(s)`
        );
      }

      if (response.data.failed_count > 0) {
        toast.error(`Failed to assign ${response.data.failed_count} group(s)`);
        (response.data.results?.failed ?? []).forEach((fail) => {
          toast.error(`Group ${fail.group_id}: ${fail.reason}`);
        });
      }

      return response.data.results;
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Failed to set supervisor'));
    },
  });

  const executeFinalizationMutation = useMutation({
    mutationFn: async (data: ExecuteFinalizationRequest) => {
      const response = await api.post<{ message: string; finalized_count: number }>(
        '/admin/finalization/execute',
        data
      );
      toast.success(
        `${response.data.finalized_count} group(s) finalized successfully`
      );
      return true;
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Failed to execute finalization'));
    },
  });

  const rollbackFinalizationMutation = useMutation({
    mutationFn: async (data: RollbackFinalizationRequest) => {
      const response = await api.post<{ message: string; rolled_back_count: number }>(
        '/admin/finalization/rollback',
        data
      );
      toast.success(
        `${response.data.rolled_back_count} group(s) rolled back successfully`
      );
      return true;
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Failed to rollback finalization'));
    },
  });

  const cancelKelompokFinalMutation = useMutation({
    mutationFn: async (data: CancelKelompokFinalRequest) => {
      const response = await api.post<{
        message: string;
        group: unknown;
        old_status: string;
        new_status: string;
      }>('/admin/finalization/cancel-kelompok-final', data);
      toast.success(response.data.message);
      return true;
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Failed to cancel Kelompok Final'));
    },
  });

  const exportReportMutation = useMutation({
    mutationFn: async (data: ExportRequest) => {
      const response = await api.get('/admin/finalization/export', {
        params: data,
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: data.format === 'excel' ? 'text/csv' : 'text/html',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finalisasi_periode_${data.period_id}_${new Date().toISOString().split('T')[0]}.${
        data.format === 'excel' ? 'csv' : 'html'
      }`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded successfully');
    },
    onError: (error: unknown) => {
      toast.error(api.getApiErrorMessage(error, 'Failed to export report'));
    },
  });

  return {
    settingSupervisor: batchSetSupervisorMutation.isPending,
    executingFinalization: executeFinalizationMutation.isPending,
    rollingBack: rollbackFinalizationMutation.isPending,
    cancelingKelompokFinal: cancelKelompokFinalMutation.isPending,
    exporting: exportReportMutation.isPending,

    batchSetSupervisor: (data: BatchSupervisorRequest) =>
      batchSetSupervisorMutation.mutateAsync(data),
    executeFinalization: (data: ExecuteFinalizationRequest) =>
      executeFinalizationMutation.mutateAsync(data),
    rollbackFinalization: (data: RollbackFinalizationRequest) =>
      rollbackFinalizationMutation.mutateAsync(data),
    cancelKelompokFinal: (data: CancelKelompokFinalRequest) =>
      cancelKelompokFinalMutation.mutateAsync(data),
    exportReport: (data: ExportRequest) =>
      exportReportMutation.mutateAsync(data),
  };
}
