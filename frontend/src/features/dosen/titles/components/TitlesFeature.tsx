'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { titleSchema, type TitleFormData } from '@/lib/validations/title';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit, Search, X, History, Loader2 } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { SpecializationSelector, SPECIALIZATIONS } from '@/components/ui/specialization-selector';
import { SortableTableHeader } from '@/components/common/SortableTableHeader';
import { formatDateTime } from '@/lib/utils';
import { useTitles } from '../hooks/use-titles';
import type { Title, SortKey, SortDir } from '../types';

export function TitlesFeature() {
    const {
        periods,
        selectedPeriod,
        setSelectedPeriod,
        titles,
        titlesLoading,
        availableGroups,
        formDialog,
        setFormDialog,
        withdrawDialog,
        setWithdrawDialog,
        historyDialog,
        setHistoryDialog,
        handleSubmit,
        handleDelete,
        handleWithdraw,
        handleViewHistory,
    } = useTitles();

    const [search, setSearch] = useState('');
    const [filterSpecs, setFilterSpecs] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('title');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const form = useForm<TitleFormData>({
        resolver: zodResolver(titleSchema),
        mode: 'onBlur',
        defaultValues: {
            title: '',
            description: '',
            problem_statement: '',
            scope: '',
            specializations: [],
            quota: 1,
            pre_assigned_group_id: '',
        },
    });

    const handleEdit = (title: Title) => {
        form.reset({
            title: title.title,
            description: title.description,
            problem_statement: title.problem_statement || '',
            scope: title.scope || '',
            specializations: title.specializations || [],
            quota: title.quota,
            pre_assigned_group_id: title.pre_assigned_group_id?.toString() || '',
        });
        setFormDialog({ open: true, editingId: title.id });
    };

    const handleOpenChange = (isOpen: boolean) => {
        setFormDialog({ open: isOpen, editingId: isOpen ? formDialog.editingId : null });
        if (!isOpen) {
            form.reset();
        }
    };

    const toggleSpecFilter = (spec: string) => {
        setFilterSpecs(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
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
            result = result.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
        }
        if (filterSpecs.length > 0) {
            result = result.filter(t => t.specializations && filterSpecs.some(s => t.specializations!.includes(s)));
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

    const formatDateWithTime = (dateString: string) => {
        if (!dateString) return 'N/A';
        return formatDateTime(dateString);
    };

    if (titlesLoading && !titles.length && !selectedPeriod) {
        return <Loading variant="section" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Titles</h1>
                    <p className="text-muted-foreground">Create and manage your final project titles.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={titlesLoading}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map((p: { id: number; name: string }) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Dialog open={formDialog.open} onOpenChange={handleOpenChange}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { form.reset(); setFormDialog({ open: true, editingId: null }); }} disabled={!selectedPeriod} title={!selectedPeriod ? 'Please select a period first' : undefined}>
                                <Plus className="mr-2 h-4 w-4" /> Add Title
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                            <form onSubmit={form.handleSubmit(handleSubmit)}>
                                <DialogHeader>
                                    <DialogTitle>{formDialog.editingId ? 'Edit Title' : 'Add New Title'}</DialogTitle>
                                    <DialogDescription>
                                        {formDialog.editingId ? 'Update your project title details.' : 'Offer a new title for students to bid on.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <Controller name="title" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="title">Title</FieldLabel>
                                            <Input id="title" {...field} aria-invalid={!!fieldState.error} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="description" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="description">Description</FieldLabel>
                                            <Textarea id="description" {...field} rows={3} aria-invalid={!!fieldState.error} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="problem_statement" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="problem_statement">Problem Statement</FieldLabel>
                                            <Textarea id="problem_statement" {...field} placeholder="What problem does this project solve?" rows={3} aria-invalid={!!fieldState.error} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="scope" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="scope">Scope</FieldLabel>
                                            <Textarea id="scope" {...field} placeholder="Define the boundaries and scope of this project" rows={3} aria-invalid={!!fieldState.error} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="specializations" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <SpecializationSelector selected={field.value || []} onChange={field.onChange} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="quota" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="quota">Quota (Groups)</FieldLabel>
                                            <Input id="quota" type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} aria-invalid={!!fieldState.error} />
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                        </Field>
                                    )} />
                                    <Controller name="pre_assigned_group_id" control={form.control} render={({ field, fieldState }) => (
                                        <Field data-invalid={!!fieldState.error}>
                                            <FieldLabel htmlFor="pre_assigned_group_id">Tugaskan ke Kelompok (Opsional)</FieldLabel>
                                            <Select value={field.value || ''} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue placeholder="Pilih kelompok..." /></SelectTrigger>
                                                <SelectContent>
                                                    {availableGroups.length === 0 ? (
                                                        <SelectItem value="no-groups-available" disabled>Tidak ada kelompok tersedia untuk periode ini</SelectItem>
                                                    ) : (
                                                        availableGroups.map((group: { id: number; status: string; members?: Array<{ id: number; name?: string }> }) => {
                                                            const isReady = group.status === 'READY_FOR_BIDDING';
                                                            const memberCount = group.members?.length || 0;
                                                            return (
                                                                <SelectItem key={group.id} value={group.id.toString()} disabled={!isReady}>
                                                                    <span className={!isReady ? 'text-muted-foreground' : ''}>
                                                                        Group {group.id} ({memberCount} anggota) - {group.status}
                                                                        {!isReady && ' (Tidak tersedia)'}
                                                                    </span>
                                                                </SelectItem>
                                                            );
                                                        })
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FieldError>{fieldState.error?.message}</FieldError>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <p>Hanya kelompok dengan status &quot;READY_FOR_BIDDING&quot; yang dapat dipilih.</p>
                                                <p>Jika dipilih, judul tidak akan muncul di marketplace dan otomatis ditugaskan ke kelompok tersebut.</p>
                                            </div>
                                        </Field>
                                    )} />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">{formDialog.editingId ? 'Update Title' : 'Create Title'}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search titles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Filter:</span>
                    {SPECIALIZATIONS.map(spec => (
                        <label key={spec} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox checked={filterSpecs.includes(spec)} onCheckedChange={() => toggleSpecFilter(spec)} />
                            <span className="text-xs">{spec}</span>
                        </label>
                    ))}
                </div>
            </div>

            {titlesLoading ? (
                <Loading variant="section" />
            ) : filteredTitles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    {titles.length === 0 ? 'No titles found. Create one to get started.' : 'No titles match your search/filter.'}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableTableHeader label="Title" sortKey="title" currentSortKey={sortKey} onSort={handleSort} />
                                <TableHead>Specializations</TableHead>
                                <SortableTableHeader label="Quota" sortKey="quota" currentSortKey={sortKey} onSort={handleSort} />
                                <SortableTableHeader label="Groups" sortKey="active_groups_count" currentSortKey={sortKey} onSort={handleSort} />
                                <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} onSort={handleSort} />
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTitles.map(title => (
                                <TableRow key={title.id} className="cursor-pointer" onClick={() => window.location.href = `/dosen/titles/${title.id}`}>
                                    <TableCell className="font-medium max-w-[300px]"><div className="line-clamp-2">{title.title}</div></TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(title.specializations || []).map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell>{title.quota} group{title.quota > 1 ? 's' : ''}</TableCell>
                                    <TableCell>{title.active_groups_count}/{title.quota}</TableCell>
                                    <TableCell><Badge variant={title.status === 'open' ? 'default' : 'secondary'}>{title.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewHistory(title)} title="View title history"><History className="h-4 w-4" /></Button>
                                            {title.status === 'APPROVED' || title.supervisor_approval_status === 'APPROVED' ? (
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setWithdrawDialog({ open: true, title, reason: '', loading: false })} title="Withdraw approval from this title"><X className="h-4 w-4" /></Button>
                                            ) : null}
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(title)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(title.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={withdrawDialog.open} onOpenChange={(open) => setWithdrawDialog(prev => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Withdraw Approval</DialogTitle>
                        <DialogDescription>This action will revert affected groups to FORMING_SOLO status. They will need to choose another title.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {withdrawDialog.title && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm font-medium">Title: {withdrawDialog.title.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{withdrawDialog.title.active_groups_count} active group{withdrawDialog.title.active_groups_count > 1 ? 's' : ''} will be affected</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <FieldLabel htmlFor="withdraw-reason">Reason (Optional)</FieldLabel>
                            <Textarea id="withdraw-reason" placeholder="Why are you withdrawing approval? (leave blank if not applicable)" value={withdrawDialog.reason} onChange={(e) => setWithdrawDialog(prev => ({ ...prev, reason: e.target.value }))} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWithdrawDialog({ open: false, reason: '', loading: false })} disabled={withdrawDialog.loading}>Cancel</Button>
                        <Button variant="destructive" onClick={handleWithdraw} disabled={withdrawDialog.loading}>
                            {withdrawDialog.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Withdraw Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Title History</DialogTitle>
                        <DialogDescription>View approval withdrawal and deletion history for this title.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {historyDialog.title && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm font-medium">{historyDialog.title.title}</p>
                                <p className="text-xs text-gray-600 mt-1">Status: {historyDialog.title.status}</p>
                            </div>
                        )}
                        {historyDialog.loading ? (
                            <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <>
                                {(historyDialog.approvalHistory.length === 0 && historyDialog.deletionHistory.length === 0) ? (
                                    <div className="text-center py-8 text-muted-foreground">No history found for this title.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {historyDialog.approvalHistory.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span>Approval Withdrawals ({historyDialog.approvalHistory.length})</h4>
                                                <div className="space-y-3">
                                                    {historyDialog.approvalHistory.map((audit, idx) => (
                                                        <div key={idx} className="border-l-2 border-amber-500 pl-4 py-2">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-sm font-medium">{audit.action}</p>
                                                                    <p className="text-xs text-muted-foreground">By: {audit.lecturer?.name || 'Unknown'}</p>
                                                                    {audit.reason && <p className="text-xs text-gray-600 mt-1">Reason: {audit.reason}</p>}
                                                                    {audit.affected_group && <p className="text-xs text-gray-600">Group: {audit.affected_group.name}</p>}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateWithTime(audit.created_at)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {historyDialog.deletionHistory.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Deletions ({historyDialog.deletionHistory.length})</h4>
                                                <div className="space-y-3">
                                                    {historyDialog.deletionHistory.map((audit, idx) => (
                                                        <div key={idx} className="border-l-2 border-red-500 pl-4 py-2">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-sm font-medium">{audit.action}</p>
                                                                    <p className="text-xs text-muted-foreground">By: {audit.lecturer?.name || 'Unknown'}</p>
                                                                    {audit.reason && <p className="text-xs text-gray-600 mt-1">Reason: {audit.reason}</p>}
                                                                    {audit.affected_groups_count && audit.affected_groups_count > 0 && (
                                                                        <p className="text-xs text-gray-600">
                                                                            Affected: {audit.affected_groups_count} group(s)
                                                                            {audit.reverted_group_ids && audit.reverted_group_ids.length > 0 && <span> (Groups: {audit.reverted_group_ids.join(', ')})</span>}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateWithTime(audit.created_at)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryDialog({ open: false, title: undefined, loading: false, approvalHistory: [], deletionHistory: [] })}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
