'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ChevronLeft, Save, Plus, Trash2, FileText, AlertCircle } from 'lucide-react';
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
} from "@/components/ui/select";
import {
    DataTable,
    DataTableColumn,
} from '@/components/ui/data-table';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized?: boolean;
}

interface PhaseRequirement {
    id?: number;
    phase: string;
    name: string;
    description: string | null;
    is_required: boolean;
}

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

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

export default function PhaseDocumentRequirementsPage() {
    const router = useRouter();
    const params = useParams();
    const phaseParam = (params.phase as string)?.toUpperCase();
    const phase = PHASES.includes(phaseParam) ? phaseParam : '';
    
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
    const [requirements, setRequirements] = useState<PhaseRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [newDocDesc, setNewDocDesc] = useState('');

    const selectedPeriod = periods.find(p => p.id.toString() === selectedPeriodId);
    const isPeriodFinalized = selectedPeriod?.is_finalized ?? false;

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/periods-list');
            const data = res.data?.data || [];
            setPeriods(data);
            if (data.length > 0) {
                const active = data.find((p: Period) => p.is_active);
                setSelectedPeriodId(active?.id?.toString() || data[0].id.toString());
            }
        } catch (error) {
            console.error('Failed to fetch periods', error);
        }
    }, []);

    const fetchRequirements = useCallback(async () => {
        if (!selectedPeriodId || !phase) return;
        setLoading(true);
        try {
            const res = await api.get(`/admin/document-requirements/period/${selectedPeriodId}`);
            const data = res.data?.data || [];
            // Filter for current phase only
            const phaseData = data.filter((r: PhaseRequirement) => r.phase === phase);
            setRequirements(phaseData.map((r: PhaseRequirement) => ({
                ...r,
                description: r.description || '',
            })));
        } catch (error) {
            console.error('Failed to fetch requirements', error);
            toast.error('Failed to load document requirements');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriodId, phase]);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    useEffect(() => {
        if (selectedPeriodId && phase) {
            fetchRequirements();
        }
    }, [selectedPeriodId, phase, fetchRequirements]);

    const handleAddDocument = () => {
        if (isPeriodFinalized) return;
        if (!newDocName.trim()) {
            toast.error('Document name is required');
            return;
        }

        const exists = requirements.some(
            r => r.name.toLowerCase() === newDocName.trim().toLowerCase()
        );

        if (exists) {
            toast.error('Document type already exists');
            return;
        }

        const newDoc: PhaseRequirement = {
            phase,
            name: newDocName.trim(),
            description: newDocDesc.trim() || null,
            is_required: true,
        };

        setRequirements(prev => [...prev, newDoc]);
        setNewDocName('');
        setNewDocDesc('');
    };

    const handleRemoveDocument = (index: number) => {
        if (isPeriodFinalized) return;
        setRequirements(prev => prev.filter((_, i) => i !== index));
    };

    const handleToggleRequired = (index: number) => {
        if (isPeriodFinalized) return;
        setRequirements(prev => prev.map((r, i) => {
            if (i === index) {
                return { ...r, is_required: !r.is_required };
            }
            return r;
        }));
    };

    const handleUpdateName = (index: number, name: string) => {
        if (isPeriodFinalized) return;
        setRequirements(prev => prev.map((r, i) => {
            if (i === index) {
                return { ...r, name };
            }
            return r;
        }));
    };

    const handleUpdateDescription = (index: number, description: string) => {
        if (isPeriodFinalized) return;
        setRequirements(prev => prev.map((r, i) => {
            if (i === index) {
                return { ...r, description: description || null };
            }
            return r;
        }));
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

        setSaving(true);
        try {
            // Get all requirements for the period (all phases)
            const res = await api.get(`/admin/document-requirements/period/${selectedPeriodId}`);
            const allRequirements = res.data?.data || [];
            
            // Filter out current phase requirements
            const otherPhases = allRequirements.filter((r: PhaseRequirement) => r.phase !== phase);
            
            // Merge with current phase requirements
            const updatedRequirements = [...otherPhases, ...requirements];

            await api.put('/admin/document-requirements/bulk', {
                period_id: parseInt(selectedPeriodId),
                requirements: updatedRequirements.map(r => ({
                    phase: r.phase,
                    name: r.name,
                    description: r.description || null,
                    is_required: r.is_required,
                })),
            });

            toast.success('Document requirements saved successfully');
        } catch (error) {
            console.error('Failed to save requirements', error);
            toast.error('Failed to save requirements');
        } finally {
            setSaving(false);
        }
    };

    const columns: DataTableColumn<PhaseRequirement>[] = useMemo(() => [
        {
            key: 'required',
            header: '',
            width: 'w-10',
            render: (_req, index) => (
                <Checkbox
                    checked={requirements[index]?.is_required ?? false}
                    onCheckedChange={() => handleToggleRequired(index)}
                    disabled={isPeriodFinalized}
                />
            ),
        },
        {
            key: 'name',
            header: 'Nama Dokumen',
            render: (_req, index) => (
                isPeriodFinalized ? (
                    <span className="font-medium">{requirements[index]?.name}</span>
                ) : (
                    <Input
                        value={requirements[index]?.name || ''}
                        onChange={(e) => handleUpdateName(index, e.target.value)}
                        className="h-8 text-sm"
                    />
                )
            ),
        },
        {
            key: 'description',
            header: 'Deskripsi',
            render: (_req, index) => (
                isPeriodFinalized ? (
                    <span className="text-sm text-muted-foreground">
                        {requirements[index]?.description || '-'}
                    </span>
                ) : (
                    <Input
                        value={requirements[index]?.description || ''}
                        onChange={(e) => handleUpdateDescription(index, e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Deskripsi"
                    />
                )
            ),
        },
        {
            key: 'action',
            header: 'Aksi',
            align: 'center',
            width: 'w-20',
            render: (_req, index) => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveDocument(index)}
                    disabled={isPeriodFinalized}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ),
        },
    ], [requirements, isPeriodFinalized]);

    if (!phase) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Invalid phase</p>
                <Button 
                    variant="link" 
                    onClick={() => router.push('/admin/document-requirements')}
                    className="mt-2"
                >
                    Back to Document Requirements
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
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
                <Button
                    onClick={handleSave}
                    disabled={saving || isPeriodFinalized}
                    size="sm"
                >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Simpan
                </Button>
            </div>

            {/* Period Alert */}
            {isPeriodFinalized && (
                <Alert variant="destructive" className="border-amber-500 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Period Finalized</AlertTitle>
                    <AlertDescription className="text-amber-700">
                        Document requirements cannot be modified for a finalized period.
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                {/* Left Column - Phase Info */}
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
                                <p className="text-sm text-muted-foreground mt-1">
                                    {PHASE_DESCRIPTIONS[phase]}
                                </p>
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
                                        {periods.map(period => (
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
                                    <span className="text-lg font-semibold">{requirements.length}</span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm text-muted-foreground">Required</span>
                                    <span className="text-lg font-semibold text-emerald-600">
                                        {requirements.filter(r => r.is_required).length}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Document Types Table */}
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
                            {/* Add New Document Row */}
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

                            {/* Documents Table */}
                            <DataTable<PhaseRequirement>
                                title=""
                                data={requirements}
                                columns={columns}
                                loading={loading}
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
