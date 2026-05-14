'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea";
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
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        group_id: '',
        type: 'BIMBINGAN',
        date: '',
        start_time: '',
        end_time: '',
        room: '',
        mode: 'offline',
        notes: '',
    });
    const [editingId, setEditingId] = useState<number | null>(null);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch periods if not already fetched
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...formData,
                mode: formData.type === 'BIMBINGAN' ? formData.mode : null,
                notes: formData.notes || null,
            };
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
            toast.error('Failed to save schedule');
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
        setEditingId(schedule.id as number);
        const d = new Date(schedule.date);
        setFormData({
            group_id: schedule.group_id.toString(),
            type: schedule.type,
            date: format(d, 'yyyy-MM-dd'),
            start_time: schedule.start_time?.slice(0, 5) || '',
            end_time: schedule.end_time?.slice(0, 5) || '',
            room: schedule.room,
            mode: schedule.mode || 'offline',
            notes: schedule.notes || '',
        });
        setOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            group_id: '',
            type: 'BIMBINGAN',
            date: '',
            start_time: '',
            end_time: '',
            room: '',
            mode: 'offline',
            notes: '',
        });
    };

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
                                        <TableCell>{schedule.room}</TableCell>
                                        <TableCell>
                                            <Badge variant={schedule.mode === 'online' ? 'default' : 'secondary'}>
                                                {schedule.mode}
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
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
                            <DialogDescription>
                                {editingId ? 'Update the schedule details.' : 'Set up a new schedule for your group.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="group">Group / Title</Label>
                                <Select
                                    value={formData.group_id}
                                    onValueChange={(val) => setFormData({ ...formData, group_id: val })}
                                >
                                    <SelectTrigger>
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
                            </div>

                            <div className="grid gap-2">
                                <Label>Mode</Label>
                                <Select
                                    value={formData.mode}
                                    onValueChange={(val) => setFormData({ ...formData, mode: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="offline">Offline</SelectItem>
                                        <SelectItem value="online">Online</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="start_time">Start Time</Label>
                                    <Input
                                        id="start_time"
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="end_time">End Time</Label>
                                    <Input
                                        id="end_time"
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="room">Room / Location</Label>
                                <Input
                                    id="room"
                                    placeholder={formData.mode === 'online' ? 'e.g. Zoom link' : 'e.g. Room A101'}
                                    value={formData.room}
                                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Notes (optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Additional information..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                />
                            </div>
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
