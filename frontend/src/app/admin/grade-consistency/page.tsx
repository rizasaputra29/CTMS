'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, RefreshCw, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface Period { id: number; name: string; is_active: boolean; }
interface Check {
    id: number; group_id: number; student_id: number | null;
    pdc1_score: number | null; pdc2_score: number | null;
    deviation: number | null; status: string; notes: string | null;
    student?: { name: string }; group?: { id: number };
}

export default function AdminGradeConsistencyPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [checks, setChecks] = useState<Check[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingCheck, setEditingCheck] = useState<Check | null>(null);
    const [editForm, setEditForm] = useState({ status: '', notes: '' });

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            setPeriods(res.data || []);
            const active = (res.data || []).find((p: Period) => p.is_active);
            if (active) setSelectedPeriod(active.id.toString());
        } catch { /* ignore */ }
    }, []);

    const fetchChecks = useCallback(async () => {
        if (!selectedPeriod) return;
        setLoading(true);
        try {
            const res = await api.get('/admin/grade-consistency', { params: { period_id: selectedPeriod } });
            setChecks(res.data.data || []);
        } catch { toast.error('Failed to load checks'); }
        finally { setLoading(false); }
    }, [selectedPeriod]);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);
    useEffect(() => { if (selectedPeriod) fetchChecks(); }, [fetchChecks, selectedPeriod]);

    const handleGenerate = async () => {
        if (!selectedPeriod) return;
        setGenerating(true);
        try {
            const res = await api.post('/admin/grade-consistency/generate', { period_id: selectedPeriod });
            toast.success(res.data.message || 'Generated');
            fetchChecks();
        } catch { toast.error('Failed to generate'); }
        finally { setGenerating(false); }
    };

    const startEdit = (c: Check) => {
        setEditingCheck(c);
        setEditForm({ status: c.status, notes: c.notes || '' });
        setEditOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCheck) return;
        try {
            await api.put(`/admin/grade-consistency/${editingCheck.id}`, editForm);
            toast.success('Updated');
            setEditOpen(false);
            fetchChecks();
        } catch { toast.error('Failed to update'); }
    };

    const statusColor = (s: string) => {
        if (s === 'CONSISTENT') return 'default';
        if (s === 'INCONSISTENT') return 'destructive';
        return 'secondary';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Grade Consistency Check</h1>
                    <p className="text-muted-foreground">Compare PDC1 vs PDC2 assessment scores for consistency.</p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select period" /></SelectTrigger>
                        <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={handleGenerate} disabled={generating || !selectedPeriod} variant="outline">
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Auto-Generate
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : checks.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                    No consistency checks yet. Click &quot;Auto-Generate&quot; to create checks from existing scores.
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Group</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead className="text-center">PDC1 Score</TableHead>
                                <TableHead className="text-center">PDC2 Score</TableHead>
                                <TableHead className="text-center">Deviation</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {checks.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">#{c.group_id}</TableCell>
                                    <TableCell>{c.student?.name || '—'}</TableCell>
                                    <TableCell className="text-center">{c.pdc1_score ?? '—'}</TableCell>
                                    <TableCell className="text-center">{c.pdc2_score ?? '—'}</TableCell>
                                    <TableCell className="text-center">
                                        {c.deviation != null ? (
                                            <span className={Number(c.deviation) > 20 ? 'text-destructive font-bold' : ''}>{c.deviation}%</span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell><Badge variant={statusColor(c.status)}>{c.status}</Badge></TableCell>
                                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}><Edit className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <form onSubmit={handleUpdate}>
                        <DialogHeader>
                            <DialogTitle>Update Consistency Check</DialogTitle>
                            <DialogDescription>Update the status and notes for this check.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UNCHECKED">Unchecked</SelectItem>
                                        <SelectItem value="CONSISTENT">Consistent</SelectItem>
                                        <SelectItem value="INCONSISTENT">Inconsistent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2"><Label>Notes</Label><Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
                        </div>
                        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
