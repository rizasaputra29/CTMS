'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
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
    GitCompare, 
    Star, 
    Award, 
    FileSpreadsheet,

    AlertTriangle,
    CheckCircle2,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Period { 
    id: number; 
    name: string; 
    is_active: boolean; 
}

interface ReportSummary {
    assessments: {
        total_scores: number;
        total_groups: number;
        total_students: number;
        average_score: number;
        top_groups: Array<{
            group_id: number;
            group_name: string;
            student_count: number;
            average_score: number;
        }>;
    };
    peer_reviews: {
        total_reviews: number;
        total_groups: number;
        average_score: number;
        top_groups: Array<{
            group_id: number;
            group_name: string;
            student_count: number;
            average_score: number;
        }>;
    };
    final_grades: {
        total_students: number;
        complete: number;
        incomplete: number;
        top_students: Array<{
            group_id: number;
            group_name: string;
            student_id: number;
            student_name: string;
            student_nim: string;
            final_grade: number;
            letter_grade: string;
            status: string;
        }>;
    };
    grade_consistency: {
        consistent: number;
        inconsistent: number;
        pending: number;
        inconsistent_students: Array<{
            group_id: number;
            group_name: string;
            student_id: number;
            student_name: string;
            pdc1_score: number;
            pdc2_score: number;
            deviation: number;
        }>;
    };
    groups: {
        total_groups: number;
        groups: Array<{
            group_id: number;
            group_name: string;
            status: string;
            member_count: number;
            supervisor_1: string;
            supervisor_2: string;
        }>;
    };
}

const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

const getLetterGradeColor = (grade: string): string => {
    switch (grade) {
        case 'A': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'C': return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'D': return 'bg-orange-100 text-orange-800 border-orange-300';
        default: return 'bg-red-100 text-red-800 border-red-300';
    }
};

