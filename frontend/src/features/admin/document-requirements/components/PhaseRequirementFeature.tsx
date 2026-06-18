'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Plus, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { useDocumentRequirements } from '../hooks/use-document-requirements';
import type { PhaseRequirement } from '../types';

const PHASE_LABELS: Record<string, string> = {
    PDC1: 'PDC 1',
    SEMPRO: 'Seminar Proposal',
    PDC2: 'PDC 2',
    EXPO: 'Expo',
    TA: 'Tugas Akhir',
    SIDANG: 'Sidang',
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
    PDC1: 'Tahap awal pengembangan project capstone, termasuk proposal dan perencanaan awal.',
    SEMPRO: 'Seminar proposal untuk presentasi rencana project kepada dosen pembimbing.',
    PDC2: 'Tahap kedua pengembangan dengan fokus pada kemajuan implementasi project.',
    EXPO: 'Presentasi dan pameran hasil project capstone kepada publik.',
    TA: 'Penulisan dan pengembangan laporan Tugas Akhir secara menyeluruh.',
    SIDANG: 'Sidang akhir untuk presentasi dan pembelaan Tugas Akhir.',
};

interface PhaseRequirementFeatureProps {
    phase: string;
}

type DisplayItem = PhaseRequirement & {
    __source: 'base' | 'addition';
    __baseIndex?: number;
    __additionIndex?: number;
};

