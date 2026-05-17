'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getTaDefenseStatusBadgeVariant } from '@/lib/badge-variants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import Link from 'next/link';
import {
    Loader2, Plus, Search, GraduationCap, AlertCircle,
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, FileText, Lock,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taDefenseSchema, type TaDefenseFormData } from '@/lib/validations/ta-defense';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

interface Period { id: number; name: string; is_active: boolean; }
interface Dosen { id: number; name: string; email: string; }
interface Student { id: number; name: string; nim: string; }
interface Location {
    id: number;
    name: string;
    capacity: number;
    type: 'physical' | 'online';
    is_active: boolean;
}

interface TaDefenseSchedule {
    id: number;
    student: Student;
    students?: Student[];
    group: { id: number; name: string; code: string };
    period: Period;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    location_id?: number;
    status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
    examiner1: Dosen;
    examiner2: Dosen;
    evaluation_deadline: string;
    notes: string | null;
}

interface EligibleMember {
    student: Student;
    is_leader: boolean;
    is_ready_for_sidang: boolean;
    is_already_selected: boolean;
    status_text: string;
    has_active_defense: boolean;
}

interface EligibleStudentData {
    id: number;
    name: string;
    code: string;
    members: EligibleMember[];
    supervisors: { id: number; pivot?: { role: string } }[];
}

type SortKey = 'name' | 'date' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'SCHEDULED' | 'DONE' | 'CANCELLED';

/**
 * Validates if value is a valid StatusFilter
 */
function isStatusFilter(value: string): value is StatusFilter {
  return ['ALL', 'SCHEDULED', 'DONE', 'CANCELLED'].includes(value);
}

const PAGE_SIZES = [10, 25, 50];

