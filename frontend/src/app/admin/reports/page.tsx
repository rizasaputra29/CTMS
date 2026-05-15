'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
    Star, 
    Award, 
    FileSpreadsheet,

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
        pdc1_complete: number;
        pdc2_complete: number;
        ta_complete: number;
        top_students: Array<{
            group_id: number;
            group_name: string;
            student_id: number;
            student_name: string;
            student_nim: string;
            pdc1_score: number | null;
            pdc2_score: number | null;
            ta_score: number | null;
            pdc1_complete: boolean;
            pdc2_complete: boolean;
            ta_complete: boolean;
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

const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-400';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

const _getLetterGradeColor = (grade: string): string => {
    switch (grade) {
        case 'A': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'C': return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'D': return 'bg-orange-100 text-orange-800 border-orange-300';
        default: return 'bg-red-100 text-red-800 border-red-300';
    }
};

export default function AdminReportsPage() {
    const router = useRouter();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const selectedPeriodRef = useRef(selectedPeriod);
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        selectedPeriodRef.current = selectedPeriod;
    }, [selectedPeriod]);

    const fetchPeriods = useCallback(async () => {
        try {
            const res = await api.get('/admin/periods');
            const periodsData = res.data?.data || [];
            setPeriods(periodsData);
            const active = periodsData.find((p: Period) => p.is_active);
            if (active && !selectedPeriodRef.current) setSelectedPeriod(active.id.toString());
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
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map(i => (
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
                <div className="grid gap-4 md:grid-cols-3 items-stretch">
                    {/* Assessment Scores Card */}
                    <Card className="hover:shadow-lg transition-shadow flex flex-col h-full">
                        <CardHeader className="pb-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <GraduationCap className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Assessment Scores</CardTitle>
                                    <CardDescription className="text-xs">
                                        {summary.assessments.total_scores} scores
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2 text-center flex-shrink-0">
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    <div className="text-xl font-bold">{summary.assessments.total_students}</div>
                                    <div className="text-xs text-muted-foreground">Students</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    <div className={`text-xl font-bold ${getScoreColor(Number(summary.assessments.average_score))}`}>
                                        {Number(summary.assessments.average_score).toFixed(0)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    <div className="text-xl font-bold">{summary.assessments.total_groups}</div>
                                    <div className="text-xs text-muted-foreground">Groups</div>
                                </div>
                            </div>

                            {/* Top Groups Table */}
                            <div className="flex-1">
                                <h4 className="text-xs font-medium mb-2">Top Groups</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-medium">Group</th>
                                                <th className="px-2 py-1.5 text-center font-medium">#</th>
                                                <th className="px-2 py-1.5 text-right font-medium">Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.assessments.top_groups.map((group, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-2 py-1.5 font-medium truncate max-w-[100px]">{group.group_name}</td>
                                                    <td className="px-2 py-1.5 text-center">{group.student_count}</td>
                                                    <td className={`px-2 py-1.5 text-right font-semibold ${getScoreColor(Number(group.average_score))}`}>
                                                        {Number(group.average_score).toFixed(0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs px-2"
                                    disabled={downloading === 'assessments-all'}
                                    onClick={() => handleExport('assessments', 'all')}
                                >
                                    {downloading === 'assessments-all' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Download className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Export</span>
                                </Button>
                                <Link href={`/admin/reports/assessments${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full text-xs px-2">
                                        <Eye className="h-3 w-3" />
                                        <span className="ml-1">View</span>
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Peer Reviews Card */}
                    <Card className="hover:shadow-lg transition-shadow flex flex-col h-full">
                        <CardHeader className="pb-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
                                    <Star className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Peer Reviews</CardTitle>
                                    <CardDescription className="text-xs">
                                        {summary.peer_reviews.total_reviews} reviews
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-center flex-shrink-0">
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    <div className={`text-xl font-bold ${getScoreColor(Number(summary.peer_reviews.average_score))}`}>
                                        {Number(summary.peer_reviews.average_score).toFixed(0)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg</div>
                                </div>
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    <div className="text-xl font-bold">{summary.peer_reviews.total_groups}</div>
                                    <div className="text-xs text-muted-foreground">Groups</div>
                                </div>
                            </div>

                            {/* Top Groups Table */}
                            <div className="flex-1">
                                <h4 className="text-xs font-medium mb-2">Top Groups</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-medium">Group</th>
                                                <th className="px-2 py-1.5 text-center font-medium">#</th>
                                                <th className="px-2 py-1.5 text-right font-medium">Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.peer_reviews.top_groups.map((group, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-2 py-1.5 font-medium truncate max-w-[100px]">{group.group_name}</td>
                                                    <td className="px-2 py-1.5 text-center">{group.student_count}</td>
                                                    <td className={`px-2 py-1.5 text-right font-semibold ${getScoreColor(Number(group.average_score))}`}>
                                                        {Number(group.average_score).toFixed(0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs px-2"
                                    disabled={downloading === 'peer-reviews-all'}
                                    onClick={() => handleExport('peer-reviews', 'all')}
                                >
                                    {downloading === 'peer-reviews-all' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Download className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Export</span>
                                </Button>
                                <Link href={`/admin/reports/peer-reviews${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full text-xs px-2">
                                        <Eye className="h-3 w-3" />
                                        <span className="ml-1">View</span>
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Final Grades Card */}
                    <Card className="hover:shadow-lg transition-shadow flex flex-col h-full">
                        <CardHeader className="pb-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                    <Award className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Final Grades</CardTitle>
                                    <CardDescription className="text-xs">
                                        {summary.final_grades.total_students} students
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col">
                            {/* Stats - 3 columns for PDC1, PDC2, TA */}
                            <div className="grid grid-cols-3 gap-2 text-center flex-shrink-0">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <div className="text-xl font-bold text-blue-600">{summary.final_grades.pdc1_complete}</div>
                                    <div className="text-xs text-blue-600">PDC1</div>
                                </div>
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <div className="text-xl font-bold text-purple-600">{summary.final_grades.pdc2_complete}</div>
                                    <div className="text-xs text-purple-600">PDC2</div>
                                </div>
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <div className="text-xl font-bold text-amber-600">{summary.final_grades.ta_complete}</div>
                                    <div className="text-xs text-amber-600">TA</div>
                                </div>
                            </div>

                            {/* Top Students Table */}
                            <div className="flex-1">
                                <h4 className="text-xs font-medium mb-2">Top Students</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-medium">Student</th>
                                                <th className="px-2 py-1.5 text-center font-medium">P1</th>
                                                <th className="px-2 py-1.5 text-center font-medium">P2</th>
                                                <th className="px-2 py-1.5 text-center font-medium">TA</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {summary.final_grades.top_students.map((student, idx) => (
                                                <tr 
                                                    key={idx} 
                                                    className="hover:bg-muted/30 cursor-pointer"
                                                    onClick={() => router.push(`/admin/reports/assessments/student/${student.student_id}${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`)}
                                                >
                                                    <td className="px-2 py-1.5">
                                                        <div className="font-medium truncate max-w-[80px]">{student.student_name}</div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[80px]">{student.group_name}</div>
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-center font-semibold ${getScoreColor(student.pdc1_score)}`}>
                                                        {student.pdc1_score !== null && !Number.isNaN(student.pdc1_score) ? Number(student.pdc1_score).toFixed(0) : '–'}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-center font-semibold ${getScoreColor(student.pdc2_score)}`}>
                                                        {student.pdc2_score !== null && !Number.isNaN(student.pdc2_score) ? Number(student.pdc2_score).toFixed(0) : '–'}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-center font-semibold ${getScoreColor(student.ta_score)}`}>
                                                        {student.ta_score !== null && !Number.isNaN(student.ta_score) ? Number(student.ta_score).toFixed(0) : '–'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs px-2"
                                    disabled={downloading === 'final-grades-all'}
                                    onClick={() => handleExport('final-grades', 'all')}
                                >
                                    {downloading === 'final-grades-all' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Download className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Export</span>
                                </Button>
                                <Link href={`/admin/reports/final-grades${selectedPeriod ? `?period_id=${selectedPeriod}` : ''}`} className="flex-1">
                                    <Button variant="default" size="sm" className="w-full text-xs px-2">
                                        <Eye className="h-3 w-3" />
                                        <span className="ml-1">View</span>
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
