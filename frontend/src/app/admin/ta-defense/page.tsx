'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import axios from 'axios';
import api from '@/lib/api';
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
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import Link from 'next/link';
import {
    Loader2, Plus, Search, GraduationCap, AlertCircle,
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, FileText,
} from 'lucide-react';

interface Period { id: number; name: string; is_active: boolean; }
interface Dosen { id: number; name: string; email: string; }
interface Student { id: number; name: string; nim: string; }

interface TaDefenseSchedule {
    id: number;
    student: Student;
    group: { id: number; name: string; code: string };
    period: Period;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
    examiner1: Dosen;
    examiner2: Dosen;
    evaluation_deadline: string;
    notes: string | null;
}

interface EligibleStudentData {
    group: { id: number; name: string; code: string };
    student: Student;
    supervisors: { id: number; pivot?: { role: string } }[];
    submission?: { id: number };
}

type SortKey = 'name' | 'date' | 'status';
type SortDir = 'asc' | 'desc';
const PAGE_SIZES = [10, 25, 50];

export default function AdminTaDefensePage() {
    const [schedules, setSchedules] = useState<TaDefenseSchedule[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('');
    const [formEndTime, setFormEndTime] = useState('');
    const [formRoom, setFormRoom] = useState('');
    const [formExaminer1, setFormExaminer1] = useState('');
    const [formExaminer2, setFormExaminer2] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [examinerError, setExaminerError] = useState('');

    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelSchedule, setCancelSchedule] = useState<TaDefenseSchedule | null>(null);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedSchedules, setExpandedSchedules] = useState<Set<number>>(new Set());

    const [eligibleGroups, setEligibleGroups] = useState<Array<{
        id: number; name: string; code: string;
        members: { student: Student; is_leader: boolean }[];
        supervisors: { id: number; pivot?: { role: string } }[];
    }>>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const currentPeriod = selectedPeriod;
            const [periodsRes, dosensRes, eligibleRes] = await Promise.all([
                api.get('/admin/periods'),
                api.get('/admin/users?role=dosen'),
                api.get('/admin/ta-defense-schedules/eligible-students', {
                    params: currentPeriod ? { period_id: currentPeriod } : {}
                }),
            ]);

            const perData: Period[] = periodsRes.data.data || [];
            setPeriods(perData);
            const dosensData = dosensRes.data?.data || dosensRes.data || [];
            setDosens(Array.isArray(dosensData) ? dosensData : dosensData.data || []);

            const eligibleData: EligibleStudentData[] = eligibleRes.data.data || [];
            const groupsMap = new Map<number, typeof eligibleGroups[0]>();

            eligibleData.forEach((item) => {
                const group = item.group;
                if (!groupsMap.has(group.id)) {
                    groupsMap.set(group.id, {
                        id: group.id,
                        name: group.name,
                        code: group.code,
                        members: [],
                        supervisors: item.supervisors?.map(s => ({
                            id: s.id,
                            pivot: s.pivot,
                        })) || [],
                    });
                }
                groupsMap.get(group.id)!.members.push({
                    student: item.student,
                    is_leader: false,
                });
            });

            setEligibleGroups(Array.from(groupsMap.values()));

            const activePeriod = perData.find((p: Period) => p.is_active);
            if (activePeriod && !selectedPeriod) {
                setSelectedPeriod(activePeriod.id.toString());
            }
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    const fetchSchedules = useCallback(async () => {
        if (!selectedPeriod) return;
        try {
            const res = await api.get('/admin/ta-defense-schedules', {
                params: { period_id: selectedPeriod }
            });
            setSchedules(res.data.data || []);
        } catch {
            toast.error('Failed to load schedules');
        }
    }, [selectedPeriod]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);
    useEffect(() => { setPage(1); }, [searchQuery, pageSize, sortKey, sortDir]);

    const getAvailableStudents = () => {
        const group = eligibleGroups.find(g => g.id.toString() === selectedGroupId);
        if (!group) return [];
        const activeScheduledStudentIds = schedules
            .filter(s => s.status === 'SCHEDULED' || s.status === 'DONE')
            .map(s => s.student.id);
        return group.members.filter(m => !activeScheduledStudentIds.includes(m.student.id));
    };

    const getSupervisorIds = () => {
        const group = eligibleGroups.find(g => g.id.toString() === selectedGroupId);
        if (!group) return [];
        return group.supervisors?.map(s => s.id) || [];
    };

    const validateExaminers = () => {
        setExaminerError('');
        if (formExaminer1 === formExaminer2) {
            setExaminerError('Examiner 1 and Examiner 2 cannot be the same');
            return false;
        }
        const supervisorIds = getSupervisorIds();
        if (supervisorIds.includes(parseInt(formExaminer1))) {
            setExaminerError('Examiner 1 cannot be a supervisor of this group');
            return false;
        }
        if (supervisorIds.includes(parseInt(formExaminer2))) {
            setExaminerError('Examiner 2 cannot be a supervisor of this group');
            return false;
        }
        return true;
    };

    const handleCreate = async () => {
        if (!validateExaminers()) return;
        try {
            setSubmitting(true);
            await api.post('/admin/ta-defense-schedules', {
                student_id: parseInt(selectedStudentId),
                group_id: parseInt(selectedGroupId),
                period_id: parseInt(selectedPeriod),
                examiner_1_id: parseInt(formExaminer1),
                examiner_2_id: parseInt(formExaminer2),
                date: formDate,
                start_time: formStartTime,
                end_time: formEndTime,
                room: formRoom,
                notes: formNotes || null,
            });
            toast.success('TA Defense schedule created');
            setCreateOpen(false);
            resetForm();
            fetchSchedules();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to create schedule'
                : 'Failed to create schedule';
            toast.error(message);
            if (message.includes('supervisor')) setExaminerError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelSchedule) return;
        try {
            await api.put(`/admin/ta-defense-schedules/${cancelSchedule.id}/cancel`);
            toast.success('Schedule cancelled');
            setCancelOpen(false);
            setCancelSchedule(null);
            fetchSchedules();
        } catch {
            toast.error('Failed to cancel schedule');
        }
    };

    const resetForm = () => {
        setSelectedGroupId('');
        setSelectedStudentId('');
        setFormDate('');
        setFormStartTime('');
        setFormEndTime('');
        setFormRoom('');
        setFormExaminer1('');
        setFormExaminer2('');
        setFormNotes('');
        setExaminerError('');
    };

    const filteredAndSorted = useMemo(() => {
        const result = schedules.filter(s => {
            const q = searchQuery.toLowerCase();
            return (
                s.student.name.toLowerCase().includes(q) ||
                s.student.nim.toLowerCase().includes(q) ||
                s.group.id.toString().includes(q) ||
                (s.room?.toLowerCase() || '').includes(q)
            );
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.student.name.localeCompare(b.student.name);
            } else if (sortKey === 'date') {
                cmp = (a.date || '').localeCompare(b.date || '');
            } else if (sortKey === 'status') {
                cmp = (a.status || '').localeCompare(b.status || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [schedules, searchQuery, sortKey, sortDir]);

    const activeSchedules = useMemo(() => filteredAndSorted.filter(s => s.status !== 'CANCELLED'), [filteredAndSorted]);
    const cancelledSchedules = useMemo(() => filteredAndSorted.filter(s => s.status === 'CANCELLED'), [filteredAndSorted]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleExpanded = (id: number) => {
        setExpandedSchedules(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const statusColor = (status: string) => {
        if (status === 'SCHEDULED') return 'default' as const;
        if (status === 'DONE') return 'default' as const;
        if (status === 'CANCELLED') return 'secondary' as const;
        return 'outline' as const;
    };

    const statusDisplay = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'Scheduled';
            case 'DONE': return 'Completed';
            case 'CANCELLED': return 'Cancelled';
            default: return status;
        }
    };

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100' : 'opacity-30'}`} />
            </div>
        </TableHead>
    );

    const ScheduleTable = ({ data }: { data: TaDefenseSchedule[] }) => {
        const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
        const safePage = Math.min(page, totalPages);
        const paginated = useMemo(() => {
            const start = (safePage - 1) * pageSize;
            return data.slice(start, start + pageSize);
        }, [data, safePage, pageSize]);

        const showingStart = data.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
        const showingEnd = Math.min(safePage * pageSize, data.length);

        return (
            <>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10" />
                                <SortHeader label="Student" sortKeyName="name" />
                                <TableHead>NIM</TableHead>
                                <TableHead className="w-[80px]">Group</TableHead>
                                <SortHeader label="Date" sortKeyName="date" />
                                <TableHead className="w-[120px]">Time</TableHead>
                                <TableHead>Room</TableHead>
                                <TableHead className="w-[180px]">Examiners</TableHead>
                                <SortHeader label="Status" sortKeyName="status" />
                                <TableHead className="w-[80px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.map((s) => {
                                const isExpanded = expandedSchedules.has(s.id);
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
                                                    onClick={(e) => { e.stopPropagation(); toggleExpanded(s.id); }}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`font-semibold ${isCancelled ? 'text-muted-foreground/60' : ''}`}>
                                                    {s.student.name}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-sm font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {s.student.nim}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-sm tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    #{s.group.id}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`text-sm whitespace-nowrap font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {formatDate(s.date)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`text-sm whitespace-nowrap font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {s.start_time.slice(0, 5)}
                                                    <span className="text-muted-foreground/40 mx-0.5">–</span>
                                                    {s.end_time.slice(0, 5)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-sm ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {s.room || <span className="text-muted-foreground/40">—</span>}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`text-sm leading-tight ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    <div>{s.examiner1?.name || '—'}</div>
                                                    <div>{s.examiner2?.name || '—'}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusColor(s.status)} className="text-[11px]">
                                                    {statusDisplay(s.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                    {s.status !== 'CANCELLED' && (
                                                        <Link href={`/admin/evaluation-summary/${s.id}`}>
                                                            <Button size="sm" variant="outline" className="text-[13px] h-7 px-2">
                                                                <FileText className="mr-1 h-3.5 w-3.5" />
                                                                Eval
                                                            </Button>
                                                        </Link>
                                                    )}
                                                    {s.status === 'SCHEDULED' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-[13px] h-7 text-destructive hover:text-destructive"
                                                            onClick={() => { setCancelSchedule(s); setCancelOpen(true); }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {isExpanded && (
                                            <TableRow className={`${isCancelled ? 'bg-muted/20' : 'bg-muted/30'} hover:bg-inherit`}>
                                                <TableCell colSpan={10} className="p-4">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                                                        {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Room</span>
                                                                    <span className="text-[12px] text-muted-foreground">
                                                                        {s.room || <span className="text-muted-foreground/40">—</span>}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Examiner 1</span>
                                                                    <span className="text-[12px] font-medium text-foreground/80">{s.examiner1?.name || '—'}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Examiner 2</span>
                                                                    <span className="text-[12px] font-medium text-foreground/80">{s.examiner2?.name || '—'}</span>
                                                                </div>
                                                                {s.evaluation_deadline && (
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Eval Deadline</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {formatDate(s.evaluation_deadline)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                Student Info
                                                            </h4>
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Name</span>
                                                                    <span className="text-[12px] font-medium text-foreground/80">{s.student.name}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">NIM</span>
                                                                    <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{s.student.nim}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Group</span>
                                                                    <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                        #{s.group.id}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Period</span>
                                                                    <span className="text-[12px] text-muted-foreground">{s.period?.name || '—'}</span>
                                                                </div>
                                                                {s.notes && (
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Notes</span>
                                                                        <span className="text-[12px] text-muted-foreground">{s.notes}</span>
                                                                    </div>
                                                                )}
                                                            </div>
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

                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {showingStart}–{showingEnd} of {data.length}
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
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">TA Defense Schedules</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Manage individual TA defense schedules for students.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} disabled={!selectedPeriod}>
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule TA Defense
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Period</span>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
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
                        placeholder="Search student, NIM, group..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {!selectedPeriod && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">Select a period to view TA defense schedules.</p>
                </div>
            )}

            {selectedPeriod && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No TA defense schedules found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        Create a new schedule to get started.
                    </p>
                </div>
            )}

            {selectedPeriod && filteredAndSorted.length > 0 && (
                <Tabs defaultValue="active" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="active">
                            Active ({activeSchedules.length})
                        </TabsTrigger>
                        <TabsTrigger value="cancelled">
                            Cancelled ({cancelledSchedules.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="space-y-0">
                        {activeSchedules.length === 0 ? (
                            <div className="text-center py-12 border rounded-lg border-dashed">
                                <p className="text-muted-foreground text-sm">No active schedules</p>
                            </div>
                        ) : (
                            <ScheduleTable data={activeSchedules} />
                        )}
                    </TabsContent>

                    <TabsContent value="cancelled" className="space-y-0">
                        {cancelledSchedules.length === 0 ? (
                            <div className="text-center py-12 border rounded-lg border-dashed">
                                <p className="text-muted-foreground text-sm">No cancelled schedules</p>
                            </div>
                        ) : (
                            <ScheduleTable data={cancelledSchedules} />
                        )}
                    </TabsContent>
                </Tabs>
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Schedule TA Defense</DialogTitle>
                        <DialogDescription>
                            Create a new TA defense schedule for an individual student.
                            Examiners cannot be supervisors of the group.
                        </DialogDescription>
                    </DialogHeader>

                    {examinerError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{examinerError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Group</Label>
                                <Select value={selectedGroupId} onValueChange={(val) => {
                                    setSelectedGroupId(val);
                                    setSelectedStudentId('');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {eligibleGroups.map(g => (
                                            <SelectItem key={g.id} value={g.id.toString()}>
                                                Group {g.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Student</Label>
                                <Select
                                    value={selectedStudentId}
                                    onValueChange={setSelectedStudentId}
                                    disabled={!selectedGroupId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select student" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAvailableStudents().map(m => (
                                            <SelectItem key={m.student.id} value={m.student.id.toString()}>
                                                {m.student.name} {m.is_leader && '(Leader)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Room</Label>
                                <Input placeholder="e.g., Room A, Lab 1" value={formRoom} onChange={(e) => setFormRoom(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Examiner 1</Label>
                                <Select value={formExaminer1} onValueChange={setFormExaminer1}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select examiner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Examiner 2</Label>
                                <Select value={formExaminer2} onValueChange={setFormExaminer2}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select examiner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Input placeholder="Additional notes..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || !selectedStudentId || !formDate || !formStartTime || !formEndTime || !formExaminer1 || !formExaminer2}
                        >
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Schedule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this TA defense schedule?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {cancelSchedule && (
                        <div className="py-4">
                            <p className="font-medium">{cancelSchedule.student.name}</p>
                            <p className="text-sm text-muted-foreground">
                                Group {cancelSchedule.group.id} - {formatDate(cancelSchedule.date)}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelOpen(false)}>
                            Keep Schedule
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
