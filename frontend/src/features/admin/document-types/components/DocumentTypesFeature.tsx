'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Plus, Trash2, Edit, Loader2, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { documentTypeSchema, type DocumentTypeFormData } from '@/lib/validations/document-type';
import { useDocumentTypes } from '../hooks/use-document-types';
import type { DocumentType } from '../types';

const DEFAULT_FORM: DocumentTypeFormData = { name: '', description: '', phase: 'ALL' };

export function DocumentTypesFeature() {
    const {
        filteredTypes,
        isLoading,
        searchQuery,
        setSearchQuery,
        phases,
        createMutation,
        updateMutation,
        deleteMutation,
    } = useDocumentTypes();

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<DocumentType | null>(null);

    const form = useForm<DocumentTypeFormData>({
        resolver: zodResolver(documentTypeSchema),
        defaultValues: DEFAULT_FORM,
    });

    const { control, register, handleSubmit, reset, formState: { errors } } = form;

    const resetForm = () => {
        setEditing(null);
        reset(DEFAULT_FORM);
    };

    const startEdit = (t: DocumentType) => {
        setEditing(t);
        reset({
            name: t.name,
            description: t.description || '',
            phase: t.phase || 'ALL',
        });
        setOpen(true);
    };

    const onSubmit = (data: DocumentTypeFormData) => {
        if (editing) {
            updateMutation.mutate({ id: editing.id, form: data }, {
                onSuccess: () => {
                    setOpen(false);
                    resetForm();
                },
            });
        } else {
            createMutation.mutate(data, {
                onSuccess: () => {
                    setOpen(false);
                    resetForm();
                },
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Delete this document type?')) {
            deleteMutation.mutate(id);
        }
    };

    const dialogTitle = editing ? 'Edit Document Type' : 'Add Document Type';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Document Types</h1>
                    <p className="text-muted-foreground">Manage dynamic document types (HKI, Hak Cipta, etc.).</p>
                </div>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Type</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <DialogHeader>
                                <DialogTitle>{dialogTitle}</DialogTitle>
                                <DialogDescription>Define a new document type category.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        {...register('name')}
                                        placeholder="HKI"
                                        aria-invalid={errors.name ? 'true' : 'false'}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">{errors.name.message}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        {...register('description')}
                                        placeholder="Hak Kekayaan Intelektual"
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-destructive">{errors.description.message}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phase">Phase (optional)</Label>
                                    <Controller
                                        name="phase"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger id="phase">
                                                    <SelectValue placeholder="All phases" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ALL">All Phases</SelectItem>
                                                    {phases.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                    {editing ? 'Save Changes' : 'Create'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search document types..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : filteredTypes.length === 0 ? (
                <EmptyState
                    icon={Search}
                    title={searchQuery ? 'No matching document types found' : 'No document types defined yet'}
                />
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
                            {filteredTypes.map((t) => (
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
