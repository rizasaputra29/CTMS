'use client';

import { useState, Fragment } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronUp, MoreVertical, Edit, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    bidding_start: string | null;
    bidding_end: string | null;
    bidding_reminder_at?: string | null;
    pdc1_start: string | null;
    pdc1_end: string | null;
    pdc1_reminder_at?: string | null;
    pdc2_start: string | null;
    pdc2_end: string | null;
    pdc2_reminder_at?: string | null;
    expo_date: string | null;
    expo_reminder_at?: string | null;
    ta_start: string | null;
    ta_end: string | null;
    ta_reminder_at?: string | null;
    min_group_size: number | null;
    max_group_size: number | null;
    max_supervisor_load: number | null;
}

interface PeriodTableProps {
    periods: Period[];
    onEdit: (period: Period) => void;
    onDelete: (id: number) => void;
    onToggleActive: (period: Period) => void;
}

type SortKey = 'name' | 'duration' | 'status';
type SortDir = 'asc' | 'desc';

export function PeriodTable({ periods, onEdit, onDelete, onToggleActive }: PeriodTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const toggleExpanded = (id: number) => {
        setExpandedRows((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedPeriods = [...periods].sort((a, b) => {
        let comparison = 0;
        switch (sortKey) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'duration':
                comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
                break;
            case 'status':
                comparison = Number(b.is_active) - Number(a.is_active);
                break;
        }
        return sortDir === 'asc' ? comparison : -comparison;
    });

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try {
            return format(new Date(dateStr), 'dd MMM yyyy', { locale: id });
        } catch {
            return dateStr;
        }
    };

    const formatDuration = (start: string, end: string) => {
        return `${formatDate(start)} — ${formatDate(end)}`;
    };

    const hasPhaseDates = (period: Period) => {
        return period.bidding_start || period.pdc1_start || period.pdc2_start || 
               period.expo_date || period.ta_start;
    };

    const hasGroupConfig = (period: Period) => {
        return period.min_group_size !== null || period.max_group_size !== null || 
               period.max_supervisor_load !== null;
    };

    return (
        <div className="rounded-lg border bg-white">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead 
                            className="cursor-pointer font-semibold text-gray-700"
                            onClick={() => handleSort('name')}
                        >
                            Nama Periode
                        </TableHead>
                        <TableHead 
                            className="cursor-pointer font-semibold text-gray-700"
                            onClick={() => handleSort('duration')}
                        >
                            Durasi
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">Konfigurasi Group</TableHead>
                        <TableHead 
                            className="cursor-pointer font-semibold text-gray-700"
                            onClick={() => handleSort('status')}
                        >
                            Status
                        </TableHead>
                        <TableHead className="w-16 text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedPeriods.map((period) => {
                        const isExpanded = expandedRows.has(period.id);
                        
                        return (
                            <Fragment key={period.id}>
                                <TableRow 
                                    className="cursor-pointer hover:bg-gray-50/50"
                                    onClick={() => toggleExpanded(period.id)}
                                >
                                    <TableCell onClick={(e) => { e.stopPropagation(); toggleExpanded(period.id); }}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-gray-500" />
                                            )}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-900">
                                        {period.name}
                                    </TableCell>
                                    <TableCell className="text-gray-600">
                                        {formatDuration(period.start_date, period.end_date)}
                                    </TableCell>
                                    <TableCell>
                                        {hasGroupConfig(period) ? (
                                            <span className="text-sm text-gray-600">
                                                {period.min_group_size}-{period.max_group_size} anggota
                                                {period.max_supervisor_load && (
                                                    <span className="text-gray-400"> · {period.max_supervisor_load}/dosen</span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400">Belum dikonfigurasi</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {period.is_active ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                                Aktif
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                                                Nonaktif
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4 text-gray-500" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onEdit(period)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onToggleActive(period)}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    {period.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => onDelete(period.id)}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Hapus
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                
                                {/* Expanded Row */}
                                {isExpanded && (
                                    <TableRow className="bg-gray-50/30">
                                        <TableCell colSpan={6} className="p-0">
                                            <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {/* Phase Dates */}
                                                {hasPhaseDates(period) && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                            Tanggal Fase
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            {period.bidding_start && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Bidding</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.bidding_start)} — {formatDate(period.bidding_end)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.pdc1_start && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">PDC1</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.pdc1_start)} — {formatDate(period.pdc1_end)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.pdc2_start && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">PDC2</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.pdc2_start)} — {formatDate(period.pdc2_end)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.expo_date && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">EXPO</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.expo_date)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.ta_start && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Sidang TA</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.ta_start)} — {formatDate(period.ta_end)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Group Configuration */}
                                                {hasGroupConfig(period) && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                            Konfigurasi Group
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Jumlah Anggota</span>
                                                                <span className="text-gray-900 font-medium">
                                                                    {period.min_group_size} — {period.max_group_size} orang
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Max Dosen Pembimbing</span>
                                                                <span className="text-gray-900 font-medium">
                                                                    {period.max_supervisor_load} group/dosen
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Reminder Dates */}
                                                {(period.bidding_reminder_at || period.pdc1_reminder_at || 
                                                  period.pdc2_reminder_at || period.expo_reminder_at || 
                                                  period.ta_reminder_at) && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                            Tanggal Pengingat
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            {period.bidding_reminder_at && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Bidding</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.bidding_reminder_at)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.pdc1_reminder_at && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">PDC1</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.pdc1_reminder_at)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.pdc2_reminder_at && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">PDC2</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.pdc2_reminder_at)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.expo_reminder_at && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">EXPO</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.expo_reminder_at)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {period.ta_reminder_at && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600">Sidang TA</span>
                                                                    <span className="text-gray-900 font-medium">
                                                                        {formatDate(period.ta_reminder_at)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
