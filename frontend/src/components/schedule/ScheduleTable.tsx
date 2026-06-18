'use client';

// This component uses TanStack Table's useReactTable() which cannot be safely memoized
// The React Compiler is configured to skip memoization for this component
import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    flexRender,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    ChevronLeft,
    ChevronRight,
    Check,
    X,
    Eye,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ScheduleEvent } from './ScheduleCalendar';

const staticColumns = [
    {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const date = row.original.date;
            const parsed = parseISO(date);
            const isValid = !isNaN(parsed.getTime());
            return (
                <span className="text-sm">
                    {isValid ? format(parsed, 'dd MMM yyyy') : 'Invalid date'}
                </span>
            );
        },
    },
    {
        accessorKey: 'start_time',
        header: 'Time',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const date = parseISO(row.original.date);
            const time = row.original.start_time;
            const isValid = !isNaN(date.getTime());
            return (
                <span className="text-sm text-muted-foreground">
                    {time || (isValid ? format(date, 'HH:mm') : '-')}
                </span>
            );
        },
    },
    {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const type = row.original.type;
            const variant =
                type === 'BIMBINGAN'
                    ? 'default'
                    : type === 'SEMPRO'
                      ? 'secondary'
                      : type === 'EXPO'
                        ? 'outline'
                        : type === 'TA_DEFENSE'
                          ? 'destructive'
                          : 'default';
            return (
                <Badge variant={variant} className="text-xs">
                    {type}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'group.title.title',
        header: 'Group',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const groupTitle = row.original.group?.title?.title;
            return (
                <span className="text-sm font-medium">
                    {groupTitle || '-'}
                </span>
            );
        },
    },
    {
        accessorKey: 'student_name',
        header: 'Student',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const students = row.original.students;
            const studentName = row.original.student_name;

            if (students && students.length > 1) {
                return (
                    <div className="text-sm">
                        <span>{students[0].name}</span>
                        <span className="text-muted-foreground text-xs ml-1">+{students.length - 1} more</span>
                    </div>
                );
            }

            return <span className="text-sm">{studentName || '-'}</span>;
        },
    },
    {
        accessorKey: 'room',
        header: 'Room',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const room = row.original.room;
            const mode = row.original.mode;
            return (
                <span className="text-sm text-muted-foreground">
                    {room || (mode === 'online' ? 'Online' : '-')}
                </span>
            );
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const status = row.original.status || 'SCHEDULED';
            const variant =
                status === 'APPROVED' || status === 'COMPLETED'
                    ? 'default'
                    : status === 'REJECTED'
                      ? 'destructive'
                      : 'secondary';
            return (
                <Badge variant={variant} className="text-xs capitalize">
                    {status.toLowerCase()}
                </Badge>
            );
        },
    },
];

interface ScheduleTableProps {
    schedules: ScheduleEvent[];
    onRowClick: (schedule: ScheduleEvent) => void;
    onApprove: (id: number | string, type: string) => void;
    onReject: (id: number | string, type: string, reason: string) => void;
    isProcessing?: boolean;
}

export function ScheduleTable({
    schedules,
    onRowClick,
    onApprove,
    onReject,
    isProcessing = false,
}: ScheduleTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const actionsColumn = useMemo(() => ({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: { original: ScheduleEvent } }) => {
            const schedule = row.original;
            const status = schedule.status;

            if (status !== 'PENDING') {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRowClick(schedule);
                        }}
                    >
                        <Eye className="h-4 w-4" />
                        View
                    </Button>
                );
            }

            if (rejectingId === String(schedule.id)) {
                return (
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-32 text-xs"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject(String(schedule.id), schedule.type, rejectReason);
                                setRejectingId(null);
                                setRejectReason('');
                            }}
                            disabled={!rejectReason.trim() || isProcessing}
                        >
                            <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setRejectingId(null);
                                setRejectReason('');
                            }}
                        >
                            <X className="h-4 w-4 text-red-600" />
                        </Button>
                    </div>
                );
            }

            return (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onApprove(String(schedule.id), schedule.type);
                        }}
                        disabled={isProcessing}
                    >
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">Approve</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setRejectingId(String(schedule.id));
                        }}
                        disabled={isProcessing}
                    >
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-600">Reject</span>
                    </Button>
                </div>
            );
        },
    }), [onRowClick, onApprove, onReject, rejectingId, rejectReason, isProcessing]);

    const columns = useMemo(() => [...staticColumns, actionsColumn], [actionsColumn]);

    const table = useReactTable({
        data: schedules,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
        },
    });

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="cursor-pointer"
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {{
                                                asc: <ChevronUp className="h-3 w-3" />,
                                                desc: <ChevronDown className="h-3 w-3" />,
                                            }[header.column.getIsSorted() as string] ?? null}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-32 text-center text-muted-foreground"
                                >
                                    No schedules found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => onRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {schedules.length} results
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{' '}
                        {table.getPageCount() || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