export default function AdminTaDefensePage() {
    const [schedules, setSchedules] = useState<TaDefenseSchedule[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [examinerError, setExaminerError] = useState('');

    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelSchedule, setCancelSchedule] = useState<TaDefenseSchedule | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedSchedules, setExpandedSchedules] = useState<Set<number>>(new Set());

    const [eligibleGroups, setEligibleGroups] = useState<EligibleStudentData[]>([]);

    // Status filter state
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

    // React Hook Form setup
    const form = useForm<TaDefenseFormData>({
        resolver: zodResolver(taDefenseSchema),
        mode: 'onBlur',
        defaultValues: {
            period_id: '',
            group_id: '',
            student_ids: [],
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            examiner_1_id: '',
            examiner_2_id: '',
            notes: '',
        },
    });

    // Watch form values for conditional logic
    const watchedGroupId = form.watch('group_id');
    const watchedStudentIds = form.watch('student_ids');
    const watchedPeriodId = form.watch('period_id');
    const watchedExaminer1 = form.watch('examiner_1_id');
    const watchedExaminer2 = form.watch('examiner_2_id');

    const fetchSchedules = useCallback(async () => {
        try {
            // Build params - when "all", send period_id: 'all' to get all schedules
            const params: Record<string, string> = {};
            if (selectedPeriod) {
                params.period_id = selectedPeriod;
            }
            
            const res = await api.get('/admin/ta-defense-schedules', { params });
            setSchedules(res.data.data || []);
        } catch (error) {
            console.error('Fetch schedules error:', error);
            toast.error('Failed to load schedules');
        }
    }, [selectedPeriod]);

    // Combined data fetching with proper cleanup
    useEffect(() => {
        let isMounted = true;

        const loadAllData = async () => {
            setLoading(true);
            try {
                // Fetch periods, dosens, and eligible students in parallel
                const [periodsRes, dosensRes] = await Promise.all([
                    api.get('/admin/periods'),
                    api.get('/admin/users?role=dosen'),
                ]);

                if (!isMounted) return;

                const perData: Period[] = periodsRes.data.data || [];
                setPeriods(perData);
                const dosensData = dosensRes.data?.data || dosensRes.data || [];
                setDosens(Array.isArray(dosensData) ? dosensData : dosensData.data || []);

                // Fetch eligible students if a specific period is selected
                if (selectedPeriod && selectedPeriod !== 'all') {
                    const eligibleRes = await api.get('/admin/ta-defense-schedules/eligible-students', {
                        params: { period_id: selectedPeriod }
                    });
                    if (isMounted) {
                        const eligibleData: EligibleStudentData[] = eligibleRes.data.data || [];
                        setEligibleGroups(eligibleData);
                    }
                } else {
                    if (isMounted) {
                        setEligibleGroups([]);
                    }
                }

                // Fetch schedules
                const params: Record<string, string> = {};
                if (selectedPeriod) {
                    params.period_id = selectedPeriod;
                }
                const schedulesRes = await api.get('/admin/ta-defense-schedules', { params });
                if (isMounted) {
                    setSchedules(schedulesRes.data.data || []);
                }

                // Fetch locations
                const locationsRes = await api.get('/locations');
                if (isMounted) {
                    setLocations(locationsRes.data?.data || []);
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Fetch data error:', error);
                    toast.error('Failed to load data');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadAllData();

        return () => {
            isMounted = false;
        };
    }, [selectedPeriod]);

    const getAvailableStudents = (): EligibleMember[] => {
        const group = eligibleGroups.find(g => g.id.toString() === watchedGroupId);
        return group?.members || [];
    };

    const getSupervisorIds = () => {
        const group = eligibleGroups.find(g => g.id.toString() === watchedGroupId);
        if (!group) return [];
        return group.supervisors?.map(s => s.id) || [];
    };

    const validateExaminers = () => {
        setExaminerError('');
        if (watchedExaminer1 === watchedExaminer2) {
            setExaminerError('Examiner 1 and Examiner 2 cannot be the same');
            return false;
        }
        const supervisorIds = getSupervisorIds();
        if (supervisorIds.includes(parseInt(watchedExaminer1))) {
            setExaminerError('Examiner 1 cannot be a supervisor of this group');
            return false;
        }
        if (supervisorIds.includes(parseInt(watchedExaminer2))) {
            setExaminerError('Examiner 2 cannot be a supervisor of this group');
            return false;
        }
        return true;
    };

    const fetchEligibleGroups = useCallback(async (periodId: string) => {
        if (!periodId) return;
        try {
            const res = await api.get('/admin/ta-defense-schedules/eligible-students', {
                params: { period_id: periodId }
            });
            // API returns array of groups directly with members already populated
            const groupsData: EligibleStudentData[] = res.data.data || [];
            setEligibleGroups(groupsData);
        } catch {
            toast.error('Failed to load eligible groups');
        }
    }, []);

    const onSubmit = async (data: TaDefenseFormData) => {
        if (!validateExaminers()) return;
        try {
            await api.post('/admin/ta-defense-schedules', {
                student_ids: data.student_ids.map(id => parseInt(id)),
                group_id: parseInt(data.group_id),
                period_id: parseInt(data.period_id),
                examiner_1_id: parseInt(data.examiner_1_id),
                examiner_2_id: parseInt(data.examiner_2_id),
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                location_id: data.location_id ? parseInt(data.location_id) : null,
                notes: data.notes || null,
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

    const handleEdit = (schedule: TaDefenseSchedule) => {
        setDialogMode('edit');
        // Format date/time properly - extract just the date part and HH:MM for time
        const formattedDate = schedule.date ? schedule.date.split('T')[0] : '';
        const formattedStartTime = schedule.start_time ? schedule.start_time.substring(0, 5) : '';
        const formattedEndTime = schedule.end_time ? schedule.end_time.substring(0, 5) : '';
        
        form.reset({
            period_id: schedule.period?.id?.toString() || '',
            group_id: schedule.group?.id?.toString() || '',
            student_ids: schedule.students?.map(s => s.id.toString()) || [schedule.student?.id.toString() || ''],
            date: formattedDate,
            start_time: formattedStartTime,
            end_time: formattedEndTime,
            location_id: schedule.location_id?.toString() || '',
            examiner_1_id: schedule.examiner1?.id?.toString() || '',
            examiner_2_id: schedule.examiner2?.id?.toString() || '',
            notes: schedule.notes || '',
        });
        // Pre-fetch eligible groups for the period
        if (schedule.period?.id) {
            fetchEligibleGroups(schedule.period.id.toString());
        }
        setCreateOpen(true);
    };

    const handleUpdate = async (data: TaDefenseFormData) => {
        if (!validateExaminers()) return;
        // Find the current schedule being edited
        const currentSchedule = schedules.find(s => 
            s.group?.id?.toString() === data.group_id && s.status === 'SCHEDULED'
        );
        if (!currentSchedule) {
            toast.error('Schedule not found');
            return;
        }
        try {
            await api.put(`/admin/ta-defense-schedules/${currentSchedule.id}`, {
                period_id: currentSchedule.period?.id, // Include period_id from existing schedule
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
                location_id: parseInt(data.location_id),
                examiner_1_id: parseInt(data.examiner_1_id),
                examiner_2_id: parseInt(data.examiner_2_id),
                notes: data.notes || null,
            });
            toast.success('TA Defense schedule updated');
            setCreateOpen(false);
            resetForm();
            fetchSchedules();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to update schedule'
                : 'Failed to update schedule';
            toast.error(message);
        }
    };

    const resetForm = () => {
        form.reset({
            period_id: '',
            group_id: '',
            student_ids: [],
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            examiner_1_id: '',
            examiner_2_id: '',
            notes: '',
        });
        setExaminerError('');
        setEligibleGroups([]);
    };

    const filteredAndSorted = useMemo(() => {
        const result = schedules.filter(s => {
            const q = searchQuery.toLowerCase();
            // Handle multi-student structure - check all students in the schedule
            const studentMatch = s.students?.some((st: Student) =>
                st.name?.toLowerCase().includes(q) ||
                st.nim?.toLowerCase().includes(q)
            ) || s.student?.name?.toLowerCase().includes(q);
            
            const locationName = locations.find(l => l.id === s.location_id)?.name || s.room || '';
            
            return (
                studentMatch ||
                s.group?.id?.toString().includes(q) ||
                locationName.toLowerCase().includes(q)
            );
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                // Sort by first student's name
                const aName = a.students?.[0]?.name || a.student?.name || '';
                const bName = b.students?.[0]?.name || b.student?.name || '';
                cmp = aName.localeCompare(bName);
            } else if (sortKey === 'date') {
                cmp = (a.date || '').localeCompare(b.date || '');
            } else if (sortKey === 'status') {
                cmp = (a.status || '').localeCompare(b.status || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [schedules, searchQuery, sortKey, sortDir, locations]);

    // Filter by status
    const filteredSchedules = useMemo(() => {
        if (statusFilter === 'ALL') {
            return filteredAndSorted;
        }
        return filteredAndSorted.filter(s => s.status === statusFilter);
    }, [filteredAndSorted, statusFilter]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
        setPage(1); // Reset page when sort changes
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1); // Reset page when page size changes
    };

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setPage(1); // Reset page when search changes
    };

    const handleStatusFilterChange = (status: string) => {
        if (isStatusFilter(status)) {
            setStatusFilter(status);
            setPage(1); // Reset page when filter changes
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

    const statusColor = (status: string) => getTaDefenseStatusBadgeVariant(status);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- pageSize is valid state dependency
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
                                <TableHead>Location</TableHead>
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
                                                    {(s.students && s.students.length > 0) ? s.students[0].name : (s.student?.name || 'N/A')}
                                                    {(s.students && s.students.length > 1) && (
                                                        <span className="text-xs text-muted-foreground ml-1">+{s.students.length - 1} more</span>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-sm font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {(s.students && s.students.length > 0) ? s.students[0].nim : (s.student?.nim || '-')}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-sm tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                    {s.group.code || `#${s.group.id}`}
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
                                                    {locations.find(l => l.id === s.location_id)?.name || s.room || <span className="text-muted-foreground/40">—</span>}
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
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-[13px] h-7"
                                                                onClick={() => handleEdit(s)}
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-[13px] h-7 text-destructive hover:text-destructive"
                                                                onClick={() => { setCancelSchedule(s); setCancelOpen(true); }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </>
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
                                                                    <span className="text-muted-foreground/70 text-[12px]">Location</span>
                                                                    <span className="text-[12px] text-muted-foreground">
                                                                        {locations.find(l => l.id === s.location_id)?.name || s.room || <span className="text-muted-foreground/40">—</span>}
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
                                                                {/* Handle multi-student or single student */}
                                                                {(s.students || [s.student])?.map((student: Student | undefined, idx: number) => (
                                                                    student ? (
                                                                        <div key={student?.id || idx} className="border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground/70 text-[12px]">Name {idx > 0 && `#${idx + 1}`}</span>
                                                                                <span className="text-[12px] font-medium text-foreground/80">{student?.name || 'N/A'}</span>
                                                                            </div>
                                                                            {student?.nim && (
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-muted-foreground/70 text-[12px]">NIM</span>
                                                                                    <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{student.nim}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : null
                                                                ))}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Group</span>
                                                                    <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                        #{s.group?.id || '—'}
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
                            <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))}>
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
                <div className="flex items-center gap-2">
                    <Button onClick={() => {
                        const activePeriod = periods.find(p => p.is_active);
                        const defaultPeriodId = activePeriod ? activePeriod.id.toString() : (selectedPeriod !== 'all' ? selectedPeriod : '');
                        form.setValue('period_id', defaultPeriodId);
                        setDialogMode('create');
                        // Fetch eligible groups for the period
                        const periodToFetch = defaultPeriodId || (activePeriod ? activePeriod.id.toString() : '');
                        if (periodToFetch) {
                            fetchEligibleGroups(periodToFetch);
                        }
                        setCreateOpen(true);
                    }} disabled={!selectedPeriod}>
                        <Plus className="mr-2 h-4 w-4" />
                        Schedule TA Defense
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Period</span>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Periods</SelectItem>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name}
                                    {p.is_active && <span className="ml-2 text-[11px] text-muted-foreground/60">(active)</span>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Status</span>
                    <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative flex-1 sm:ml-auto sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search student, NIM, group..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {!selectedPeriod && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">Select a period to view TA defense schedules.</p>
                </div>
            )}

            {selectedPeriod && filteredSchedules.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <GraduationCap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No TA defense schedules found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} schedules. Try changing the status filter.` : 'Create a new schedule to get started.'}
                    </p>
                </div>
            )}

            {selectedPeriod && filteredSchedules.length > 0 && <ScheduleTable data={filteredSchedules} />}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Schedule TA Defense</DialogTitle>
                        <DialogDescription>
                            Create a new TA defense schedule for selected students.
                            Examiners cannot be supervisors of the group.
                        </DialogDescription>
                    </DialogHeader>

                    {examinerError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{examinerError}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={form.handleSubmit(dialogMode === 'create' ? onSubmit : handleUpdate)}>
                        <div className="grid gap-4 py-4">
                            {/* Period Selector - only in CREATE mode */}
                            {dialogMode === 'create' && (
                                <Controller
                                    name="period_id"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Period</FieldLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    form.setValue('group_id', '');
                                                    form.setValue('student_ids', []);
                                                    setEligibleGroups([]);
                                                    fetchEligibleGroups(val);
                                                }}
                                            >
                                                <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
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
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                            )}

                            <Controller
                                name="group_id"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Group</FieldLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue('student_ids', []);
                                            }}
                                            disabled={!watchedPeriodId}
                                        >
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder={watchedPeriodId ? "Select group" : "Select period first"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {eligibleGroups.map(g => (
                                                    <SelectItem key={g.id} value={g.id.toString()}>
                                                        Group {g.id} {g.code && `(${g.code})`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && (
                                            <FieldError>{fieldState.error.message}</FieldError>
                                        )}
                                    </Field>
                                )}
                            />

                            {/* Multi-Student Checkbox Selection */}
                            {watchedGroupId && (
                                <Field>
                                    <FieldLabel>Students <span className="text-muted-foreground text-xs">(select at least one)</span></FieldLabel>
                                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                        {getAvailableStudents().length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No students in this group.</p>
                                        ) : (
                                            getAvailableStudents().map((m: EligibleMember) => {
                                                const isAlreadySelected = m.is_already_selected;
                                                const isReadyForSidang = m.is_ready_for_sidang;
                                                const isChecked = watchedStudentIds.includes(m.student.id.toString());

                                                return (
                                                    <div key={m.student.id} className="flex items-center space-x-3">
                                                        <Checkbox
                                                            id={`student-${m.student.id}`}
                                                            checked={isChecked || isAlreadySelected}
                                                            disabled={isAlreadySelected || !isReadyForSidang}
                                                            onCheckedChange={(checked) => {
                                                                if (isAlreadySelected) {
                                                                    toast.error('Already selected students cannot be removed');
                                                                    return;
                                                                }
                                                                const currentIds = form.getValues('student_ids');
                                                                if (checked) {
                                                                    form.setValue('student_ids', [...currentIds, m.student.id.toString()]);
                                                                } else {
                                                                    form.setValue('student_ids', currentIds.filter(id => id !== m.student.id.toString()));
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`student-${m.student.id}`}
                                                            className={`text-sm flex items-center gap-2 cursor-pointer ${!isReadyForSidang && !isAlreadySelected ? 'text-muted-foreground' : ''}`}
                                                        >
                                                            <span>{m.student.name}</span>
                                                            <span className="text-xs text-muted-foreground font-mono">{m.student.nim}</span>
                                                            {m.is_leader && (
                                                                <Badge variant="secondary" className="text-[10px] h-4">Leader</Badge>
                                                            )}
                                                            {isAlreadySelected && (
                                                                <Badge variant="default" className="text-[10px] h-4">Selected</Badge>
                                                            )}
                                                            {!isReadyForSidang && !isAlreadySelected && (
                                                                <>
                                                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                                                    <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground" title="Not ready for sidang TA">Locked</Badge>
                                                                </>
                                                            )}
                                                        </label>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    {form.formState.errors.student_ids && (
                                        <FieldError>{form.formState.errors.student_ids.message}</FieldError>
                                    )}
                                    {watchedStudentIds.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            {watchedStudentIds.length} student{watchedStudentIds.length > 1 ? 's' : ''} selected
                                        </p>
                                    )}
                                </Field>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="date"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Date</FieldLabel>
                                            <Input
                                                type="date"
                                                value={field.value}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                className={fieldState.error ? 'border-destructive' : ''}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="location_id"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Location <span className="text-destructive">*</span></FieldLabel>
                                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                    <SelectValue placeholder="Select location..." />
                                                </SelectTrigger>
                                                <SelectContent position="popper" avoidCollisions>
                                                    {locations.length === 0 && (
                                                        <SelectItem value="no-locations" disabled>No locations available</SelectItem>
                                                    )}
                                                    {locations.filter(l => l.is_active).map((loc) => (
                                                        <SelectItem key={loc.id} value={loc.id.toString()}>
                                                            {loc.name} {loc.capacity ? `(Cap: ${loc.capacity})` : ''}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="start_time"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Start Time</FieldLabel>
                                            <Input
                                                type="time"
                                                value={field.value}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                className={fieldState.error ? 'border-destructive' : ''}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="end_time"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>End Time</FieldLabel>
                                            <Input
                                                type="time"
                                                value={field.value}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                className={fieldState.error ? 'border-destructive' : ''}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="examiner_1_id"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Examiner 1</FieldLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                    <SelectValue placeholder="Select examiner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dosens.map(d => (
                                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="examiner_2_id"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <FieldLabel>Examiner 2</FieldLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                    <SelectValue placeholder="Select examiner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dosens.map(d => (
                                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>

                            <Controller
                                name="notes"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Notes (Optional)</FieldLabel>
                                        <Input
                                            placeholder="Additional notes..."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            className={fieldState.error ? 'border-destructive' : ''}
                                        />
                                        {fieldState.error && (
                                            <FieldError>{fieldState.error.message}</FieldError>
                                        )}
                                    </Field>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => { setCreateOpen(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting || watchedStudentIds.length === 0 || (dialogMode === 'create' && !watchedPeriodId)}
                            >
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {dialogMode === 'create' ? 'Create Schedule' : 'Update Schedule'}
                            </Button>
                        </DialogFooter>
                    </form>
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
