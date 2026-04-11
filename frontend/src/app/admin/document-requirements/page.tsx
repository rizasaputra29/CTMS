'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

interface PhaseRequirement {
    id?: number;
    phase: string;
    name: string;
    description: string | null;
    is_required: boolean;
}

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

const DEFAULT_DOCUMENTS: Record<string, string[]> = {
    PDC1: ['Proposal', 'Gantt Chart'],
    SEMPRO: ['Buku Bimbingan', 'Bukti Kemajuan'],
    PDC2: ['Laporan Kemajuan', 'Bukti Kemajuan'],
    EXPO: ['Poster', 'Laporan TA'],
    TA: ['Draft TA', 'Buku Panduan TA'],
    SIDANG: ['Buku TA Final', 'CD Program'],
};

export default function AdminDocumentRequirementsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
    const [selectedPhase, setSelectedPhase] = useState<string>(PHASES[0]);
    const [requirements, setRequirements] = useState<PhaseRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [newDocDesc, setNewDocDesc] = useState('');

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/periods-list');
            const periodsData = res.data?.data || [];
            setPeriods(periodsData);
            if (periodsData.length > 0) {
                const active = periodsData.find((p: Period) => p.is_active);
                setSelectedPeriodId(active?.id?.toString() || periodsData[0].id.toString());
            }
        } catch (error) {
            console.error('Failed to fetch periods', error);
        }
    }, []);

    const fetchRequirements = useCallback(async () => {
        if (!selectedPeriodId) return;
        setLoading(true);
        try {
            const res = await api.get(`/admin/document-requirements/period/${selectedPeriodId}`);
            const data = res.data?.data || [];
            // Normalize data: convert null descriptions to empty strings
            setRequirements(data.map((r: PhaseRequirement) => ({
                ...r,
                description: r.description || ''
            })));
        } catch (error) {
            console.error('Failed to fetch requirements', error);
            toast.error('Failed to load document requirements');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriodId]);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    useEffect(() => {
        if (selectedPeriodId) {
            fetchRequirements();
        }
    }, [selectedPeriodId, fetchRequirements]);

    const currentPhaseRequirements = useMemo(() => {
        return requirements.filter(r => r.phase === selectedPhase);
    }, [requirements, selectedPhase]);

    const handleAddDocument = () => {
        if (!newDocName.trim()) {
            toast.error('Document name is required');
            return;
        }

        const exists = currentPhaseRequirements.some(
            r => r.name.toLowerCase() === newDocName.trim().toLowerCase()
        );

        if (exists) {
            toast.error('Document type already exists in this phase');
            return;
        }

        const newDoc: PhaseRequirement = {
            phase: selectedPhase,
            name: newDocName.trim(),
            description: newDocDesc.trim(),
            is_required: true,
        };

        setRequirements(prev => [...prev, newDoc]);
        setNewDocName('');
        setNewDocDesc('');
    };

    const handleRemoveDocument = (name: string) => {
        setRequirements(prev => prev.filter(r => !(r.phase === selectedPhase && r.name === name)));
    };

    const handleToggleRequired = (name: string) => {
        setRequirements(prev => prev.map(r => {
            if (r.phase === selectedPhase && r.name === name) {
                return { ...r, is_required: !r.is_required };
            }
            return r;
        }));
    };

    const handleUpdateDescription = (name: string, description: string) => {
        setRequirements(prev => prev.map(r => {
            if (r.phase === selectedPhase && r.name === name) {
                return { ...r, description };
            }
            return r;
        }));
    };

    const handleSave = async () => {
        if (!selectedPeriodId) {
            toast.error('Please select a period');
            return;
        }

        setSaving(true);
        try {
            const requirementsByPhase = PHASES.map(phase => {
                return requirements
                    .filter(r => r.phase === phase)
                    .map(r => ({
                        phase: r.phase,
                        name: r.name,
                        description: r.description || null,
                        is_required: r.is_required,
                    }));
            }).flat();

            await api.put('/admin/document-requirements/bulk', {
                period_id: parseInt(selectedPeriodId),
                requirements: requirementsByPhase,
            });

            toast.success('Document requirements saved successfully');
            fetchRequirements();
        } catch (error) {
            console.error('Failed to save requirements', error);
            toast.error('Failed to save requirements');
        } finally {
            setSaving(false);
        }
    };

    const handleLoadDefaults = () => {
        const defaults: PhaseRequirement[] = [];
        
        Object.entries(DEFAULT_DOCUMENTS).forEach(([phase, docs]) => {
            docs.forEach(docName => {
                const exists = requirements.some(
                    r => r.phase === phase && r.name === docName
                );
                if (!exists) {
                    defaults.push({
                        phase,
                        name: docName,
                        description: '',
                        is_required: true,
                    });
                }
            });
        });

        if (defaults.length === 0) {
            toast.info('All default documents already loaded');
            return;
        }

        setRequirements(prev => [...prev, ...defaults]);
        toast.success('Default documents loaded');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Document Requirements</h1>
                    <p className="text-muted-foreground">Configure required documents for each phase per period.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleLoadDefaults}>
                        Load Defaults
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !selectedPeriodId}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="w-[300px]">
                    <Label>Period</Label>
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map(period => (
                                <SelectItem key={period.id} value={period.id.toString()}>
                                    {period.name} {period.is_active && <Badge variant="secondary" className="ml-2">Active</Badge>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex gap-2 border-b">
                {PHASES.map(phase => (
                    <button
                        key={phase}
                        onClick={() => setSelectedPhase(phase)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            selectedPhase === phase
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {phase}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : !selectedPeriodId ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                    Please select a period to manage document requirements.
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Document Types</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Manage document types for {selectedPhase}
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Document name"
                                    value={newDocName}
                                    onChange={(e) => setNewDocName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddDocument()}
                                />
                                <Button onClick={handleAddDocument}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <Input
                                placeholder="Description (optional)"
                                value={newDocDesc}
                                onChange={(e) => setNewDocDesc(e.target.value)}
                            />

                            {currentPhaseRequirements.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No document types defined for {selectedPhase}. Add one above or load defaults.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {currentPhaseRequirements.map((req, idx) => (
                                        <div
                                            key={`${req.phase}-${req.name}-${idx}`}
                                            className="flex items-center gap-2 p-3 border rounded-lg"
                                        >
                                            <Checkbox
                                                id={`${req.phase}-${req.name}-required`}
                                                checked={req.is_required}
                                                onCheckedChange={() => handleToggleRequired(req.name)}
                                            />
                                            <div className="flex-1">
                                                <Label
                                                    htmlFor={`${req.phase}-${req.name}-required`}
                                                    className="font-medium cursor-pointer"
                                                >
                                                    {req.name}
                                                </Label>
                                                <Input
                                                    placeholder="Description"
                                                    value={req.description}
                                                    onChange={(e) => handleUpdateDescription(req.name, e.target.value)}
                                                    className="mt-1 h-8 text-sm"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleRemoveDocument(req.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {PHASES.map(phase => {
                                    const phaseReqs = requirements.filter(r => r.phase === phase);
                                    const requiredCount = phaseReqs.filter(r => r.is_required).length;
                                    return (
                                        <div key={phase} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{phase}</Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    {phaseReqs.length} document{phaseReqs.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <span className="text-sm">
                                                {requiredCount} required
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
