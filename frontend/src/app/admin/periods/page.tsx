'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarIcon, Edit, Loader2 } from 'lucide-react';
import { PeriodStepperDialog } from '@/components/period/period-stepper-dialog';
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

export default function AdminPeriodsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredPeriods = useMemo(() => {
        return periods.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' 
                ? true 
                : statusFilter === 'active' ? p.is_active : !p.is_active;
            return matchesSearch && matchesStatus;
        });
    }, [periods, searchQuery, statusFilter]);

    const fetchPeriods = useCallback(async () => {
        try {
            const response = await api.get('/admin/periods');
            setPeriods(response.data?.data || []);
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
    };

    const startEdit = (period: Period) => {
        setEditingPeriod(period);
        setOpen(true);
    };

    const handleSuccess = () => {
        resetForm();
        fetchPeriods();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this period? This action cannot be undone.')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            toast.success('Period deleted');
            fetchPeriods();
        } catch (error: unknown) {
            console.error('Failed to delete period', error);
            if (api.isAxiosError(error)) {
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
                <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Period
                </Button>
            </div>

            <PeriodStepperDialog
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}
                editingPeriod={editingPeriod}
                onSuccess={handleSuccess}
            />

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search periods by name..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active Only</SelectItem>
                            <SelectItem value="inactive">Inactive Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && filteredPeriods.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No periods found matching your criteria.
                </div>
            )}

            {/* Period Cards */}
            <div className="grid gap-4">
                {filteredPeriods.map((period) => (
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
