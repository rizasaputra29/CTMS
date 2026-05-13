'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    Filter,
    Users,
    ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface EvaluationStatus {
    score: number | null;
    status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
    total_components: number;
    scored_components: number;
}

interface StudentEvaluation {
    student_id: number;
    student_name: string;
    student_nim: string;
    group_id: number;
    group_name: string;
    evaluations: {
        SEMPRO: EvaluationStatus;
        BIMBINGAN_SEMPRO: EvaluationStatus;
        SIDANG_TA: EvaluationStatus;
        BIMBINGAN_TA: EvaluationStatus;
        EXPO: EvaluationStatus;
        MILESTONE: EvaluationStatus;
        NILAI_DOSEN: EvaluationStatus;
    };
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const EVALUATION_TYPES = [
    { key: 'SEMPRO', label: 'SEMPRO' },
    { key: 'BIMBINGAN_SEMPRO', label: 'BIMBINGAN' },
    { key: 'SIDANG_TA', label: 'SIDANG TA' },
    { key: 'BIMBINGAN_TA', label: 'BIMBINGAN TA' },
    { key: 'EXPO', label: 'EXPO' },
    { key: 'MILESTONE', label: 'MILESTONE' },
    { key: 'NILAI_DOSEN', label: 'NILAI DOSEN' },
];

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'COMPLETE':
            return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">Complete</Badge>;
        case 'PARTIAL':
            return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Partial</Badge>;
        case 'NOT_STARTED':
        default:
            return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
    }
};

const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-400';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

export default function AssessmentsReportPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const periodId = searchParams.get('period_id');
    
    const [students, setStudents] = useState<StudentEvaluation[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [studentSearch, setStudentSearch] = useState('');
    const [sortBy, setSortBy] = useState('group');
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
                sort_by: sortBy,
            };
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/student-evaluations-summary', { params });
            setStudents(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch evaluations', error);
            toast.error('Failed to load evaluation data');
        } finally {
            setLoading(false);
        }
    }, [periodId, studentSearch, sortBy, page, perPage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = async () => {
        if (!periodId) return;
        setDownloading(true);
        try {
            const params: Record<string, string> = {
                period_id: periodId,
                sort_by: sortBy,
            };
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/student-evaluations-summary/export', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `student_evaluations_summary_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Evaluation summary exported');
        } catch {
            toast.error('Failed to export');
        } finally {
            setDownloading(false);
        }
    };

    const handleRowClick = (studentId: number) => {
        router.push(`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`);
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
                        <p className="text-muted-foreground">Student evaluation status by type.</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <Label>Sort By</Label>
                            <Select value={sortBy} onValueChange={(val) => {
                                setSortBy(val);
                                setPage(1);
                            }}>
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

                        <div className="space-y-2 flex items-end">
                            <div className="text-sm text-muted-foreground">
                                {meta && (
                                    <span>Showing {students.length} of {meta.total} students</span>
                                )}
                            </div>
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
                            <p className="text-muted-foreground">Loading evaluation data...</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="p-8 text-center">
                            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
                            <p className="text-muted-foreground">No students match your search criteria.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Student</TableHead>
                                        <TableHead className="w-[100px]">Group</TableHead>
                                        {EVALUATION_TYPES.map(type => (
                                            <TableHead key={type.key} className="text-center min-w-[100px]">
                                                <div className="text-xs">{type.label}</div>
                                            </TableHead>
                                        ))}
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow 
                                            key={student.student_id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleRowClick(student.student_id)}
                                        >
                                            <TableCell>
                                                <div className="font-medium">{student.student_name}</div>
                                                <div className="text-xs text-muted-foreground">{student.student_nim}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{student.group_name}</span>
                                            </TableCell>
                                            {EVALUATION_TYPES.map(type => {
                                                const evalData = student.evaluations[type.key as keyof typeof student.evaluations];
                                                return (
                                                    <TableCell key={type.key} className="text-center">
                                                        <div className={`text-lg font-bold ${getScoreColor(evalData?.score)}`}>
                                                            {evalData?.score !== null ? Math.round(evalData.score) : '–'}
                                                        </div>
                                                        <div className="mt-1">
                                                            {getStatusBadge(evalData?.status)}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell>
                                                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    
                    {/* Pagination */}
                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Page {meta.current_page} of {meta.last_page}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                                    disabled={page === meta.last_page || loading}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
