'use client';

import { useState, useMemo, useCallback } from 'react';
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
  PaginationNext,
  PaginationPrevious,
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
} from 'lucide-react';
import { useFinalizationDashboard } from '@/hooks/use-finalization-dashboard';
import { useSupervisorLoad } from '@/hooks/use-supervisor-load';
import { useFinalizationActions } from '@/hooks/use-finalization-actions';
import { useManualGrouping } from '@/hooks/use-manual-grouping';
import { FinalizationExecuteDialog } from '@/components/finalization/finalization-execute-dialog';
import { ManualGroupingDialog } from '@/components/finalization/manual-grouping-dialog';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'sonner';

import type { Group, Student, DashboardTab, OthersSubTab } from '@/types/finalization';

export default function FinalizationPage() {
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
    activeTab,
    activeSubTab,
    filters,
    loading,
    showPeriodSelector,
    setActiveTab,
    setActiveSubTab,
    setSearch,
    setPage,
    refresh,
    selectPeriod,
  } = useFinalizationDashboard(periodId);

  const { lecturers: supervisorLecturers } = useSupervisorLoad(period?.id);
  const {
    executeFinalization,
    executingFinalization,
    exporting,
    exportReport,
  } = useFinalizationActions();

  const {
    availableGroups,
    availableTitles,
    lecturers: manualGroupingLecturers,
    creatingGroup,
    addingMembers,
    promotingToReady,
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

  // Fetch available groups when dialog opens
  const handleOpenGroupingDialog = useCallback(async (open: boolean) => {
    setShowGroupingDialog(open);
    if (open && period) {
      await Promise.all([
        fetchAvailableGroups(period.id),
        fetchAvailableTitles(period.id),
        fetchLecturers(period.id),
      ]);
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
    if (!period) return;
    
    const success = await createManualGroup({
      studentIds,
      periodId: period.id,
      option,
      titleId,
      newTitle,
    });
    
    if (success) {
      refresh();
    }
  }, [period, createManualGroup, refresh]);

  const handleAddToExistingGroup = useCallback(async (studentIds: number[], groupId: number) => {
    const success = await addToExistingGroup({
      groupId,
      studentIds,
    });
    
    if (success) {
      refresh();
    }
  }, [addToExistingGroup, refresh]);

  // Handler for assigning title to READY_FOR_BIDDING group
  const handleAssignTitleToGroup = useCallback(async (groupId: number, titleId: number) => {
    const success = await assignTitle({ groupId, titleId });
    if (success) {
      refresh();
    }
  }, [assignTitle, refresh]);

  const handleAddMemberToGroup = useCallback((group: Group) => {
    setSelectedGroupForAction(group);
    // Open manual grouping dialog with pre-selected group
    setShowGroupingDialog(true);
  }, []);

  const handleFinalizeGroup = useCallback(async (group: Group) => {
    const success = await promoteToReadyForFinalization({ groupId: group.id });
    if (success) {
      refresh();
    }
  }, [promoteToReadyForFinalization, refresh]);

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
    return data.data as Group[];
  }, [activeTab, data, isPaginatedData]);

  // Per-row supervisor set handler
  const handleSetSupervisorForGroup = useCallback(
    async (groupId: number, supervisorId: number, role: 'supervisor_1_id' | 'supervisor_2_id') => {
      setSettingRow(groupId);
      try {
        const payload: Record<string, number | boolean | undefined> = {
          group_id: groupId,
          mark_final: false,
        };
        // We need to keep existing values. Find the group in tableData
        const group = (tableData as Group[]).find((g) => g.id === groupId);
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
    [tableData, refresh]
  );

  // Mark group as Kelompok Final
  const handleMarkKelompokFinal = useCallback(
    async (groupId: number) => {
      setSettingRow(groupId);
      try {
        const group = (tableData as Group[]).find((g) => g.id === groupId);
        
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
    [tableData, refresh]
  );

  const handleExecuteFinalization = async () => {
    if (!period) return;

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

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> =
      {
        READY_FOR_FINALIZATION: { variant: 'secondary', label: 'Siap Finalisasi' },
        KELOMPOK_FINAL: { variant: 'default', label: 'Kelompok Final' },
        PDC1_ACTIVE: { variant: 'default', label: 'PDC1' },
        PDC2_ACTIVE: { variant: 'default', label: 'PDC2' },
        FORMING: { variant: 'outline', label: 'Forming' },
        FORMING_SOLO: { variant: 'outline', label: 'Solo Seeker' },
        READY_FOR_BIDDING: { variant: 'outline', label: 'Ready Bidding' },
        TITLE_APPROVED: { variant: 'secondary', label: 'Title Approved' },
        WAITING_SUPERVISOR_APPROVAL: { variant: 'outline', label: 'Waiting Approval' },
        CLOSED: { variant: 'destructive', label: 'Ditutup' },
        DISSOLVED: { variant: 'destructive', label: 'Dibubarkan' },
      };

    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // ══════════════════════════════════════════
  // PERIOD SELECTOR (shown first, before anything)
  // ══════════════════════════════════════════
  if (showPeriodSelector || !period) {
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
            {periods.length > 0 ? (
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
                        <Badge variant="default" className="bg-green-600 text-xs">
                          Aktif
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Max Beban: {p.max_supervisor_load || 8} grup
                      </p>
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
                <p className="font-medium">Memuat daftar periode...</p>
                <p className="text-sm mt-1">Mohon tunggu sebentar</p>
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
              <PaginationPrevious
                onClick={() => setPage(Math.max(1, pagination.currentPage - 1))}
                className={pagination.currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {[...Array(pagination.lastPage)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => setPage(i + 1)}
                  isActive={pagination.currentPage === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(pagination.lastPage, pagination.currentPage + 1))}
                className={pagination.currentPage === pagination.lastPage ? 'pointer-events-none opacity-50' : ''}
              />
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
            <Select 
              value={period?.id.toString()} 
              onValueChange={(val) => selectPeriod(parseInt(val))}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs font-semibold">
                <SelectValue placeholder="Pilih Periode..." />
              </SelectTrigger>
              <SelectContent>
                {periods.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} {p.is_active ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

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

      {/* Document Requirements Status */}
      {stats?.document_requirements && (
        <Card className={stats.document_requirements.all_configured ? 'border-green-200 bg-green-50/30' : 'border-yellow-200 bg-yellow-50/30'}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Document Requirements Status</CardTitle>
              </div>
              <Link href="/admin/document-requirements">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-3 w-3" />
                  Configure
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              {stats.document_requirements.all_configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">All phases configured</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">
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
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
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
              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari grup, mahasiswa, atau judul..."
                    value={filters.search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Table with inline supervisor dropdowns */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : tableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Tidak ada grup dengan status READY_FOR_FINALIZATION
                        </TableCell>
                      </TableRow>
                    ) : (
                      (tableData as Group[]).map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
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
                              value={group.supervisor_1_id?.toString() ?? group.title?.lecturer?.id?.toString() ?? undefined}
                              onValueChange={(val) => handleSetSupervisorForGroup(group.id, parseInt(val), 'supervisor_1_id')}
                              disabled={settingRow === group.id}
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
                              value={group.supervisor_2_id?.toString() ?? undefined}
                              onValueChange={(val) => handleSetSupervisorForGroup(group.id, parseInt(val), 'supervisor_2_id')}
                              disabled={settingRow === group.id}
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
                              disabled={!group.supervisor_1_id || settingRow === group.id}
                              onClick={() => handleMarkKelompokFinal(group.id)}
                              className="text-xs h-8"
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
                      ))
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
                {stats?.can_finalize && (
                  <Button onClick={() => setShowExecuteDialog(true)} variant="default">
                    <Shield className="mr-2 h-4 w-4" />
                    Eksekusi Finalisasi
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
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

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Kelompok</TableHead>
                      <TableHead>Judul</TableHead>
                      <TableHead>Anggota</TableHead>
                      <TableHead>Supervisor 1</TableHead>
                      <TableHead>Supervisor 2</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : tableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Belum ada kelompok final. Set supervisor di tab &quot;Siap Finalisasi&quot; terlebih dahulu.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (tableData as Group[]).map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
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
                          <TableCell>{getStatusBadge(group.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
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
                onValueChange={(v) => setActiveSubTab(v as OthersSubTab)}
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
                    <Button onClick={() => setShowGroupingDialog(true)}>
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
                        ) : (
                          (tableData as Student[]).map((student) => (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.name}</TableCell>
                              <TableCell>{student.nim}</TableCell>
                              <TableCell>{student.email}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Sub Tab: No Title */}
                <TabsContent value="no_title" className="space-y-4">
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
                        ) : (
                          (tableData as Group[]).map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.name}</TableCell>
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
                              <TableCell>{getStatusBadge(group.status)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Sub Tab: Not Ready (FORMING, FORMING_SOLO, READY_FOR_BIDDING, TITLE_APPROVED, etc.) */}
                <TabsContent value="not_ready" className="space-y-4">
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
                            <TableCell colSpan={4} className="text-center py-8">
                              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Semua grup sudah siap atau sudah difinalisasi
                            </TableCell>
                          </TableRow>
                        ) : (
                          (tableData as Group[]).map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.name}</TableCell>
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
                              <TableCell>{getStatusBadge(group.status)}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {group.status === 'FORMING' && (
                                      <DropdownMenuItem onClick={() => handleAddMemberToGroup(group)}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Tambah Anggota
                                      </DropdownMenuItem>
                                    )}
                                    {group.status === 'READY_FOR_BIDDING' && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedGroupForAction(group);
                                        setShowAssignTitleDialog(true);
                                      }}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Assign Judul
                                      </DropdownMenuItem>
                                    )}
                                    {group.status === 'TITLE_APPROVED' && (
                                      <DropdownMenuItem onClick={() => handleFinalizeGroup(group)}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Finalisasi
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
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
        studentsWithoutGroup={activeTab === 'others' && activeSubTab === 'no_group' ? (tableData as Student[]) : []}
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignTitleDialog(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
