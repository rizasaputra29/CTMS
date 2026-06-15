'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuditLogs } from '@/features/admin/audit-logs/hooks/use-audit-logs';
import { useExpandableRows } from '@/hooks/use-expandable-rows';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
    Collapsible,
    CollapsibleContent,
} from '@/components/ui/collapsible';
import {
    History,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    CalendarIcon,
    X,
    User,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
} from 'lucide-react';
import type { AuditLog } from '@/features/admin/audit-logs/types';

const getActionBadgeVariant = (action: string) => {
    const actionColors: Record<string, string> = {
        'CREATE': 'bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20',
        'UPDATE': 'bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-500/20',
        'DELETE': 'bg-red-500/10 text-red-700 border-red-200 hover:bg-red-500/20',
        'APPROVE': 'bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20',
        'REJECT': 'bg-orange-500/10 text-orange-700 border-orange-200 hover:bg-orange-500/20',
        'ASSIGN': 'bg-purple-500/10 text-purple-700 border-purple-200 hover:bg-purple-500/20',
        'SUBMIT': 'bg-cyan-500/10 text-cyan-700 border-cyan-200 hover:bg-cyan-500/20',
        'UPLOAD': 'bg-indigo-500/10 text-indigo-700 border-indigo-200 hover:bg-indigo-500/20',
        'LOGIN': 'bg-gray-500/10 text-gray-700 border-gray-200 hover:bg-gray-500/20',
        'LOGOUT': 'bg-gray-500/10 text-gray-700 border-gray-200 hover:bg-gray-500/20',
        'EXPORT': 'bg-teal-500/10 text-teal-700 border-teal-200 hover:bg-teal-500/20',
        'IMPORT': 'bg-violet-500/10 text-violet-700 border-violet-200 hover:bg-violet-500/20',
        'FLAG': 'bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/20',
        'UNFLAG': 'bg-yellow-500/10 text-yellow-700 border-yellow-200 hover:bg-yellow-500/20',
    };

    const prefix = action.split('_').pop();
    if (prefix && actionColors[prefix]) {
        return actionColors[prefix];
    }

    if (action.includes('CREATE') || action.includes('ADD')) {
        return actionColors['CREATE'];
    }
    if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('MODIFY')) {
        return actionColors['UPDATE'];
    }
    if (action.includes('DELETE') || action.includes('REMOVE')) {
        return actionColors['DELETE'];
    }
    if (action.includes('APPROVE') || action.includes('ACCEPT')) {
        return actionColors['APPROVE'];
    }
    if (action.includes('REJECT') || action.includes('DENY')) {
        return actionColors['REJECT'];
    }

    return 'bg-slate-500/10 text-slate-700 border-slate-200 hover:bg-slate-500/20';
};

const formatDateTime = (dateString: string) => {
    try {
        return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
    } catch {
        return dateString;
    }
};

const getTargetLink = (log: AuditLog) => {
    if (log.target_type === 'App\\Models\\User' || log.target_type === 'User') {
        return '/admin/users';
    }
    if (log.target_type === 'App\\Models\\Group' || log.target_type === 'Group') {
        return `/admin/groups/${log.target_id}`;
    }
    return null;
};

const formatPayload = (payload: Record<string, unknown> | null): string => {
    if (!payload) return 'No payload data';
    try {
        return JSON.stringify(payload, null, 2);
    } catch {
        return 'Unable to format payload';
    }
};

