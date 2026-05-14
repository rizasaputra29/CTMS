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
    Award,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface FinalGrade {
    student_id: number;
    student_name: string;
    student_nim: string;
    group_id: number;
    group_title: string;
    pdc1_score: number | null;
    pdc2_score: number | null;
    ta_score: number | null;
    pdc1_complete: boolean;
    pdc2_complete: boolean;
    ta_complete: boolean;
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-400';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

export default function FinalGradesReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [grades, setGrades] = useState<FinalGrade[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [groupId, setGroupId] = useState('all');
    const [status, setStatus] = useState('all');
    const [studentSearch, setStudentSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [groups, setGroups] = useState<{id: number, code?: string, title: {title: string}}[]>([]);

    const fetchGroups = useCallback(async () => {
        if (!periodId) return;
        try {
            const res = await api.get('/admin/groups', { params: { period_id: periodId } });
            setGroups(res.data?.groups || []);
        } catch {
            // Silent fail
        }
    }, [periodId]);

    const fetchData = useCallback(async () => {
        if (!periodId) return;
        
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                period_id: periodId,
                page,
                per_page: perPage,
            };
            
            if (groupId !== 'all') {
                params.group_id = groupId;
            }
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/final-grades', { params });
            setGrades(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch final grades', error);
            toast.error('Failed to load final grades');
        } finally {
            setLoading(false);
        }
    }, [periodId, groupId, status, studentSearch, page, perPage]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

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
            
            if (groupId !== 'all') {
                params.group_id = groupId;
            }
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/final-grades/export', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `final_grades_report_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Final grades report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

    // Calculate summary stats
    const pdc1CompleteCount = grades.filter(g => g.pdc1_complete).length;
    const pdc2CompleteCount = grades.filter(g => g.pdc2_complete).length;
    const taCompleteCount = grades.filter(g => g.ta_complete).length;

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
                    disabled={downloading}
                >
                    {downloading ? (
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
                            <div className="text-2xl font-bold text-purple-600">{pdc2CompleteCount}</div>
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
                            <Label>Group</Label>
                            <Select value={groupId} onValueChange={(val) => {
                                setGroupId(val);
                                setPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All groups" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Groups</SelectItem>
                                    {groups.map(group => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.title?.title || group.code || `Group ${group.id}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(val) => {
                                setStatus(val);
                                setPage(1);
                            }}>
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
                            <p className="text-muted-foreground">Loading final grades...</p>
                        </div>
                    ) : grades.length === 0 ? (
                        <div className="p-8 text-center">
                            <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                            <p className="text-muted-foreground">No grades match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Group</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>NIM</TableHead>
                                            <TableHead className="text-right">PDC 1</TableHead>
                                            <TableHead className="text-center">PDC1 Status</TableHead>
                                            <TableHead className="text-right">PDC 2</TableHead>
                                            <TableHead className="text-center">PDC2 Status</TableHead>
                                            <TableHead className="text-right">TA</TableHead>
                                            <TableHead className="text-center">TA Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grades.map((grade) => (
                                            <TableRow key={grade.student_id}>
                                                <TableCell className="font-medium">
                                                    {grade.group_title || `Group ${grade.group_id}`}
                                                </TableCell>
                                                <TableCell className="font-medium">{grade.student_name}</TableCell>
                                                <TableCell className="text-muted-foreground">{grade.student_nim}</TableCell>
                                                <TableCell className={`text-right font-bold ${getScoreColor(grade.pdc1_score)}`}>
                                                    {grade.pdc1_score !== null && !Number.isNaN(grade.pdc1_score) ? Number(grade.pdc1_score).toFixed(1) : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={grade.pdc1_complete ? 'default' : 'secondary'}>
                                                        {grade.pdc1_complete ? 'Complete' : 'Incomplete'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${getScoreColor(grade.pdc2_score)}`}>
                                                    {grade.pdc2_score !== null && !Number.isNaN(grade.pdc2_score) ? Number(grade.pdc2_score).toFixed(1) : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={grade.pdc2_complete ? 'default' : 'secondary'}>
                                                        {grade.pdc2_complete ? 'Complete' : 'Incomplete'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${getScoreColor(grade.ta_score)}`}>
                                                    {grade.ta_score !== null && !Number.isNaN(grade.ta_score) ? Number(grade.ta_score).toFixed(1) : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={grade.ta_complete ? 'default' : 'secondary'}>
                                                        {grade.ta_complete ? 'Complete' : 'Incomplete'}
                                                    </Badge>
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
