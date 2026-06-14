'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Filter, ArrowUpDown, MoreHorizontal, FileText, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import api from '@/lib/api';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized?: boolean;
}

interface PhaseSummary {
    phase: string;
    document_count: number;
    required_count: number;
    document_names: string[];
    has_configured: boolean;
}

type SortKey = 'phase' | 'count';
type SortDir = 'asc' | 'desc';

const PHASES = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];

const PHASE_LABELS: Record<string, string> = {
    PDC1: 'PDC 1',
    SEMPRO: 'Seminar Proposal',
    PDC2: 'PDC 2',
    EXPO: 'Expo',
    TA: 'Tugas Akhir',
    SIDANG: 'Sidang',
};

export default function AdminDocumentRequirementsPage() {
    const router = useRouter();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
    const [summaries, setSummaries] = useState<PhaseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('phase');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

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

    const fetchSummaries = useCallback(async () => {
        if (!selectedPeriodId) return;
        setLoading(true);
        try {
            const res = await api.get(`/admin/document-requirements/period/${selectedPeriodId}/summary`);
            const data: PhaseSummary[] = res.data?.data || [];
            // Ensure all phases are present
            const phaseMap = new Map<string, PhaseSummary>(data.map((s) => [s.phase, s]));
            const fullSummaries = PHASES.map(phase => ({
                phase,
                document_count: phaseMap.get(phase)?.document_count || 0,
                required_count: phaseMap.get(phase)?.required_count || 0,
                document_names: phaseMap.get(phase)?.document_names || [],
                has_configured: phaseMap.get(phase)?.has_configured || false,
            }));
            setSummaries(fullSummaries);
        } catch (error) {
            console.error('Failed to fetch summaries', error);
            // Fallback to empty summaries for all phases
            setSummaries(PHASES.map(phase => ({
                phase,
                document_count: 0,
                required_count: 0,
                document_names: [],
                has_configured: false,
            })));
        } finally {
            setLoading(false);
        }
    }, [selectedPeriodId]);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    useEffect(() => {
        if (selectedPeriodId) {
            fetchSummaries();
        }
    }, [selectedPeriodId, fetchSummaries]);

    const filteredSummaries = useMemo(() => {
        let filtered = summaries.filter(s => 
            s.phase.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.document_names.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        
        // Sort
        filtered = [...filtered].sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case 'phase':
                    comparison = PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase);
                    break;
                case 'count':
                    comparison = a.document_count - b.document_count;
                    break;
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });
        
        return filtered;
    }, [summaries, searchQuery, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleLoadDefaults = async () => {
        if (!selectedPeriodId) {
            toast.error('Please select a period');
            return;
        }
        
        const DEFAULT_DOCUMENTS: Record<string, string[]> = {
            PDC1: ['Proposal', 'Gantt Chart'],
            SEMPRO: ['Buku Bimbingan', 'Bukti Kemajuan'],
            PDC2: ['Laporan Kemajuan', 'Bukti Kemajuan'],
            EXPO: ['Poster', 'Laporan TA'],
            TA: ['Draft TA', 'Buku Panduan TA'],
            SIDANG: ['Buku TA Final', 'CD Program'],
        };

        try {
            const requirements = Object.entries(DEFAULT_DOCUMENTS).map(([phase, docs]) => {
                return docs.map(name => ({
                    phase,
                    name,
                    description: null,
                    is_required: true,
                }));
            }).flat();

            await api.put('/admin/document-requirements/bulk', {
                period_id: parseInt(selectedPeriodId),
                requirements,
            });

            toast.success('Default documents loaded for all phases');
            fetchSummaries();
        } catch (error) {
            console.error('Failed to load defaults', error);
            toast.error('Failed to load default documents');
        }
    };

    const getPhaseColor = (phase: string): string => {
        const colors: Record<string, string> = {
            PDC1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            SEMPRO: 'bg-sky-100 text-sky-700 border-sky-200',
            PDC2: 'bg-violet-100 text-violet-700 border-violet-200',
            EXPO: 'bg-amber-100 text-amber-700 border-amber-200',
            TA: 'bg-rose-100 text-rose-700 border-rose-200',
            SIDANG: 'bg-teal-100 text-teal-700 border-teal-200',
        };
        return colors[phase] || 'bg-grey-100 text-grey-700 border-grey-200';
    };

    const columns: DataTableColumn<PhaseSummary>[] = useMemo(() => [
        { key: 'no', header: 'No', width: 'w-12' },
        {
            key: 'phase',
            header: 'Fase',
            sortable: true,
            render: (summary) => (
                <Badge variant="outline" className={getPhaseColor(summary.phase)}>
                    {PHASE_LABELS[summary.phase] || summary.phase}
                </Badge>
            ),
        },
        {
            key: 'syarat',
            header: 'Syarat Dokumen',
            render: (summary) => (
                <span className="text-sm text-muted-foreground">
                    {summary.document_count} document{summary.document_count !== 1 ? 's' : ''}
                    {summary.required_count > 0 && (
                        <span className="text-xs text-emerald-600 ml-1">
                            ({summary.required_count} required)
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'types',
            header: 'Tipe Dokumen',
            render: (summary) => (
                summary.document_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {summary.document_names.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {name}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground italic">
                        Not configured
                    </span>
                )
            ),
        },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            render: (summary) => (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/admin/document-requirements/${summary.phase.toLowerCase()}`)}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            ),
        },
    ], []);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
                        Document Requirements
                    </h1>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleLoadDefaults}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        Gunakan konfigurasi bawaan
                    </Button>
                </div>
            </div>

            {/* DataTable */}
            <DataTable<PhaseSummary>
                title="Phase Configuration"
                data={filteredSummaries}
                columns={columns}
                loading={loading}
                emptyMessage="No phases found"
                emptySubMessage="Try adjusting your search."
                emptyIcon={<FileText className="h-10 w-10" />}
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search..."
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => handleSort(key as SortKey)}
                filterSlot={
                    <div className="flex items-center gap-2">
                        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                            <SelectTrigger className="w-48">
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="mr-2 h-4 w-4" /> Filter
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Status</div>
                                <DropdownMenuItem onClick={() => setSearchQuery('')}>
                                    All Phases
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchQuery('configured')}>
                                    Configured
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchQuery('not configured')}>
                                    Not Configured
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                }
                rowClickable
                onRowClick={(summary) => router.push(`/admin/document-requirements/${summary.phase.toLowerCase()}`)}
            />
        </div>
    );
}
