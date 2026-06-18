'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useReportsPeriods, useReportsSummary, useFinalGradesReport, useGroupsReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { FinalGradeTable } from '@/features/admin/reports/components/FinalGradeTable';
import { GroupTable } from '@/features/admin/reports/components/GroupTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Download,
    Loader2,
    Users,
    GraduationCap,
    Star,
    Award,
    FileSpreadsheet,
    Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined || Number.isNaN(score)) return 'text-muted-foreground';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-foreground';
    if (score >= 60) return 'text-foreground';
    return 'text-foreground';
};

const getScoreLabel = (score: number | null | undefined): string => {
    if (score === null || score === undefined || Number.isNaN(score)) return '–';
    return Number(score).toFixed(0);
};

const getStatusBadge = (count: number, total: number) => {
    if (total === 0) return <Badge variant="outline" className="text-[10px]">No Data</Badge>;
    if (count === total) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">Complete</Badge>;
    if (count > 0) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">In Progress</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Not Started</Badge>;
};

interface PhaseCardProps {
    phase: 'pdc1' | 'pdc2' | 'ta';
    title: string;
    assessments: {
        average: number | null | undefined;
        students: number;
        total: number;
    };
    peerReviews?: {
        average: number | null | undefined;
        count: number;
    };
    finalGrades: {
        average: number | null | undefined;
        complete: number;
        total: number;
    };
    selectedPeriod: string;
}

