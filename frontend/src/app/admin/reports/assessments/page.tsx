'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { 
    ArrowLeft, 
    Download, 
    Loader2, 
    Search,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface AssessmentScore {
    id: number;
    score: number;
    evaluation_type: string;
    notes: string | null;
    created_at: string;
    component: {
        code: string;
        name: string;
        weight: number;
    } | null;
    component_display: {
        code: string;
        name: string;
    } | null;
    periodComponent: {
        template: {
            code: string;
            name: string;
        };
    } | null;
    evaluator: {
        name: string;
    };
    student: {
        name: string;
        nim: string;
    } | null;
    group: {
        id: number;
        title: {
            title: string;
        };
    };
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const EVALUATION_TYPES = [
    { value: 'all', label: 'All Types' },
    { value: 'SEMPRO', label: 'Seminar Proposal (SEMPRO)' },
    { value: 'BIMBINGAN_SEMPRO', label: 'Bimbingan Sempro' },
    { value: 'SIDANG_TA', label: 'Sidang TA' },
    { value: 'BIMBINGAN_TA', label: 'Bimbingan TA' },
    { value: 'EXPO', label: 'Expo' },
    { value: 'MILESTONE', label: 'Milestone' },
    { value: 'NILAI_DOSEN', label: 'Nilai Dosen' },
];

const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

export default function AssessmentsReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [scores, setScores] = useState<AssessmentScore[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [evaluationType, setEvaluationType] = useState('all');
    const [studentSearch, setStudentSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);

    const fetchData = useCallback(async () => {
        if (!periodId) return;
        
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                period_id: periodId,
                page,
                per_page: perPage,
            };
            
            if (evaluationType !== 'all') {
                params.evaluation_type = evaluationType;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/assessments', { params });
            setScores(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch assessments', error);
            toast.error('Failed to load assessment data');
        } finally {
            setLoading(false);
        }
    }, [periodId, evaluationType, studentSearch, page, perPage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = async () => {
        if (!periodId) return;
        setDownloading(true);
        try {
            const params: Record<string, string | number> = {
                period_id: periodId,
                format: 'csv',
            };
            
            if (evaluationType !== 'all') {
                params.evaluation_type = evaluationType;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/assessments', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `assessments_report_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Assessment report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

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
                        <p className="text-muted-foreground">Detailed view of all assessment scores.</p>
                    </div>
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleExport}
                    disabled={downloading}
                >
                    {downloading ? (
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
                            <Label>Evaluation Type</Label>
                            <Select value={evaluationType} onValueChange={(val) => {
                                setEvaluationType(val);
                                setPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EVALUATION_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Name or NIM..."
                                    value={studentSearch}
                                    onChange={(e) => {
                                        setStudentSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Per Page</Label>
                            <Select value={perPage.toString()} onValueChange={(val) => {
                                setPerPage(parseInt(val));
                                setPage(1);
                            }}>
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
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-muted-foreground">Loading assessment data...</p>
                        </div>
                    ) : scores.length === 0 ? (
                        <div className="p-8 text-center">
                            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                            <p className="text-muted-foreground">No assessment scores match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Group</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Evaluator</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Component</TableHead>
                                            <TableHead className="text-right">Score</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {scores.map((score) => (
                                            <TableRow key={score.id}>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(score.created_at).toLocaleDateString('id-ID')}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {score.group?.title?.title || `Group ${score.group?.id}`}
                                                </TableCell>
                                                <TableCell>
                                                    {score.student ? (
                                                        <div>
                                                            <div className="font-medium">{score.student.name}</div>
                                                            <div className="text-xs text-muted-foreground">{score.student.nim}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Group-level</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{score.evaluator?.name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{score.evaluation_type}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {score.component_display?.name || 
                                                         score.component?.name || 
                                                         score.periodComponent?.template?.name || 
                                                         'N/A'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {score.component_display?.code || 
                                                         score.component?.code || 
                                                         score.periodComponent?.template?.code}
                                                    </div>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${getScoreColor(Number(score.score))}`}>
                                                    {Number(score.score).toFixed(1)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {meta && (
                                <div className="flex items-center justify-between px-4 py-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {((meta.current_page - 1) * meta.per_page) + 1} - {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} records
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={meta.current_page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm">
                                            Page {meta.current_page} of {meta.last_page}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                                            disabled={meta.current_page === meta.last_page}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
