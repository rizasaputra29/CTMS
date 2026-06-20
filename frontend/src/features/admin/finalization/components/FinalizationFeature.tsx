'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  RefreshCw,
  Users,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  Shield,
  FileDown,
  ChevronDown,
  UserPlus,
  CalendarDays,
  ArrowRight,
  FileText,
  Settings,
  RotateCcw,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useFinalizationDashboard } from '@/hooks/use-finalization-dashboard';
import { useSupervisorLoad } from '@/hooks/use-supervisor-load';
import { useFinalizationActions } from '@/hooks/use-finalization-actions';
import { useManualGrouping } from '@/hooks/use-manual-grouping';
import { useKeyboardShortcuts, focusSearchInput } from '@/hooks/use-keyboard-shortcuts';
import { FinalizationExecuteDialog } from '@/components/finalization/finalization-execute-dialog';
import { ManualGroupingDialog } from '@/components/finalization/manual-grouping-dialog';
import { BulkActionBar } from '@/components/finalization/bulk-action-bar';
import { FilterPanel } from '@/components/finalization/filter-panel';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'sonner';

import type { Group, DashboardTab } from '@/types/finalization';
import { isDashboardTab, isOthersSubTab, isGroupArray, isStudentArray } from '@/types/finalization';

export function FinalizationFeature() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get('period_id')
    ? parseInt(searchParams.get('period_id')!)
    : undefined;

  // Hooks
  const {
    period,
    periods,
    stats,
    data,
    flow,
    activeTab,
    activeSubTab,
    filters,
    loading,
    isLoadingPeriods,
    periodsError,
    showPeriodSelector,
    setActiveTab,
    setActiveSubTab,
    setSearch,
    setPage,
    setFilters,
    refresh,
    selectPeriod,
    fetchActivePeriods,
  } = useFinalizationDashboard(periodId);

  const { lecturers: supervisorLecturers } = useSupervisorLoad(period?.id);
  const {
    executeFinalization,
    executingFinalization,
    cancelKelompokFinal,
    cancelingKelompokFinal,
    exporting,
    exportReport,
  } = useFinalizationActions();

  const {
    availableGroups,
    availableTitles,
    lecturers: manualGroupingLecturers,
    creatingGroup,
    addingMembers,
    fetchAvailableGroups,
    fetchAvailableTitles,
    fetchLecturers,
    createManualGroup,
    addToExistingGroup,
    assignTitle,
    promoteToReadyForFinalization,
  } = useManualGrouping();

  // Local state
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [showGroupingDialog, setShowGroupingDialog] = useState(false);
  const [showAssignTitleDialog, setShowAssignTitleDialog] = useState(false);
  const [selectedGroupForAction, setSelectedGroupForAction] = useState<Group | null>(null);
  const [settingRow, setSettingRow] = useState<number | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showBulkMarkFinalDialog, setShowBulkMarkFinalDialog] = useState(false);
  const [showBulkCancelFinalDialog, setShowBulkCancelFinalDialog] = useState(false);

  // Row selection state for bulk actions
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [reopeningPeriod, setReopeningPeriod] = useState(false);
  const isPeriodFinalized = !!period?.is_finalized;
  const canModifyByFlow = flow?.can_modify ?? !isPeriodFinalized;
  const canExecuteByFlow = flow?.can_execute_finalization ?? !!stats?.can_finalize;
  const canReopenFinalization = !!stats?.can_reopen_finalization;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearchFocus: () => focusSearchInput(searchInputRef),
    onRefresh: () => refresh(),
    onTabChange: (index) => {
      const tabs: DashboardTab[] = ['ready', 'final', 'others'];
      if (tabs[index]) {
        setActiveTab(tabs[index]);
      }
    },
    onExport: () => handleExport('excel'),
    onHelp: () => setShowKeyboardHelp(true),
  });

  // Fetch available groups when dialog opens
  const handleOpenGroupingDialog = useCallback(async (open: boolean) => {
    setShowGroupingDialog(open);
    if (open && period) {
      console.log('Opening dialog, fetching data for period:', period.id);
      try {
        await Promise.all([
          fetchAvailableGroups(period.id),
          fetchAvailableTitles(period.id),
          fetchLecturers(period.id),
        ]);
        console.log('Data fetching completed');
      } catch (err) {
        console.error('Error fetching dialog data:', err);
      }
    }
  }, [period, fetchAvailableGroups, fetchAvailableTitles, fetchLecturers]);

  // Handlers for manual grouping
  const handleCreateGroup = useCallback(async ({
    studentIds,
    option,
    titleId,
    newTitle,
  }: {
    studentIds: number[];
    option: 'no_title' | 'assign_title' | 'add_title';
    titleId?: number;
    newTitle?: { title: string; description?: string; specializations: string[]; lecturerId: number };
  }) => {
    if (!period || isPeriodFinalized || !canModifyByFlow) return;
    
    const success = await createManualGroup({
      studentIds,
      periodId: period.id,
      option,
      ...(titleId !== undefined ? { titleId } : {}),
      ...(newTitle !== undefined ? { newTitle } : {}),
    });
    
    if (success) {
      refresh();
    }
  }, [period, createManualGroup, refresh, isPeriodFinalized, canModifyByFlow]);

  const handleAddToExistingGroup = useCallback(async (studentIds: number[], groupId: number) => {
    if (isPeriodFinalized || !canModifyByFlow) return;
    const success = await addToExistingGroup({
      groupId,
      studentIds,
    });
    
    if (success) {
      refresh();
    }
  }, [addToExistingGroup, refresh, isPeriodFinalized, canModifyByFlow]);

  // Handler for assigning title to READY_FOR_BIDDING group
  const handleAssignTitleToGroup = useCallback(async (groupId: number, titleId: number) => {
    if (isPeriodFinalized || !canModifyByFlow) return;
    const success = await assignTitle({ groupId, titleId });
    if (success) {
      refresh();
    }
  }, [assignTitle, refresh, isPeriodFinalized, canModifyByFlow]);

  const handleAddMemberToGroup = useCallback((group: Group) => {
    if (isPeriodFinalized || !canModifyByFlow) return;
    setSelectedGroupForAction(group);
    // Open manual grouping dialog with pre-selected group
    handleOpenGroupingDialog(true);
  }, [handleOpenGroupingDialog, isPeriodFinalized, canModifyByFlow]);

  const handleOpenAssignTitleDialog = useCallback(async (group: Group) => {
    if (isPeriodFinalized || !canModifyByFlow) return;
    setSelectedGroupForAction(group);
    setShowAssignTitleDialog(true);

    if (period) {
      await fetchAvailableTitles(period.id);
    }
  }, [period, fetchAvailableTitles, isPeriodFinalized, canModifyByFlow]);

  const handleFinalizeGroup = useCallback(async (group: Group) => {
    if (isPeriodFinalized || !canModifyByFlow) return;
    const success = await promoteToReadyForFinalization({ groupId: group.id });
    if (success) {
      refresh();
    }
  }, [promoteToReadyForFinalization, refresh, isPeriodFinalized, canModifyByFlow]);

  // Derived data
  const isPaginatedData = data && 'data' in data;
  const tableData = useMemo(() => isPaginatedData ? data.data : [], [isPaginatedData, data]);
  const pagination = isPaginatedData
    ? {
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
        perPage: data.per_page,
      }
    : null;

  const kelompokFinalGroups = useMemo(() => {
    if (activeTab !== 'final' || !isPaginatedData) return [];
    return isGroupArray(data.data) ? data.data : [];
  }, [activeTab, data, isPaginatedData]);

  // Per-row supervisor set handler
  const handleSetSupervisorForGroup = useCallback(
    async (groupId: number, supervisorId: number, role: 'supervisor_1_id' | 'supervisor_2_id') => {
      if (isPeriodFinalized || !canModifyByFlow) return;
      setSettingRow(groupId);
      try {
        const payload: Record<string, number | boolean | undefined> = {
          group_id: groupId,
          mark_final: false,
        };
        // We need to keep existing values. Find the group in tableData
        const group = isGroupArray(tableData) ? tableData.find((g) => g.id === groupId) : undefined;
        if (role === 'supervisor_1_id') {
          payload.supervisor_1_id = supervisorId;
          payload.supervisor_2_id = group?.supervisor_2_id;
        } else {
          payload.supervisor_1_id = group?.supervisor_1_id || group?.title?.lecturer?.id;
          payload.supervisor_2_id = supervisorId;
        }

        await api.post('/admin/finalization/set-supervisor', payload);
        toast.success('Supervisor berhasil ditetapkan');
        refresh();
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal menetapkan supervisor'
          : 'Terjadi kesalahan';
        toast.error(message);
      } finally {
        setSettingRow(null);
      }
    },
    [tableData, refresh, isPeriodFinalized, canModifyByFlow]
  );

  // Mark group as Kelompok Final
  const handleMarkKelompokFinal = useCallback(
    async (groupId: number) => {
      if (isPeriodFinalized || !canModifyByFlow) return;
      setSettingRow(groupId);
      try {
        const group = isGroupArray(tableData) ? tableData.find((g) => g.id === groupId) : undefined;
        
        const sv1 = group?.supervisor_1_id || group?.title?.lecturer?.id;
        
        if (!sv1) {
          toast.error('Supervisor 1 harus ditetapkan terlebih dahulu');
          return;
        }
        if (!group?.supervisor_2_id) {
          toast.error('Supervisor 2 harus ditetapkan terlebih dahulu');
          return;
        }
        // Use set-supervisor endpoint with mark_final=true to promote to KELOMPOK_FINAL
        await api.post('/admin/finalization/set-supervisor', {
          group_id: groupId,
          supervisor_1_id: sv1,
          supervisor_2_id: group.supervisor_2_id,
          mark_final: true,
        });
        toast.success('Kelompok berhasil ditandai sebagai Kelompok Final');
        refresh();
      } catch (err) {
        const message = api.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal menandai kelompok final'
          : 'Terjadi kesalahan';
        toast.error(message);
      } finally {
        setSettingRow(null);
      }
    },
    [tableData, refresh, isPeriodFinalized, canModifyByFlow]
  );

  // Cancel/Revert Kelompok Final
  const handleCancelKelompokFinal = useCallback(
    async (group: Group) => {
      if (isPeriodFinalized || !canModifyByFlow) {
        toast.error('Periode sudah difinalisasi. Reopen period terlebih dahulu.');
        return;
      }
      
      const reason = prompt('Alasan cancel Kelompok Final (opsional):');
      if (reason === null) return; // User cancelled
      
      const success = await cancelKelompokFinal({
        period_id: group.period_id,
        group_id: group.id,
        ...(reason ? { reason } : {}),
      });
      
      if (success) {
        refresh();
      }
    },
    [isPeriodFinalized, cancelKelompokFinal, refresh, canModifyByFlow]
  );

  // Row selection handlers for bulk actions
  const toggleRowSelection = useCallback((groupId: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const selectAllRows = useCallback(() => {
    const allIds = isGroupArray(tableData) ? tableData.map((g) => g.id) : [];
    setSelectedRows(new Set(allIds));
  }, [tableData]);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Reset selection when tab or data changes
  useEffect(() => {
    setSelectedRows(new Set());
  }, [activeTab, activeSubTab, data]);

  const handleExecuteFinalization = async () => {
    if (!period || isPeriodFinalized || !canModifyByFlow) return;

    const success = await executeFinalization({
      period_id: period.id,
      confirmation: true,
    });

    if (success) {
      setShowExecuteDialog(false);
      refresh();
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!period) return;
    await exportReport({ period_id: period.id, format });
  };

  const handleExportSelected = useCallback(() => {
    const selectedGroups = isGroupArray(tableData) ? tableData.filter((g) => selectedRows.has(g.id)) : [];
    if (selectedGroups.length === 0) {
      toast.error('Tidak ada grup yang dipilih');
      return;
    }

    // Create CSV content
    const headers = ['ID', 'Nama Grup', 'Status', 'Judul', 'Supervisor 1', 'Supervisor 2', 'Jumlah Anggota'];
    const rows = selectedGroups.map((group) => [
      group.id,
      group.code || `Group ${group.id}`,
      group.status,
      group.title?.title || '-',
      group.supervisor1?.name || '-',
      group.supervisor2?.name || '-',
      group.members?.length || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected_groups_${period?.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${selectedGroups.length} grup berhasil diexport`);
  }, [tableData, selectedRows, period]);

  const handleReopenPeriod = useCallback(async () => {
    if (!period || !canReopenFinalization) return;

    setReopeningPeriod(true);
    try {
      const response = await api.post<{ message: string; reverted_count?: number }>(
        '/admin/finalization/reopen',
        { period_id: period.id }
      );

      const revertedCount = response.data?.reverted_count ?? 0;
      toast.success(`Periode berhasil dibuka kembali. ${revertedCount} grup dikembalikan ke KELOMPOK_FINAL.`);
      refresh();
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal membuka kembali periode'
        : 'Terjadi kesalahan';
      toast.error(message);
    } finally {
      setReopeningPeriod(false);
    }
  }, [period, canReopenFinalization, refresh]);

  // Bulk mark final handler with validation
  const handleBulkMarkFinal = useCallback(async () => {
    if (!period || isPeriodFinalized || !canModifyByFlow || selectedRows.size === 0) return;

    const selectedGroups = isGroupArray(tableData) ? tableData.filter((g) => selectedRows.has(g.id)) : [];
    const valid: Group[] = [];
    const invalid: { group: Group; reason: string }[] = [];

    selectedGroups.forEach((group) => {
      if (group.status !== 'READY_FOR_FINALIZATION') {
        invalid.push({ group, reason: 'Status bukan Siap Finalisasi' });
        return;
      }
      if (!group.supervisor_1_id && !group.title?.lecturer?.id) {
        invalid.push({ group, reason: 'Belum ada Supervisor 1' });
        return;
      }
      if (!group.supervisor_2_id) {
        invalid.push({ group, reason: 'Belum ada Supervisor 2' });
        return;
      }
      valid.push(group);
    });

    if (invalid.length > 0) {
      // Show validation errors
      toast.error(`${invalid.length} grup tidak valid untuk di-mark final`);
      invalid.forEach(({ group, reason }) => {
        toast.error(`${group.code || `Group ${group.id}`}: ${reason}`);
      });
    }

    if (valid.length === 0) {
      toast.error('Tidak ada grup yang valid untuk di-mark final');
      return;
    }

    // Process valid groups
    setSettingRow(-1); // Indicate bulk operation
    try {
      await Promise.all(
        valid.map((group) =>
          api.post('/admin/finalization/set-supervisor', {
            group_id: group.id,
            supervisor_1_id: group.supervisor_1_id || group.title?.lecturer?.id,
            supervisor_2_id: group.supervisor_2_id,
            mark_final: true,
          })
        )
      );
      toast.success(`${valid.length} grup berhasil ditandai sebagai Kelompok Final`);
      clearSelection();
      setShowBulkMarkFinalDialog(false);
      refresh();
    } catch (err) {
      const message = api.isAxiosError(err)
        ? err.response?.data?.message || 'Gagal mark final bulk'
        : 'Terjadi kesalahan';
      toast.error(message);
    } finally {
      setSettingRow(null);
    }
  }, [period, isPeriodFinalized, canModifyByFlow, selectedRows, tableData, clearSelection, refresh]);

  // Bulk cancel final handler
  const handleBulkCancelFinal = useCallback(async (reason?: string) => {
    if (!period || isPeriodFinalized || !canModifyByFlow || selectedRows.size === 0) return;

    const selectedGroups = isGroupArray(tableData) ? tableData.filter((g) => selectedRows.has(g.id)) : [];
    
    try {
      await Promise.all(
        selectedGroups.map((group) =>
          cancelKelompokFinal({
            period_id: period.id,
            group_id: group.id,
            ...(reason ? { reason } : {}),
          })
        )
      );
      toast.success(`${selectedGroups.length} grup berhasil di-cancel dari Kelompok Final`);
      clearSelection();
      setShowBulkCancelFinalDialog(false);
      refresh();
    } catch {
      // Error already handled by cancelKelompokFinal
    }
  }, [period, isPeriodFinalized, canModifyByFlow, selectedRows, tableData, cancelKelompokFinal, clearSelection, refresh]);

  // Status badge helper with enhanced colors
  const getStatusBadge = (status: string, statusLabel?: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      // 🟡 Perlu Judul (Warning - Amber)
      READY_FOR_BIDDING: {
        label: 'Perlu Judul',
        className: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
      },

      // 🔵 Judul OK (Info - Blue)
      TITLE_APPROVED: {
        label: 'Judul OK',
        className: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
      },

      // ⚪ Siap Final (Secondary - Slate)
      READY_FOR_FINALIZATION: {
        label: 'Siap Final',
        className: 'bg-slate-100 text-slate-800 border-slate-300',
      },

      // 🟢 Kelompok Final (Success - Emerald)
      KELOMPOK_FINAL: {
        label: 'Kelompok Final',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
      },

      // 🔵 PDC1/PDC2 Active (Primary)
      PDC1_ACTIVE: {
        label: 'PDC1 Active',
        className: 'bg-primary-100 text-primary-500 border-primary-300',
      },
      PDC2_ACTIVE: {
        label: 'PDC2 Active',
        className: 'bg-primary-100 text-primary-500 border-primary-300',
      },
      TA_DRAFT: {
        label: 'TA Draft',
        className: 'bg-violet-100 text-violet-700 border-violet-300',
      },

      // ⚪ Forming states (Gray)
      FORMING: {
        label: 'Forming',
        className: 'bg-gray-100 text-gray-800 border-gray-300',
      },
      FORMING_SOLO: {
        label: 'Solo Seeker',
        className: 'bg-gray-100 text-gray-800 border-gray-300',
      },

      // 🟡 Waiting Approval (Yellow)
      WAITING_SUPERVISOR_APPROVAL: {
        label: 'Menunggu Approval',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      },

      // 🔴 Closed/Dissolved (Destructive - Red)
      CLOSED: {
        label: 'Ditutup',
        className: 'bg-red-100 text-red-800 border-red-300',
      },
      DISSOLVED: {
        label: 'Dibubarkan',
        className: 'bg-red-100 text-red-800 border-red-300',
      },
    };

    const config = variants[status] || { label: statusLabel || status, className: 'bg-gray-100 text-gray-800' };
    return (
      <Badge variant="outline" className={config.className}>
        {statusLabel || config.label}
      </Badge>
    );
  };

  // Status label helper for descriptions
  const getStatusDescription = (status: string): string => {
    const descriptions: Record<string, string> = {
      PDC1_ACTIVE: 'Grup aktif di fase PDC1 (Semester 5-6)',
      READY_FOR_SEMPRO: 'Siap untuk Sidang Proposal',
      SEMPRO_DONE: 'Sidang Proposal selesai',
      PDC2_ACTIVE: 'Grup aktif di fase PDC2 (Semester 7-8)',
      TA_DRAFT: 'Menunggu upload TA Draft',
      PDC2_READY_FOR_EXPO: 'Siap untuk EXPO',
      EXPO_REGISTERED: 'Terdaftar di EXPO',
      EXPO_DONE: 'EXPO selesai',
      PDC2_COMPLETED: 'PDC2 selesai',
      READY_FOR_TA_INDIVIDUAL: 'Siap untuk Tugas Akhir individu',
    };
    return descriptions[status] || `Status: ${status}`;
  };

  const flowReasonMap: Record<string, string> = {
    PERIOD_FINALIZED: 'Periode sudah difinalisasi. Dashboard berada dalam mode read-only.',
  };

  const actionReasonMap: Record<string, string> = {
    PERIOD_FINALIZED: 'Periode sudah difinalisasi.',
    SUPERVISOR_1_REQUIRED: 'Supervisor 1 wajib ditentukan terlebih dahulu.',
    SUPERVISOR_2_REQUIRED: 'Supervisor 2 wajib ditentukan terlebih dahulu.',
  };

  const globalFlowMessage = flow?.reason
    ? flowReasonMap[flow.reason] || 'Aksi finalisasi saat ini tidak tersedia.'
    : null;

  // ══════════════════════════════════════════
  // PERIOD SELECTOR (shown first, before anything)
  // ══════════════════════════════════════════
  if (showPeriodSelector) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finalisasi Periode</h1>
          <p className="text-muted-foreground mt-1">
            Kelola finalisasi grup dan penentuan supervisor
          </p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Pilih Periode Aktif
            </CardTitle>
            <CardDescription>
              Pilih periode aktif yang ingin Anda finalisasi. Hanya periode dengan status aktif yang ditampilkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPeriods ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="mx-auto h-10 w-10 mb-3 opacity-50 animate-pulse">
                  <CalendarDays className="h-10 w-10" />
                </div>
                <p className="font-medium">Memuat daftar periode...</p>
                <p className="text-sm mt-1">Mohon tunggu sebentar</p>
              </div>
            ) : periodsError ? (
              <div className="text-center py-8 text-destructive">
                <AlertTriangle className="mx-auto h-10 w-10 mb-3 opacity-70" />
                <p className="font-medium">Gagal memuat periode</p>
                <p className="text-sm mt-1 opacity-70">{periodsError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchActivePeriods()}
                  className="mt-4"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Coba Lagi
                </Button>
              </div>
            ) : periods.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {periods.map((p) => (
                  <Card
                    key={p.id}
                    className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                    onClick={() => selectPeriod(p.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {p.name}
                        </CardTitle>
                        {p.is_finalized ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Finalized
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            Aktif
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Max Beban: {p.max_supervisor_load || 8} grup
                      </p>
                      {p.is_finalized && (
                        <p className="text-xs text-amber-600 mt-1">
                          Periode sudah difinalisasi — mode read-only
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Pilih periode ini <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <p className="font-medium">Tidak ada periode aktif</p>
                <p className="text-sm mt-1">Tidak ditemukan periode dengan status aktif saat ini.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DASHBOARD (after period selected)
  // ══════════════════════════════════════════

  // Loading state
  if (loading && !data) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  // Pagination renderer
  const renderPagination = () => {
    if (!pagination || pagination.lastPage <= 1) return null;
    return (
      <div className="mt-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={() => setPage(Math.max(1, pagination.currentPage - 1))}
                className={pagination.currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
            {[...Array(pagination.lastPage)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  onClick={() => setPage(i + 1)}
                  isActive={pagination.currentPage === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={() => setPage(Math.min(pagination.lastPage, pagination.currentPage + 1))}
                className={pagination.currentPage === pagination.lastPage ? 'pointer-events-none opacity-50' : ''}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finalisasi Periode</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground mr-2">
              Kelola finalisasi grup dan penentuan supervisor
            </p>
            {/* Quick Period Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 gap-2 px-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{period?.name}</span>
                  {period?.is_finalized && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                      Finalized
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Pilih Periode
                </div>
                {periods.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => selectPeriod(p.id)}
                    className="flex items-center justify-between"
                  >
                    <span className={p.id === period?.id ? 'font-semibold' : ''}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {p.is_finalized && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                          Finalized
                        </Badge>
                      )}
                      {p.is_active && !p.is_finalized && (
                        <Badge variant="default" className="bg-green-600 text-[10px] px-1.5 py-0">
                          Aktif
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex gap-2">
          {canReopenFinalization && (
            <Button
              variant="default"
              onClick={handleReopenPeriod}
              disabled={reopeningPeriod}
            >
              <RotateCcw className={`mr-2 h-4 w-4 ${reopeningPeriod ? 'animate-spin' : ''}`} />
              Reopen Finalization
            </Button>
          )}
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting}>
                <FileDown className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Export Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export PDF (HTML)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKeyboardHelp(true)}
            title="Keyboard Shortcuts (?)"
          >
            <span className="text-sm font-semibold">?</span>
          </Button>
        </div>
      </div>

      {isPeriodFinalized && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-800">Periode Sudah Difinalisasi</CardTitle>
            <CardDescription className="text-amber-700">
              Halaman ini dalam mode read-only. Anda tetap dapat melihat data dan export report, tetapi aksi perubahan dinonaktifkan.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isPeriodFinalized && (stats?.total_pdc1_active ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-800">Legacy Finalization Terdeteksi</CardTitle>
            <CardDescription className="text-amber-700">
              Ditemukan {(stats?.total_pdc1_active ?? 0)} grup berstatus PDC1_ACTIVE walau periode belum ditandai finalized.
              Gunakan tombol Reopen Finalization untuk mengembalikan grup ke KELOMPOK_FINAL.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {globalFlowMessage && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-800">Status Aksi Finalisasi</CardTitle>
            <CardDescription className="text-amber-700">{globalFlowMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Siap Finalisasi</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_ready}</div>
              <p className="text-xs text-muted-foreground">Grup READY_FOR_FINALIZATION</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kelompok Final</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.total_kelompok_final}</div>
              <p className="text-xs text-muted-foreground">Sudah di-set supervisor</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tanpa Kelompok</CardTitle>
              <GraduationCap className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.total_no_group}</div>
              <p className="text-xs text-muted-foreground">Mahasiswa perlu grouping</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Belum Siap</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.total_not_ready}</div>
              <p className="text-xs text-muted-foreground">Grup belum READY</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════
          PREREQUISITES STATUS
          ════════════════════════════════════════════ */}
      {flow?.prerequisites && flow.prerequisites.length > 0 && (
        <Card className={flow.prerequisites.every(p => p.configured) ? 'border-green-200 bg-green-50/30' : 'border-yellow-200 bg-yellow-50/30'}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Prerequisites Status</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              {flow.prerequisites.every(p => p.configured) ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">All prerequisites met</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">
                    {flow.prerequisites.filter(p => p.configured).length} of {flow.prerequisites.length} prerequisites configured
                  </span>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {flow.prerequisites.map((prereq) => (
                <div
                  key={prereq.type}
                  className={`p-2 rounded text-center text-xs ${
                    prereq.configured
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  <div className="font-medium">{prereq.label}</div>
                  <div className="text-[10px] mt-0.5">{prereq.configured ? 'Done' : 'Not set'}</div>
                  <div className="mt-1.5">
                    <Link href={prereq.configured ? prereq.edit_url : prereq.configure_url}>
                      <Button variant="ghost" size="sm" className={`text-[10px] h-5 px-1.5 py-0 ${prereq.configured ? 'text-green-700 hover:text-green-800 hover:bg-green-200' : 'text-red-700 hover:text-red-800 hover:bg-red-200'}`}>
                        {prereq.configured ? 'Edit' : 'Configure'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Document Requirements Detail */}
            {stats?.document_requirements && (
              <div className="mt-4 pt-4 border-t border-dashed border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Document Requirements</span>
                  </div>
                  <Link href="/admin/document-requirements">
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                      <Settings className="mr-1 h-3 w-3" />
                      {stats.document_requirements.all_configured ? 'Edit' : 'Configure'}
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {stats.document_requirements.all_configured ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700">All phases configured</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700">
                        {stats.document_requirements.configured_phases} of {stats.document_requirements.total_phases} phases configured
                      </span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {Object.entries(stats.document_requirements.phases).map(([phase, status]) => (
                    <div
                      key={phase}
                      className={`p-2 rounded text-center text-xs ${
                        status.configured
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <div className="font-medium">{phase}</div>
                      <div className="text-[10px]">
                        {status.configured ? `${status.count} docs` : 'Not set'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════
          GRUP PASCA FINALISASI
          ════════════════════════════════════════════ */}
      {stats?.total_post_finalization && stats.total_post_finalization > 0 && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary-500" />
              <CardTitle className="text-sm font-medium text-primary-500">
                Grup Pasca Finalisasi ({stats.total_post_finalization} grup)
              </CardTitle>
            </div>
            <CardDescription className="text-primary-500">
              Grup yang sudah melewati tahap finalisasi dan sedang aktif di fase PDC1, PDC2, EXPO, atau TA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.post_finalization_breakdown || {}).map(([status, count]) => (
                <div
                  key={status}
                  className="p-3 rounded-lg border bg-white/60 border-primary-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    {getStatusBadge(status)}
                    <span className="text-lg font-bold text-primary-500">{count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getStatusDescription(status)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(isDashboardTab(v) ? v : activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ready" className="relative">
            Siap Finalisasi
            {stats && stats.total_ready > 0 && (
              <Badge variant="secondary" className="ml-2">{stats.total_ready}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="final" className="relative">
            Kelompok Final
            {stats && stats.total_kelompok_final > 0 && (
              <Badge variant="default" className="ml-2">{stats.total_kelompok_final}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="others" className="relative">
            Perlu Perhatian
            {stats && (stats.total_no_group + stats.total_not_ready) > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.total_no_group + stats.total_not_ready}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ Tab 1: Siap Finalisasi (READY_FOR_FINALIZATION) ═══════════ */}
        <TabsContent value="ready" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Grup Siap Finalisasi</CardTitle>
                <CardDescription>
                  Grup dengan status READY_FOR_FINALIZATION. Pilih supervisor lalu tandai sebagai Kelompok Final.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  <strong>Siap Finalisasi:</strong> Grup dengan status READY_FOR_FINALIZATION yang menunggu penentuan supervisor.
                  Set Supervisor 1 & 2, lalu tandai sebagai <strong>Kelompok Final</strong>.
                </p>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Cari grup, mahasiswa, atau judul... (Ctrl+F)"
                      value={filters.search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Filter Panel */}
                <FilterPanel
                  filters={{
                    supervisorStatus: filters.supervisorStatus || 'all',
                    memberCount: filters.memberCount || 'all',
                  }}
                  onFilterChange={(newFilters) => setFilters(newFilters)}
                  minGroupSize={period?.min_group_size || 3}
                  maxGroupSize={period?.max_group_size || 4}
                  showSupervisor={true}
                  showMemberCount={false}
                />
              </div>

              {/* Bulk Action Bar */}
              {!isPeriodFinalized && canModifyByFlow && (
                <BulkActionBar
                  selectedCount={selectedRows.size}
                  totalCount={tableData.length}
                  onSelectAll={selectAllRows}
                  onSelectNone={clearSelection}
                  onMarkFinal={() => setShowBulkMarkFinalDialog(true)}
                  onExport={handleExportSelected}
                  showMarkFinal={true}
                  showCancelFinal={false}
                  loading={settingRow !== null}
                />
              )}

              {/* Table with inline supervisor dropdowns */}
              <div className="rounded-md border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedRows.size === tableData.length && tableData.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllRows();
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Nama Kelompok</TableHead>
                      <TableHead>Judul</TableHead>
                      <TableHead>Anggota</TableHead>
                      <TableHead>Supervisor 1</TableHead>
                      <TableHead>Supervisor 2</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : tableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Tidak ada grup dengan status READY_FOR_FINALIZATION
                        </TableCell>
                      </TableRow>
                    ) : isGroupArray(tableData) ? (
                      tableData.map((group) => {
                        const actionReason = group.allowed_actions?.reason
                          ? actionReasonMap[group.allowed_actions.reason] || 'Aksi belum tersedia untuk grup ini.'
                          : null;

                        return (
                        <TableRow key={group.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.has(group.id)}
                              onCheckedChange={() => toggleRowSelection(group.id)}
                              aria-label={`Select ${group.code || `Group ${group.id}`}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{group.code || `Group ${group.id}`}</TableCell>
                          <TableCell>
                            {group.title ? (
                              <div>
                                <p className="font-medium text-sm truncate max-w-[180px]">{group.title.title}</p>
                                <p className="text-xs text-muted-foreground">{group.title.lecturer?.name}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {group.members?.slice(0, 2).map((member) => (
                                <span key={member.id} className="text-sm">{member.student.name}</span>
                              ))}
                              {group.members && group.members.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{group.members.length - 2} lainnya
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {/* Supervisor 1 Dropdown */}
                          <TableCell>
                            <Select
                              value={group.supervisor_1_id?.toString() ?? group.title?.lecturer?.id?.toString() ?? ''}
                              onValueChange={(val) => handleSetSupervisorForGroup(group.id, parseInt(val), 'supervisor_1_id')}
                              disabled={settingRow === group.id || isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_set_supervisor ?? true)}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue placeholder="Pilih SV1" />
                              </SelectTrigger>
                              <SelectContent>
                                {supervisorLecturers.map((lec) => (
                                  <SelectItem
                                    key={lec.id}
                                    value={lec.id.toString()}
                                    disabled={lec.is_overloaded || lec.id.toString() === group.supervisor_2_id?.toString()}
                                  >
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span className="truncate">{lec.name}</span>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {lec.current_load}/{lec.max_load}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {/* Supervisor 2 Dropdown */}
                          <TableCell>
                            <Select
                              value={group.supervisor_2_id?.toString() ?? ''}
                              onValueChange={(val) => handleSetSupervisorForGroup(group.id, parseInt(val), 'supervisor_2_id')}
                              disabled={settingRow === group.id || isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_set_supervisor ?? true)}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue placeholder="Pilih SV2" />
                              </SelectTrigger>
                              <SelectContent>
                                {supervisorLecturers.map((lec) => (
                                  <SelectItem
                                    key={lec.id}
                                    value={lec.id.toString()}
                                    disabled={lec.is_overloaded || lec.id.toString() === (group.supervisor_1_id?.toString() ?? group.title?.lecturer?.id?.toString())}
                                  >
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span className="truncate">{lec.name}</span>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {lec.current_load}/{lec.max_load}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {/* Action: Mark KELOMPOK_FINAL */}
                          <TableCell>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={settingRow === group.id || isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_mark_kelompok_final ?? !!group.supervisor_1_id)}
                              onClick={() => handleMarkKelompokFinal(group.id)}
                              className="text-xs h-8"
                              title={actionReason || undefined}
                            >
                              {settingRow === group.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Shield className="mr-1 h-3 w-3" />
                                  Kelompok Final
                                </>
                              )}
                            </Button>
                           </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Data tidak valid
                        </TableCell>
                      </TableRow>
                    )}
                    </TableBody>
                 </Table>
               </div>
 
               {renderPagination()}
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* ═══════════ Tab 2: Kelompok Final (KELOMPOK_FINAL) ═══════════ */}
        <TabsContent value="final" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Kelompok Final</CardTitle>
                  <CardDescription>
                    Grup yang sudah di-set supervisor dan ditandai KELOMPOK_FINAL. Siap untuk eksekusi finalisasi.
                  </CardDescription>
                </div>
                {!isPeriodFinalized && (
                  <div className="flex flex-col items-end">
                    <Button 
                      onClick={() => setShowExecuteDialog(true)} 
                      variant="default"
                      disabled={!canExecuteByFlow}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Eksekusi Finalisasi
                    </Button>
                    {flow?.blockers && flow.blockers.length > 0 && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md max-w-md">
                        <p className="text-sm font-semibold text-red-800 mb-2">
                          Finalisasi tidak dapat dilakukan:
                        </p>
                        <ul className="space-y-2">
                          {flow.blockers.map((blocker) => (
                            <li key={blocker.type} className="text-sm text-red-700">
                              <span className="font-medium">{blocker.message}</span>
                              {blocker.action && (
                                <p className="text-xs text-red-500 mt-0.5 ml-0">
                                  Action: {blocker.action}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Info Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-4 flex items-start gap-2">
                <Info className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-800">
                  <strong>Kelompok Final:</strong> Grup dengan supervisor lengkap yang siap untuk <strong>Eksekusi Finalisasi</strong>.
                  Gunakan dropdown Aksi untuk Cancel jika perlu revisi.
                </p>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari grup, mahasiswa, atau supervisor..."
                    value={filters.search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Bulk Action Bar */}
              {!isPeriodFinalized && canModifyByFlow && (
                <BulkActionBar
                  selectedCount={selectedRows.size}
                  totalCount={tableData.length}
                  onSelectAll={selectAllRows}
                  onSelectNone={clearSelection}
                  onCancelFinal={() => setShowBulkCancelFinalDialog(true)}
                  onExport={handleExportSelected}
                  showMarkFinal={false}
                  showCancelFinal={true}
                  loading={cancelingKelompokFinal}
                />
              )}

              {/* Table */}
              <div className="rounded-md border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedRows.size === tableData.length && tableData.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllRows();
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Nama Kelompok</TableHead>
                      <TableHead>Judul</TableHead>
                      <TableHead>Anggota</TableHead>
                      <TableHead>Supervisor 1</TableHead>
                      <TableHead>Supervisor 2</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : tableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Belum ada kelompok final. Set supervisor di tab &quot;Siap Finalisasi&quot; terlebih dahulu.
                        </TableCell>
                      </TableRow>
                    ) : isGroupArray(tableData) ? (
                      tableData.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.has(group.id)}
                              onCheckedChange={() => toggleRowSelection(group.id)}
                              aria-label={`Select ${group.code || `Group ${group.id}`}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{group.code || `Group ${group.id}`}</TableCell>
                          <TableCell>
                            {group.title ? (
                              <div>
                                <p className="font-medium text-sm truncate max-w-[180px]">{group.title.title}</p>
                                <p className="text-xs text-muted-foreground">{group.title.lecturer?.name}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {group.members?.slice(0, 2).map((member) => (
                                <span key={member.id} className="text-sm">{member.student.name}</span>
                              ))}
                              {group.members && group.members.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{group.members.length - 2} lainnya
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {group.supervisor1 ? (
                              <Badge variant="default">{group.supervisor1.name}</Badge>
                            ) : (
                              <Badge variant="destructive">Perlu SV1</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {group.supervisor2 ? (
                              <Badge variant="outline">{group.supervisor2.name}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(group.status, group.status_label)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPeriodFinalized || !canModifyByFlow || cancelingKelompokFinal}>
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCancelKelompokFinal(group)} disabled={isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_cancel_kelompok_final ?? true)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Kelompok Final
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              {renderPagination()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ Tab 3: Perlu Perhatian (Belum Ready) ═══════════ */}
        <TabsContent value="others" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Perlu Perhatian</CardTitle>
              <CardDescription>
                Mahasiswa dan grup yang belum mencapai status READY_FOR_FINALIZATION
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sub Tabs */}
              <Tabs
                value={activeSubTab}
                onValueChange={(v) => setActiveSubTab(isOthersSubTab(v) ? v : activeSubTab)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="no_group">
                    Tanpa Kelompok
                    {stats && stats.total_no_group > 0 && (
                      <Badge variant="destructive" className="ml-2">{stats.total_no_group}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="no_title">
                    Tanpa Judul
                    {stats && stats.total_no_title > 0 && (
                      <Badge variant="secondary" className="ml-2">{stats.total_no_title}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="not_ready">
                    Belum Siap
                    {stats && stats.total_not_ready > 0 && (
                      <Badge variant="secondary" className="ml-2">{stats.total_not_ready}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Sub Tab: No Group */}
                <TabsContent value="no_group" className="space-y-4">
                  {/* Info Banner */}
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      <strong>Tanpa Kelompok:</strong> Mahasiswa yang sudah terdaftar di periode tapi belum memiliki grup.
                      Gunakan <strong>Grouping Manual</strong> untuk membuat grup baru atau menambahkan ke grup existing.
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari mahasiswa..."
                        value={filters.search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button onClick={() => handleOpenGroupingDialog(true)} disabled={isPeriodFinalized}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Grouping Manual
                    </Button>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>NIM</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8">
                              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              Semua mahasiswa sudah memiliki kelompok
                            </TableCell>
                          </TableRow>
                        ) : isStudentArray(tableData) ? (
                          tableData.map((student) => (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.name}</TableCell>
                              <TableCell>{student.nim}</TableCell>
                              <TableCell>{student.email}</TableCell>
                            </TableRow>
                          ))
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Sub Tab: No Title */}
                <TabsContent value="no_title" className="space-y-4">
                  {/* Info Banner */}
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      <strong>Tanpa Judul:</strong> Grup dengan status READY_FOR_BIDDING yang perlu di-assign judul.
                      Pindah ke tab <strong>Belum Siap</strong> untuk melihat grup TITLE_APPROVED yang menunggu supervisor.
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari grup..."
                        value={filters.search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <FilterPanel
                      filters={{
                        supervisorStatus: filters.supervisorStatus || 'all',
                        memberCount: filters.memberCount || 'all',
                      }}
                      onFilterChange={(newFilters) => setFilters(newFilters)}
                      minGroupSize={period?.min_group_size || 3}
                      maxGroupSize={period?.max_group_size || 4}
                      showSupervisor={false}
                      showMemberCount={true}
                    />
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Kelompok</TableHead>
                          <TableHead>Anggota</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8">
                              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              Semua grup sudah memiliki judul
                            </TableCell>
                          </TableRow>
                        ) : isGroupArray(tableData) ? (
                          tableData.map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.code || `Group ${group.id}`}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {group.members?.slice(0, 2).map((member) => (
                                    <span key={member.id} className="text-sm">{member.student.name}</span>
                                  ))}
                                  {group.members && group.members.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{group.members.length - 2} lainnya
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(group.status, group.status_label)}</TableCell>
                            </TableRow>
                          ))
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Sub Tab: Not Ready (TITLE_APPROVED only) */}
                <TabsContent value="not_ready" className="space-y-4">
                  {/* Info Banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">
                      <strong>Belum Siap:</strong> Grup dengan status TITLE_APPROVED yang menunggu penentuan supervisor.
                      Set Supervisor 1 & 2 di tab <strong>Siap Finalisasi</strong> untuk melanjutkan ke Kelompok Final.
                    </p>
                  </div>

                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari grup..."
                      value={filters.search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama Kelompok</TableHead>
                            <TableHead>Anggota</TableHead>
                            <TableHead>Judul</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[120px]">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Tidak ada grup TITLE_APPROVED
                            </TableCell>
                          </TableRow>
                        ) : isGroupArray(tableData) ? (
                          tableData.map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.code || `Group ${group.id}`}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {group.members?.slice(0, 2).map((member) => (
                                    <span key={member.id} className="text-sm">{member.student.name}</span>
                                  ))}
                                  {group.members && group.members.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{group.members.length - 2} lainnya
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {group.title ? (
                                  <p className="text-sm truncate max-w-[200px]">{group.title.title}</p>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(group.status, group.status_label)}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPeriodFinalized || !canModifyByFlow}>
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {group.status === 'FORMING' && (
                                      <DropdownMenuItem onClick={() => handleAddMemberToGroup(group)} disabled={isPeriodFinalized}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Tambah Anggota
                                      </DropdownMenuItem>
                                    )}
                                    {group.status === 'READY_FOR_BIDDING' && (
                                      <DropdownMenuItem onClick={() => handleOpenAssignTitleDialog(group)} disabled={isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_assign_title ?? true)}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Assign Judul
                                      </DropdownMenuItem>
                                    )}
                                    {group.status === 'TITLE_APPROVED' && (
                                      <DropdownMenuItem onClick={() => handleFinalizeGroup(group)} disabled={isPeriodFinalized || !canModifyByFlow || !(group.allowed_actions?.can_promote_to_ready_for_finalization ?? true)}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Finalisasi
                                      </DropdownMenuItem>
                                    )}
                                    {group.allowed_actions?.reason && (
                                      <DropdownMenuItem disabled>
                                        <Info className="mr-2 h-4 w-4" />
                                        {actionReasonMap[group.allowed_actions.reason] || 'Aksi tidak tersedia'}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              {renderPagination()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <FinalizationExecuteDialog
        open={showExecuteDialog}
        onOpenChange={setShowExecuteDialog}
        groups={kelompokFinalGroups}
        stats={stats}
        loading={executingFinalization}
        onConfirm={handleExecuteFinalization}
      />

      <ManualGroupingDialog
        open={showGroupingDialog}
        onOpenChange={handleOpenGroupingDialog}
        studentsWithoutGroup={activeTab === 'others' && activeSubTab === 'no_group' ? (isStudentArray(tableData) ? tableData : []) : []}
        existingGroups={availableGroups}
        availableTitles={availableTitles}
        lecturers={manualGroupingLecturers}
        loading={creatingGroup || addingMembers}
        minGroupSize={period?.min_group_size ?? 3}
        maxGroupSize={period?.max_group_size ?? 4}
        onCreateGroup={handleCreateGroup}
        onAddToExisting={handleAddToExistingGroup}
      />

      {/* Dialog for assigning title to READY_FOR_BIDDING group */}
      <Dialog open={showAssignTitleDialog} onOpenChange={setShowAssignTitleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Judul ke Grup</DialogTitle>
            <DialogDescription>
              Pilih judul yang akan di-assign ke grup {selectedGroupForAction?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Judul</Label>
              <Select
                disabled={availableTitles.length === 0 || isPeriodFinalized}
                onValueChange={(value) => {
                  if (selectedGroupForAction) {
                    handleAssignTitleToGroup(selectedGroupForAction.id, parseInt(value));
                    setShowAssignTitleDialog(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih judul..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTitles.map((title) => (
                    <SelectItem key={title.id} value={title.id.toString()}>
                      <div className="flex flex-col">
                        <span>{title.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {title.lecturer?.name} (Quota: {title.quota})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTitles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada judul marketplace yang tersedia untuk periode ini.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignTitleDialog(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Gunakan shortcut berikut untuk navigasi cepat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Focus Search</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + F</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Refresh Data</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tab 1: Siap Finalisasi</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + 1</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tab 2: Kelompok Final</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + 2</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tab 3: Perlu Perhatian</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + 3</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Export Data</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + E</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Show Help</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyboardHelp(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Mark Final Validation Dialog */}
      <Dialog open={showBulkMarkFinalDialog} onOpenChange={setShowBulkMarkFinalDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Bulk Mark Kelompok Final</DialogTitle>
            <DialogDescription>
              Validasi grup yang akan ditandai sebagai Kelompok Final
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {(() => {
              const selectedGroups = isGroupArray(tableData) ? tableData.filter((g) => selectedRows.has(g.id)) : [];
              const valid: Group[] = [];
              const invalid: { group: Group; reason: string }[] = [];

              selectedGroups.forEach((group) => {
                if (group.status !== 'READY_FOR_FINALIZATION') {
                  invalid.push({ group, reason: 'Status bukan Siap Finalisasi' });
                  return;
                }
                if (!group.supervisor_1_id && !group.title?.lecturer?.id) {
                  invalid.push({ group, reason: 'Belum ada Supervisor 1' });
                  return;
                }
                if (!group.supervisor_2_id) {
                  invalid.push({ group, reason: 'Belum ada Supervisor 2' });
                  return;
                }
                valid.push(group);
              });

              return (
                <>
                  {/* Valid Groups */}
                  {valid.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Valid ({valid.length} grup)
                      </h4>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 space-y-1">
                            {valid.map((group) => (
                          <div key={group.id} className="text-sm text-emerald-800">
                            {group.code || `Group ${group.id}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invalid Groups */}
                  {invalid.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-red-700 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Tidak Valid ({invalid.length} grup)
                      </h4>
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
                        {invalid.map(({ group, reason }) => (
                          <div key={group.id} className="text-sm text-red-800 flex justify-between">
                            <span>{group.code || `Group ${group.id}`}</span>
                            <span className="text-red-600">{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkMarkFinalDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleBulkMarkFinal}
              disabled={settingRow === -1}
            >
              {settingRow === -1 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Final
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Cancel Final Dialog */}
      <Dialog open={showBulkCancelFinalDialog} onOpenChange={setShowBulkCancelFinalDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Cancel Kelompok Final</DialogTitle>
            <DialogDescription>
              Cancel {selectedRows.size} grup dari status Kelompok Final
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800">
                <strong>Perhatian:</strong> Grup yang di-cancel akan kembali ke status <strong>READY_FOR_FINALIZATION</strong>.
                Pastikan untuk mengecek kembali supervisor assignment sebelum melanjutkan.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Alasan Cancel (opsional)</Label>
              <textarea
                id="cancel-reason"
                className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm"
                placeholder="Masukkan alasan cancel..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkCancelFinalDialog(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const reason = (document.getElementById('cancel-reason') as HTMLTextAreaElement)?.value;
                handleBulkCancelFinal(reason);
              }}
              disabled={cancelingKelompokFinal}
            >
              {cancelingKelompokFinal ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Final
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
