'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useReportsPeriods, useFinalGradesReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { FinalGradeTable } from '@/features/admin/reports/components/FinalGradeTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Award, Filter } from 'lucide-react';
import api from '@/lib/api';

export default function FinalGradesReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id') || '';
    
    const { data: periods = [] } = useReportsPeriods();
    const {
        grades,
        loading,
        pagination,
        filters,
        setGroupId,
        setStatus,
        setStudentSearch,
        setSort,
        setPage,
        setPerPage,
    } = useFinalGradesReport(periodId);
    const exportMutation = useReportExport('final-grades', periodId);
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
            ...(filters.status !== 'all' ? { status: filters.status } : {}),
            ...(filters.studentSearch ? { student_search: filters.studentSearch } : {}),
        });
    };

    const pdc1CompleteCount = grades.filter((g) => g.pdc1_complete).length;
    const pdc2CompleteCount = grades.filter((g) => g.pdc2_complete).length;
    const taCompleteCount = grades.filter((g) => g.ta_complete).length;
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
                        <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Final Grades</h1>
                        <p className="text-muted-foreground">Calculated final grades for all students.</p>
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
            {!loading && grades.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{grades.length}</div>
                            <div className="text-sm text-muted-foreground">Total Students</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-blue-600">{pdc1CompleteCount}</div>
                            <div className="text-sm text-muted-foreground">PDC1 Complete</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-primary-500">{pdc2CompleteCount}</div>
                            <div className="text-sm text-muted-foreground">PDC2 Complete</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-amber-600">{taCompleteCount}</div>
                            <div className="text-sm text-muted-foreground">TA Complete</div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <Label>Status</Label>
                            <Select value={filters.status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="Complete">Complete</SelectItem>
                                    <SelectItem value="Incomplete">Incomplete</SelectItem>
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
            <FinalGradeTable
                grades={grades}
                loading={loading}
                pagination={pagination}
                search={filters.studentSearch}
                onSearchChange={setStudentSearch}
                sortKey={filters.sortBy}
                sortDir={filters.sortDir}
                onSort={setSort}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
            />
        </div>
    );
}
