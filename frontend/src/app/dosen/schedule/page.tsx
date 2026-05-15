'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { toast } from "sonner";
import { format } from 'date-fns';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { dosenScheduleSchema, type DosenScheduleFormData } from '@/lib/validations/schedule';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { toScheduleMode, toNumber } from '@/types';

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
    type: string;
    date: string;
    start_time?: string;
    end_time?: string;
    room: string;
    mode?: string;
    notes?: string;
    group?: {
        title?: { title: string };
    };
}

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

            // Use the new aggregated endpoint that includes BIMBINGAN, SEMPRO/EXPO, and TA_DEFENSE
            const [schedulesRes, groupsRes] = await Promise.all([
                api.get(`/dosen/all-schedules${queryParam}`),
                api.get(`/dosen/groups/supervised${queryParam}`)
            ]);
            setSchedules(schedulesRes.data.data || []);
            setGroups(groupsRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch data', error);
            // Fallback to legacy endpoint
            try {
                const queryParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
                const [schedulesRes, groupsRes] = await Promise.all([
                    api.get(`/dosen/schedules${queryParam}`),
                    api.get(`/dosen/groups/supervised${queryParam}`)
                ]);
                setSchedules(schedulesRes.data.data || []);
                setGroups(groupsRes.data.data || []);
            } catch (fallbackError) {
                console.error('Failed to fetch fallback data', fallbackError);
            }
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
                mode?: string;
                notes?: string;
            }
            const payload: SchedulePayload = {
                group_id: data.group_id,
                type: data.type,
                date: data.date,
                start_time: data.start_time,
                end_time: data.end_time,
            };
            
            // Only include room if it has a value
            if (data.room) {
                payload.room = data.room;
            }
            
            // Only include mode for BIMBINGAN
            if (data.type === 'BIMBINGAN' && data.mode) {
                payload.mode = data.mode;
            }
            
            // Only include notes if it has a value
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
            const conflicts = error?.response?.data?.conflicts;
            if (conflicts && conflicts.length > 0) {
                toast.error(`${message}: ${conflicts.join(', ')}`);
            } else {
                toast.error(message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number | string) => {
        // Find the schedule to check its type
        const schedule = schedules.find(s => s.id === id);
        if (schedule && schedule.type !== 'BIMBINGAN') {
            toast.error(`${schedule.type} schedules cannot be deleted from here.`);
            return;
        }
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        try {
            await api.delete(`/schedules/${id}`);
            toast.success('Schedule deleted');
            await fetchData();
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete schedule');
        }
    };

    const handleEdit = (schedule: ScheduleEvent) => {
        // Only allow editing BIMBINGAN schedules
        // SEMPRO, EXPO, and TA_DEFENSE are view-only
        if (schedule.type !== 'BIMBINGAN') {
            toast.info(`${schedule.type} schedules are view-only. Please use the evaluation page for assessments.`);
            return;
        }
        const editingIdNum = toNumber(schedule.id?.toString());
        setEditingId(editingIdNum);
        const d = new Date(schedule.date);
        form.reset({
            group_id: schedule.group_id.toString(),
            type: schedule.type,
            date: format(d, 'yyyy-MM-dd'),
            start_time: schedule.start_time?.slice(0, 5) || '',
            end_time: schedule.end_time?.slice(0, 5) || '',
            room: schedule.room || '',
            mode: toScheduleMode(schedule.mode),
            notes: schedule.notes || undefined,
        });
        setOpen(true);
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
                    <p className="text-muted-foreground">Manage bimbingan sessions for your supervised groups.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { resetForm(); setOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Schedule
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schedules.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    No BIMBINGAN schedules found
                                </TableCell>
                            </TableRow>
                        ) : (
                            schedules
                                .filter(s => s.type === 'BIMBINGAN')
                                .map((schedule) => (
                                    <TableRow key={schedule.id}>
                                        <TableCell>
                                            {format(new Date(schedule.date), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            {schedule.start_time?.slice(0, 5) || ''} - {schedule.end_time?.slice(0, 5) || ''}
                                        </TableCell>
                                        <TableCell>
                                            {schedule.group?.title?.title || `Group ${schedule.group_id}`}
                                        </TableCell>
                                        <TableCell>{schedule.room || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={schedule.mode === 'online' ? 'default' : 'secondary'}>
                                                {schedule.mode || 'offline'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(schedule)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(schedule.id)}
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Schedule Dialog */}
            <Dialog open={open} onOpenChange={(val) => {
                setOpen(val);
                if (!val) resetForm();
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
                            <DialogDescription>
                                {editingId ? 'Update the schedule details.' : 'Set up a new schedule for your group.'}
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
                                            value={field.value || undefined}
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
                                                value={field.value || undefined}
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
        </div>
    );
}
