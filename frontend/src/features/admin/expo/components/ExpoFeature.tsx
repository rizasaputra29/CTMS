'use client';

import { useMemo, useState, Fragment } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
    Plus, Search, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    ArrowUpDown, Eye, EyeOff, Edit, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loading } from '@/components/ui/loading';
import { expoEventSchema, type ExpoEventFormData } from '@/lib/validations/expo';
import { useExpoEvents } from '../hooks/use-expo-events';
import type { ExpoEvent } from '../types';

type SortKey = 'name' | 'date';
type SortDir = 'asc' | 'desc';
const PAGE_SIZES = [10, 25, 50];

interface SortHeaderProps {
    label: string;
    sortKeyName: SortKey;
    sortKey: SortKey;
    onSort: (key: SortKey) => void;
}

function SortHeader({ label, sortKeyName, sortKey, onSort }: SortHeaderProps) {
    return (
        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => onSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100' : 'opacity-30'}`} />
            </div>
        </TableHead>
    );
}

export function ExpoFeature() {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ExpoEvent | null>(null);

    const { events, eventsLoading, periods, locations, create, update, publish, remove, isPending } =
        useExpoEvents(selectedPeriod);

    const { control, handleSubmit, reset, formState: { errors } } = useForm<ExpoEventFormData>({
        resolver: zodResolver(expoEventSchema),
        defaultValues: {
            period_id: '',
            name: '',
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            capacity: '30',
        },
    });

    const filteredAndSorted = useMemo(() => {
        const result = events.filter((evt) => {
            const q = searchQuery.toLowerCase();
            const locationName = locations.find((l) => l.id === evt.location_id)?.name || evt.room || '';
            return evt.name.toLowerCase().includes(q) || locationName.toLowerCase().includes(q);
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'date') cmp = (a.date || '').localeCompare(b.date || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [events, searchQuery, sortKey, sortDir, locations]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredAndSorted.slice(start, start + pageSize);
    }, [filteredAndSorted, safePage, pageSize]);

    const showingStart = filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

    const openCreate = () => {
        setEditing(null);
        reset({
            period_id: periods[0]?.id.toString() || '',
            name: '',
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            capacity: '30',
        });
        setDialogOpen(true);
    };

    const openEdit = (evt: ExpoEvent) => {
        setEditing(evt);
        reset({
            period_id: evt.period_id.toString(),
            name: evt.name,
            date: evt.date.split('T')[0],
            start_time: evt.start_time.slice(0, 5),
            end_time: evt.end_time.slice(0, 5),
            location_id: evt.location_id?.toString() || '',
            capacity: evt.capacity.toString(),
        });
        setDialogOpen(true);
    };

    const onSubmit = async (data: ExpoEventFormData) => {
        if (editing) {
            await update({ id: editing.id, data });
        } else {
            await create(data);
        }
        setDialogOpen(false);
    };

    const handlePublish = async (evt: ExpoEvent) => {
        await publish(evt.id);
    };

    const handleDelete = async (evt: ExpoEvent) => {
        if (!confirm(`Delete "${evt.name}"?`)) return;
        await remove(evt.id);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleExpanded = (id: number) => {
        setExpandedEvents((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const formatDate = (dateStr: string) => {
        try { return format(new Date(dateStr), 'dd MMM yyyy'); }
        catch { return dateStr; }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Expo Events</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Create and manage expo events for student groups.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> New Event
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
                            <SelectItem value="all">All Periods</SelectItem>
                            {periods.map((p) => (
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
                        placeholder="Search by name or room..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {eventsLoading && <Loading variant="section" />}

            {!eventsLoading && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <CalendarDays className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No Expo Events Found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">Try adjusting your filters or create a new event.</p>
                </div>
            )}

            {!eventsLoading && filteredAndSorted.length > 0 && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10" />
                                    <SortHeader label="Event" sortKeyName="name" sortKey={sortKey} onSort={handleSort} />
                                    <SortHeader label="Date" sortKeyName="date" sortKey={sortKey} onSort={handleSort} />
                                    <TableHead className="w-[120px]">Time</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="w-[160px]">Registrations</TableHead>
                                    <TableHead className="w-[110px]">Status</TableHead>
                                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.map((evt) => {
                                    const isExpanded = expandedEvents.has(evt.id);
                                    const isFull = evt.registrations_count >= evt.capacity;
                                    const progressPct = Math.min(100, (evt.registrations_count / Math.max(1, evt.capacity)) * 100);
                                    return (
                                        <Fragment key={evt.id}>
                                            <TableRow
                                                className={`cursor-pointer ${!evt.is_published ? 'bg-muted/20 hover:bg-muted/40' : 'hover:bg-muted/50'}`}
                                                onClick={() => toggleExpanded(evt.id)}
                                            >
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={(e) => { e.stopPropagation(); toggleExpanded(evt.id); }}
                                                    >
                                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`font-semibold ${!evt.is_published ? 'text-muted-foreground/70' : ''}`}>{evt.name}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap font-mono tabular-nums">{formatDate(evt.date)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap font-mono tabular-nums">
                                                        {evt.start_time.slice(0, 5)}
                                                        <span className="text-muted-foreground/40 mx-0.5">–</span>
                                                        {evt.end_time.slice(0, 5)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {locations.find((l) => l.id === evt.location_id)?.name || evt.room || <span className="text-muted-foreground/40">—</span>}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-sm ${isFull ? 'text-destructive font-medium' : 'text-muted-foreground'} tabular-nums`}>
                                                                {evt.registrations_count}/{evt.capacity}
                                                            </span>
                                                            {isFull && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Full</Badge>}
                                                        </div>
                                                        <div className="w-full bg-muted rounded-full h-1.5">
                                                            <div className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary/60'}`} style={{ width: `${progressPct}%` }} />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={evt.is_published ? 'default' : 'secondary'} className="text-[11px]">
                                                        {evt.is_published ? 'Published' : 'Draft'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Button size="sm" variant="outline" className="text-[13px] h-7 px-2" onClick={() => handlePublish(evt)}>
                                                            {evt.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="text-[13px] h-7 px-2" onClick={() => openEdit(evt)}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="text-[13px] h-7 px-2" onClick={() => handleDelete(evt)} disabled={evt.registrations_count > 0}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className="bg-muted/30 hover:bg-inherit">
                                                    <TableCell colSpan={8} className="p-4">
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Event Details</h4>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Date</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{formatDate(evt.date)}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Time</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{evt.start_time.slice(0, 5)} — {evt.end_time.slice(0, 5)}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Location</span>
                                                                        <span className="text-[12px] text-muted-foreground">{locations.find((l) => l.id === evt.location_id)?.name || evt.room || <span className="text-muted-foreground/40">—</span>}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Period</span>
                                                                        <span className="text-[12px] font-medium text-foreground/80">{evt.period?.name || '—'}</span>
                                                                    </div>
                                                                    {evt.creator?.name && (
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-muted-foreground/70 text-[12px]">Created by</span>
                                                                            <span className="text-[12px] text-muted-foreground">{evt.creator.name}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Registrations</h4>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Capacity</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{evt.capacity}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Registered</span>
                                                                        <span className={`text-[12px] font-mono tabular-nums ${isFull ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{evt.registrations_count}</span>
                                                                    </div>
                                                                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                                                                        <div className={`h-2 rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${progressPct}%` }} />
                                                                    </div>
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

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <p className="text-sm text-muted-foreground">Showing {showingStart}–{showingEnd} of {filteredAndSorted.length}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-muted-foreground/60">Rows</span>
                                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                    <SelectTrigger className="h-7 w-[60px] text-[12px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <span className="text-sm text-muted-foreground px-2">Page {safePage} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editing ? 'Edit Event' : 'Create Expo Event'}</DialogTitle>
                            <DialogDescription>{editing ? 'Update the event details.' : 'Create a new expo event for student registration.'}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            {!editing && (
                                <div>
                                    <Label>Period</Label>
                                    <Controller name="period_id" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue placeholder="Select period..." /></SelectTrigger>
                                            <SelectContent>
                                                {periods.filter((p) => p.is_active).map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                    {errors.period_id && <p className="text-sm text-destructive mt-1">{errors.period_id.message}</p>}
                                </div>
                            )}
                            <div>
                                <Label>Event Name</Label>
                                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="e.g. Expo Capstone Batch 1" />} />
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Date</Label>
                                    <Controller name="date" control={control} render={({ field }) => <Input type="date" {...field} />} />
                                    {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
                                </div>
                                <div>
                                    <Label>Location <span className="text-destructive">*</span></Label>
                                    <Controller name="location_id" control={control} render={({ field }) => (
                                        <Select value={field.value || ''} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                                            <SelectContent position="popper" avoidCollisions>
                                                {locations.length === 0 && <SelectItem value="no-locations" disabled>No locations available</SelectItem>}
                                                {locations.filter((l) => l.is_active).map((loc) => <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name} {loc.capacity ? `(Cap: ${loc.capacity})` : ''}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                    {errors.location_id && <p className="text-sm text-destructive mt-1">{errors.location_id.message}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Start Time</Label>
                                    <Controller name="start_time" control={control} render={({ field }) => <Input type="time" {...field} />} />
                                    {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
                                </div>
                                <div>
                                    <Label>End Time</Label>
                                    <Controller name="end_time" control={control} render={({ field }) => <Input type="time" {...field} />} />
                                    {errors.end_time && <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>}
                                </div>
                                <div>
                                    <Label>Capacity</Label>
                                    <Controller name="capacity" control={control} render={({ field }) => <Input type="number" min="1" {...field} />} />
                                    {errors.capacity && <p className="text-sm text-destructive mt-1">{errors.capacity.message}</p>}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
