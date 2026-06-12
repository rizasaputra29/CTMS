'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Trash2, Edit, Search, Filter, ArrowUpDown, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { locationSchema, type LocationFormData } from '@/lib/validations/location';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { isScheduleMode, toScheduleMode } from '@/types';
import { Loading } from '@/components/ui/loading';

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

    const form = useForm<LocationFormData>({
        resolver: zodResolver(locationSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '',
            type: 'offline',
            capacity: '',
            description: '',
            is_active: true,
        },
    });

    const fetchLocations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/locations/all');
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
        form.reset({
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
        form.reset({
            name: location.name,
            type: location.type,
            capacity: location.capacity?.toString() || '',
            description: location.description || '',
            is_active: location.is_active,
        });
        setDialogOpen(true);
    };

    const onSubmit = async (data: LocationFormData) => {
        try {
            const payload = {
                name: data.name,
                type: data.type,
                capacity: data.capacity ? parseInt(data.capacity) : null,
                description: data.description || null,
                is_active: data.is_active,
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
        } catch (error) {
            console.error('Failed to save location', error);
            const message = api.getApiErrorMessage(error, 'Failed to save location');
            toast.error(message);
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
        } catch (error) {
            console.error('Failed to delete location', error);
            const message = api.getApiErrorMessage(error, 'Failed to delete location');
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
        } catch (error) {
            console.error('Failed to update location status', error);
            const message = api.getApiErrorMessage(error, 'Failed to update location status');
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
        <TableHead className="cursor-pointer px-4 select-none hover:bg-gray-50" onClick={() => handleSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100 text-gray-900' : 'opacity-40'}`} />
            </div>
        </TableHead>
    );

    return (
        <div className="min-h-screen bg-gray-50/50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage rooms, labs, and virtual locations for schedules</p>
                    </div>
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Tambah Lokasi
                    </Button>
                </div>

                {/* White Card Container */}
                <div className="bg-white rounded-xl border shadow-sm">
                    {/* Table Header with Controls */}
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-900">Location Table</h2>
                            </div>
                            
                            <div className="flex flex-1 flex-col sm:flex-row gap-3 sm:justify-end">
                                {/* Search */}
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search locations..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-10"
                                    />
                                </div>
                                
                                {/* Type Filter */}
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(isScheduleMode(v) ? v : 'all')}>
                                        <SelectTrigger className="w-[140px] h-10">
                                            <SelectValue placeholder="All Types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            <SelectItem value="offline">Offline</SelectItem>
                                            <SelectItem value="online">Online</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Status Filter */}
                                <div className="flex items-center gap-2">
                                    <Select value={statusFilter} onValueChange={(v) => { if (isStatusFilter(v)) setStatusFilter(v); }}>
                                        <SelectTrigger className="w-[140px] h-10">
                                            <SelectValue placeholder="All Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {/* Sort */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleSort('name')}
                                    className="h-10 w-10"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table Content */}
                    <div>
                        {loading ? (
                            <div className="py-16">
                                <Loading variant="section" />
                            </div>
                        ) : filteredAndSorted.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MapPin className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">No Locations Found</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                                        ? 'Try adjusting your filters.'
                                        : 'Create your first location to get started.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="border-y">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50 hover:bg-gray-50">
                                                <SortHeader label="Name" sortKeyName="name"/>
                                                <SortHeader label="Type" sortKeyName="type" />
                                                <SortHeader label="Capacity" sortKeyName="capacity" />
                                                <SortHeader label="Status" sortKeyName="status" />
                                                <TableHead className="max-w-[200px] text-center">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginated.map((location) => (
                                                <TableRow key={location.id} className={!location.is_active ? 'bg-gray-50/50' : ''}>
                                                    <TableCell className='px-4'>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className={`h-4 w-4 ${location.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                            <span className={`font-medium ${!location.is_active ? 'text-gray-500' : ''}`}>
                                                                {location.name}
                                                            </span>
                                                        </div>
                                                        {location.description && (
                                                            <p className="text-xs text-gray-500 mt-0.5 ml-6">
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
                                                        <span className="text-sm text-gray-600">
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
                                                    <TableCell className="text-right px-4">
                                                        <div className="flex items-center justify-center gap-1">
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
                                                                    <span className="animate-spin">⟳</span>
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
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                                    <div className="flex items-center gap-4">
                                        <p className="text-sm text-gray-600">
                                            Showing {showingStart} to {showingEnd} of {filteredAndSorted.length} results
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Per page:</span>
                                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                                <SelectTrigger className="h-8 w-[70px]">
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
                                        
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                const pageNum = i + 1;
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={safePage === pageNum ? 'default' : 'outline'}
                                                        size="icon"
                                                        onClick={() => setPage(pageNum)}
                                                        className="h-8 w-8"
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        
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
                    </div>
                </div>
            </div>

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
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="space-y-4 py-4">
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Name *</FieldLabel>
                                        <Input
                                            {...field}
                                            id={field.name}
                                            placeholder="e.g., Lab IF-101, Zoom Meeting Room"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && <FieldError>{fieldState.error?.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="type"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={field.name}>Type *</FieldLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={(v) => field.onChange(toScheduleMode(v))}
                                            >
                                                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="offline">Offline</SelectItem>
                                                    <SelectItem value="online">Online</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && <FieldError>{fieldState.error?.message}</FieldError>}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="capacity"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={field.name}>Capacity (optional)</FieldLabel>
                                            <Input
                                                {...field}
                                                id={field.name}
                                                type="number"
                                                min="1"
                                                placeholder="e.g., 30"
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError>{fieldState.error?.message}</FieldError>}
                                        </Field>
                                    )}
                                />
                            </div>
                            <Controller
                                name="description"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Description (optional)</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id={field.name}
                                            placeholder="Additional details about this location..."
                                            rows={3}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && <FieldError>{fieldState.error?.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="is_active"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Active</FieldLabel>
                                        <Switch
                                            id={field.name}
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && <FieldError>{fieldState.error?.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            {editing && (
                                <p className="text-xs text-gray-500">
                                    Tip: Set to inactive to prevent this location from appearing in schedule dropdowns.
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={form.formState.isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <span className="mr-2 animate-spin">⟳</span>
                                        Saving...
                                    </>
                                ) : editing ? (
                                    'Save Changes'
                                ) : (
                                    'Create Location'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
