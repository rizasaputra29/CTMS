'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, MoreHorizontal, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { useDocumentRequirements, PHASES } from '../hooks/use-document-requirements';
import type { PhaseSummary } from '../types';

const PHASE_LABELS: Record<string, string> = {
    PDC1: 'PDC 1',
    SEMPRO: 'Seminar Proposal',
    PDC2: 'PDC 2',
    EXPO: 'Expo',
    TA: 'Tugas Akhir',
    SIDANG: 'Sidang',
};

type SortKey = 'phase' | 'count';
type SortDir = 'asc' | 'desc';

const getPhaseColor = (phase: string): string => {
    const colors: Record<string, string> = {
        PDC1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        SEMPRO: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        PDC2: 'bg-violet-100 text-violet-700 border-violet-200',
        EXPO: 'bg-amber-100 text-amber-700 border-amber-200',
        TA: 'bg-rose-100 text-rose-700 border-rose-200',
        SIDANG: 'bg-teal-100 text-teal-700 border-teal-200',
    };
    return colors[phase] || 'bg-grey-100 text-grey-700 border-grey-200';
};

export function DocumentRequirementsFeature() {
    const router = useRouter();
    const {
        periods,
        selectedPeriodId,
        setSelectedPeriodId,
        summaries,
        summariesLoading,
        loadDefaults,
        isLoadingDefaults,
    } = useDocumentRequirements();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('phase');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const columns: DataTableColumn<PhaseSummary>[] = useMemo(
        () => [
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
                render: (summary) =>
                    summary.document_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {summary.document_names.map((name, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                    {name}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">Not configured</span>
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
        ],
        [router]
    );

    const filteredSummaries = useMemo(() => {
        let filtered = (summaries ?? []).filter(
            (s) =>
                s.phase?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.document_names ?? []).some((name) => name?.toLowerCase().includes(searchQuery.toLowerCase()))
        );

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

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">Document Requirements</h1>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDefaults(selectedPeriodId)}
                        disabled={!selectedPeriodId || isLoadingDefaults}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        Gunakan konfigurasi bawaan
                    </Button>
                </div>
            </div>

            <DataTable<PhaseSummary>
                title="Phase Configuration"
                data={filteredSummaries}
                columns={columns}
                loading={summariesLoading}
                emptyMessage="No phases found"
                emptySubMessage="Try adjusting your search."
                emptyIcon={<FileText className="h-10 w-10" />}
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search..."
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => handleSort(key as SortKey)}
                rowIdKey="phase"
                filterSlot={
                    <div className="flex items-center gap-2">
                        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                            <SelectTrigger className="w-48">
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="mr-2 h-4 w-4" /> Filter
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Status</div>
                                <DropdownMenuItem onClick={() => setSearchQuery('')}>All Phases</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchQuery('configured')}>Configured</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSearchQuery('not configured')}>Not Configured</DropdownMenuItem>
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
