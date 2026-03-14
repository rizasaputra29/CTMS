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
interface Indicator {
    id: number; period_id: number; name: string; description: string | null;
    weight: number; sort_order: number;
}

export default function AdminPeerReviewPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [indicators, setIndicators] = useState<Indicator[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Indicator | null>(null);
    const [form, setForm] = useState({ name: '', description: '', weight: '25', sort_order: '0' });

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            setPeriods(res.data || []);
            const active = (res.data || []).find((p: Period) => p.is_active);
            if (active) setSelectedPeriod(active.id.toString());
        } catch { /* ignore */ }
    }, []);

    const fetchIndicators = useCallback(async () => {
        if (!selectedPeriod) return;
        setLoading(true);
        try {
            const res = await api.get('/admin/peer-review/indicators', { params: { period_id: selectedPeriod } });
            setIndicators(res.data.data || []);
        } catch { toast.error('Failed to load indicators'); }
        finally { setLoading(false); }
    }, [selectedPeriod]);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);
    useEffect(() => { if (selectedPeriod) fetchIndicators(); }, [fetchIndicators, selectedPeriod]);

    const resetForm = () => { setEditing(null); setForm({ name: '', description: '', weight: '25', sort_order: '0' }); };

    const startEdit = (i: Indicator) => {
        setEditing(i);
        setForm({ name: i.name, description: i.description || '', weight: i.weight.toString(), sort_order: i.sort_order.toString() });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...form, period_id: selectedPeriod, weight: parseFloat(form.weight), sort_order: parseInt(form.sort_order) };
            if (editing) {
                await api.put(`/admin/peer-review/indicators/${editing.id}`, payload);
                toast.success('Indicator updated');
            } else {
                await api.post('/admin/peer-review/indicators', payload);
                toast.success('Indicator created');
            }
            setOpen(false); resetForm(); fetchIndicators();
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed to save');
            else toast.error('Failed to save');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this indicator?')) return;
        try { await api.delete(`/admin/peer-review/indicators/${id}`); toast.success('Deleted'); fetchIndicators(); }
        catch { toast.error('Failed to delete'); }
    };

    const totalWeight = indicators.reduce((sum, i) => sum + Number(i.weight), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Peer Review Indicators</h1>
                <p className="text-muted-foreground">Manage peer review indicators that students use to evaluate each other.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="ml-auto">
                    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
                        <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Indicator</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editing ? 'Edit Indicator' : 'Add Indicator'}</DialogTitle>
                                    <DialogDescription>Define a peer review indicator for this period.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kontribusi Teknis" required /></div>
                                    <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Seberapa besar kontribusi teknis anggota..." /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2"><Label>Weight (%)</Label><Input type="number" step="0.01" min="0" max="100" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} required /></div>
                                        <div className="grid gap-2"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
                                    </div>
                                </div>
                                <DialogFooter><Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total weight:</span>
                <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>{totalWeight}%</Badge>
                {totalWeight !== 100 && <span className="text-sm text-destructive">Should equal 100%</span>}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : indicators.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">No indicators defined for this period.</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">#</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[100px]">Weight</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {indicators.map(i => (
                                <TableRow key={i.id}>
                                    <TableCell className="text-muted-foreground">{i.sort_order}</TableCell>
                                    <TableCell className="font-medium">{i.name}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-[300px] truncate">{i.description || '—'}</TableCell>
                                    <TableCell><Badge variant="secondary">{i.weight}%</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(i)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
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
