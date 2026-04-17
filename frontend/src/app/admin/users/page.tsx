'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Edit, Search, ArrowUpDown, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from "sonner";

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

type SortKey = 'name' | 'email' | 'created_at' | 'nim' | 'nip';
type SortDir = 'asc' | 'desc';
type RoleTab = 'all' | 'mahasiswa' | 'dosen' | 'admin';

interface PaginationData {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<RoleTab>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [pagination, setPagination] = useState<PaginationData>({
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 0,
    });

    // Create/Edit State
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        roles: ['mahasiswa'],
    });

    const fetchUsers = useCallback(async (page: number = 1) => {
        setLoading(true);
        try {
            const params: Record<string, string> = {
                page: page.toString(),
                sort_by: sortKey,
                sort_order: sortDir,
            };
            
            if (activeTab !== 'all') {
                params.role = activeTab;
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
        } catch (error) {
            console.error('Failed to fetch users', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [activeTab, search, sortKey, sortDir]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchUsers(1);
        }, 500);
        return () => clearTimeout(debounce);
    }, [fetchUsers]);

    const handleTabChange = (tab: RoleTab) => {
        setActiveTab(tab);
        // Reset sort key when changing tabs for better UX
        if (tab === 'mahasiswa') {
            setSortKey('nim');
        } else if (tab === 'dosen') {
            setSortKey('nip');
        } else {
            setSortKey('name');
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

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= pagination.last_page) {
            fetchUsers(page);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await api.put(`/admin/users/${editingUser.id}`, formData);
                toast.success('User updated successfully');
            } else {
                await api.post('/admin/users', formData);
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

    const startEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            roles: user.roles?.map(r => r.slug) || [user.role],
        });
        setOpen(true);
    };

    const resetForm = () => {
        setEditingUser(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            roles: ['mahasiswa'],
        });
    };

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead 
            className="cursor-pointer select-none hover:bg-muted/50" 
            onClick={() => handleSort(sortKeyName)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'opacity-100' : 'opacity-50'}`} />
            </div>
        </TableHead>
    );

    // Dynamic columns based on active tab
    const renderTableHeaders = () => {
        const baseHeaders = [
            <SortHeader key="name" label="Name" sortKeyName="name" />,
            <TableHead key="email">Email</TableHead>,
        ];

        if (activeTab === 'mahasiswa') {
            return [
                ...baseHeaders,
                <SortHeader key="nim" label="NIM" sortKeyName="nim" />,
                <TableHead key="period">Periode</TableHead>,
                <TableHead key="joined">Joined</TableHead>,
                <TableHead key="actions" className="text-right">Actions</TableHead>,
            ];
        } else if (activeTab === 'dosen') {
            return [
                ...baseHeaders,
                <SortHeader key="nip" label="NIP" sortKeyName="nip" />,
                <TableHead key="role">Role</TableHead>,
                <TableHead key="joined">Joined</TableHead>,
                <TableHead key="actions" className="text-right">Actions</TableHead>,
            ];
        } else {
            return [
                ...baseHeaders,
                <TableHead key="role">Role</TableHead>,
                <TableHead key="joined">Joined</TableHead>,
                <TableHead key="actions" className="text-right">Actions</TableHead>,
            ];
        }
    };

    const renderTableCell = (user: User, column: string) => {
        switch (column) {
            case 'name':
                return <TableCell className="font-medium">{user.name}</TableCell>;
            case 'email':
                return <TableCell className="text-muted-foreground">{user.email}</TableCell>;
            case 'nim':
                return <TableCell>{user.nim || '-'}</TableCell>;
            case 'nip':
                return <TableCell>{user.nip || '-'}</TableCell>;
            case 'period':
                return (
                    <TableCell>
                        {user.registered_periods && user.registered_periods.length > 0 ? (
                            <Badge variant="secondary">
                                {user.registered_periods[0].name}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                        )}
                    </TableCell>
                );
            case 'role':
                return (
                    <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {(user.roles?.map(r => r.slug) || [user.role]).map((slug) => (
                                <Badge
                                    key={`${user.id}-${slug}`}
                                    variant={slug === 'admin' ? 'default' : slug === 'dosen' ? 'secondary' : 'outline'}
                                >
                                    {slug}
                                </Badge>
                            ))}
                        </div>
                    </TableCell>
                );
            case 'joined':
                return (
                    <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                );
            case 'actions':
                return (
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(user)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            {user.id !== 1 && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </TableCell>
                );
            default:
                return null;
        }
    };

    const renderTableRow = (user: User) => {
        if (activeTab === 'mahasiswa') {
            return (
                <TableRow key={user.id}>
                    {renderTableCell(user, 'name')}
                    {renderTableCell(user, 'email')}
                    {renderTableCell(user, 'nim')}
                    {renderTableCell(user, 'period')}
                    {renderTableCell(user, 'joined')}
                    {renderTableCell(user, 'actions')}
                </TableRow>
            );
        } else if (activeTab === 'dosen') {
            return (
                <TableRow key={user.id}>
                    {renderTableCell(user, 'name')}
                    {renderTableCell(user, 'email')}
                    {renderTableCell(user, 'nip')}
                    {renderTableCell(user, 'role')}
                    {renderTableCell(user, 'joined')}
                    {renderTableCell(user, 'actions')}
                </TableRow>
            );
        } else {
            return (
                <TableRow key={user.id}>
                    {renderTableCell(user, 'name')}
                    {renderTableCell(user, 'email')}
                    {renderTableCell(user, 'role')}
                    {renderTableCell(user, 'joined')}
                    {renderTableCell(user, 'actions')}
                </TableRow>
            );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage system users (Admin, Dosen, Mahasiswa).</p>
                </div>
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                                <DialogDescription>
                                    {editingUser ? 'Update user details.' : 'Create a new user account.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Password {editingUser && '(Leave blank to keep current)'}</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                        minLength={8}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Roles</Label>
                                    <div className="flex flex-wrap gap-4 mt-2">
                                        {['admin', 'dosen', 'mahasiswa'].map((roleSlug) => (
                                            <div key={roleSlug} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`role-${roleSlug}`}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    checked={formData.roles.includes(roleSlug)}
                                                    onChange={(e) => {
                                                        const roles = [...formData.roles];
                                                        if (e.target.checked) {
                                                            roles.push(roleSlug);
                                                        } else {
                                                            const idx = roles.indexOf(roleSlug);
                                                            if (idx > -1) roles.splice(idx, 1);
                                                        }
                                                        setFormData({ ...formData, roles });
                                                    }}
                                                />
                                                <Label htmlFor={`role-${roleSlug}`} className="capitalize cursor-pointer">
                                                    {roleSlug}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">{editingUser ? 'Save Changes' : 'Create User'}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search + Role Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, NIM, or NIP..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as RoleTab)}>
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="mahasiswa">Mahasiswa</TabsTrigger>
                        <TabsTrigger value="dosen">Dosen</TabsTrigger>
                        <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No users found.
                </div>
            ) : (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {renderTableHeaders()}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(user => renderTableRow(user))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} users
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.current_page - 1)}
                                disabled={pagination.current_page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground px-2">
                                Page {pagination.current_page} of {pagination.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.current_page + 1)}
                                disabled={pagination.current_page === pagination.last_page}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
