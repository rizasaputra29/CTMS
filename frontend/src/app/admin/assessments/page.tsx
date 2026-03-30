'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface Period { id: number; name: string; is_active: boolean; }
interface Component {
    id: number; period_id: number; type: string; code: string;
    name: string; description: string | null; weight: number; sort_order: number;
}

const TYPES = ['SEMPRO', 'SIDANG_TA', 'BIMBINGAN'];

export default function AdminAssessmentsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('SEMPRO');
    const [components, setComponents] = useState<Component[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Component | null>(null);
    const [form, setForm] = useState({ code: '', name: '', description: '', weight: '25', sort_order: '0' });

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            setPeriods(res.data || []);
            const active = (res.data || []).find((p: Period) => p.is_active);
            if (active) setSelectedPeriod(active.id.toString());
        } catch { /* ignore */ }
    }, []);

    const fetchComponents = useCallback(async () => {
        if (!selectedPeriod) return;
        setLoading(true);
        try {
            const res = await api.get('/admin/assessment-components', {
                params: { period_id: selectedPeriod, type: selectedType },
            });
            setComponents(res.data.data || []);
        } catch { toast.error('Failed to load components'); }
        finally { setLoading(false); }
    }, [selectedPeriod, selectedType]);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);
    useEffect(() => { if (selectedPeriod) fetchComponents(); }, [fetchComponents, selectedPeriod]);

    const resetForm = () => { setEditing(null); setForm({ code: '', name: '', description: '', weight: '25', sort_order: '0' }); };

    const startEdit = (c: Component) => {
        setEditing(c);
        setForm({ code: c.code, name: c.name, description: c.description || '', weight: c.weight.toString(), sort_order: c.sort_order.toString() });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...form, period_id: selectedPeriod, type: selectedType, weight: parseFloat(form.weight), sort_order: parseInt(form.sort_order) };
            if (editing) {
                await api.put(`/admin/assessment-components/${editing.id}`, payload);
                toast.success('Component updated');
            } else {
                await api.post('/admin/assessment-components', payload);
                toast.success('Component created');
            }
            setOpen(false); resetForm(); fetchComponents();
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed to save');
            else toast.error('Failed to save');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this component?')) return;
        try { await api.delete(`/admin/assessment-components/${id}`); toast.success('Deleted'); fetchComponents(); }
        catch { toast.error('Failed to delete'); }
    };

    const totalWeight = components.reduce((sum, c) => sum + Number(c.weight), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Assessment Components</h1>
                <p className="text-muted-foreground">Manage CPMK/CPL assessment components per period and evaluation type.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedPeriod} onValueChange={v => { setSelectedPeriod(v); }}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
                <div className="ml-auto">
                    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
                        <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Component</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editing ? 'Edit Component' : 'Add Component'}</DialogTitle>
                                    <DialogDescription>Define a CPMK/CPL assessment component for {selectedType}.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2"><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="CPMK-1" required /></div>
                                        <div className="grid gap-2"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
                                    </div>
                                    <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kemampuan Presentasi" required /></div>
                                    <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" /></div>
                                    <div className="grid gap-2"><Label>Weight (%)</Label><Input type="number" step="0.01" min="0" max="100" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} required /></div>
                                </div>
                                <DialogFooter><Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Weight indicator */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total weight:</span>
                <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>{totalWeight}%</Badge>
                {totalWeight !== 100 && <span className="text-sm text-destructive">Should equal 100%</span>}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : components.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">No components defined for {selectedType} in this period.</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">#</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[100px]">Weight</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {components.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                                    <TableCell><Badge variant="outline">{c.code}</Badge></TableCell>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-[300px] truncate">{c.description || '—'}</TableCell>
                                    <TableCell><Badge variant="secondary">{c.weight}%</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
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
