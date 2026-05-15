'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Loader2, Search, ArrowUpDown, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { ScheduleMode } from '@/types';
import { isScheduleMode, toScheduleMode } from '@/types';

interface Location {
    id: number;
    name: string;
    capacity: number | null;
    type: 'offline' | 'online';
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

type SortKey = 'name' | 'type' | 'capacity' | 'status';
type SortDir = 'asc' | 'desc';
type TypeFilter = 'all' | 'offline' | 'online';
type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Validates if value is a valid StatusFilter
 */
function isStatusFilter(value: string): value is StatusFilter {
  return ['all', 'active', 'inactive'].includes(value);
}

const PAGE_SIZES = [10, 25, 50];

export default function AdminLocationsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Location | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState<{
        name: string;
        type: ScheduleMode;
        capacity: string;
        description: string;
        is_active: boolean;
    }>({
        name: '',
        type: 'offline',
        capacity: '',
        description: '',
        is_active: true,
    });

    const fetchLocations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/locations');
            setLocations(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch locations', err);
            toast.error('Failed to load locations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, typeFilter, statusFilter, pageSize, sortKey, sortDir]);

    const filteredAndSorted = useMemo(() => {
        let result = [...locations];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.description?.toLowerCase() || '').includes(q)
            );
        }

        // Type filter
        if (typeFilter !== 'all') {
            result = result.filter(l => l.type === typeFilter);
        }

        // Status filter
        if (statusFilter === 'active') {
            result = result.filter(l => l.is_active);
        } else if (statusFilter === 'inactive') {
            result = result.filter(l => !l.is_active);
        }

        // Sort
        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name);
            } else if (sortKey === 'type') {
                cmp = a.type.localeCompare(b.type);
            } else if (sortKey === 'capacity') {
                const aCap = a.capacity || 0;
                const bCap = b.capacity || 0;
                cmp = aCap - bCap;
            } else if (sortKey === 'status') {
                cmp = Number(a.is_active) - Number(b.is_active);
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [locations, searchQuery, typeFilter, statusFilter, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredAndSorted.slice(start, start + pageSize);
    }, [filteredAndSorted, safePage, pageSize]);

    const showingStart = filteredAndSorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const showingEnd = Math.min(safePage * pageSize, filteredAndSorted.length);

    const resetForm = () => {
        setEditing(null);
        setForm({
            name: '',
            type: 'offline',
            capacity: '',
            description: '',
            is_active: true,
        });
    };

    const openCreate = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEdit = (location: Location) => {
        setEditing(location);
        setForm({
            name: location.name,
            type: location.type,
            capacity: location.capacity?.toString() || '',
            description: location.description || '',
            is_active: location.is_active,
        });
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                name: form.name,
                type: form.type,
                capacity: form.capacity ? parseInt(form.capacity) : null,
                description: form.description || null,
                is_active: form.is_active,
            };

            if (editing) {
                await api.put(`/locations/${editing.id}`, payload);
                toast.success('Location updated successfully');
            } else {
                await api.post('/locations', payload);
                toast.success('Location created successfully');
            }

            setDialogOpen(false);
            resetForm();
            fetchLocations();
        } catch (error: any) {
            console.error('Failed to save location', error);
            const message = error?.response?.data?.message || 'Failed to save location';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (location: Location) => {
        if (!confirm(`Are you sure you want to delete "${location.name}"?\n\nNote: Location must be inactive before deletion.`)) {
            return;
        }

        setDeleting(location.id);
        try {
            await api.delete(`/locations/${location.id}`);
            toast.success('Location deleted successfully');
            fetchLocations();
        } catch (error: any) {
            console.error('Failed to delete location', error);
            const message = error?.response?.data?.message || 'Failed to delete location';
            toast.error(message);
        } finally {
            setDeleting(null);
        }
    };

    const handleToggleActive = async (location: Location) => {
        try {
            await api.put(`/locations/${location.id}`, {
                is_active: !location.is_active,
            });
            toast.success(`Location ${location.is_active ? 'deactivated' : 'activated'} successfully`);
            fetchLocations();
        } catch (error: any) {
            console.error('Failed to update location status', error);
            const message = error?.response?.data?.message || 'Failed to update location status';
            toast.error(message);
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Manage rooms, labs, and virtual locations for schedules.
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Location
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search locations..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Type</span>
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(isScheduleMode(v) ? v : 'all')}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Status</span>
                    <Select value={statusFilter} onValueChange={(v) => { if (isStatusFilter(v)) setStatusFilter(v); }}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredAndSorted.length === 0 && (
                <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                    <MapPin className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No Locations Found</p>
                    <p className="text-[13px] text-muted-foreground/60 mt-1">
                        {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters.'
                            : 'Create your first location to get started.'}
                    </p>
                </div>
            )}

            {/* Table */}
            {!loading && filteredAndSorted.length > 0 && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortHeader label="Name" sortKeyName="name" />
                                    <SortHeader label="Type" sortKeyName="type" />
                                    <SortHeader label="Capacity" sortKeyName="capacity" />
                                    <SortHeader label="Status" sortKeyName="status" />
                                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.map((location) => (
                                    <TableRow key={location.id} className={!location.is_active ? 'bg-muted/20' : ''}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <MapPin className={`h-4 w-4 ${location.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <span className={`font-medium ${!location.is_active ? 'text-muted-foreground' : ''}`}>
                                                    {location.name}
                                                </span>
                                            </div>
                                            {location.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                                                    {location.description}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={location.type === 'offline' ? 'default' : 'secondary'} className="text-[11px]">
                                                {location.type === 'offline' ? 'Offline' : 'Online'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {location.capacity ? location.capacity : '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={location.is_active}
                                                    onCheckedChange={() => handleToggleActive(location)}
                                                />
                                                <Badge variant={location.is_active ? 'default' : 'secondary'} className="text-[11px]">
                                                    {location.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-[13px] h-7 px-2"
                                                    onClick={() => openEdit(location)}
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="text-[13px] h-7 px-2"
                                                    onClick={() => handleDelete(location)}
                                                    disabled={location.is_active || deleting === location.id}
                                                    title={location.is_active ? 'Deactivate before deleting' : 'Delete location'}
                                                >
                                                    {deleting === location.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
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
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Location' : 'Add Location'}</DialogTitle>
                        <DialogDescription>
                            {editing
                                ? 'Update the location details below.'
                                : 'Create a new location for scheduling events and sessions.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., Lab IF-101, Zoom Meeting Room"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Type *</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(v) => setForm({ ...form, type: toScheduleMode(v) })}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="offline">Offline</SelectItem>
                                        <SelectItem value="online">Online</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="capacity">Capacity (optional)</Label>
                                <Input
                                    id="capacity"
                                    type="number"
                                    min="1"
                                    value={form.capacity}
                                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                                    placeholder="e.g., 30"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Additional details about this location..."
                                rows={3}
                            />
                        </div>
                        <div className="flex items-center justify-between space-y-0">
                            <Label htmlFor="is_active">Active</Label>
                            <Switch
                                id="is_active"
                                checked={form.is_active}
                                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                            />
                        </div>
                        {editing && (
                            <p className="text-xs text-muted-foreground">
                                Tip: Set to inactive to prevent this location from appearing in schedule dropdowns.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !form.name.trim()}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : editing ? (
                                'Save Changes'
                            ) : (
                                'Create Location'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
