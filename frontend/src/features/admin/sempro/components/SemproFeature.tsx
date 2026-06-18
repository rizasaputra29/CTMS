'use client';

import { useState, useMemo, Fragment } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { semproScheduleSchema, type SemproScheduleFormData } from '@/lib/validations/sempro';
import type { ScheduleUpdatePayload } from '@/types/schedule';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { getSemproStatusBadgeVariant } from '@/lib/badge-variants';
import { format } from 'date-fns';
import {
    Loader2, Plus, Search, FileText, ClipboardCheck,
    ChevronDown, ChevronUp,
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { SortableTableHeader } from '@/components/common/SortableTableHeader';
import { PaginationControls } from '@/components/common/PaginationControls';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { useExpandableRows } from '@/hooks/use-expandable-rows';
import { useSempro } from '../hooks/use-sempro';
import type { SortKey, SortDir, Schedule } from '../types';

const PAGE_SIZES = [10, 25, 50];

export function SemproFeature() {
    const {
        schedules, groups, periods, dosens, locations,
        isLoading: loading,
        selectedPeriod, setSelectedPeriod,
        createSchedule, approveSchedule, rejectSchedule, cancelSchedule, updateSchedule,
    } = useSempro();

    const [searchQuery, setSearchQuery] = useState('');

    const [scheduleOpen, setScheduleOpen] = useState(false);

    // React Hook Form for schedule dialog
    const form = useForm<SemproScheduleFormData>({
        resolver: zodResolver(semproScheduleSchema),
        defaultValues: {
            period_id: '',
            group_id: '',
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            examiner_1_id: '',
            examiner_2_id: '',
        },
    });

    const [rejectId, setRejectId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [approveId, setApproveId] = useState<number | null>(null);
    const [approveData, setApproveData] = useState({
        date: '', start_time: '', end_time: '', location_id: '', room: '',
        examiner_1_id: '', examiner_2_id: '',
    });

    const [cancelId, setCancelId] = useState<number | null>(null);

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const { isExpanded, toggleExpanded } = useExpandableRows<number>();

    const filteredAndSorted = useMemo(() => {
        const result = schedules.filter(s => {
            const q = searchQuery.toLowerCase();
            const title = s.group?.title?.title?.toLowerCase() || '';
            const groupId = s.group_id.toString();
            const room = s.room?.toLowerCase() || '';
            const ex1 = s.examiner1?.name?.toLowerCase() || '';
            const ex2 = s.examiner2?.name?.toLowerCase() || '';
            return title.includes(q) || groupId.includes(q) || room.includes(q) || ex1.includes(q) || ex2.includes(q);
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'title') {
                const titleA = a.group?.title?.title || '';
                const titleB = b.group?.title?.title || '';
                cmp = titleA.localeCompare(titleB);
            } else if (sortKey === 'date') {
                cmp = (a.date || '').localeCompare(b.date || '');
            } else if (sortKey === 'status') {
                cmp = (a.status || '').localeCompare(b.status || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [schedules, searchQuery, sortKey, sortDir]);

    const { paginatedData, pagination } = useClientPagination(filteredAndSorted, {
        pageSizes: PAGE_SIZES,
    });

    const resetForm = () => {
        form.reset();
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleSchedule = async (data: SemproScheduleFormData) => {
        interface SchedulePayload {
            group_id: number;
            date: string;
            start_time: string;
            end_time: string;
            examiner_1_id: number;
            examiner_2_id: number;
            location_id?: number;
        }
        const payload: SchedulePayload = {
            group_id: Number(data.group_id),
            date: data.date,
            start_time: data.start_time,
            end_time: data.end_time,
            examiner_1_id: Number(data.examiner_1_id),
            examiner_2_id: Number(data.examiner_2_id),
        };
        if (data.location_id) {
            payload.location_id = Number(data.location_id);
        }
        await createSchedule(payload);
        setScheduleOpen(false);
        resetForm();
    };

    const handleApprove = (id: number, schedule?: Schedule) => {
        setApproveId(id);
        setApproveData({
            date: schedule?.date || '',
            start_time: schedule?.start_time?.substring(0, 5) || '',
            end_time: schedule?.end_time?.substring(0, 5) || '',
            location_id: schedule?.location_id?.toString() || '',
            room: schedule?.room || '',
            examiner_1_id: schedule?.examiner1?.id?.toString() || '',
            examiner_2_id: schedule?.examiner2?.id?.toString() || '',
        });
        setApproveDialogOpen(true);
    };

    const submitApprove = async () => {
        if (!approveId) return;
        interface ApprovePayload {
            date: string;
            start_time: string;
            end_time: string;
            examiner_1_id: number;
            examiner_2_id: number;
            location_id?: number;
        }
        const payload: ApprovePayload = {
            date: approveData.date,
            start_time: approveData.start_time,
            end_time: approveData.end_time,
            examiner_1_id: Number(approveData.examiner_1_id),
            examiner_2_id: Number(approveData.examiner_2_id),
        };
        if (approveData.location_id) {
            payload.location_id = Number(approveData.location_id);
        }
        await approveSchedule(approveId, payload);
        setApproveDialogOpen(false);
        setApproveId(null);
    };

    const handleReject = async () => {
        if (!rejectId || !rejectReason.trim()) return;
        await rejectSchedule(rejectId, rejectReason);
        setRejectId(null);
        setRejectReason('');
    };

    const handleCancel = async () => {
        if (!cancelId) return;
        await cancelSchedule(cancelId);
        setCancelId(null);
    };

    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

    const handleEdit = (id: number, schedule: Schedule) => {
        setEditId(id);
        setEditingSchedule(schedule);
        setApproveData({
            date: schedule?.date || '',
            start_time: schedule?.start_time?.substring(0, 5) || '',
            end_time: schedule?.end_time?.substring(0, 5) || '',
            location_id: schedule?.location_id?.toString() || '',
            room: schedule?.room || '',
            examiner_1_id: schedule?.examiner1?.id?.toString() || '',
            examiner_2_id: schedule?.examiner2?.id?.toString() || '',
        });
        setEditDialogOpen(true);
    };

    const submitEdit = async () => {
        if (!editId) return;
        const payload: ScheduleUpdatePayload = {
            date: approveData.date,
            start_time: approveData.start_time,
            end_time: approveData.end_time,
            examiner_1_id: Number(approveData.examiner_1_id),
            examiner_2_id: Number(approveData.examiner_2_id),
            location_id: approveData.location_id && approveData.location_id !== ''
                ? Number(approveData.location_id)
                : null,
        };

        // Include room if location_id is not set or if room has value
        if (approveData.room && approveData.room !== '') {
            payload.room = approveData.room;
        }

        await updateSchedule(editId, payload);
        setEditDialogOpen(false);
        setEditId(null);
        setEditingSchedule(null);
    };

    const statusColor = (s: string) => getSemproStatusBadgeVariant(s);

    const statusDisplay = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'Completed';
            case 'CANCELLED': return 'Cancelled';
            case 'PENDING_APPROVAL': return 'Pending';
            case 'APPROVED': return 'Approved';
            default: return status;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    // Watch form values
    const watchedPeriodId = form.watch('period_id');
    const watchedGroupId = form.watch('group_id');
    const watchedExaminer1Id = form.watch('examiner_1_id');

    // Filter eligible groups based on form period selection
    const eligibleGroups = useMemo(() => {
        return groups.filter(g => {
            if (g.status !== 'READY_FOR_SEMPRO') return false;
            // If no period selected in form, show all ready groups
            if (!watchedPeriodId) return true;
            // Filter by selected period
            return g.period_id?.toString() === watchedPeriodId;
        });
    }, [groups, watchedPeriodId]);

    // Get supervisors of the selected group to exclude from examiners
    const selectedGroup = useMemo(() => {
        if (!watchedGroupId) return null;
        return groups.find(g => g.id.toString() === watchedGroupId);
    }, [groups, watchedGroupId]);

    // Filter dosens to exclude supervisors of selected group
    const availableDosens = useMemo(() => {
        if (!selectedGroup) return dosens;
        // Get supervisor IDs from the selected group
        const groupSupervisorIds: number[] = [];
        if (selectedGroup.supervisor1?.id) {
            groupSupervisorIds.push(selectedGroup.supervisor1.id);
        }
        if (selectedGroup.supervisor2?.id) {
            groupSupervisorIds.push(selectedGroup.supervisor2.id);
        }
        // Filter out supervisors from dosens list
        return dosens.filter(d => !groupSupervisorIds.includes(d.id));
    }, [dosens, selectedGroup]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Sidang Proposal</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Schedule and manage SEMPRO sessions.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setScheduleOpen(true)} disabled={!selectedPeriod}>
                        <Plus className="mr-2 h-4 w-4" /> New Schedule
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Period</span>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-55">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Periode</SelectItem>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name}
                                    {p.is_active && <span className="ml-2 text-[11px] text-muted-foreground/60">(active)</span>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative flex-1 sm:ml-auto sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, examiner, room..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading && <Loading variant="section" />}

            {!loading && !selectedPeriod && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">Select a period to view SEMPRO schedules.</p>
                </div>
            )}

            {!loading && selectedPeriod && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No SEMPRO schedules yet</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        {eligibleGroups.length > 0
                            ? `${eligibleGroups.length} group${eligibleGroups.length > 1 ? 's' : ''} ready for scheduling`
                            : 'No groups are ready for SEMPRO in this period.'}
                    </p>
                </div>
            )}

            {!loading && selectedPeriod && filteredAndSorted.length > 0 && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10" />
                                    <SortableTableHeader label="Group" sortKey="title" currentSortKey={sortKey} onSort={handleSort} />
                                    <SortableTableHeader label="Date" sortKey="date" currentSortKey={sortKey} onSort={handleSort} />
                                    <TableHead>Time</TableHead>
                                    <TableHead>Room</TableHead>
                                    <TableHead>Examiners</TableHead>
                                    <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} onSort={handleSort} />
                                    <TableHead className="w-35 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((s) => {
                                    const expanded = isExpanded(s.id);
                                    const isCancelled = s.status === 'CANCELLED';

                                    return (
                                        <Fragment key={s.id}>
                                            <TableRow
                                                className={`cursor-pointer ${isCancelled ? 'hover:bg-muted/40' : 'hover:bg-muted/50'}`}
                                                onClick={() => toggleExpanded(s.id)}
                                            >
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleExpanded(s.id);
                                                        }}
                                                    >
                                                        {expanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={`font-semibold truncate ${isCancelled ? 'text-muted-foreground/60' : ''}`}>
                                                            {s.group?.title?.title || `Group ${s.group_id}`}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
                                                            #{s.group_id}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap font-mono tabular-nums">
                                                        {formatDate(s.date)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap font-mono tabular-nums">
                                                        {s.start_time}
                                                        <span className="text-muted-foreground/40 mx-0.5">–</span>
                                                        {s.end_time}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {s.room || <span className="text-muted-foreground/40">—</span>}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground leading-tight">
                                                        <div className={isCancelled ? 'text-muted-foreground/50' : ''}>
                                                            {s.group?.supervisor1?.name || <span className="text-muted-foreground/50">—</span>}
                                                        </div>
                                                        <div className={isCancelled ? 'text-muted-foreground/50' : ''}>
                                                            {s.group?.supervisor2?.name || <span className="text-muted-foreground/50">—</span>}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground leading-tight">
                                                        <div className={isCancelled ? 'text-muted-foreground/50' : ''}>
                                                            {s.examiner1?.name || '—'}
                                                        </div>
                                                        <div className={isCancelled ? 'text-muted-foreground/50' : ''}>
                                                            {s.examiner2?.name || '—'}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={statusColor(s.status)} className="text-[12px]">
                                                        {statusDisplay(s.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Link href={`/admin/evaluation-summary/${s.id}`}>
                                                            <Button size="sm" variant="outline" className="text-[13px] h-7 px-2">
                                                                <FileText className="mr-1 h-3.5 w-3.5" />
                                                                Eval
                                                            </Button>
                                                        </Link>
                                                        {s.status === 'PENDING_APPROVAL' && (
                                                            <>
                                                                <Button size="sm" className="h-7 text-[13px]" onClick={() => handleApprove(s.id, s)}>
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-7 text-[13px]"
                                                                    onClick={() => setRejectId(s.id)}
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                        {s.status === 'SCHEDULED' && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-[13px]"
                                                                    onClick={() => handleEdit(s.id, s)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-7 text-[13px]"
                                                                    onClick={() => setCancelId(s.id)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {expanded && (
                                                <TableRow className={`${s.status === 'PENDING_APPROVAL' ? 'bg-primary/5' : 'bg-muted/30'} hover:bg-inherit`}>
                                                    <TableCell colSpan={8} className="p-4">
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                            <div className="space-y-2">
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                    Schedule Details
                                                                </h4>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Date</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {formatDate(s.date)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Time</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {s.start_time} — {s.end_time}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Room</span>
                                                                        <span className="text-[12px] text-muted-foreground">
                                                                            {s.room || <span className="text-muted-foreground/40">—</span>}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Penguji 1</span>
                                                                        <span className="text-[12px] font-medium text-foreground/80">{s.examiner1?.name || '—'}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Penguji 2</span>
                                                                        <span className="text-[12px] font-medium text-foreground/80">{s.examiner2?.name || '—'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                    Evaluations
                                                                </h4>
                                                                {s.examiner_student_averages && s.examiner_student_averages.length > 0 ? (
                                                                    <div className="space-y-1.5">
                                                                        {s.examiner_student_averages.map((ea, i) => (
                                                                            <div key={i} className="flex items-center justify-between">
                                                                                <span className="text-[12px] font-medium text-foreground/80">
                                                                                    {ea.student?.name || `Student #${ea.student?.id}`}
                                                                                </span>
                                                                                <span className="text-[13px] text-muted-foreground font-mono tabular-nums">
                                                                                    {ea.average_score}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[12px] text-muted-foreground/40">No evaluations yet.</p>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                    Bimbingan Evaluations
                                                                </h4>
                                                                {s.bimbingan_evaluations && s.bimbingan_evaluations.length > 0 ? (
                                                                    <div className="space-y-1.5">
                                                                        {s.bimbingan_evaluations.map((be, i) => (
                                                                            <div key={i} className="flex items-center justify-between">
                                                                                <span className="text-[12px] font-medium text-foreground/80">
                                                                                    {be.student?.name || `Student #${be.student?.id}`}
                                                                                </span>
                                                                                <span className="text-[13px] text-muted-foreground font-mono tabular-nums">
                                                                                    {be.average_score}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[12px] text-muted-foreground/40">No bimbingan evaluations yet.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <PaginationControls
                        page={pagination.safePage}
                        pageSize={pagination.pageSize}
                        totalPages={pagination.totalPages}
                        totalItems={pagination.totalItems}
                        showingStart={pagination.showingStart}
                        showingEnd={pagination.showingEnd}
                        pageSizes={pagination.pageSizes}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        size="sm"
                    />
                </>
            )}

            {/* --- Create Schedule Dialog --- */}
            <Dialog open={scheduleOpen} onOpenChange={(v) => { setScheduleOpen(v); if (!v) resetForm(); }}>
                <DialogContent className="sm:max-w-120">
                    <form onSubmit={form.handleSubmit(handleSchedule)}>
                        <DialogHeader>
                            <DialogTitle>New SEMPRO Schedule</DialogTitle>
                            <DialogDescription>
                                Schedule a proposal seminar session for a group.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Period <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="period_id"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a period..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {periods.length === 0 ? (
                                                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                                        No periods available
                                                    </div>
                                                ) : (
                                                    periods.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()}>
                                                            {p.name}
                                                            {p.is_active && <span className="ml-2 text-[11px] text-muted-foreground/60">(active)</span>}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {form.formState.errors.period_id && (
                                    <p className="text-sm text-destructive">{form.formState.errors.period_id.message}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Group <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="group_id"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange} disabled={!watchedPeriodId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={watchedPeriodId ? "Select a group..." : "Select a period first..."} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {eligibleGroups.length === 0 ? (
                                                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                                        {watchedPeriodId ? "No groups ready for SEMPRO in this period" : "Select a period to see available groups"}
                                                    </div>
                                                ) : (
                                                    eligibleGroups.map(g => (
                                                        <SelectItem key={g.id} value={g.id.toString()}>
                                                            {g.title?.title || `Group ${g.id}`}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {form.formState.errors.group_id && (
                                    <p className="text-sm text-destructive">{form.formState.errors.group_id.message}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="grid gap-1.5">
                                    <Label className="text-[13px]">Date <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="date"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input type="date" {...field} />
                                        )}
                                    />
                                    {form.formState.errors.date && (
                                        <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                                    )}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[13px]">Start <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="start_time"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input type="time" {...field} />
                                        )}
                                    />
                                    {form.formState.errors.start_time && (
                                        <p className="text-xs text-destructive">{form.formState.errors.start_time.message}</p>
                                    )}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[13px]">End <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="end_time"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input type="time" {...field} />
                                        )}
                                    />
                                    {form.formState.errors.end_time && (
                                        <p className="text-xs text-destructive">{form.formState.errors.end_time.message}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Room <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="location_id"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a room..." />
                                            </SelectTrigger>
                                            <SelectContent position="popper" avoidCollisions>
                                                {locations.length === 0 ? (
                                                    <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                                        No locations available. Add locations in system settings.
                                                    </div>
                                                ) : (
                                                    locations.map(loc => (
                                                        <SelectItem key={loc.id} value={loc.id.toString()}>
                                                            {loc.name} (Capacity: {loc.capacity})
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label className="text-[13px]">Penguji 1 <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="examiner_1_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                            <SelectContent>
                                                {availableDosens.map(d => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {form.formState.errors.examiner_1_id && (
                                        <p className="text-xs text-destructive">{form.formState.errors.examiner_1_id.message}</p>
                                    )}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[13px]">Penguji 2 <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="examiner_2_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableDosens.filter(d => d.id.toString() !== watchedExaminer1Id).map(d => (
                                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {form.formState.errors.examiner_2_id && (
                                        <p className="text-xs text-destructive">{form.formState.errors.examiner_2_id.message}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setScheduleOpen(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Scheduling...
                                    </>
                                ) : (
                                    'Create Schedule'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* --- Approve Dialog --- */}
            <Dialog open={approveDialogOpen} onOpenChange={(v) => { if (!v) { setApproveDialogOpen(false); setApproveId(null); } }}>
                <DialogContent className="sm:max-w-120">
                    <DialogHeader>
                        <DialogTitle>Approve SEMPRO Schedule</DialogTitle>
                        <DialogDescription>
                            Set schedule details and assign examiners.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Date</Label>
                                <Input
                                    type="date"
                                    value={approveData.date}
                                    onChange={e => setApproveData({ ...approveData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Start</Label>
                                <Input
                                    type="time"
                                    value={approveData.start_time}
                                    onChange={e => setApproveData({ ...approveData, start_time: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">End</Label>
                                <Input
                                    type="time"
                                    value={approveData.end_time}
                                    onChange={e => setApproveData({ ...approveData, end_time: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-[13px]">Room <span className="text-muted-foreground">(optional)</span></Label>
                            <Select
                                value={approveData.location_id}
                                onValueChange={(val) => setApproveData({ ...approveData, location_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a room..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.length === 0 ? (
                                        <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                            No locations available. Add locations in system settings.
                                        </div>
                                    ) : (
                                        locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.id.toString()}>
                                                {loc.name} (Capacity: {loc.capacity})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Penguji 1</Label>
                                <Select
                                    value={approveData.examiner_1_id}
                                    onValueChange={(val) => setApproveData({ ...approveData, examiner_1_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Penguji 2</Label>
                                <Select
                                    value={approveData.examiner_2_id}
                                    onValueChange={(val) => setApproveData({ ...approveData, examiner_2_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens
                                            .filter(d => d.id.toString() !== approveData.examiner_1_id)
                                            .map(d => (
                                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setApproveId(null); }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={submitApprove}
                            disabled={!approveData.date || !approveData.start_time || !approveData.end_time || !approveData.examiner_1_id || !approveData.examiner_2_id}
                        >
                            Approve Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- Reject Dialog --- */}
            <Dialog open={rejectId !== null} onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectReason(''); } }}>
                <DialogContent className="sm:max-w-105">
                    <DialogHeader>
                        <DialogTitle>Reject Schedule Request</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting this SEMPRO schedule.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[13px]">Reason</Label>
                        <Input
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="e.g. Time conflict, wrong examiner..."
                            className="mt-1.5"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- Edit Dialog --- */}
            <Dialog open={editDialogOpen} onOpenChange={(v) => { if (!v) { setEditDialogOpen(false); setEditId(null); } }}>
                <DialogContent className="sm:max-w-120">
                    <DialogHeader>
                        <DialogTitle>Edit SEMPRO Schedule</DialogTitle>
                        <DialogDescription>
                            Update schedule details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Date <span className="text-destructive">*</span></Label>
                                <Input
                                    type="date"
                                    value={approveData.date}
                                    onChange={e => setApproveData({ ...approveData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Start <span className="text-destructive">*</span></Label>
                                <Input
                                    type="time"
                                    value={approveData.start_time}
                                    onChange={e => setApproveData({ ...approveData, start_time: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">End <span className="text-destructive">*</span></Label>
                                <Input
                                    type="time"
                                    value={approveData.end_time}
                                    onChange={e => setApproveData({ ...approveData, end_time: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-[13px]">Room <span className="text-muted-foreground">(optional)</span></Label>
                            <Select
                                value={approveData.location_id}
                                onValueChange={(val) => setApproveData({ ...approveData, location_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a room..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.length === 0 ? (
                                        <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                            No locations available. Add locations in system settings.
                                        </div>
                                    ) : (
                                        locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.id.toString()}>
                                                {loc.name} (Capacity: {loc.capacity})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Penguji 1</Label>
                                <Select
                                    value={approveData.examiner_1_id}
                                    onValueChange={(val) => setApproveData({ ...approveData, examiner_1_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-[13px]">Penguji 2</Label>
                                <Select
                                    value={approveData.examiner_2_id}
                                    onValueChange={(val) => setApproveData({ ...approveData, examiner_2_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens
                                            .filter(d => d.id.toString() !== approveData.examiner_1_id)
                                            .map(d => (
                                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditId(null); }}>
                            Cancel
                        </Button>
                        <Button onClick={submitEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- Cancel Dialog --- */}
            <Dialog open={cancelId !== null} onOpenChange={(v) => { if (!v) setCancelId(null); }}>
                <DialogContent className="sm:max-w-105">
                    <DialogHeader>
                        <DialogTitle>Cancel SEMPRO Schedule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this schedule? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelId(null)}>
                            Back
                        </Button>
                        <Button variant="destructive" onClick={handleCancel}>
                            Cancel Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