export default function AdminReportsPage() {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            const periodsData = res.data?.data || [];
            setPeriods(periodsData);
            const active = periodsData.find((p: Period) => p.is_active);
            if (active && !selectedPeriod) setSelectedPeriod(active.id.toString());
        } catch { /* ignore */ }
    }, []);

    const fetchSummary = useCallback(async () => {
        if (!selectedPeriod) return;
        setLoading(true);
        try {
            const res = await api.get('/admin/reports/summary', {
                params: { period_id: selectedPeriod }
            });
            setSummary(res.data.data);
        } catch (error) {
            console.error('Failed to fetch summary', error);
            toast.error('Failed to load report summary');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);
    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    const handleExport = async (type: string, format: 'all' | 'filtered' = 'all') => {
        if (!selectedPeriod) { toast.error('Please select a period'); return; }
        setDownloading(`${type}-${format}`);
        try {
            const res = await api.get(`/admin/reports/${type}/export`, {
                params: { 
                    period_id: selectedPeriod, 
                    format: 'csv',
                    ...(format === 'filtered' ? { preview_only: true } : {})
                },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_report_period_${selectedPeriod}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${type} report downloaded`);
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(null);
        }
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
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="h-[400px]">
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground">View detailed reports and export data.</p>
                </div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[200px]">
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

            {summary && (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Assessment Scores Card */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <GraduationCap className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Assessment Scores</CardTitle>
                                    <CardDescription className="text-sm">
                                        {summary.assessments.total_scores} scores across {summary.assessments.total_groups} groups
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="text-2xl font-bold">{summary.assessments.total_students}</div>
                                    <div className="text-xs text-muted-foreground">Students</div>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className={`text-2xl font-bold ${getScoreColor(Number(summary.assessments.average_score))}`}>
                                        {Number(summary.assessments.average_score).toFixed(1)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg Score</div>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="text-2xl font-bold">{summary.assessments.total_groups}</div>
                                    <div className="text-xs text-muted-foreground">Groups</div>
                                </div>
                            </div>

                            {/* Top Groups Table */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">Top 5 Groups by Average Score</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Group</th>
                                                <th className="px-3 py-2 text-center font-medium">Students</th>
                                                <th className="px-3 py-2 text-right font-medium">Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.assessments.top_groups.map((group, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-3 py-2 font-medium">{group.group_name}</td>
                                                    <td className="px-3 py-2 text-center">{group.student_count}</td>
                                                    <td className={`px-3 py-2 text-right font-semibold ${getScoreColor(Number(group.average_score))}`}>
                                                        {Number(group.average_score).toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'assessments-all'}
                                    onClick={() => handleExport('assessments', 'all')}
                                >
                                    {downloading === 'assessments-all' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'assessments-filtered'}
                                    onClick={() => handleExport('assessments', 'filtered')}
                                >
                                    {downloading === 'assessments-filtered' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export Filtered
                                </Button>
                                <Link href={`/admin/reports/assessments${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full">
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Peer Reviews Card */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
                                    <Star className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Peer Reviews</CardTitle>
                                    <CardDescription className="text-sm">
                                        {summary.peer_reviews.total_reviews} reviews across {summary.peer_reviews.total_groups} groups
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className={`text-2xl font-bold ${getScoreColor(Number(summary.peer_reviews.average_score))}`}>
                                        {Number(summary.peer_reviews.average_score).toFixed(1)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg Score</div>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="text-2xl font-bold">{summary.peer_reviews.total_groups}</div>
                                    <div className="text-xs text-muted-foreground">Groups</div>
                                </div>
                            </div>

                            {/* Top Groups Table */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">Top 5 Groups by Average Score</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Group</th>
                                                <th className="px-3 py-2 text-center font-medium">Students</th>
                                                <th className="px-3 py-2 text-right font-medium">Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.peer_reviews.top_groups.map((group, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-3 py-2 font-medium">{group.group_name}</td>
                                                    <td className="px-3 py-2 text-center">{group.student_count}</td>
                                                    <td className={`px-3 py-2 text-right font-semibold ${getScoreColor(Number(group.average_score))}`}>
                                                        {Number(group.average_score).toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'peer-reviews-all'}
                                    onClick={() => handleExport('peer-reviews', 'all')}
                                >
                                    {downloading === 'peer-reviews-all' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'peer-reviews-filtered'}
                                    onClick={() => handleExport('peer-reviews', 'filtered')}
                                >
                                    {downloading === 'peer-reviews-filtered' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export Filtered
                                </Button>
                                <Link href={`/admin/reports/peer-reviews${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full">
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Final Grades Card */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                    <Award className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Final Grades</CardTitle>
                                    <CardDescription className="text-sm">
                                        {summary.final_grades.total_students} students | {summary.final_grades.complete} complete
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="text-2xl font-bold">{summary.final_grades.total_students}</div>
                                    <div className="text-xs text-muted-foreground">Total</div>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-lg">
                                    <div className="text-2xl font-bold text-emerald-600">{summary.final_grades.complete}</div>
                                    <div className="text-xs text-emerald-600">Complete</div>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-lg">
                                    <div className="text-2xl font-bold text-amber-600">{summary.final_grades.incomplete}</div>
                                    <div className="text-xs text-amber-600">Incomplete</div>
                                </div>
                            </div>

                            {/* Top Students Table */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">Top 5 Students by Final Grade</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">Student</th>
                                                <th className="px-3 py-2 text-center font-medium">Grade</th>
                                                <th className="px-3 py-2 text-right font-medium">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.final_grades.top_students.map((student, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium">{student.student_name}</div>
                                                        <div className="text-xs text-muted-foreground">{student.group_name}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <Badge className={getLetterGradeColor(student.letter_grade)}>
                                                            {student.letter_grade}
                                                        </Badge>
                                                    </td>
                                                    <td className={`px-3 py-2 text-right font-semibold ${getScoreColor(student.final_grade)}`}>
                                                        {Number(student.final_grade).toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'final-grades-all'}
                                    onClick={() => handleExport('final-grades', 'all')}
                                >
                                    {downloading === 'final-grades-all' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'final-grades-filtered'}
                                    onClick={() => handleExport('final-grades', 'filtered')}
                                >
                                    {downloading === 'final-grades-filtered' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export Filtered
                                </Button>
                                <Link href={`/admin/reports/final-grades${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full">
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Grade Consistency Card */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                                    <GitCompare className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Grade Consistency</CardTitle>
                                    <CardDescription className="text-sm">
                                        PDC1 vs PDC2 comparison
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-emerald-50 rounded-lg">
                                    <div className="text-2xl font-bold text-emerald-600">{summary.grade_consistency.consistent}</div>
                                    <div className="text-xs text-emerald-600">Consistent</div>
                                </div>
                                <div className="p-3 bg-red-50 rounded-lg">
                                    <div className="text-2xl font-bold text-red-600">{summary.grade_consistency.inconsistent}</div>
                                    <div className="text-xs text-red-600">Inconsistent</div>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="text-2xl font-bold">{summary.grade_consistency.pending}</div>
                                    <div className="text-xs text-muted-foreground">Pending</div>
                                </div>
                            </div>

                            {/* Inconsistent Students Table */}
                            {summary.grade_consistency.inconsistent_students.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        Most Inconsistent (Top 5)
                                    </h4>
                                    <div className="border rounded-lg overflow-hidden border-red-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-red-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Student</th>
                                                    <th className="px-3 py-2 text-center font-medium">PDC1</th>
                                                    <th className="px-3 py-2 text-center font-medium">PDC2</th>
                                                    <th className="px-3 py-2 text-right font-medium">Diff</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {summary.grade_consistency.inconsistent_students.map((student, idx) => (
                                                    <tr key={idx} className="hover:bg-muted/30">
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium">{student.student_name}</div>
                                                            <div className="text-xs text-muted-foreground">{student.group_name}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">{Number(student.pdc1_score).toFixed(1)}</td>
                                                        <td className="px-3 py-2 text-center">{Number(student.pdc2_score).toFixed(1)}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                                                            {Number(student.deviation).toFixed(1)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {summary.grade_consistency.inconsistent_students.length === 0 && (
                                <div className="text-center py-6 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                                    <p className="text-sm text-emerald-700">All grades are consistent!</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'grade-consistency-all'}
                                    onClick={() => handleExport('grade-consistency', 'all')}
                                >
                                    {downloading === 'grade-consistency-all' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={downloading === 'grade-consistency-filtered'}
                                    onClick={() => handleExport('grade-consistency', 'filtered')}
                                >
                                    {downloading === 'grade-consistency-filtered' ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Export Filtered
                                </Button>
                                <Link href={`/admin/reports/grade-consistency${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full">
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Groups Card - Full Width */}
            {summary && (
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-50 text-green-600">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Group Details</CardTitle>
                                    <CardDescription className="text-sm">
                                        {summary.groups.total_groups} groups with supervisors and members
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Groups Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Group</th>
                                        <th className="px-4 py-3 text-center font-medium">Status</th>
                                        <th className="px-4 py-3 text-center font-medium">Members</th>
                                        <th className="px-4 py-3 text-left font-medium">Supervisor 1</th>
                                        <th className="px-4 py-3 text-left font-medium">Supervisor 2</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {summary.groups.groups.map((group, idx) => (
                                        <tr key={idx} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 font-medium">{group.group_name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant={group.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                    {group.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">{group.member_count}</td>
                                            <td className="px-4 py-3 text-sm">{group.supervisor_1}</td>
                                            <td className="px-4 py-3 text-sm">{group.supervisor_2}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={downloading === 'groups-all'}
                                onClick={() => handleExport('groups', 'all')}
                            >
                                {downloading === 'groups-all' ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Export All
                            </Button>
                            <Link href={`/admin/reports/groups${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`}>
                                <Button variant="default" size="sm">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
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
                                Data is filtered by the selected period. Export &ldquo;All&rdquo; downloads the complete dataset,
                                while &ldquo;Filtered&rdquo; downloads data matching your current filters.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
