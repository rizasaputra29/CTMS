'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Loader2, Plus, CalendarDays, MapPin, Users, Eye, EyeOff,
    Trash2, Edit, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

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

export default function AdminExpoPage() {
    const [events, setEvents] = useState<ExpoEvent[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
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

    const fetchData = useCallback(async () => {
        try {
            const [evtRes, perRes] = await Promise.all([
                api.get('/admin/expo-events'),
                api.get('/admin/periods'),
            ]);
            setEvents(evtRes.data || []);
            setPeriods((perRes.data || []).filter((p: Period) => p.is_active));
        } catch (err) {
            console.error('Failed to fetch expo events', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

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
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
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
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
        }
    };

    const handleDelete = async (evt: ExpoEvent) => {
        if (!confirm(`Delete "${evt.name}"?`)) return;
        try {
            await api.delete(`/admin/expo-events/${evt.id}`);
            toast.success('Event deleted');
            fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
        }
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
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expo Events</h1>
                    <p className="text-muted-foreground">Create and manage expo events for student groups.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> New Event
                </Button>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Expo Events</h2>
                    <p className="text-muted-foreground">Create your first expo event to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {events.map((evt) => (
                        <Card key={evt.id} className={!evt.is_published ? 'opacity-70 border-dashed' : ''}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{evt.name}</CardTitle>
                                    <Badge variant={evt.is_published ? 'default' : 'secondary'}>
                                        {evt.is_published ? 'Published' : 'Draft'}
                                    </Badge>
                                </div>
                                <CardDescription>{evt.period?.name}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                    <span>{new Date(evt.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>{evt.start_time.slice(0, 5)} – {evt.end_time.slice(0, 5)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{evt.room}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span>{evt.registrations_count}/{evt.capacity} registered</span>
                                    {evt.registrations_count >= evt.capacity && (
                                        <Badge variant="destructive" className="text-xs">Full</Badge>
                                    )}
                                </div>
                                {/* Capacity bar */}
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${evt.registrations_count >= evt.capacity ? 'bg-destructive' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(100, (evt.registrations_count / evt.capacity) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline" onClick={() => handlePublish(evt)}>
                                        {evt.is_published ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                                        {evt.is_published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => openEdit(evt)}>
                                        <Edit className="mr-1 h-3 w-3" /> Edit
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(evt)} disabled={evt.registrations_count > 0}>
                                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
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
                                        {periods.map((p) => (
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
