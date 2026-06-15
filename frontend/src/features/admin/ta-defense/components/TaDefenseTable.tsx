'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import { SortableTableHeader } from '@/components/common/SortableTableHeader';
import { PaginationControls } from '@/components/common/PaginationControls';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { useExpandableRows } from '@/hooks/use-expandable-rows';
import { getTaDefenseStatusBadgeVariant } from '@/lib/badge-variants';
import type { TaDefenseSchedule, Location, SortKey } from '../types';

interface TaDefenseTableProps {
    data: TaDefenseSchedule[];
    locations: Location[];
    sortKey: SortKey;
    onSort: (key: SortKey) => void;
    onEdit: (schedule: TaDefenseSchedule) => void;
    onCancel: (schedule: TaDefenseSchedule) => void;
}

export function TaDefenseTable({
    data,
    locations,
    sortKey,
    onSort,
    onEdit,
    onCancel,
}: TaDefenseTableProps) {
    const { paginatedData, pagination } = useClientPagination(data, {
        pageSizes: [10, 25, 50],
    });
    const { isExpanded, toggleExpanded } = useExpandableRows<number>();

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const statusColor = (status: string) => getTaDefenseStatusBadgeVariant(status);

    const statusDisplay = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'Scheduled';
            case 'DONE': return 'Completed';
            case 'CANCELLED': return 'Cancelled';
            default: return status;
        }
    };

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10" />
                            <SortableTableHeader label="Student" sortKey="name" currentSortKey={sortKey} onSort={onSort} />
                            <TableHead>NIM</TableHead>
                            <TableHead className="w-20">Group</TableHead>
                            <SortableTableHeader label="Date" sortKey="date" currentSortKey={sortKey} onSort={onSort} />
                            <TableHead className="w-30">Time</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="w-45">Examiners</TableHead>
                            <SortableTableHeader label="Status" sortKey="status" currentSortKey={sortKey} onSort={onSort} />
                            <TableHead className="w-20 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((s) => {
                            const expanded = isExpanded(s.id);
                            const isCancelled = s.status === 'CANCELLED';

                            return (
                                <Fragment key={s.id}>
                                    <TableRow
                                        className={`cursor-pointer ${isCancelled ? 'hover:bg-muted/40' : 'hover:bg-muted/50'}`}
                                        onClick={() => toggleExpanded(s.id)}
                                    >
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => { e.stopPropagation(); toggleExpanded(s.id); }}
                                            >
                                                {expanded ? (
                                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`font-semibold ${isCancelled ? 'text-muted-foreground/60' : ''}`}>
                                                {(s.students && s.students.length > 0) ? s.students[0].name : (s.student?.name || 'N/A')}
                                                {(s.students && s.students.length > 1) && (
                                                    <span className="text-xs text-muted-foreground ml-1">+{s.students.length - 1} more</span>
                                                )}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-sm font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                {(s.students && s.students.length > 0) ? s.students[0].nim : (s.student?.nim || '-')}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-sm tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                {s.group.code || `#${s.group.id}`}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`text-sm whitespace-nowrap font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                {formatDate(s.date)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`text-sm whitespace-nowrap font-mono tabular-nums ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                {s.start_time.slice(0, 5)}
                                                <span className="text-muted-foreground/40 mx-0.5">–</span>
                                                {s.end_time.slice(0, 5)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-sm ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                {locations.find(l => l.id === s.location_id)?.name || s.room || <span className="text-muted-foreground/40">—</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`text-sm leading-tight ${isCancelled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                <div>{s.examiner1?.name || '—'}</div>
                                                <div>{s.examiner2?.name || '—'}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusColor(s.status)} className="text-[11px]">
                                                {statusDisplay(s.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                {s.status !== 'CANCELLED' && (
                                                    <Link href={`/admin/evaluation-summary/${s.id}`}>
                                                        <Button size="sm" variant="outline" className="text-[13px] h-7 px-2">
                                                            <FileText className="mr-1 h-3.5 w-3.5" />
                                                            Eval
                                                        </Button>
                                                    </Link>
                                                )}
                                                {s.status === 'SCHEDULED' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-[13px] h-7"
                                                            onClick={() => onEdit(s)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-[13px] h-7 text-destructive hover:text-destructive"
                                                            onClick={() => onCancel(s)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>

                                    {expanded && (
                                        <TableRow className={`${isCancelled ? 'bg-muted/20' : 'bg-muted/30'} hover:bg-inherit`}>
                                            <TableCell colSpan={10} className="p-4">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                            Schedule Details
                                                        </h4>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Date</span>
                                                                <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                    {formatDate(s.date)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Time</span>
                                                                <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                    {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Location</span>
                                                                <span className="text-[12px] text-muted-foreground">
                                                                    {locations.find(l => l.id === s.location_id)?.name || s.room || <span className="text-muted-foreground/40">—</span>}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Examiner 1</span>
                                                                <span className="text-[12px] font-medium text-foreground/80">{s.examiner1?.name || '—'}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Examiner 2</span>
                                                                <span className="text-[12px] font-medium text-foreground/80">{s.examiner2?.name || '—'}</span>
                                                            </div>
                                                            {s.evaluation_deadline && (
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Eval Deadline</span>
                                                                    <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                        {formatDate(s.evaluation_deadline)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                            Student Info
                                                        </h4>
                                                        <div className="space-y-1.5">
                                                            {(s.students || [s.student])?.map((student, idx) => (
                                                                student ? (
                                                                    <div key={student?.id || idx} className="border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-muted-foreground/70 text-[12px]">Name {idx > 0 && `#${idx + 1}`}</span>
                                                                            <span className="text-[12px] font-medium text-foreground/80">{student?.name || 'N/A'}</span>
                                                                        </div>
                                                                        {student?.nim && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground/70 text-[12px]">NIM</span>
                                                                                <span className="text-[12px] text-muted-foreground font-mono tabular-nums">{student.nim}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : null
                                                            ))}
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Group</span>
                                                                <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                                                                    #{s.group?.id || '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-muted-foreground/70 text-[12px]">Period</span>
                                                                <span className="text-[12px] text-muted-foreground">{s.period?.name || '—'}</span>
                                                            </div>
                                                            {s.notes && (
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-muted-foreground/70 text-[12px]">Notes</span>
                                                                    <span className="text-[12px] text-muted-foreground">{s.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
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

            <PaginationControls
                className="mt-4"
                page={pagination.safePage}
                pageSize={pagination.pageSize}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                showingStart={pagination.showingStart}
                showingEnd={pagination.showingEnd}
                pageSizes={pagination.pageSizes}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                size="sm"
            />
        </>
    );
}
