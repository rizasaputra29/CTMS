'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useReportsPeriods, useGroupsReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { GroupTable } from '@/features/admin/reports/components/GroupTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Users, Filter } from 'lucide-react';

export default function GroupsReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id') || '';
    
    const { data: periods = [] } = useReportsPeriods();
    const {
        groups,
        loading,
        pagination,
        filters,
        setStatus,
        setSearchQuery,
        setPage,
        setPerPage,
    } = useGroupsReport(periodId);
    const exportMutation = useReportExport('groups', periodId);

    const handleExport = async () => {
        if (!periodId) return;
        exportMutation.mutate({
            ...(filters.status !== 'all' ? { status: filters.status } : {}),
            ...(filters.searchQuery ? { search: filters.searchQuery } : {}),
        });
    };

    const selectedPeriod = periods.find((p) => p.id.toString() === periodId);

    const totalMembers = groups.reduce((sum, group) => sum + group.members_count, 0);
    const activeGroups = groups.filter((g) => g.status === 'ACTIVE').length;

    if (!periodId) {
        return (
            <div className="space-y-6">
                <Link href="/admin/reports">
                    <Button variant="ghost" className="pl-0">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Reports
                    </Button>
                </Link>
                <Card>
                    <CardContent className="py-12 text-center">
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Period Selected</h3>
                        <p className="text-muted-foreground">Please select a period from the Reports page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/reports">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Group Details</h1>
                        <p className="text-muted-foreground">Group composition, supervisors, and statuses.</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={exportMutation.isPending}
                >
                    {exportMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                    ) : (
                        <><Download className="mr-2 h-4 w-4" /> Export CSV</>
                    )}
                </Button>
            </div>

            {/* Summary Cards */}
            {!loading && groups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{groups.length}</div>
                            <div className="text-sm text-muted-foreground">Total Groups</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{activeGroups}</div>
                            <div className="text-sm text-muted-foreground">Active Groups</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{totalMembers}</div>
                            <div className="text-sm text-muted-foreground">Total Members</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Period</Label>
                            <div className="text-sm font-medium">
                                {selectedPeriod?.name || `Period ${periodId}`}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={filters.status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Per Page</Label>
                            <Select value={filters.perPage.toString()} onValueChange={(val) => setPerPage(parseInt(val))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <GroupTable
                groups={groups}
                loading={loading}
                pagination={pagination}
                search={filters.searchQuery}
                onSearchChange={setSearchQuery}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
            />
        </div>
    );
}
