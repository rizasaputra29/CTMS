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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';
import ScheduleCalendar, { type ScheduleEvent } from '@/components/schedule/ScheduleCalendar';

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

export default function DosenSchedulePage() {
    const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        group_id: '',
        type: 'BIMBINGAN',
        date: '',
        room: '',
        mode: 'offline',
        notes: '',
    });
    const [editingId, setEditingId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [schedulesRes, groupsRes] = await Promise.all([
                api.get('/dosen/schedules'),
                api.get('/dosen/groups')
            ]);
            setSchedules(schedulesRes.data.data);
            setGroups(groupsRes.data.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            fetchData();
        } catch (error) {
            console.error('Failed to save schedule', error);
            toast.error('Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        try {
            await api.delete(`/schedules/${id}`);
            toast.success('Schedule deleted');
            fetchData();
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete schedule');
        }
    };

    const handleAdd = (date: Date) => {
        resetForm();
        setFormData(prev => ({
            ...prev,
            date: format(date, "yyyy-MM-dd'T'HH:mm"),
        }));
        setOpen(true);
    };

    const handleEdit = (schedule: ScheduleEvent) => {
        setEditingId(schedule.id);
        const d = new Date(schedule.date);
        setFormData({
            group_id: schedule.group_id.toString(),
            type: schedule.type,
            date: format(d, "yyyy-MM-dd'T'HH:mm"),
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
                <p className="text-muted-foreground">Manage bimbingan sessions for your supervised groups.</p>
            </div>

            <ScheduleCalendar
                schedules={schedules}
                canEdit
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

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
                                                {group.title?.title || `Group #${group.id}`}
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
                                <Label htmlFor="date">Date & Time</Label>
                                <Input
                                    id="date"
                                    type="datetime-local"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
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
