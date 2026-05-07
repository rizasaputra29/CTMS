'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { PeriodStepperDialog } from '@/components/period/period-stepper-dialog';
import api from '@/lib/api';
import { toast } from "sonner";
import { format } from "date-fns"

interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    bidding_start: string | null;
    bidding_end: string | null;
    pdc1_start: string | null;
    pdc1_end: string | null;
    pdc2_start: string | null;
    pdc2_end: string | null;
    expo_date: string | null;
    ta_start: string | null;
    ta_end: string | null;
    min_group_size: number | null;
    max_group_size: number | null;
    max_supervisor_load: number | null;
}

type SortKey = 'name' | 'start_date' | 'is_active';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [10, 25, 50];

export default function AdminPeriodsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set());
    const [sortKey, setSortKey] = useState<SortKey>('start_date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filteredAndSorted = useMemo(() => {
        const result = periods.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'active' ? p.is_active : !p.is_active;
            return matchesSearch && matchesStatus;
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name);
            } else if (sortKey === 'start_date') {
                cmp = (a.start_date || '').localeCompare(b.start_date || '');
            } else if (sortKey === 'is_active') {
                cmp = Number(a.is_active) - Number(b.is_active);
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [periods, searchQuery, statusFilter, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredAndSorted.slice(start, start + pageSize);
    }, [filteredAndSorted, safePage, pageSize]);

    const showingStart = filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

    const fetchPeriods = useCallback(async () => {
        try {
            const response = await api.get('/admin/periods');
            setPeriods(response.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch periods', error);
            toast.error('Failed to load periods');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, pageSize, sortKey, sortDir]);

    const resetForm = () => {
        setEditingPeriod(null);
    };

    const startEdit = (period: Period) => {
        setEditingPeriod(period);
        setOpen(true);
    };

    const handleSuccess = () => {
        resetForm();
        fetchPeriods();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this period? This action cannot be undone.')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            toast.success('Period deleted');
            fetchPeriods();
        } catch (error: unknown) {
            console.error('Failed to delete period', error);
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to delete period');
            } else {
                toast.error('Failed to delete period');
            }
        }
    };

    const handleToggleActive = async (period: Period) => {
        try {
            await api.put(`/admin/periods/${period.id}`, {
                is_active: !period.is_active,
            });
            toast.success(period.is_active ? 'Period deactivated' : 'Period set as active');
            fetchPeriods();
        } catch (error) {
            console.error('Failed to toggle active', error);
            toast.error('Failed to update period');
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'is_active' ? 'desc' : 'asc');
        }
    };

    const toggleExpanded = (periodId: number) => {
        setExpandedPeriods(prev => {
            const next = new Set(prev);
            if (next.has(periodId)) {
                next.delete(periodId);
            } else {
                next.add(periodId);
            }
            return next;
        });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead
            className="cursor-pointer select-none hover:bg-muted/50"
            onClick={() => handleSort(sortKeyName)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100' : 'opacity-30'}`} />
            </div>
        </TableHead>
    );

    const PhaseDateRow = ({ label, start, end }: { label: string; start: string | null; end: string | null }) => {
        if (!start && !end) return null;
        return (
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground/70 text-[12px]">{label}</span>
                <span className="font-mono text-[12px] text-muted-foreground">
                    {formatDate(start)}
                    {end && <span className="text-muted-foreground/40 mx-1">→</span>}
                    {end ? formatDate(end) : null}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Academic Periods</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage semesters, phase dates, bidding windows, and group configurations.</p>
                </div>
                <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Period
                </Button>
            </div>

            <PeriodStepperDialog
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}
                editingPeriod={editingPeriod}
                onSuccess={handleSuccess}
            />

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search periods by name..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {!loading && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <p className="text-sm">No periods found matching your criteria.</p>
                </div>
            )}

            {!loading && filteredAndSorted.length > 0 && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10" />
                                    <SortHeader label="Name" sortKeyName="name" />
                                    <TableHead className="w-[180px]">Duration</TableHead>
                                    <SortHeader label="Status" sortKeyName="is_active" />
                                    <TableHead className="hidden md:table-cell">Group Config</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.map((period) => {
                                    const isExpanded = expandedPeriods.has(period.id);
                                    const hasPhases = period.bidding_start || period.pdc1_start ||
                                        period.pdc2_start || period.expo_date ||
                                        period.ta_start;
                                    const hasGroupConfig = period.min_group_size != null ||
                                        period.max_group_size != null ||
                                        period.max_supervisor_load != null;

                                    return (
                                        <Fragment key={period.id}>
                                            <TableRow
                                                className={`cursor-pointer ${period.is_active ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}
                                                onClick={() => toggleExpanded(period.id)}
                                            >
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleExpanded(period.id);
                                                        }}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={`font-semibold truncate ${!period.is_active ? 'text-muted-foreground/60' : ''}`}>
                                                            {period.name}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                                                        {formatDate(period.start_date)} <span className="text-muted-foreground/40">—</span> {formatDate(period.end_date)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {period.is_active ? (
                                                        <Badge>Active</Badge>
                                                    ) : (
                                                        <span className="text-[13px] text-muted-foreground/60">Inactive</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {hasGroupConfig ? (
                                                        <div className="text-sm text-muted-foreground whitespace-nowrap">
                                                            {period.min_group_size ?? '—'}<span className="text-muted-foreground/40">–</span>{period.max_group_size ?? '—'} members
                                                            {period.max_supervisor_load != null && (
                                                                <span className="text-muted-foreground/40"> · </span>
                                                            )}
                                                            {period.max_supervisor_load != null && (
                                                                <span>{period.max_supervisor_load}/dosen</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[13px] text-muted-foreground/40">Not configured</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center space-x-1.5 mr-1">
                                                            <Switch
                                                                checked={period.is_active}
                                                                onCheckedChange={() => handleToggleActive(period)}
                                                            />
                                                            <Label className="text-[11px] text-muted-foreground/60 cursor-pointer" onClick={() => handleToggleActive(period)}>Active</Label>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(period)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        {!period.is_active && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(period.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className={`${period.is_active ? 'bg-primary/5' : 'bg-muted/30'} hover:bg-inherit`}>
                                                    <TableCell colSpan={6} className="p-4">
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                            {hasPhases && (
                                                                <div className="space-y-2">
                                                                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                        Phase Dates
                                                                    </h4>
                                                                    <div className="space-y-1.5">
                                                                        <PhaseDateRow label="Bidding" start={period.bidding_start} end={period.bidding_end} />
                                                                        <PhaseDateRow label="PDC1" start={period.pdc1_start} end={period.pdc1_end} />
                                                                        <PhaseDateRow label="PDC2" start={period.pdc2_start} end={period.pdc2_end} />
                                                                        {period.expo_date && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground/70 text-[12px]">Expo</span>
                                                                                <span className="font-mono text-[12px] text-muted-foreground">
                                                                                    {formatDate(period.expo_date)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <PhaseDateRow label="TA Defense" start={period.ta_start} end={period.ta_end} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {hasGroupConfig && (
                                                                <div className="space-y-2">
                                                                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                        Group Configuration
                                                                    </h4>
                                                                    <div className="space-y-1.5">
                                                                        {(period.min_group_size != null || period.max_group_size != null) && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground/70 text-[12px]">Group Size</span>
                                                                                <span className="font-mono text-[12px] text-muted-foreground">
                                                                                    {period.min_group_size ?? '—'}–{period.max_group_size ?? '—'} members
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {period.max_supervisor_load != null && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground/70 text-[12px]">Max Supervisor Load</span>
                                                                                <span className="font-mono text-[12px] text-muted-foreground">
                                                                                    {period.max_supervisor_load} groups/dosen
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!hasPhases && !hasGroupConfig && (
                                                                <div className="text-[13px] text-muted-foreground/40 col-span-full">
                                                                    No phase dates or group configuration set.
                                                                </div>
                                                            )}
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

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <p className="text-sm text-muted-foreground">
                                Showing {showingStart}–{showingEnd} of {filteredAndSorted.length}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-muted-foreground/60">Rows</span>
                                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                    <SelectTrigger className="h-7 w-[60px] text-[12px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZES.map(s => (
                                            <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground px-2">
                                Page {safePage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
