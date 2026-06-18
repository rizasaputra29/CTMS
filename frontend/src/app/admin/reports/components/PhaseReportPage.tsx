'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useReportsPeriods, usePhaseEvaluationsReport, useReportExport } from '@/features/admin/reports/hooks/use-reports';
import { PhaseEvaluationTable } from '@/features/admin/reports/components/PhaseEvaluationTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, GraduationCap, Target } from 'lucide-react';

const phaseConfig = {
    pdc1: {
        title: 'PDC 1',
        description: 'Project Design and Concept 1',
    },
    pdc2: {
        title: 'PDC 2',
        description: 'Project Design and Concept 2',
    },
    ta: {
        title: 'TA (Tugas Akhir)',
        description: 'Final Project / Thesis',
    },
};

export default function PhaseReportPage({
    phase,
    periodId: propPeriodId,
}: {
    phase: 'pdc1' | 'pdc2' | 'ta';
    periodId?: string;
}) {
    const searchParams = useSearchParams();
    const periodId = propPeriodId || searchParams.get('period_id') || '';
    const config = phaseConfig[phase];

    const { data: periods = [] } = useReportsPeriods();

    // Phase Assessment Data
    const {
        students,
        loading: assessmentsLoading,
        pagination: assessmentsPagination,
        filters: assessmentsFilters,
        setStudentSearch: setAssessmentsSearch,
        setSortBy: setAssessmentsSort,
        setPage: setAssessmentsPage,
        setPerPage: setAssessmentsPerPage,
    } = usePhaseEvaluationsReport(periodId, phase);

    const exportMutation = useReportExport('assessments', periodId);
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
                        <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                    <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                        <Target className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
                        <p className="text-muted-foreground">{config.description}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-muted-foreground">Period</div>
                    <div className="font-medium">{selectedPeriod?.name || `Period ${periodId}`}</div>
                </div>
            </div>

            {/* Assessment Scores */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            Assessment Scores
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={exportMutation.isPending}
                            onClick={() => exportMutation.mutate({ phase })}
                        >
                            {exportMutation.isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                            ) : (
                                <><Download className="mr-2 h-4 w-4" /> Export</>
                            )}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <PhaseEvaluationTable
                        phase={phase}
                        students={students}
                        loading={assessmentsLoading}
                        pagination={assessmentsPagination}
                        search={assessmentsFilters.studentSearch}
                        onSearchChange={setAssessmentsSearch}
                        sortBy={assessmentsFilters.sortBy}
                        onSortByChange={setAssessmentsSort}
                        onPageChange={setAssessmentsPage}
                        onPerPageChange={setAssessmentsPerPage}
                        periodId={periodId}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
