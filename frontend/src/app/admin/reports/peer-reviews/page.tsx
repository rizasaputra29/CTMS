'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useReportsPeriods, usePeerReviewsReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { PeerReviewTable } from '@/features/admin/reports/components/PeerReviewTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Star, Filter } from 'lucide-react';
import api from '@/lib/api';

export default function PeerReviewsReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id') || '';
    
    const { data: periods = [] } = useReportsPeriods();
    const {
        reviews,
        loading,
        pagination,
        filters,
        setGroupId,
        setStudentSearch,
        setSort,
        setPage,
        setPerPage,
    } = usePeerReviewsReport(periodId);
    const exportMutation = useReportExport('peer-reviews', periodId);
    const [groups, setGroups] = useState<Array<{ id: number; code?: string; title: { title: string } }>>([]);

    useEffect(() => {
        if (!periodId) return;
        api.get('/admin/groups', { params: { period_id: periodId } })
            .then((res) => setGroups(res.data?.groups || []))
            .catch(() => {
                // Silent fail
            });
    }, [periodId]);

    const handleExport = async () => {
        if (!periodId) return;
        exportMutation.mutate({
            ...(filters.groupId !== 'all' ? { group_id: filters.groupId } : {}),
            ...(filters.studentSearch ? { student_search: filters.studentSearch } : {}),
        });
    };

    const selectedPeriod = periods.find((p) => p.id.toString() === periodId);

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
                        <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Peer Reviews</h1>
                        <p className="text-muted-foreground">Peer assessment results by period.</p>
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
                            <Label>Group</Label>
                            <Select value={filters.groupId} onValueChange={setGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All groups" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Groups</SelectItem>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.title?.title || group.code || `Group ${group.id}`}
                                        </SelectItem>
                                    ))}
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
            <PeerReviewTable
                reviews={reviews}
                loading={loading}
                pagination={pagination}
                search={filters.studentSearch}
                onSearchChange={setStudentSearch}
                sortBy={filters.sortBy}
                sortOrder={filters.sortOrder}
                onSortChange={setSort}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
            />
        </div>
    );
}
