'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
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
import { format } from 'date-fns';
import { Loader2, Plus, Search, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';

interface ExpoEvent {
    id: number;
    period_id: number;
    name: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    capacity: number;
    is_published: boolean;
    registrations_count: number;
    period?: { id: number; name: string };
    creator?: { name: string };
}

interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

type SortKey = 'name' | 'date';
type SortDir = 'asc' | 'desc';
const PAGE_SIZES = [10, 25, 50];

export default function AdminExpoPage() {
    const [events, setEvents] = useState<ExpoEvent[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ExpoEvent | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        period_id: '',
        name: '',
        date: '',
        start_time: '',
        end_time: '',
        room: '',
        capacity: '30',
    });

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [evtRes, perRes] = await Promise.all([
                api.get('/admin/expo-events', { params: selectedPeriod && selectedPeriod !== 'all' ? { period_id: selectedPeriod } : {} }),
                api.get('/admin/periods'),
            ]);
            const eventsData = evtRes.data?.data ?? (Array.isArray(evtRes.data) ? evtRes.data : []);
            setEvents(eventsData);
            const allPeriods = perRes.data?.data || [];
            setPeriods(allPeriods);

            // No auto-select - keep 'all' as default
        } catch (err) {
            console.error('Failed to fetch expo events', err);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => { fetchData(); }, [selectedPeriod]);
    useEffect(() => { setPage(1); }, [searchQuery, pageSize, sortKey, sortDir]);

    const filteredAndSorted = useMemo(() => {
        const result = events.filter(evt => {
            const q = searchQuery.toLowerCase();
            return evt.name.toLowerCase().includes(q) || evt.room.toLowerCase().includes(q);
        });

        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name);
            } else if (sortKey === 'date') {
                cmp = (a.date || '').localeCompare(b.date || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [events, searchQuery, sortKey, sortDir]);

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
        setForm({ period_id: periods[0]?.id.toString() || '', name: '', date: '', start_time: '', end_time: '', room: '', capacity: '30' });
        setDialogOpen(true);
    };

    const openEdit = (evt: ExpoEvent) => {
        setEditing(evt);
        setForm({
            period_id: evt.period_id.toString(),
            name: evt.name,
            date: evt.date.split('T')[0],
            start_time: evt.start_time.slice(0, 5),
            end_time: evt.end_time.slice(0, 5),
            room: evt.room,
            capacity: evt.capacity.toString(),
        });
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = { ...form, capacity: Number(form.capacity), period_id: Number(form.period_id) };
            if (editing) {
                await api.put(`/admin/expo-events/${editing.id}`, payload);
                toast.success('Event updated');
            } else {
                await api.post('/admin/expo-events', payload);
                toast.success('Event created');
            }
            setDialogOpen(false);
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublish = async (evt: ExpoEvent) => {
        try {
            await api.put(`/admin/expo-events/${evt.id}/publish`);
            toast.success(evt.is_published ? 'Unpublished' : 'Published');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
        }
    };

    const handleDelete = async (evt: ExpoEvent) => {
        if (!confirm(`Delete "${evt.name}"?`)) return;
        try {
            await api.delete(`/admin/expo-events/${evt.id}`);
            toast.success('Event deleted');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleExpanded = (id: number) => {
        setExpandedEvents(prev => {
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

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100' : 'opacity-30'}`} />
            </div>
        </TableHead>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Expo Events</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Create and manage expo events for student groups.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> New Event
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

            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {!loading && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <CalendarDays className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No Expo Events Found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        Try adjusting your filters or create a new event.
                    </p>
                </div>
            )}

            {!loading && filteredAndSorted.length > 0 && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10" />
                                    <SortHeader label="Event" sortKeyName="name" />
                                    <SortHeader label="Date" sortKeyName="date" />
                                    <TableHead className="w-[120px]">Time</TableHead>
                                    <TableHead>Room</TableHead>
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
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`font-semibold ${!evt.is_published ? 'text-muted-foreground/70' : ''}`}>
                                                        {evt.name}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap font-mono tabular-nums">
                                                        {formatDate(evt.date)}
                                                    </div>
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
                                                        {evt.room || <span className="text-muted-foreground/40">—</span>}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-sm ${isFull ? 'text-destructive font-medium' : 'text-muted-foreground'} tabular-nums`}>
                                                                {evt.registrations_count}/{evt.capacity}
                                                            </span>
                                                            {isFull && (
                                                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Full</Badge>
                                                            )}
                                                        </div>
                                                        <div className="w-full bg-muted rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary/60'}`}
                                                                style={{ width: `${progressPct}%` }}
                                                            />
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
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-[13px] h-7 px-2"
                                                            onClick={() => handlePublish(evt)}
                                                        >
                                                            {evt.is_published ? (
                                                                <EyeOff className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Eye className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-[13px] h-7 px-2"
                                                            onClick={() => openEdit(evt)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="text-[13px] h-7 px-2"
                                                            onClick={() => handleDelete(evt)}
                                                            disabled={evt.registrations_count > 0}
                                                        >
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
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                    Event Details
                                                                </h4>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Date</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {formatDate(evt.date)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Time</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {evt.start_time.slice(0, 5)} — {evt.end_time.slice(0, 5)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Room</span>
                                                                        <span className="text-[12px] text-muted-foreground">
                                                                            {evt.room || <span className="text-muted-foreground/40">—</span>}
                                                                        </span>
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
                                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                                    Registrations
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Capacity</span>
                                                                        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                            {evt.capacity}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground/70 text-[12px]">Registered</span>
                                                                        <span className={`text-[12px] font-mono tabular-nums ${isFull ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                                                            {evt.registrations_count}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                                                                        <div
                                                                            className={`h-2 rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`}
                                                                            style={{ width: `${progressPct}%` }}
                                                                        />
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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Event' : 'Create Expo Event'}</DialogTitle>
                        <DialogDescription>
                            {editing ? 'Update the event details.' : 'Create a new expo event for student registration.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {!editing && (
                            <div>
                                <Label>Period</Label>
                                <Select value={form.period_id} onValueChange={(v) => setForm({ ...form, period_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select period..." /></SelectTrigger>
                                    <SelectContent>
                                        {periods.filter(p => p.is_active).map((p) => (
                                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <Label>Event Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Expo Capstone Batch 1" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Date</Label>
                                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                            </div>
                            <div>
                                <Label>Room</Label>
                                <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="e.g. Lab IF-101" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Start Time</Label>
                                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                            </div>
                            <div>
                                <Label>End Time</Label>
                                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                            </div>
                            <div>
                                <Label>Capacity</Label>
                                <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.date}>
                            {submitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