export function PhaseRequirementFeature({ phase }: PhaseRequirementFeatureProps) {
    const router = useRouter();
    const { periods, selectedPeriodId, setSelectedPeriodId, requirements, requirementsLoading, save, isSaving } =
        useDocumentRequirements();

    const [newDocName, setNewDocName] = useState('');
    const [newDocDesc, setNewDocDesc] = useState('');
    const [additions, setAdditions] = useState<PhaseRequirement[]>([]);
    const [edits, setEdits] = useState<Record<number, Partial<PhaseRequirement>>>({});
    const [deletions, setDeletions] = useState<Set<number>>(new Set());

    const selectedPeriod = periods.find((p) => p.id.toString() === selectedPeriodId);
    const isPeriodFinalized = selectedPeriod?.is_finalized ?? false;

    const baseItems = useMemo<DisplayItem[]>(() => {
        return (requirements ?? [])
            .filter((r) => r.phase === phase)
            .map((r, index) => ({
                ...r,
                description: r.description || '',
                __source: 'base' as const,
                __baseIndex: index,
            }));
    }, [requirements, phase]);

    const items = useMemo<DisplayItem[]>(() => {
        const visibleBase = baseItems
            .filter((item) => !deletions.has(item.__baseIndex!))
            .map((item) => ({
                ...item,
                ...edits[item.__baseIndex!],
            }));
        const visibleAdditions = additions.map((item, index) => ({
            ...item,
            __source: 'addition' as const,
            __additionIndex: index,
        }));
        return [...visibleBase, ...visibleAdditions];
    }, [baseItems, additions, edits, deletions]);

    const handleAddDocument = () => {
        if (isPeriodFinalized || !newDocName.trim()) return;
        const exists = items.some((r) => r.name.toLowerCase() === newDocName.trim().toLowerCase());
        if (exists) return;
        setAdditions((prev) => [
            ...prev,
            {
                phase,
                name: newDocName.trim(),
                description: newDocDesc.trim() || null,
                is_required: true,
            },
        ]);
        setNewDocName('');
        setNewDocDesc('');
    };

    const handleRemoveDocument = (item: DisplayItem) => {
        if (isPeriodFinalized) return;
        if (item.__source === 'base' && item.__baseIndex !== undefined) {
            setDeletions((prev) => new Set([...prev, item.__baseIndex!]));
        } else if (item.__source === 'addition' && item.__additionIndex !== undefined) {
            setAdditions((prev) => prev.filter((_, i) => i !== item.__additionIndex));
        }
    };

    const handleToggleRequired = (item: DisplayItem) => {
        if (isPeriodFinalized) return;
        if (item.__source === 'base' && item.__baseIndex !== undefined) {
            setEdits((prev) => ({
                ...prev,
                [item.__baseIndex!]: { ...prev[item.__baseIndex!], is_required: !item.is_required },
            }));
        } else if (item.__additionIndex !== undefined) {
            setAdditions((prev) =>
                prev.map((r, i) => (i === item.__additionIndex ? { ...r, is_required: !r.is_required } : r))
            );
        }
    };

    const handleUpdateName = (item: DisplayItem, name: string) => {
        if (isPeriodFinalized) return;
        if (item.__source === 'base' && item.__baseIndex !== undefined) {
            setEdits((prev) => ({
                ...prev,
                [item.__baseIndex!]: { ...prev[item.__baseIndex!], name },
            }));
        } else if (item.__additionIndex !== undefined) {
            setAdditions((prev) =>
                prev.map((r, i) => (i === item.__additionIndex ? { ...r, name } : r))
            );
        }
    };

    const handleUpdateDescription = (item: DisplayItem, description: string) => {
        if (isPeriodFinalized) return;
        if (item.__source === 'base' && item.__baseIndex !== undefined) {
            setEdits((prev) => ({
                ...prev,
                [item.__baseIndex!]: { ...prev[item.__baseIndex!], description: description || null },
            }));
        } else if (item.__additionIndex !== undefined) {
            setAdditions((prev) =>
                prev.map((r, i) => (i === item.__additionIndex ? { ...r, description: description || null } : r))
            );
        }
    };

    const handleSave = async () => {
        if (isPeriodFinalized || !selectedPeriodId || !phase) {
            if (isPeriodFinalized) {
                toast.error('Cannot modify requirements for finalized period');
                return;
            }
            toast.error('Please select a period');
            return;
        }
        const otherPhases = (requirements ?? []).filter((r) => r.phase !== phase);
        const updatedBase = baseItems
            .filter((item) => !deletions.has(item.__baseIndex!))
            .map((item) => ({
                ...item,
                ...edits[item.__baseIndex!],
            }));
        const updatedRequirements = [...otherPhases, ...updatedBase, ...additions];
        await save({
            periodId: parseInt(selectedPeriodId),
            requirements: updatedRequirements.map((r) => ({
                phase: r.phase,
                name: r.name,
                description: r.description || null,
                is_required: r.is_required,
            })),
        });
        setAdditions([]);
        setEdits({});
        setDeletions(new Set());
    };

    const columns: DataTableColumn<DisplayItem>[] = [
        {
            key: 'required',
            header: '',
            width: 'w-10',
            render: (req) => (
                <Checkbox
                    checked={req.is_required}
                    onCheckedChange={() => handleToggleRequired(req)}
                    disabled={isPeriodFinalized}
                />
            ),
        },
        {
            key: 'name',
            header: 'Nama Dokumen',
            render: (req) =>
                isPeriodFinalized ? (
                    <span className="font-medium">{req.name}</span>
                ) : (
                    <Input
                        value={req.name}
                        onChange={(e) => handleUpdateName(req, e.target.value)}
                        className="h-8 text-sm"
                    />
                ),
        },
        {
            key: 'description',
            header: 'Deskripsi',
            render: (req) =>
                isPeriodFinalized ? (
                    <span className="text-sm text-muted-foreground">{req.description || '-'}</span>
                ) : (
                    <Input
                        value={req.description || ''}
                        onChange={(e) => handleUpdateDescription(req, e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Deskripsi"
                    />
                ),
        },
        {
            key: 'action',
            header: 'Aksi',
            align: 'center',
            width: 'w-20',
            render: (req) => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveDocument(req)}
                    disabled={isPeriodFinalized}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-grey-100 text-grey-600 hover:bg-grey-25"
                        onClick={() => router.push('/admin/document-requirements')}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isPeriodFinalized} size="sm">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Simpan
                </Button>
            </div>

            {isPeriodFinalized && (
                <Alert variant="destructive" className="border-amber-500 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Period Finalized</AlertTitle>
                    <AlertDescription className="text-amber-700">
                        Document requirements cannot be modified for a finalized period.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Informasi Fase</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">Nama Fase</Label>
                                <div className="mt-1">
                                    <Badge variant="outline" className="text-base px-3 py-1">
                                        {PHASE_LABELS[phase] || phase}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Deskripsi</Label>
                                <p className="text-sm text-muted-foreground mt-1">{PHASE_DESCRIPTIONS[phase]}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Periode</Label>
                                <Select
                                    value={selectedPeriodId}
                                    onValueChange={setSelectedPeriodId}
                                    disabled={isPeriodFinalized}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {periods.map((period) => (
                                            <SelectItem key={period.id} value={period.id.toString()}>
                                                {period.name} {period.is_active && '(Active)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="pt-2 border-t">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total Dokumen</span>
                                    <span className="text-lg font-semibold">{items.length}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-muted-foreground">Required</span>
                                    <span className="text-lg font-semibold text-emerald-600">
                                        {items.filter((r) => r.is_required).length}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Tipe Dokumen</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddDocument}
                                disabled={isPeriodFinalized || !newDocName.trim()}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isPeriodFinalized && (
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-2">
                                        <Input
                                            placeholder="Nama dokumen"
                                            value={newDocName}
                                            onChange={(e) => setNewDocName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddDocument()}
                                        />
                                        <Input
                                            placeholder="Deskripsi (opsional)"
                                            value={newDocDesc}
                                            onChange={(e) => setNewDocDesc(e.target.value)}
                                            className="text-sm"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleAddDocument}
                                        disabled={!newDocName.trim()}
                                        size="icon"
                                        className="mt-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            <DataTable<DisplayItem>
                                title=""
                                data={items}
                                columns={columns}
                                loading={requirementsLoading}
                                emptyMessage="Belum ada dokumen yang dikonfigurasi"
                                emptySubMessage="Tambahkan dokumen menggunakan form di atas"
                                emptyIcon={<FileText className="h-8 w-8" />}
                                className="border rounded-lg border-dashed"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