function PhaseCard({
    phase,
    title,
    assessments,
    peerReviews,
    finalGrades,
    selectedPeriod,
}: PhaseCardProps) {
    const router = useRouter();

    const overallAverage = [
        assessments.average,
        peerReviews?.average ?? null,
        finalGrades.average,
    ].filter((s): s is number => s !== null && !Number.isNaN(s));

    const avgScore = overallAverage.length > 0
        ? overallAverage.reduce((a, b) => a + b, 0) / overallAverage.length
        : null;

    return (
        <Card
            className="hover:shadow-md transition-all duration-300 flex flex-col h-full cursor-pointer group border"
            onClick={() => router.push(`/admin/reports/${phase}${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`)}
        >
            <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <CardDescription className="text-xs">
                            Phase Overview
                        </CardDescription>
                    </div>
                    <div className={cn("text-3xl font-bold", getScoreColor(avgScore))}>
                        {getScoreLabel(avgScore)}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
                {/* Assessment Scores */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GraduationCap className="h-4 w-4" />
                            Assessments
                        </div>
                        <div className="font-semibold text-foreground">
                            {getScoreLabel(assessments.average)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                            {assessments.students} of {assessments.total} evaluated
                        </div>
                        {getStatusBadge(assessments.students, assessments.total)}
                    </div>
                </div>

                {/* Peer Reviews - Only for PDC 2 */}
                {peerReviews && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Star className="h-4 w-4" />
                                Peer Reviews
                            </div>
                            <div className="font-semibold text-foreground">
                                {getScoreLabel(peerReviews.average)}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                                {peerReviews.count} reviews submitted
                            </div>
                            <Badge variant={peerReviews.count > 0 ? "default" : "secondary"} className="text-[10px]">
                                {peerReviews.count > 0 ? 'Active' : 'No Data'}
                            </Badge>
                        </div>
                    </div>
                )}

                {/* Final Grades */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Award className="h-4 w-4" />
                            Final Grades
                        </div>
                        <div className="font-semibold text-foreground">
                            {getScoreLabel(finalGrades.average)}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                            {finalGrades.complete} of {finalGrades.total} complete
                        </div>
                        {getStatusBadge(finalGrades.complete, finalGrades.total)}
                    </div>
                </div>

                {/* View Details Button */}
                <div className="mt-auto pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full group-hover:bg-accent"
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        View Phase Details
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ReportsDashboard() {
    const searchParams = useSearchParams();
    const { data: periods = [], isLoading: periodsLoading } = useReportsPeriods();
    const [selectedPeriod, setSelectedPeriod] = useState<string>(searchParams.get('period_id') || '');
    const { data: summary, isLoading: summaryLoading } = useReportsSummary(selectedPeriod || undefined);

    // Final Grades Data
    const {
        grades,
        loading: gradesLoading,
        pagination: gradesPagination,
        filters: gradesFilters,
        setStudentSearch: setGradesStudentSearch,
        setSort: setGradesSort,
        setPage: setGradesPage,
        setPerPage: setGradesPerPage,
    } = useFinalGradesReport(selectedPeriod || undefined);

    // Groups Data
    const {
        groups,
        loading: groupsLoading,
        pagination: groupsPagination,
        filters: groupsFilters,
        setSearchQuery: setGroupsSearch,
        setPage: setGroupsPage,
        setPerPage: setGroupsPerPage,
    } = useGroupsReport(selectedPeriod || undefined);

    const exportMutation = useReportExport('summary', selectedPeriod || undefined);

    const defaultPeriod = periods.length > 0
        ? (periods.find((p) => p.is_active)?.id.toString() || periods[0].id.toString())
        : '';

    useEffect(() => {
        if (defaultPeriod && !selectedPeriod) {
            setSelectedPeriod(defaultPeriod);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultPeriod]);

    const loading = periodsLoading || summaryLoading;
    const downloading = exportMutation.isPending ? 'summary-all' : null;

    const handleExport = (type: 'assessments' | 'peer-reviews' | 'final-grades' | 'groups') => {
        if (!selectedPeriod) return;
        exportMutation.mutate({ type });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                        <p className="text-muted-foreground">View detailed reports and export data.</p>
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="h-100">
                            <CardContent className="p-6">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-8 bg-muted rounded w-1/3"></div>
                                    <div className="h-4 bg-muted rounded w-1/2"></div>
                                    <div className="h-32 bg-muted rounded"></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground">View detailed reports by phase and export data.</p>
                </div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-50">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        {periods.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} {p.is_active && '(Active)'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Phase Cards - Main Row */}
            {summary && (
                <div className="grid gap-6 md:grid-cols-3">
                    {/* PDC 1 Card */}
                    <PhaseCard
                        phase="pdc1"
                        title="PDC 1"
                        assessments={{
                            average: summary.assessments.pdc1_average,
                            students: summary.assessments.pdc1_students,
                            total: summary.assessments.total_students,
                        }}
                        finalGrades={{
                            average: summary.final_grades.pdc1_average,
                            complete: summary.final_grades.pdc1_complete,
                            total: summary.final_grades.total_students,
                        }}
                        selectedPeriod={selectedPeriod}
                    />

                    {/* PDC 2 Card */}
                    <PhaseCard
                        phase="pdc2"
                        title="PDC 2"
                        assessments={{
                            average: summary.assessments.pdc2_average,
                            students: summary.assessments.pdc2_students,
                            total: summary.assessments.total_students,
                        }}
                        peerReviews={{
                            average: summary.peer_reviews.pdc2_average,
                            count: summary.peer_reviews.pdc2_reviews,
                        }}
                        finalGrades={{
                            average: summary.final_grades.pdc2_average,
                            complete: summary.final_grades.pdc2_complete,
                            total: summary.final_grades.total_students,
                        }}
                        selectedPeriod={selectedPeriod}
                    />

                    {/* TA Card */}
                    <PhaseCard
                        phase="ta"
                        title="TA (Tugas Akhir)"
                        assessments={{
                            average: summary.assessments.ta_average,
                            students: summary.assessments.ta_students,
                            total: summary.assessments.total_students,
                        }}
                        finalGrades={{
                            average: summary.final_grades.ta_average,
                            complete: summary.final_grades.ta_complete,
                            total: summary.final_grades.total_students,
                        }}
                        selectedPeriod={selectedPeriod}
                    />
                </div>
            )}

            {/* Final Grades Section - Full Width */}
            {summary && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                <Award className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">Final Grades</h2>
                                <p className="text-sm text-muted-foreground">
                                    Complete grade overview for all phases • {summary.final_grades.total_students} students
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!!downloading}
                                onClick={() => handleExport('final-grades')}
                            >
                                {downloading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Export
                            </Button>
                            <Link href={`/admin/reports/final-grades${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`}>
                                <Button variant="default" size="sm">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Full Report
                                </Button>
                            </Link>
                        </div>
                    </div>

                        <CardContent className="p-0">
                            <FinalGradeTable
                                grades={grades}
                                loading={gradesLoading}
                                pagination={gradesPagination}
                                search={gradesFilters.studentSearch}
                                onSearchChange={setGradesStudentSearch}
                                sortKey={gradesFilters.sortBy}
                                sortDir={gradesFilters.sortDir}
                                onSort={setGradesSort}
                                onPageChange={setGradesPage}
                                onPerPageChange={setGradesPerPage}
                            />
                        </CardContent>
                </div>
            )}

            {/* Groups Section - Full Width */}
            {summary && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-50 text-green-600">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">Group Details</h2>
                                <p className="text-sm text-muted-foreground">
                                    Group composition, supervisors, and statuses • {summary.groups.total_groups} groups
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!!downloading}
                                onClick={() => handleExport('groups')}
                            >
                                {downloading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Export
                            </Button>
                            <Link href={`/admin/reports/groups${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`}>
                                <Button variant="default" size="sm">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Full Report
                                </Button>
                            </Link>
                        </div>
                    </div>

                        <CardContent className="p-0">
                            <GroupTable
                                groups={groups}
                                loading={groupsLoading}
                                pagination={groupsPagination}
                                search={groupsFilters.searchQuery}
                                onSearchChange={setGroupsSearch}
                                onPageChange={setGroupsPage}
                                onPerPageChange={setGroupsPerPage}
                            />
                        </CardContent>
                </div>
            )}

            {/* About Reports */}
            <Card className="bg-muted/30">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-base">About Reports</CardTitle>
                            <CardDescription>
                                All reports are exported as CSV files compatible with Excel and Google Sheets.
                                Data is filtered by the selected period. Click on any phase card above to view detailed reports for that phase.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
