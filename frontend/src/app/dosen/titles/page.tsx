'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit, ArrowUpDown, Search, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import { SpecializationSelector, SPECIALIZATIONS } from '@/components/ui/specialization-selector';

interface Title {
    id: number;
    title: string;
    description: string;
    problem_statement: string | null;
    scope: string | null;
    specializations: string[] | null;
    quota: number;
    status: 'open' | 'closed';
    active_groups_count: number;
    lecturer_id: number;
    pre_assigned_group_id?: number | null;
}

interface GroupSummary {
    id: number;
    status: string;
    members: Array<{ id: number }>;
}

type SortKey = 'title' | 'quota' | 'status' | 'active_groups_count';
type SortDir = 'asc' | 'desc';

export default function DosenTitlesPage() {
    // Manage Titles State
    const [titles, setTitles] = useState<Title[]>([]);
    const [titlesLoading, setTitlesLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [filterSpecs, setFilterSpecs] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('title');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        problem_statement: '',
        scope: '',
        specializations: [] as string[],
        quota: 1,
        pre_assigned_group_id: '' as string,
    });

    const [withdrawDialog, setWithdrawDialog] = useState<{
        open: boolean;
        title?: Title;
        reason: string;
        loading: boolean;
    }>({ open: false, reason: '', loading: false });

    const fetchTitles = useCallback(async (periodId?: string) => {
        setTitlesLoading(true);
        try {
            let currentPeriodId = periodId || selectedPeriod;
            if (!currentPeriodId) {
                const perRes = await api.get('/periods-list');
                const periodsData = perRes.data?.data || [];
                setPeriods(periodsData);
                const active = periodsData.find((p: { is_active: boolean }) => p.is_active);
                if (active) currentPeriodId = active.id.toString();
                setSelectedPeriod(currentPeriodId);
            }

            if (!currentPeriodId) {
                setTitlesLoading(false);
                return;
            }

            const response = await api.get(`/dosen/titles?period_id=${currentPeriodId}`);
            setTitles(response.data);
        } catch (error) {
            console.error('Failed to fetch titles', error);
            toast.error('Failed to load titles');
        } finally {
            setTitlesLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        if (!selectedPeriod) fetchTitles();
    }, [fetchTitles, selectedPeriod]);

    // Fetch available groups for pre-assignment
    const fetchAvailableGroups = async () => {
        try {
            const res = await api.get('/dosen/groups');
            setAvailableGroups(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch groups', error);
        }
    };

    useEffect(() => {
        if (open) {
            fetchAvailableGroups();
        }
    }, [open]);

    // --- Manage Titles Handlers ---
    const handleEdit = (title: Title) => {
        setFormData({
            title: title.title,
            description: title.description,
            problem_statement: title.problem_statement || '',
            scope: title.scope || '',
            specializations: title.specializations || [],
            quota: title.quota,
            pre_assigned_group_id: title.pre_assigned_group_id?.toString() || '',
        });
        setEditingId(title.id);
        setOpen(true);
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1, pre_assigned_group_id: '' });
            setEditingId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/dosen/titles/${editingId}`, formData);
                toast.success('Title updated successfully');
            } else {
                const assignedGroupId = formData.pre_assigned_group_id || null;
                // Include period_id in the request
                const payload = {
                    ...formData,
                    period_id: selectedPeriod ? parseInt(selectedPeriod) : undefined,
                };
                await api.post('/dosen/titles', payload);
                if (assignedGroupId) {
                    toast.success(`Title created and assigned to Group ${assignedGroupId}`);
                } else {
                    toast.success('Title created successfully');
                }
            }
            setOpen(false);
            setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1, pre_assigned_group_id: '' });
            setEditingId(null);
            fetchTitles(selectedPeriod);
        } catch (error) {
            console.error('Failed to save title', error);
            toast.error('Failed to save title');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this title?')) return;
        try {
            await api.delete(`/dosen/titles/${id}`);
            toast.success('Title deleted successfully');
            fetchTitles(selectedPeriod);
        } catch (error) {
            console.error('Failed to delete title', error);
            toast.error('Failed to delete title');
        }
    };

    const handleWithdrawClick = (title: Title) => {
        setWithdrawDialog({ open: true, title, reason: '', loading: false });
    };

    const handleConfirmWithdraw = async () => {
        if (!withdrawDialog.title) return;

        setWithdrawDialog(prev => ({ ...prev, loading: true }));
        try {
            await api.post(
                `/dosen/titles/${withdrawDialog.title!.id}/withdraw-approval`,
                { reason: withdrawDialog.reason || null }
            );

            toast.success('Approval withdrawn successfully');
            setWithdrawDialog({ open: false, reason: '', loading: false });
            fetchTitles(selectedPeriod);
        } catch (error) {
            console.error('Failed to withdraw approval', error);
            const errorMessage = api.isAxiosError(error)
                ? error.response?.data?.message
                : 'Failed to withdraw approval';
            toast.error(errorMessage || 'Failed to withdraw approval');
            setWithdrawDialog(prev => ({ ...prev, loading: false }));
        }
    };

    const toggleSpecFilter = (spec: string) => {
        setFilterSpecs(prev =>
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };



    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filteredTitles = useMemo(() => {
        let result = titles;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
            );
        }
        if (filterSpecs.length > 0) {
            result = result.filter(t =>
                t.specializations && filterSpecs.some(s => t.specializations!.includes(s))
            );
        }
        result = [...result].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
            else if (sortKey === 'quota') cmp = a.quota - b.quota;
            else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
            else if (sortKey === 'active_groups_count') cmp = a.active_groups_count - b.active_groups_count;
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [titles, search, filterSpecs, sortKey, sortDir]);

    const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(sortKeyName)}>
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
            </div>
        </TableHead>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Titles</h1>
                    <p className="text-muted-foreground">Create and manage your final project titles.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={(val) => { setSelectedPeriod(val); fetchTitles(val); }} disabled={titlesLoading}>
                         <SelectTrigger className="w-[180px]">
                             <SelectValue placeholder="Select period" />
                         </SelectTrigger>
                         <SelectContent>
                             {periods.filter(p => p.is_active).map(p => (
                                 <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                    <Dialog open={open} onOpenChange={handleOpenChange}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setEditingId(null); setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1, pre_assigned_group_id: '' }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Add Title
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editingId ? 'Edit Title' : 'Add New Title'}</DialogTitle>
                                    <DialogDescription>
                                        {editingId ? 'Update your project title details.' : 'Offer a new title for students to bid on.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">Title</Label>
                                        <Input
                                            id="title"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows={3}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="problem_statement">Problem Statement</Label>
                                        <Textarea
                                            id="problem_statement"
                                            value={formData.problem_statement}
                                            onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                                            placeholder="What problem does this project solve?"
                                            rows={3}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="scope">Scope</Label>
                                        <Textarea
                                            id="scope"
                                            value={formData.scope}
                                            onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                                            placeholder="Define the boundaries and scope of this project"
                                            rows={3}
                                            required
                                        />
                                    </div>
                                    <SpecializationSelector
                                        selected={formData.specializations}
                                        onChange={(specializations) => setFormData({ ...formData, specializations })}
                                        required
                                    />
                                    <div className="grid gap-2">
                                        <Label htmlFor="quota">Quota (Groups)</Label>
                                        <Input
                                            id="quota"
                                            type="number"
                                            min="1"
                                            value={formData.quota}
                                            onChange={(e) => setFormData({ ...formData, quota: parseInt(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="pre_assigned_group_id">Tugaskan ke Kelompok (Opsional)</Label>
                                        <Select 
                                            value={formData.pre_assigned_group_id} 
                                            onValueChange={(value) => setFormData({ ...formData, pre_assigned_group_id: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kelompok..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableGroups
                                                    .filter(g => g.members && g.members.length >= 3)
                                                    .map(group => (
                                                        <SelectItem key={group.id} value={group.id.toString()}>
                                                            Group {group.id} ({group.members.length} anggota) - {group.status}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Jika dipilih, judul tidak akan muncul di marketplace dan otomatis ditugaskan ke kelompok tersebut.
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit">{editingId ? 'Update Title' : 'Create Title'}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search titles..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Filter:</span>
                    {SPECIALIZATIONS.map(spec => (
                        <label key={spec} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                                checked={filterSpecs.includes(spec)}
                                onCheckedChange={() => toggleSpecFilter(spec)}
                            />
                            <span className="text-xs">{spec}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Table */}
            {titlesLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filteredTitles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    {titles.length === 0 ? 'No titles found. Create one to get started.' : 'No titles match your search/filter.'}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortHeader label="Title" sortKeyName="title" />
                                <TableHead>Specializations</TableHead>
                                <SortHeader label="Quota" sortKeyName="quota" />
                                <SortHeader label="Groups" sortKeyName="active_groups_count" />
                                <SortHeader label="Status" sortKeyName="status" />
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTitles.map(title => (
                                <TableRow key={title.id} className="cursor-pointer" onClick={() => window.location.href = `/dosen/titles/${title.id}`}>
                                    <TableCell className="font-medium max-w-[300px]">
                                        <div className="line-clamp-2">{title.title}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(title.specializations || []).map(s => (
                                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>{title.quota} group{title.quota > 1 ? 's' : ''}</TableCell>
                                    <TableCell>{title.active_groups_count}/{title.quota}</TableCell>
                                    <TableCell>
                                        <Badge variant={title.status === 'open' ? 'default' : 'secondary'}>
                                            {title.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {title.status === 'open' && (
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleWithdrawClick(title)}
                                                    title="Withdraw approval from this title"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(title)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(title.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Withdrawal Dialog */}
            <Dialog open={withdrawDialog.open} onOpenChange={(open) => 
                setWithdrawDialog(prev => ({ ...prev, open }))
            }>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Withdraw Approval</DialogTitle>
                        <DialogDescription>
                            This action will revert affected groups to FORMING_SOLO status. They will need to choose another title.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {withdrawDialog.title && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm font-medium">Title: {withdrawDialog.title.title}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    {withdrawDialog.title.active_groups_count} active group{withdrawDialog.title.active_groups_count > 1 ? 's' : ''} will be affected
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="withdraw-reason">Reason (Optional)</Label>
                            <Textarea
                                id="withdraw-reason"
                                placeholder="Why are you withdrawing approval? (leave blank if not applicable)"
                                value={withdrawDialog.reason}
                                onChange={(e) => setWithdrawDialog(prev => ({ ...prev, reason: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            variant="outline"
                            onClick={() => setWithdrawDialog({ open: false, reason: '', loading: false })}
                            disabled={withdrawDialog.loading}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleConfirmWithdraw}
                            disabled={withdrawDialog.loading}
                        >
                            {withdrawDialog.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Withdraw Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
