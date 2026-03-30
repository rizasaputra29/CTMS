'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, CalendarIcon, Edit, Loader2, Users, BookOpen, GraduationCap } from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import { format } from "date-fns"

interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    bidding_start: string | null;
    bidding_end: string | null;
    pdc1_start: string | null;
    pdc1_end: string | null;
    pdc2_start: string | null;
    pdc2_end: string | null;
    expo_date: string | null;
    ta_start: string | null;
    ta_end: string | null;
    min_group_size: number | null;
    max_group_size: number | null;
    max_supervise_load: number | null;
}

const emptyForm = {
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
    bidding_start: '',
    bidding_end: '',
    pdc1_start: '',
    pdc1_end: '',
    pdc2_start: '',
    pdc2_end: '',
    expo_date: '',
    ta_start: '',
    ta_end: '',
    min_group_size: 3,
    max_group_size: 4,
    max_supervise_load: 5,
};

export default function AdminPeriodsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({ ...emptyForm });

    const fetchPeriods = useCallback(async () => {
        try {
            const response = await api.get('/admin/periods');
            setPeriods(response.data);
        } catch (error) {
            console.error('Failed to fetch periods', error);
            toast.error('Failed to load periods');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    const resetForm = () => {
        setEditingPeriod(null);
        setFormData({ ...emptyForm });
    };

    const startEdit = (period: Period) => {
        setEditingPeriod(period);
        setFormData({
            name: period.name,
            start_date: period.start_date ? period.start_date.split('T')[0] : '',
            end_date: period.end_date ? period.end_date.split('T')[0] : '',
            is_active: period.is_active,
            bidding_start: period.bidding_start ? period.bidding_start.split('T')[0] : '',
            bidding_end: period.bidding_end ? period.bidding_end.split('T')[0] : '',
            pdc1_start: period.pdc1_start ? period.pdc1_start.split('T')[0] : '',
            pdc1_end: period.pdc1_end ? period.pdc1_end.split('T')[0] : '',
            pdc2_start: period.pdc2_start ? period.pdc2_start.split('T')[0] : '',
            pdc2_end: period.pdc2_end ? period.pdc2_end.split('T')[0] : '',
            expo_date: period.expo_date ? period.expo_date.split('T')[0] : '',
            ta_start: period.ta_start ? period.ta_start.split('T')[0] : '',
            ta_end: period.ta_end ? period.ta_end.split('T')[0] : '',
            min_group_size: period.min_group_size ?? 3,
            max_group_size: period.max_group_size ?? 4,
            max_supervise_load: period.max_supervise_load ?? 5,
        });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        // Build payload, converting empty strings to null
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(formData)) {
            if (typeof value === 'string' && value === '') {
                payload[key] = null;
            } else {
                payload[key] = value;
            }
        }

        try {
            if (editingPeriod) {
                await api.put(`/admin/periods/${editingPeriod.id}`, payload);
                toast.success('Period updated successfully');
            } else {
                await api.post('/admin/periods', payload);
                toast.success('Period created successfully');
            }
            setOpen(false);
            resetForm();
            fetchPeriods();
        } catch (error: unknown) {
            console.error('Failed to save period', error);
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to save period');
            } else {
                toast.error('Failed to save period');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this period? This action cannot be undone.')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            toast.success('Period deleted');
            fetchPeriods();
        } catch (error: unknown) {
            console.error('Failed to delete period', error);
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to delete period');
            } else {
                toast.error('Failed to delete period');
            }
        }
    };

    const handleToggleActive = async (period: Period) => {
        try {
            await api.put(`/admin/periods/${period.id}`, {
                is_active: !period.is_active,
            });
            toast.success(period.is_active ? 'Period deactivated' : 'Period set as active');
            fetchPeriods();
        } catch (error) {
            console.error('Failed to toggle active', error);
            toast.error('Failed to update period');
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const DateRangeDisplay = ({ label, start, end }: { label: string; start: string | null; end: string | null }) => {
        if (!start && !end) return null;
        return (
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">
                    {formatDate(start)} → {formatDate(end)}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Academic Periods</h1>
                    <p className="text-muted-foreground">Manage semesters, phase dates, bidding windows, and group configurations.</p>
                </div>
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Period
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>{editingPeriod ? 'Edit Period' : 'New Academic Period'}</DialogTitle>
                                <DialogDescription>
                                    {editingPeriod ? 'Update period configuration and phase dates.' : 'Define a new semester with phase dates and group rules.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4" /> Basic Information
                                    </h4>
                                    <div className="grid gap-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Period Name</Label>
                                            <Input
                                                id="name"
                                                placeholder="e.g. Semester Ganjil 2025/2026"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="start_date">Start Date</Label>
                                                <Input
                                                    id="start_date"
                                                    type="date"
                                                    value={formData.start_date}
                                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="end_date">End Date</Label>
                                                <Input
                                                    id="end_date"
                                                    type="date"
                                                    value={formData.end_date}
                                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="is-active"
                                                checked={formData.is_active}
                                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                            />
                                            <Label htmlFor="is-active">Set as Active Period</Label>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Bidding Window */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" /> Bidding Window
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="bidding_start">Bidding Start</Label>
                                            <Input
                                                id="bidding_start"
                                                type="date"
                                                value={formData.bidding_start}
                                                onChange={(e) => setFormData({ ...formData, bidding_start: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="bidding_end">Bidding End</Label>
                                            <Input
                                                id="bidding_end"
                                                type="date"
                                                value={formData.bidding_end}
                                                onChange={(e) => setFormData({ ...formData, bidding_end: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Phase Dates */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4" /> Phase Dates
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="pdc1_start">PDC1 Start</Label>
                                            <Input id="pdc1_start" type="date" value={formData.pdc1_start}
                                                onChange={(e) => setFormData({ ...formData, pdc1_start: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="pdc1_end">PDC1 End</Label>
                                            <Input id="pdc1_end" type="date" value={formData.pdc1_end}
                                                onChange={(e) => setFormData({ ...formData, pdc1_end: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="pdc2_start">PDC2 Start</Label>
                                            <Input id="pdc2_start" type="date" value={formData.pdc2_start}
                                                onChange={(e) => setFormData({ ...formData, pdc2_start: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="pdc2_end">PDC2 End</Label>
                                            <Input id="pdc2_end" type="date" value={formData.pdc2_end}
                                                onChange={(e) => setFormData({ ...formData, pdc2_end: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="expo_date">Expo Date</Label>
                                            <Input id="expo_date" type="date" value={formData.expo_date}
                                                onChange={(e) => setFormData({ ...formData, expo_date: e.target.value })} />
                                        </div>
                                        <div /> {/* spacer */}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="ta_start">TA Defense Start</Label>
                                            <Input id="ta_start" type="date" value={formData.ta_start}
                                                onChange={(e) => setFormData({ ...formData, ta_start: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="ta_end">TA Defense End</Label>
                                            <Input id="ta_end" type="date" value={formData.ta_end}
                                                onChange={(e) => setFormData({ ...formData, ta_end: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Group Config */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Users className="h-4 w-4" /> Group Configuration
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="min_group_size">Min Group Size</Label>
                                            <Input id="min_group_size" type="number" min={1} max={10}
                                                value={formData.min_group_size}
                                                onChange={(e) => setFormData({ ...formData, min_group_size: parseInt(e.target.value) || 1 })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="max_group_size">Max Group Size</Label>
                                            <Input id="max_group_size" type="number" min={1} max={10}
                                                value={formData.max_group_size}
                                                onChange={(e) => setFormData({ ...formData, max_group_size: parseInt(e.target.value) || 1 })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="max_supervise_load">Max Supervise Load</Label>
                                            <Input id="max_supervise_load" type="number" min={1} max={50}
                                                value={formData.max_supervise_load}
                                                onChange={(e) => setFormData({ ...formData, max_supervise_load: parseInt(e.target.value) || 1 })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingPeriod ? 'Save Changes' : 'Create Period'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && periods.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No periods found. Create one to get started.
                </div>
            )}

            {/* Period Cards */}
            <div className="grid gap-4">
                {periods.map((period) => (
                    <Card key={period.id} className={period.is_active ? 'border-primary' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-xl font-bold">{period.name}</CardTitle>
                                {period.is_active && <Badge>Active</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center space-x-2 mr-4">
                                    <Switch
                                        checked={period.is_active}
                                        onCheckedChange={() => handleToggleActive(period)}
                                    />
                                    <Label className="text-xs text-muted-foreground">Active</Label>
                                </div>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => startEdit(period)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                {!period.is_active && (
                                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(period.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                                <CalendarIcon className="h-4 w-4" />
                                {formatDate(period.start_date)} — {formatDate(period.end_date)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                {/* Left Column: Phase Dates */}
                                <div className="space-y-2">
                                    <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Phase Dates</h5>
                                    <DateRangeDisplay label="Bidding" start={period.bidding_start} end={period.bidding_end} />
                                    <DateRangeDisplay label="PDC1" start={period.pdc1_start} end={period.pdc1_end} />
                                    <DateRangeDisplay label="PDC2" start={period.pdc2_start} end={period.pdc2_end} />
                                    {period.expo_date && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Expo</span>
                                            <span className="font-mono text-xs">{formatDate(period.expo_date)}</span>
                                        </div>
                                    )}
                                    <DateRangeDisplay label="TA Defense" start={period.ta_start} end={period.ta_end} />
                                </div>

                                {/* Right Column: Group Config */}
                                <div className="space-y-2">
                                    <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Group Config</h5>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Group Size</span>
                                        <span className="font-mono text-xs">
                                            {period.min_group_size ?? '—'} – {period.max_group_size ?? '—'} members
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Max Supervise Load</span>
                                        <span className="font-mono text-xs">
                                            {period.max_supervise_load ?? '—'} groups/dosen
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
