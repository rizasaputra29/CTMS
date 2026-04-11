'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import type {
  BatchSupervisorRequest,
  BatchSupervisorResult,
  ExecuteFinalizationRequest,
  RollbackFinalizationRequest,
  ExportRequest,
} from '@/types/finalization';

interface UseFinalizationActionsReturn {
  // Loading states
  settingSupervisor: boolean;
  executingFinalization: boolean;
  rollingBack: boolean;
  exporting: boolean;
  
  // Actions
  batchSetSupervisor: (data: BatchSupervisorRequest) => Promise<BatchSupervisorResult | null>;
  executeFinalization: (data: ExecuteFinalizationRequest) => Promise<boolean>;
  rollbackFinalization: (data: RollbackFinalizationRequest) => Promise<boolean>;
  exportReport: (data: ExportRequest) => Promise<void>;
}

export function useFinalizationActions(): UseFinalizationActionsReturn {
  const [settingSupervisor, setSettingSupervisor] = useState(false);
  const [executingFinalization, setExecutingFinalization] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [exporting, setExporting] = useState(false);

  const batchSetSupervisor = useCallback(
    async (data: BatchSupervisorRequest): Promise<BatchSupervisorResult | null> => {
      setSettingSupervisor(true);

      try {
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
          response.data.results.failed.forEach((fail) => {
            toast.error(`Group ${fail.group_id}: ${fail.reason}`);
          });
        }

        return response.data.results;
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to set supervisor'
          : 'An unexpected error occurred';
        toast.error(message);
        return null;
      } finally {
        setSettingSupervisor(false);
      }
    },
    []
  );

  const executeFinalization = useCallback(
    async (data: ExecuteFinalizationRequest): Promise<boolean> => {
      setExecutingFinalization(true);

      try {
        const response = await api.post<{ message: string; finalized_count: number }>(
          '/admin/finalization/execute',
          data
        );

        toast.success(
          `${response.data.finalized_count} group(s) finalized successfully`
        );
        return true;
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to execute finalization'
          : 'An unexpected error occurred';
        toast.error(message);
        return false;
      } finally {
        setExecutingFinalization(false);
      }
    },
    []
  );

  const rollbackFinalization = useCallback(
    async (data: RollbackFinalizationRequest): Promise<boolean> => {
      setRollingBack(true);

      try {
        const response = await api.post<{ message: string; rolled_back_count: number }>(
          '/admin/finalization/rollback',
          data
        );

        toast.success(
          `${response.data.rolled_back_count} group(s) rolled back successfully`
        );
        return true;
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to rollback finalization'
          : 'An unexpected error occurred';
        toast.error(message);
        return false;
      } finally {
        setRollingBack(false);
      }
    },
    []
  );

  const exportReport = useCallback(
    async (data: ExportRequest): Promise<void> => {
      setExporting(true);

      try {
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
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to export report'
          : 'An unexpected error occurred';
        toast.error(message);
      } finally {
        setExporting(false);
      }
    },
    []
  );

  return {
    settingSupervisor,
    executingFinalization,
    rollingBack,
    exporting,
    batchSetSupervisor,
    executeFinalization,
    rollbackFinalization,
    exportReport,
  };
}
