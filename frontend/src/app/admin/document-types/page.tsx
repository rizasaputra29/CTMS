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

interface DocumentType {
    id: number; name: string; description: string | null;
    phase: string | null; is_active: boolean;
}

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'TA', 'EXPO', 'SIDANG'];

export default function AdminDocumentTypesPage() {
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<DocumentType | null>(null);
    const [form, setForm] = useState({ name: '', description: '', phase: 'ALL' });

    const fetchTypes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/document-types');
            setTypes(res.data.data || []);
        } catch { toast.error('Failed to load document types'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTypes(); }, [fetchTypes]);

    const resetForm = () => { setEditing(null); setForm({ name: '', description: '', phase: 'ALL' }); };

    const startEdit = (t: DocumentType) => {
        setEditing(t);
        setForm({ name: t.name, description: t.description || '', phase: t.phase || 'ALL' });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...form, phase: form.phase === 'ALL' ? null : form.phase };
            if (editing) {
                await api.put(`/admin/document-types/${editing.id}`, payload);
                toast.success('Document type updated');
            } else {
                await api.post('/admin/document-types', payload);
                toast.success('Document type created');
            }
            setOpen(false); resetForm(); fetchTypes();
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed to save');
            else toast.error('Failed to save');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this document type?')) return;
        try { await api.delete(`/admin/document-types/${id}`); toast.success('Deleted'); fetchTypes(); }
        catch { toast.error('Failed to delete'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Document Types</h1>
                    <p className="text-muted-foreground">Manage dynamic document types (HKI, Hak Cipta, etc.).</p>
                </div>
                <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Type</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>{editing ? 'Edit Document Type' : 'Add Document Type'}</DialogTitle>
                                <DialogDescription>Define a new document type category.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="HKI" required /></div>
                                <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Hak Kekayaan Intelektual" /></div>
                                <div className="grid gap-2">
                                    <Label>Phase (optional)</Label>
                                    <Select value={form.phase} onValueChange={v => setForm({ ...form, phase: v })}>
                                        <SelectTrigger><SelectValue placeholder="All phases" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All Phases</SelectItem>
                                            {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter><Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : types.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">No document types defined yet.</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Phase</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {types.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.name}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-[300px] truncate">{t.description || '—'}</TableCell>
                                    <TableCell><Badge variant="outline">{t.phase || 'All'}</Badge></TableCell>
                                    <TableCell><Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
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
