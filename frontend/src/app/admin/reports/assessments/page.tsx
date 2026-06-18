'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useReportsPeriods, useAssessmentsReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { AssessmentTable } from '@/features/admin/reports/components/AssessmentTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, GraduationCap, Filter } from 'lucide-react';

export default function AssessmentsReportPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialPeriodId = searchParams.get('period_id') || '';

    const { data: periods = [] } = useReportsPeriods();
    const {
        students,
        loading,
        pagination,
        filters,
        setStudentSearch,
        setSortBy,
        setPage,
        setPerPage,
    } = useAssessmentsReport(initialPeriodId);
    const exportMutation = useReportExport('assessments', initialPeriodId);

    const handleExport = async () => {
        if (!initialPeriodId) return;
        exportMutation.mutate({
            sort_by: filters.sortBy,
            ...(filters.studentSearch ? { student_search: filters.studentSearch } : {}),
        });
    };

    const selectedPeriod = periods.find((p) => p.id.toString() === initialPeriodId);

    if (!initialPeriodId) {
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
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Assessment Scores</h1>
                        <p className="text-muted-foreground">Student evaluation status by type.</p>
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
                                {selectedPeriod?.name || `Period ${initialPeriodId}`}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Sort By</Label>
                            <Select value={filters.sortBy} onValueChange={(val) => setSortBy(val as "group" | "name")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="group">Group</SelectItem>
                                    <SelectItem value="name">Student Name</SelectItem>
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
            <AssessmentTable
                students={students}
                loading={loading}
                pagination={pagination}
                search={filters.studentSearch}
                onSearchChange={setStudentSearch}
                sortBy={filters.sortBy}
                onSortByChange={setSortBy}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                onRowClick={(student) =>
                    router.push(`/admin/reports/assessments/student/${student.student_id}?period_id=${initialPeriodId}`)
                }
            />
        </div>
    );
}