export function AuditLogsFeature() {
    const {
        logs,
        pagination,
        isLoading,
        actionTypes,
        periods,
        searchQuery,
        setSearchQuery,
        selectedAction,
        setSelectedAction,
        selectedPeriod,
        setSelectedPeriod,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        handlePageChange,
        handlePerPageChange,
        clearFilters,
        hasActiveFilters,
    } = useAuditLogs();

    const { isExpanded, toggleExpanded } = useExpandableRows<number>();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-muted-foreground text-sm">View and track all system activity logs.</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filters</span>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-8 px-2 text-xs"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear all
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search action, target type, or payload..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Action Type Filter */}
                        <Select value={selectedAction} onValueChange={setSelectedAction}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Action Type</SelectLabel>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    {actionTypes.map((action) => (
                                        <SelectItem key={action} value={action}>
                                            {action}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        {/* Period Filter */}
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="All Periods" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Registration Period</SelectLabel>
                                    <SelectItem value="all">All Periods</SelectItem>
                                    {periods.map((period) => (
                                        <SelectItem key={period.id} value={period.id.toString()}>
                                            {period.name} {period.is_active && '(Active)'}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Date Range:</span>
                        <div className="flex flex-wrap gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'justify-start text-left font-normal',
                                            !dateFrom && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFrom ? format(dateFrom, 'PPP') : 'From date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateFrom}
                                        onSelect={setDateFrom}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            'justify-start text-left font-normal',
                                            !dateTo && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateTo ? format(dateTo, 'PPP') : 'To date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateTo}
                                        onSelect={setDateTo}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {(dateFrom || dateTo) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setDateFrom(undefined);
                                        setDateTo(undefined);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
                <CardHeader className="pb-3 text-sm font-medium border-b bg-muted/30">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span>Total Logs: {pagination.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Per page:</span>
                            <Select
                                value={pagination.per_page.toString()}
                                onValueChange={handlePerPageChange}
                            >
                                <SelectTrigger className="w-[80px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[15, 30, 50, 100].map((option) => (
                                        <SelectItem key={option} value={option.toString()}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <Loading variant="section" />
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            No audit logs found for the selected criteria.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Performed By</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Target Type</TableHead>
                                        <TableHead>Target ID</TableHead>
                                        <TableHead>Period</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => {
                                        const expanded = isExpanded(log.id);
                                        const targetLink = getTargetLink(log);

                                        return (
                                            <Fragment key={log.id}>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => toggleExpanded(log.id)}
                                                >
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(log.id);
                                                            }}
                                                        >
                                                            {expanded ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-sm whitespace-nowrap">
                                                        {formatDateTime(log.created_at)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.user ? (
                                                            <div className="flex flex-col">
                                                                <Link
                                                                    href="/admin/users"
                                                                    className="font-medium text-sm hover:underline text-primary"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <span className="flex items-center gap-1">
                                                                        <User className="h-3 w-3" />
                                                                        {log.user.name}
                                                                    </span>
                                                                </Link>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {log.user.email}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                System
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'font-medium',
                                                                getActionBadgeVariant(log.action)
                                                            )}
                                                        >
                                                            {log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {log.target_type?.split('\\').pop()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {targetLink ? (
                                                            <Link
                                                                href={targetLink}
                                                                className="text-sm font-medium hover:underline text-primary flex items-center gap-1"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {log.target_id}
                                                                <ExternalLink className="h-3 w-3" />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-sm font-medium">
                                                                {log.target_id}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.period_name ? (
                                                            <span className="text-xs text-muted-foreground">
                                                                {log.period_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded Row - Payload Details */}
                                                {expanded && (
                                                    <TableRow className="bg-muted/30 hover:bg-inherit">
                                                        <TableCell colSpan={8} className="p-0">
                                                            <Collapsible open={expanded}>
                                                                <CollapsibleContent>
                                                                    <div className="p-4 space-y-3">
                                                                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                                            <History className="h-4 w-4" />
                                                                            Action Details (ID: {log.id})
                                                                        </div>
                                                                        <div className="bg-background rounded-lg border p-4 overflow-x-auto">
                                                                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                                                                {formatPayload(log.payload)}
                                                                            </pre>
                                                                        </div>
                                                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                                                            <span>Raw Action: {log.action}</span>
                                                                            <span>|</span>
                                                                            <span>Raw Target: {log.target_type}</span>
                                                                            <span>|</span>
                                                                            <span>Created: {log.created_at}</span>
                                                                        </div>
                                                                    </div>
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            <div className="border-t px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <p className="text-sm text-muted-foreground">
                                    Showing {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} logs
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(pagination.current_page - 1)}
                                        disabled={pagination.current_page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <span className="text-sm text-muted-foreground px-2">
                                        Page {pagination.current_page} of {pagination.last_page}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(pagination.current_page + 1)}
                                        disabled={pagination.current_page === pagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
