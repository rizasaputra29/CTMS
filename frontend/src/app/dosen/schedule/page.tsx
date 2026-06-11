'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { toast } from "sonner";
import { format, parseISO } from 'date-fns';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit } from 'lucide-react';
import { dosenScheduleSchema, type DosenScheduleFormData } from '@/lib/validations/schedule';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { toScheduleMode, toNumber } from '@/types';
import { isApiErrorWithResponse } from '@/lib/error-utils';
import ScheduleCalendar from '@/components/schedule/ScheduleCalendar';


interface Group {
    id: number;
    title: {
        title: string;
    } | null;
    members: {
        student: {
            name: string;
        }
    }[];
}

interface Location {
    id: number;
    name: string;
    type: 'offline' | 'online';
    capacity: number | null;
    is_active: boolean;
}

interface ScheduleEvent {
    id: number | string;
    group_id: number;
    student_id?: number;
    type: 'SEMPRO' | 'SIDANG' | 'EXPO' | 'BIMBINGAN' | 'TA_DEFENSE';
    date: string;
    start_time?: string;
    end_time?: string;
    room: string;
    mode?: string | null;
    notes?: string | null;
    status?: string;
    period_name?: string;
    student_name?: string;
    examiner1?: { name: string } | null;
    examiner2?: { name: string } | null;
    examiners?: { name: string; role?: string }[];
    group: {
        title: {
            title: string;
            lecturer?: { name: string } | null;
        } | null;
        members?: { student: { name: string } }[];
        supervisor?: { name: string } | null;
    };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    BIMBINGAN: { label: 'Bimbingan', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    SEMPRO: { label: 'Sempro', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    EXPO: { label: 'Expo', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    TA_DEFENSE: { label: 'TA Defense', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    SIDANG: { label: 'Sidang', color: 'text-primary-500', bgColor: 'bg-primary-50' },
};

export default function DosenSchedulePage() {
    const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | string | null>(null);

    const form = useForm<DosenScheduleFormData>({
        resolver: zodResolver(dosenScheduleSchema),
        mode: 'onBlur',
        defaultValues: {
            group_id: '',
            type: 'BIMBINGAN',
            date: '',
            start_time: '',
            end_time: '',
            room: '',
            mode: 'offline',
            notes: undefined,
        },
    });

    const fetchLocations = async () => {
        try {
            const res = await api.get('/locations');
            setLocations(res.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch locations', error);
        }
    };

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch periods if not already fetched
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

            // Fetch locations
            await fetchLocations();

            const queryParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';

            // Use the aggregated endpoint that includes BIMBINGAN, SEMPRO/EXPO, and TA_DEFENSE
            const [schedulesRes, groupsRes] = await Promise.all([
                api.get(`/dosen/all-schedules${queryParam}`),
                api.get(`/dosen/groups/supervised${queryParam}`)
            ]);
            setSchedules(schedulesRes.data.data || []);
            setGroups(groupsRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load schedules');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [periods.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        fetchData(val);
    };

    const handleSubmit = async (data: DosenScheduleFormData) => {
        setSaving(true);
        try {
            interface SchedulePayload {
                group_id: string;
                type: string;
                date: string;
                start_time: string;
                end_time: string;
                room?: string;
                mode?: string | null;
                notes?: string | null;
            }
            const payload: SchedulePayload = {
                group_id: data.group_id,
                type: data.type,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
            };
            
            if (data.room) {
                payload.room = data.room;
            }
            
            if (data.type === 'BIMBINGAN' && data.mode) {
                payload.mode = data.mode;
            }
            
            if (data.notes) {
                payload.notes = data.notes;
            }
            
            if (editingId) {
                await api.put(`/schedules/${editingId}`, payload);
                toast.success('Schedule updated successfully');
            } else {
                await api.post('/schedules', payload);
                toast.success('Schedule created successfully');
            }
            setOpen(false);
            resetForm();
            await fetchData();
        } catch (error) {
            console.error('Failed to save schedule', error);
            const message = api.getApiErrorMessage(error, 'Failed to save schedule');
            // Use type guard to safely access axios error properties
            const axiosError = api.isAxiosError(error) ? error : null;
            const conflicts = axiosError?.response?.data?.conflicts;
            if (conflicts && conflicts.length > 0) {
                toast.error(`${message}: ${conflicts.join(', ')}`);
            } else {
                toast.error(message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        
        try {
            await api.delete(`/schedules/${deletingId}`);
            toast.success('Schedule deleted');
            await fetchData();
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete schedule');
        } finally {
            setDeleteDialogOpen(false);
            setDeletingId(null);
        }
    };

    const confirmDelete = (id: number | string) => {
        const schedule = schedules.find(s => s.id === id);
        if (schedule && schedule.type !== 'BIMBINGAN') {
            toast.error(`${schedule.type} schedules cannot be deleted from here.`);
            return;
        }
        setDeletingId(id);
        setDeleteDialogOpen(true);
    };

    const handleEdit = (schedule: ScheduleEvent) => {
        if (schedule.type !== 'BIMBINGAN') {
            toast.info(`${schedule.type} schedules are view-only.`);
            return;
        }
        const editingIdNum = toNumber(schedule.id?.toString());
        setEditingId(editingIdNum);
        
        // Parse date properly
        let dateStr = '';
        try {
            const dateObj = parseISO(schedule.date);
            if (!isNaN(dateObj.getTime())) {
                dateStr = format(dateObj, 'yyyy-MM-dd');
            } else {
                const fallbackDate = new Date(schedule.date);
                if (!isNaN(fallbackDate.getTime())) {
                    dateStr = format(fallbackDate, 'yyyy-MM-dd');
                }
            }
        } catch {
            const fallbackDate = new Date(schedule.date);
            if (!isNaN(fallbackDate.getTime())) {
                dateStr = format(fallbackDate, 'yyyy-MM-dd');
            }
        }
        
        form.reset({
            group_id: schedule.group_id.toString(),
            type: schedule.type,
            date: dateStr,
            start_time: schedule.start_time?.slice(0, 5) || '',
            end_time: schedule.end_time?.slice(0, 5) || '',
            room: schedule.room || '',
            mode: toScheduleMode(schedule.mode),
            notes: schedule.notes || undefined,
        });
        setOpen(true);
    };

    const handleRowClick = (event: ScheduleEvent) => {
        setSelectedEvent(event);
        setDetailDialogOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        form.reset({
            group_id: '',
            type: 'BIMBINGAN',
            date: '',
            start_time: '',
            end_time: '',
            room: '',
            mode: 'offline',
            notes: undefined,
        });
    };

    const watchMode = form.watch('mode');
    const offlineLocations = locations.filter(l => l.type === 'offline');

    // Filter schedules by period if selected
    const filteredSchedules = useMemo(() => {
        if (selectedPeriod === 'all') return schedules;
        return schedules.filter(_s => {
            // This would need period_id in the schedule data
            // For now, return all
            return true;
        });
    }, [schedules, selectedPeriod]);

    // Group schedules by type for statistics
    const scheduleStats = useMemo(() => {
        const stats: Record<string, number> = {};
        filteredSchedules.forEach(s => {
            stats[s.type] = (stats[s.type] || 0) + 1;
        });
        return stats;
    }, [filteredSchedules]);

    if (loading) return <Loading variant="section" />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Schedule</h1>
                    <p className="text-muted-foreground">
                        View all your schedules: bimbingan sessions, examinations, and events.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { resetForm(); setOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New BIMBINGAN
                    </Button>
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Academic Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className={`p-4 rounded-lg border ${config.bgColor}`}>
                        <p className={`text-2xl font-bold ${config.color}`}>
                            {scheduleStats[type] || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">{config.label}</p>
                    </div>
                ))}
            </div>

            {/* Calendar View */}
            <ScheduleCalendar
                schedules={filteredSchedules}
                canEdit={true}
                onAdd={(date) => {
                    resetForm();
                    form.setValue('date', format(date, 'yyyy-MM-dd'));
                    setOpen(true);
                }}
                onEdit={handleEdit}
                onDelete={confirmDelete}
                onRowClick={handleRowClick}
            />

            {/* BIMBINGAN Create/Edit Dialog */}
            <Dialog open={open} onOpenChange={(val) => {
                setOpen(val);
                if (!val) resetForm();
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit BIMBINGAN Schedule' : 'New BIMBINGAN Schedule'}</DialogTitle>
                            <DialogDescription>
                                {editingId ? 'Update the schedule details.' : 'Set up a new bimbingan session for your group.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Field>
                                <FieldLabel htmlFor="group">Group / Title</FieldLabel>
                                <Controller
                                    name="group_id"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value ? String(field.value) : ""}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger data-invalid={form.formState.errors.group_id ? '' : undefined}>
                                                <SelectValue placeholder="Select group" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groups.map((group) => (
                                                    <SelectItem key={group.id} value={group.id.toString()}>
                                                        {group.title?.title || `Group ${group.id}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <FieldError>{form.formState.errors.group_id?.message}</FieldError>
                            </Field>

                            <Field>
                                <FieldLabel>Mode</FieldLabel>
                                <Controller
                                    name="mode"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="offline">Offline</SelectItem>
                                                <SelectItem value="online">Online</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <FieldError>{form.formState.errors.mode?.message}</FieldError>
                            </Field>
                            
                            <Field>
                                <FieldLabel htmlFor="date">Date</FieldLabel>
                                <Controller
                                    name="date"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            id="date"
                                            type="date"
                                            {...field}
                                            data-invalid={fieldState.error ? '' : undefined}
                                            aria-invalid={fieldState.error ? 'true' : 'false'}
                                        />
                                    )}
                                />
                                <FieldError>{form.formState.errors.date?.message}</FieldError>
                            </Field>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel htmlFor="start_time">Start Time</FieldLabel>
                                    <Controller
                                        name="start_time"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Input
                                                id="start_time"
                                                type="time"
                                                {...field}
                                                data-invalid={fieldState.error ? '' : undefined}
                                                aria-invalid={fieldState.error ? 'true' : 'false'}
                                            />
                                        )}
                                    />
                                    <FieldError>{form.formState.errors.start_time?.message}</FieldError>
                                </Field>
                                
                                <Field>
                                    <FieldLabel htmlFor="end_time">End Time</FieldLabel>
                                    <Controller
                                        name="end_time"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Input
                                                id="end_time"
                                                type="time"
                                                {...field}
                                                data-invalid={fieldState.error ? '' : undefined}
                                                aria-invalid={fieldState.error ? 'true' : 'false'}
                                            />
                                        )}
                                    />
                                    <FieldError>{form.formState.errors.end_time?.message}</FieldError>
                                </Field>
                            </div>
                            
                            {watchMode === 'offline' ? (
                                <Field>
                                    <FieldLabel htmlFor="room">Room / Location</FieldLabel>
                                    <Controller
                                        name="room"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select
                                            value={field.value || ""}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger data-invalid={form.formState.errors.room ? '' : undefined}>
                                                    <SelectValue placeholder="Select location" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {offlineLocations.length === 0 ? (
                                                        <SelectItem value="no-locations" disabled>
                                                            No locations available
                                                        </SelectItem>
                                                    ) : (
                                                        offlineLocations.map((location) => (
                                                            <SelectItem key={location.id} value={location.name}>
                                                                {location.name}
                                                                {location.capacity && ` (Capacity: ${location.capacity})`}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <FieldError>{form.formState.errors.room?.message}</FieldError>
                                </Field>
                            ) : (
                                <Field>
                                    <FieldLabel htmlFor="room">Zoom Link</FieldLabel>
                                    <Controller
                                        name="room"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Input
                                                id="room"
                                                placeholder="https://zoom.us/j/..."
                                                {...field}
                                                data-invalid={fieldState.error ? '' : undefined}
                                                aria-invalid={fieldState.error ? 'true' : 'false'}
                                            />
                                        )}
                                    />
                                    <FieldError>{form.formState.errors.room?.message}</FieldError>
                                </Field>
                            )}
                            
                            <Field>
                                <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
                                <Controller
                                    name="notes"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Textarea
                                            id="notes"
                                            placeholder="Additional information..."
                                            {...field}
                                            value={field.value || ''}
                                            data-invalid={fieldState.error ? '' : undefined}
                                            aria-invalid={fieldState.error ? 'true' : 'false'}
                                            rows={3}
                                        />
                                    )}
                                />
                                <FieldError>{form.formState.errors.notes?.message}</FieldError>
                            </Field>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Schedule'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Schedule Detail Dialog */}
            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Schedule Details</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="py-4 space-y-4">
                            {/* Type Badge */}
                            <div className="flex items-center gap-2">
                                <Badge className={TYPE_CONFIG[selectedEvent.type]?.bgColor + ' ' + TYPE_CONFIG[selectedEvent.type]?.color}>
                                    {TYPE_CONFIG[selectedEvent.type]?.label || selectedEvent.type}
                                </Badge>
                                {selectedEvent.status && (
                                    <Badge variant={
                                        selectedEvent.status === 'SCHEDULED' || selectedEvent.status === 'APPROVED' ? 'default' :
                                        selectedEvent.status === 'COMPLETED' ? 'secondary' :
                                        selectedEvent.status === 'CANCELLED' ? 'destructive' :
                                        'outline'
                                    }>
                                        {selectedEvent.status}
                                    </Badge>
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-semibold">
                                {selectedEvent.group?.title?.title || 'Untitled'}
                            </h3>

                            {/* Details */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Date</p>
                                    <p className="font-medium">
                                        {selectedEvent.date ? format(parseISO(selectedEvent.date), 'EEEE, dd MMMM yyyy') : 'Not set'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Time</p>
                                    <p className="font-medium">
                                        {selectedEvent.start_time?.slice(0, 5) || '--:--'} - {selectedEvent.end_time?.slice(0, 5) || '--:--'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Location</p>
                                    <p className="font-medium">{selectedEvent.room || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Mode</p>
                                    <p className="font-medium capitalize">{selectedEvent.mode || 'Offline'}</p>
                                </div>
                            </div>

                            {/* Student/Group Info */}
                            {(selectedEvent.student_name || selectedEvent.group?.members) && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Participants</p>
                                    {selectedEvent.student_name && (
                                        <p className="text-sm font-medium">{selectedEvent.student_name}</p>
                                    )}
                                    {selectedEvent.group?.members && selectedEvent.group.members.length > 0 && (
                                        <p className="text-sm">
                                            {selectedEvent.group.members.map(m => m.student.name).join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Examiners */}
                            {(selectedEvent.examiner1 || selectedEvent.examiner2 || selectedEvent.examiners) && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Examiners</p>
                                    <p className="text-sm">
                                        {selectedEvent.examiners?.map(e => e.name).join(', ') ||
                                         [selectedEvent.examiner1?.name, selectedEvent.examiner2?.name].filter(Boolean).join(', ') ||
                                         '-'}
                                    </p>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedEvent.notes && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{selectedEvent.notes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {selectedEvent.type === 'BIMBINGAN' && (
                                <div className="border-t pt-4 flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => {
                                            setDetailDialogOpen(false);
                                            handleEdit(selectedEvent);
                                        }}
                                    >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-destructive"
                                        onClick={() => {
                                            setDetailDialogOpen(false);
                                            confirmDelete(selectedEvent.id);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Schedule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this schedule? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
