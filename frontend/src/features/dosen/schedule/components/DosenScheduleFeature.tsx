'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { toScheduleMode, toNumber } from '@/types/guards';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { dosenScheduleSchema, type DosenScheduleFormData } from '@/lib/validations/schedule';
import ScheduleCalendar from '@/components/schedule/ScheduleCalendar';
import { useDosenSchedule } from '../hooks/use-dosen-schedule';
import type { DosenScheduleEvent } from '../types';

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    BIMBINGAN: { label: 'Bimbingan', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    SEMPRO: { label: 'Sempro', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    EXPO: { label: 'Expo', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    TA_DEFENSE: { label: 'TA Defense', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    SIDANG: { label: 'Sidang', color: 'text-primary-500', bgColor: 'bg-primary-50' },
};

export function DosenScheduleFeature() {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<DosenScheduleEvent | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | string | null>(null);

    const { periods, locations, schedules, groups, isLoading, isRefetching, saveSchedule, isSaving, deleteSchedule, isDeleting } =
        useDosenSchedule(selectedPeriod);

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

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
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

    const handleSubmit = async (data: DosenScheduleFormData) => {
        await saveSchedule({ data, editingId });
        setOpen(false);
        resetForm();
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        await deleteSchedule(deletingId);
        setDeleteDialogOpen(false);
        setDeletingId(null);
    };

    const confirmDelete = (id: number | string) => {
        const schedule = schedules.find((s) => s.id === id);
        if (schedule && schedule.type !== 'BIMBINGAN') {
            toast.error(`${schedule.type} schedules cannot be deleted from here.`);
            return;
        }
        setDeletingId(id);
        setDeleteDialogOpen(true);
    };

    const handleEdit = (schedule: DosenScheduleEvent) => {
        if (schedule.type !== 'BIMBINGAN') {
            toast.info(`${schedule.type} schedules are view-only.`);
            return;
        }
        const editingIdNum = toNumber(schedule.id?.toString());
        setEditingId(editingIdNum);

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

    const handleRowClick = (event: DosenScheduleEvent) => {
        setSelectedEvent(event);
        setDetailDialogOpen(true);
    };

    const watchMode = form.watch('mode');
    const offlineLocations = (locations ?? []).filter((l) => l.type === 'offline');

    const scheduleStats = useMemo(() => {
        const stats: Record<string, number> = {};
        (schedules ?? []).forEach((s) => {
            stats[s.type] = (stats[s.type] || 0) + 1;
        });
        return stats;
    }, [schedules]);

    if (isLoading) return <Loading variant="section" />;

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
                                {periods.map((p) => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && '(Active)'}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {isRefetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className={`p-4 rounded-lg border ${config.bgColor}`}>
                        <p className={`text-2xl font-bold ${config.color}`}>{scheduleStats[type] || 0}</p>
                        <p className="text-sm text-muted-foreground">{config.label}</p>
                    </div>
                ))}
            </div>

            {/* Calendar View */}
            <ScheduleCalendar
                schedules={schedules}
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
            <Dialog
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}
            >
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit BIMBINGAN Schedule' : 'New BIMBINGAN Schedule'}</DialogTitle>
                            <DialogDescription>
                                {editingId
                                    ? 'Update the schedule details.'
                                    : 'Set up a new bimbingan session for your group.'}
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
                                            value={field.value ? String(field.value) : ''}
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
                                        <Select value={field.value} onValueChange={field.onChange}>
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
                                                value={field.value || ''}
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
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Schedule'}
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
                            <div className="flex items-center gap-2">
                                <Badge className={TYPE_CONFIG[selectedEvent.type]?.bgColor + ' ' + TYPE_CONFIG[selectedEvent.type]?.color}>
                                    {TYPE_CONFIG[selectedEvent.type]?.label || selectedEvent.type}
                                </Badge>
                                {selectedEvent.status && (
                                    <Badge
                                        variant={
                                            selectedEvent.status === 'SCHEDULED' || selectedEvent.status === 'APPROVED'
                                                ? 'default'
                                                : selectedEvent.status === 'COMPLETED'
                                                ? 'secondary'
                                                : selectedEvent.status === 'CANCELLED'
                                                ? 'destructive'
                                                : 'outline'
                                        }
                                    >
                                        {selectedEvent.status}
                                    </Badge>
                                )}
                            </div>

                            <h3 className="text-lg font-semibold">{selectedEvent.group?.title?.title || 'Untitled'}</h3>

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

                            {(selectedEvent.student_name || selectedEvent.group?.members) && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Participants</p>
                                    {selectedEvent.student_name && <p className="text-sm font-medium">{selectedEvent.student_name}</p>}
                                    {selectedEvent.group?.members && selectedEvent.group.members.length > 0 && (
                                        <p className="text-sm">
                                            {selectedEvent.group.members.map((m) => m.student.name).join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {(selectedEvent.examiner1 || selectedEvent.examiner2 || selectedEvent.examiners) && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Examiners</p>
                                    <p className="text-sm">
                                        {selectedEvent.examiners?.map((e) => e.name).join(', ') ||
                                            [selectedEvent.examiner1?.name, selectedEvent.examiner2?.name].filter(Boolean).join(', ') ||
                                            '-'}
                                    </p>
                                </div>
                            )}

                            {selectedEvent.notes && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{selectedEvent.notes}</p>
                                </div>
                            )}

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
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
