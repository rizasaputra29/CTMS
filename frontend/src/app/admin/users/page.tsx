'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getRoleBadgeVariant } from "@/lib/badge-variants"
import {
  Trash2,
  Edit,
  Search,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  UserX,
  MoreHorizontal,
  Users,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
  Filter,
  Plus,
  UserPlus,
} from 'lucide-react';
import { toast } from "sonner";
import { type RoleTab } from "@/types/guards";
import { userSchema, type UserFormData } from "@/lib/validations/user";
import { z } from "zod";

/* =========================================================
   Types
   ========================================================= */

interface Role {
    id: number;
    name: string;
    slug: string;
}

interface RegisteredPeriod {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    nim?: string;
    nip?: string;
    is_active: boolean;
    role: string;
    roles: Role[];
    registered_periods?: RegisteredPeriod[];
    created_at: string;
}

type SortKey = 'name' | 'email' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

interface PaginationData {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

/* =========================================================
   Helpers
   ========================================================= */

function generateInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

function avatarColorClass(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function RoleIcon({ slug }: { slug: string }) {
    switch (slug) {
        case 'admin': return <ShieldCheck className="h-3 w-3" />;
        case 'dosen': return <Stethoscope className="h-3 w-3" />;
        case 'mahasiswa': return <GraduationCap className="h-3 w-3" />;
        default: return <Users className="h-3 w-3" />;
    }
}

/* =========================================================
   Main page
   ========================================================= */

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<RoleTab>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [pagination, setPagination] = useState<PaginationData>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });
    const [kickingUserId, setKickingUserId] = useState<number | null>(null);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Create/Edit State
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Schema
    const getSchema = () => {
        if (editingUser) {
            return userSchema;
        }
        return userSchema.extend({
            password: z.string().min(8, "Password must be at least 8 characters"),
        });
    };

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { isSubmitting },
    } = useForm<UserFormData>({
        resolver: zodResolver(getSchema()),
        mode: 'onBlur',
        defaultValues: {
            name: '',
            email: '',
            password: '',
            roles: ['mahasiswa'],
            nim: '',
        },
    });

    const watchedRoles = watch('roles');

    /* ─── Fetch ─────────────────────────────────────────── */

    const fetchUsers = useCallback(async (page: number = 1, perPage?: number) => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: page.toString(),
                per_page: (perPage ?? pagination.per_page).toString(),
                sort_by: sortKey,
                sort_order: sortDir,
            };

            if (activeTab !== 'all') {
                params.role = activeTab;
            }
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            if (search) {
                params.search = search;
            }

            const response = await api.get('/admin/users', { params });
            setUsers(response.data.data);
            setPagination({
                current_page: response.data.current_page,
                last_page: response.data.last_page,
                per_page: response.data.per_page,
                total: response.data.total,
            });
            // Clear selection on refetch
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Failed to fetch users', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter, search, sortKey, sortDir, pagination.per_page]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchUsers(1);
        }, 500);
        return () => clearTimeout(debounce);
    }, [fetchUsers]);

    /* ─── Actions ───────────────────────────────────────── */

    const handleTabChange = (tab: RoleTab) => {
        setActiveTab(tab);
        setSelectedIds(new Set());
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= pagination.last_page) {
            fetchUsers(page);
        }
    };

    const handlePerPageChange = (val: string) => {
        const pp = parseInt(val, 10);
        if (!isNaN(pp)) {
            setPagination(prev => ({ ...prev, per_page: pp, current_page: 1 }));
            fetchUsers(1, pp);
        }
    };

    const handleRoleToggle = (roles: string[], roleSlug: string, checked: boolean) => {
        if (checked) {
            if (roleSlug === 'mahasiswa') {
                return ['mahasiswa'];
            } else {
                const filtered = roles.filter((role) => role !== 'mahasiswa');
                if (!filtered.includes(roleSlug)) {
                    filtered.push(roleSlug);
                }
                return filtered;
            }
        } else {
            return roles.filter((role) => role !== roleSlug);
        }
    };

    const onSubmit = async (data: UserFormData) => {
        try {
            if (data.roles.includes('mahasiswa') && (!data.nim || data.nim.length < 8)) {
                toast.error('NIM is required for mahasiswa role and must be at least 8 characters');
                return;
            }

            const payload: Record<string, unknown> = {
                name: data.name,
                email: data.email,
                roles: data.roles,
            };

            if (data.password) {
                payload.password = data.password;
            }

            if (data.roles.includes('mahasiswa') && data.nim) {
                payload.nim = data.nim;
            }

            if (editingUser) {
                await api.put(`/admin/users/${editingUser.id}`, payload);
                toast.success('User updated successfully');
            } else {
                await api.post('/admin/users', payload);
                toast.success('User created successfully');
            }
            setOpen(false);
            fetchUsers(pagination.current_page);
            resetForm();
        } catch (error: unknown) {
            console.error('Failed to save user', error);
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to save user');
            } else {
                toast.error('Failed to save user');
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            toast.success('User deleted');
            fetchUsers(pagination.current_page);
        } catch (error) {
            console.error('Failed to delete user', error);
            toast.error('Failed to delete user');
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} selected users?`)) return;
        try {
            await Promise.all(ids.map(id => api.delete(`/admin/users/${id}`)));
            toast.success(`${ids.length} users deleted`);
            setSelectedIds(new Set());
            fetchUsers(pagination.current_page);
        } catch (error) {
            console.error('Bulk delete failed', error);
            toast.error('Some users could not be deleted');
        }
    };

    const handleKickFromPeriod = async (user: User) => {
        const registeredPeriod = user.registered_periods?.[0];
        if (!registeredPeriod) {
            toast.error('Mahasiswa belum terdaftar pada periode manapun');
            return;
        }

        const confirmed = confirm(
            `Kick ${user.name} dari periode ${registeredPeriod.name}?\n\n` +
            'Aksi ini akan menghapus registrasi periode, menghapus keanggotaan grup di periode tersebut, dan membatalkan invitation/join request yang masih pending.'
        );

        if (!confirmed) return;

        setKickingUserId(user.id);
        try {
            const response = await api.delete(`/admin/periods/${registeredPeriod.id}/students/${user.id}/registration`);
            toast.success(response.data?.message || 'Mahasiswa berhasil dikeluarkan dari periode');
            fetchUsers(pagination.current_page);
        } catch (error: unknown) {
            console.error('Failed to kick student from period', error);
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Gagal mengeluarkan mahasiswa dari periode');
            } else {
                toast.error('Gagal mengeluarkan mahasiswa dari periode');
            }
        } finally {
            setKickingUserId(null);
        }
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        reset({
            name: user.name,
            email: user.email,
            password: '',
            roles: (user.roles?.map(r => r.slug) || [user.role]) as ('admin' | 'dosen' | 'mahasiswa')[],
            nim: user.nim || '',
        });
        setOpen(true);
    };

    const resetForm = () => {
        setEditingUser(null);
        reset({
            name: '',
            email: '',
            password: '',
            roles: ['mahasiswa'],
            nim: '',
        });
    };

    /* ─── Selection helpers ─────────────────────────────── */

    const allSelected = useMemo(() => {
        if (users.length === 0) return false;
        return users.every(u => selectedIds.has(u.id));
    }, [users, selectedIds]);

    const someSelected = useMemo(() => {
        return users.some(u => selectedIds.has(u.id)) && !allSelected;
    }, [users, selectedIds, allSelected]);

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(users.map(u => u.id)));
        }
    };

    const toggleSelectOne = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /* ─── Render helpers ───────────────────────────────── */

    const roleSlugs = (user: User) =>
        (user.roles?.map(r => r.slug as 'admin' | 'dosen' | 'mahasiswa') || [user.role as 'admin' | 'dosen' | 'mahasiswa']);

    const primaryRoleSlug = (user: User) => roleSlugs(user)[0];

    /* ─── Pagination numbers ───────────────────────────── */

    const pageNumbers = useMemo(() => {
        const { current_page, last_page } = pagination;
        const pages: (number | string)[] = [];
        if (last_page <= 7) {
            for (let i = 1; i <= last_page; i++) pages.push(i);
        } else {
            if (current_page <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(last_page);
            } else if (current_page >= last_page - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = last_page - 4; i <= last_page; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                pages.push(current_page - 1);
                pages.push(current_page);
                pages.push(current_page + 1);
                pages.push('...');
                pages.push(last_page);
            }
        }
        return pages;
    }, [pagination]);

    /* ─── Sort label ────────────────────────────────────── */

    const sortLabel = useMemo(() => {
        const labels: Record<SortKey, string> = { name: 'Nama', email: 'Email', created_at: 'Tanggal Daftar' };
        return `${labels[sortKey]} ${sortDir === 'asc' ? '↑' : '↓'}`;
    }, [sortKey, sortDir]);

    return (
        <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
                            User Management
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => toast.info('Import Users - Coming Soon')}>
                            <Upload className="mr-2 h-4 w-4" /> Import Users
                        </Button>
                        <Button onClick={() => router.push("/admin/users/new")} size="sm">
                            <UserPlus className="mr-2 h-4 w-4" /> Tambah User
                        </Button>
                    </div>
                </div>

                {/* Card */}
                <Card className="py-0 gap-0">
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 border-b">
                        <h3 className="text-[20px] leading-[1.4] font-semibold text-[#353849]">User Table</h3>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search"
                                    className="pl-9 w-64"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Filter Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Filter className="mr-2 h-4 w-4" /> Filter
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Role</div>
                                    <DropdownMenuItem onClick={() => handleTabChange('all')} className={activeTab === 'all' ? 'bg-accent' : ''}>All</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleTabChange('mahasiswa')} className={activeTab === 'mahasiswa' ? 'bg-accent' : ''}>Mahasiswa</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleTabChange('dosen')} className={activeTab === 'dosen' ? 'bg-accent' : ''}>Dosen</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleTabChange('admin')} className={activeTab === 'admin' ? 'bg-accent' : ''}>Admin</DropdownMenuItem>
                                    <div className="my-1 h-px bg-border" />
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Status</div>
                                    <DropdownMenuItem onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'bg-accent' : ''}>All</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('active')} className={statusFilter === 'active' ? 'bg-accent' : ''}>Active</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('inactive')} className={statusFilter === 'inactive' ? 'bg-accent' : ''}>Inactive</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Sort Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <ArrowUpDown className="mr-2 h-4 w-4" /> {sortLabel}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => handleSort('name')}>Nama {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSort('email')}>Email {sortKey === 'email' && (sortDir === 'asc' ? '↑' : '↓')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSort('created_at')}>Tanggal Daftar {sortKey === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                <Users className="h-10 w-10 mb-3 opacity-40" />
                                <p className="text-sm font-medium">No users found</p>
                                <p className="text-xs mt-1">Try adjusting your search or filter.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent bg-grey-25">
                                            <TableHead className="w-10 text-[#666D80]">
                                                <Checkbox
                                                    checked={allSelected}
                                                    data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                                                    onCheckedChange={toggleSelectAll}
                                                    aria-label="Select all"
                                                />
                                            </TableHead>
                                            <TableHead className="whitespace-nowrap w-12 text-[#666D80]">No</TableHead>
                                            <TableHead className="whitespace-nowrap text-[#666D80]">Nama User</TableHead>
                                            <TableHead className="whitespace-nowrap text-[#666D80]">Email</TableHead>
                                            <TableHead className="whitespace-nowrap text-[#666D80]">Access Role</TableHead>
                                            <TableHead className="whitespace-nowrap text-[#666D80]">Tanggal Daftar</TableHead>
                                            <TableHead className="text-right whitespace-nowrap text-[#666D80]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user, idx) => {
                                            const slugs = roleSlugs(user);
                                            const mainSlug = primaryRoleSlug(user);
                                            const checked = selectedIds.has(user.id);
                                            const rowNumber = ((pagination.current_page - 1) * pagination.per_page) + idx + 1;
                                            return (
                                                <TableRow
                                                    key={user.id}
                                                    className="group cursor-pointer"
                                                    data-selected={checked}
                                                    onClick={() => router.push(`/admin/users/${user.id}`)}
                                                >
                                                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={() => toggleSelectOne(user.id)}
                                                            aria-label={`Select ${user.name}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm py-3">{rowNumber}</TableCell>
                                                    <TableCell className="py-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className={`h-8 w-8 border ${avatarColorClass(user.name)}`}>
                                                                <AvatarFallback className={`${avatarColorClass(user.name)} font-semibold text-xs`}>
                                                                    {generateInitials(user.name)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-medium text-sm text-foreground">{user.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground py-3">{user.email}</TableCell>
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {slugs.map((slug) => (
                                                                <Badge
                                                                    key={`${user.id}-${slug}`}
                                                                    variant={getRoleBadgeVariant(slug)}
                                                                    className="flex items-center gap-1 text-xs px-2 py-0.5 capitalize"
                                                                >
                                                                    <RoleIcon slug={slug} />
                                                                    {slug}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm py-3">
                                                        {new Date(user.created_at).toLocaleDateString('en-US', {
                                                            month: 'numeric',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })}
                                                    </TableCell>
                                                    <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40">
                                                                <DropdownMenuItem
                                                                    onClick={() => router.push(`/admin/users/${user.id}`)}
                                                                >
                                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                                    Lihat Detail
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startEdit(user); }}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                {mainSlug === 'mahasiswa' && user.registered_periods && user.registered_periods.length > 0 && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleKickFromPeriod(user)}
                                                                        disabled={kickingUserId === user.id}
                                                                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                                                    >
                                                                        {kickingUserId === user.id ? (
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <UserX className="mr-2 h-4 w-4" />
                                                                        )}
                                                                        Kick
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {user.id !== 1 && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDelete(user.id)}
                                                                        variant="destructive"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>

                    {/* Pagination */}
                    {!loading && users.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                                    <Select value={String(pagination.per_page)} onValueChange={handlePerPageChange}>
                                        <SelectTrigger className="h-8 w-20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 20, 50, 100].map((n) => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-nowrap">
                                    Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} results
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handlePageChange(pagination.current_page - 1)}
                                    disabled={pagination.current_page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {pageNumbers.map((page, i) => (
                                    page === '...' ? (
                                        <span key={`dots-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
                                    ) : (
                                        <Button
                                            key={page}
                                            variant={pagination.current_page === page ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 w-8 px-0"
                                            onClick={() => handlePageChange(page as number)}
                                        >
                                            {page}
                                        </Button>
                                    )
                                ))}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handlePageChange(pagination.current_page + 1)}
                                    disabled={pagination.current_page === pagination.last_page}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Create/Edit Dialog */}
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <DialogHeader>
                                <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                                <DialogDescription>
                                    {editingUser ? 'Update user details.' : 'Create a new user account.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Controller
                                    name="name"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="name">Full Name</FieldLabel>
                                            <Input
                                                {...field}
                                                id="name"
                                                placeholder="Enter full name"
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="email"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="email">Email</FieldLabel>
                                            <Input
                                                {...field}
                                                id="email"
                                                type="email"
                                                placeholder="Enter email address"
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="password"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="password">
                                                Password {editingUser && '(Leave blank to keep current)'}
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id="password"
                                                type="password"
                                                placeholder={editingUser ? "Enter new password (optional)" : "Enter password"}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="roles"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel>Roles</FieldLabel>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                {(['admin', 'dosen', 'mahasiswa'] as const).map((roleSlug) => (
                                                    <div key={roleSlug} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`role-${roleSlug}`}
                                                            checked={field.value?.includes(roleSlug)}
                                                            onCheckedChange={(checked) => {
                                                                const newRoles = handleRoleToggle(field.value || [], roleSlug, checked as boolean);
                                                                field.onChange(newRoles);
                                                            }}
                                                            aria-invalid={fieldState.invalid}
                                                        />
                                                        <FieldLabel htmlFor={`role-${roleSlug}`} className="capitalize cursor-pointer">
                                                            {roleSlug}
                                                        </FieldLabel>
                                                    </div>
                                                ))}
                                            </div>
                                            {fieldState.error && (
                                                <FieldError>{fieldState.error.message}</FieldError>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Role mahasiswa harus berdiri sendiri (tidak bisa digabung dengan admin/dosen).
                                            </p>
                                        </Field>
                                    )}
                                />
                                {watchedRoles?.includes('mahasiswa') && (
                                    <Controller
                                        name="nim"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="nim">NIM</FieldLabel>
                                                <Input
                                                    {...field}
                                                    id="nim"
                                                    placeholder="Enter NIM (min 8 characters)"
                                                    aria-invalid={fieldState.invalid}
                                                />
                                                {fieldState.error && (
                                                    <FieldError>{fieldState.error.message}</FieldError>
                                                )}
                                            </Field>
                                        )}
                                    />
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {editingUser ? 'Saving...' : 'Creating...'}
                                        </>
                                    ) : (
                                        editingUser ? 'Save Changes' : 'Create User'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
        </div>
    );
}
