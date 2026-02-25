'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Plus, Trash2, Edit, ArrowUpDown, Search, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";

const SPECIALIZATIONS = ['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'];

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

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        problem_statement: '',
        scope: '',
        specializations: [] as string[],
        quota: 1,
    });

    const fetchTitles = async () => {
        setTitlesLoading(true);
        try {
            const response = await api.get('/dosen/titles');
            setTitles(response.data);
        } catch (error) {
            console.error('Failed to fetch titles', error);
            toast.error('Failed to load titles');
        } finally {
            setTitlesLoading(false);
        }
    };

    useEffect(() => {
        fetchTitles();
    }, []);

    // --- Manage Titles Handlers ---
    const handleEdit = (title: Title) => {
        setFormData({
            title: title.title,
            description: title.description,
            problem_statement: title.problem_statement || '',
            scope: title.scope || '',
            specializations: title.specializations || [],
            quota: title.quota,
        });
        setEditingId(title.id);
        setOpen(true);
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1 });
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
                await api.post('/dosen/titles', formData);
                toast.success('Title created successfully');
            }
            setOpen(false);
            setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1 });
            setEditingId(null);
            fetchTitles();
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
            fetchTitles();
        } catch (error) {
            console.error('Failed to delete title', error);
            toast.error('Failed to delete title');
        }
    };

    const toggleSpecFilter = (spec: string) => {
        setFilterSpecs(prev =>
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };

    const toggleFormSpec = (spec: string) => {
        setFormData(prev => ({
            ...prev,
            specializations: prev.specializations.includes(spec)
                ? prev.specializations.filter(s => s !== spec)
                : [...prev.specializations, spec],
        }));
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Titles</h1>
                    <p className="text-muted-foreground">Create and manage your final project titles.</p>
                </div>
                <Dialog open={open} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingId(null); setFormData({ title: '', description: '', problem_statement: '', scope: '', specializations: [], quota: 1 }); }}>
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
                                <div className="grid gap-2">
                                    <Label>Specializations</Label>
                                    <div className="flex flex-wrap gap-3">
                                        {SPECIALIZATIONS.map(spec => (
                                            <label key={spec} className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={formData.specializations.includes(spec)}
                                                    onCheckedChange={() => toggleFormSpec(spec)}
                                                />
                                                <span className="text-sm">{spec}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
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
                            </div>
                            <DialogFooter>
                                <Button type="submit">{editingId ? 'Update Title' : 'Create Title'}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
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
        </div>
    );
}
