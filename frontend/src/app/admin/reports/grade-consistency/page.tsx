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
    GitCompare,
    ChevronLeft,
    ChevronRight,
    Filter,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface GradeConsistencyCheck {
    id: number;
    pdc1_score: number;
    pdc2_score: number;
    deviation: number;
    status: 'CONSISTENT' | 'INCONSISTENT';
    notes: string | null;
    created_at: string;
    checker: {
        name: string;
    } | null;
    student: {
        id: number;
        name: string;
        nim: string;
    } | null;
    group: {
        id: number;
        code?: string;
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

const getDeviationColor = (deviation: number): string => {
    if (deviation <= 10) return 'text-emerald-600';
    if (deviation <= 20) return 'text-amber-600';
    return 'text-red-600';
};

const getStatusBadge = (status: string): { variant: 'default' | 'secondary' | 'destructive', icon: React.ComponentType<{ className?: string }> } => {
    switch (status) {
        case 'CONSISTENT':
            return { variant: 'default', icon: CheckCircle2 };
        case 'INCONSISTENT':
            return { variant: 'destructive', icon: AlertTriangle };
        default:
            return { variant: 'secondary', icon: AlertTriangle };
    }
};

export default function GradeConsistencyReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [checks, setChecks] = useState<GradeConsistencyCheck[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [status, setStatus] = useState('all');
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
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/grade-consistency', { params });
            const responseData = res.data?.data ?? res.data;
            setChecks(Array.isArray(responseData) ? responseData : []);
            setMeta(res.data?.meta);
        } catch (error) {
            console.error('Failed to fetch grade consistency', error);
            toast.error('Failed to load grade consistency data');
        } finally {
            setLoading(false);
        }
    }, [periodId, status, studentSearch, page, perPage]);

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
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/grade-consistency', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `grade_consistency_report_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Grade consistency report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

    // Calculate summary stats
    const consistentCount = checks.filter(c => c.status === 'CONSISTENT').length;
    const inconsistentCount = checks.filter(c => c.status === 'INCONSISTENT').length;

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
                        <GitCompare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Grade Consistency</h1>
                        <p className="text-muted-foreground">PDC1 vs PDC2 deviation analysis.</p>
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
            {!loading && checks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{checks.length}</div>
                            <div className="text-sm text-muted-foreground">Total Checks</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-emerald-600">{consistentCount}</div>
                            <div className="text-sm text-muted-foreground">Consistent</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-red-600">{inconsistentCount}</div>
                            <div className="text-sm text-muted-foreground">Inconsistent</div>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    <SelectItem value="CONSISTENT">Consistent</SelectItem>
                                    <SelectItem value="INCONSISTENT">Inconsistent</SelectItem>
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
                            <p className="text-muted-foreground">Loading grade consistency data...</p>
                        </div>
                    ) : checks.length === 0 ? (
                        <div className="p-8 text-center">
                            <GitCompare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                            <p className="text-muted-foreground">No grade consistency checks match your filters.</p>
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
                                            <TableHead className="text-right">PDC 1</TableHead>
                                            <TableHead className="text-right">PDC 2</TableHead>
                                            <TableHead className="text-right">Deviation</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Checked By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {checks.map((check) => {
                                            const statusBadge = getStatusBadge(check.status);
                                            const StatusIcon = statusBadge.icon;
                                            return (
                                                <TableRow key={check.id}>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDate(check.created_at)}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {check.group?.title?.title || check.group?.code || `Group ${check.group?.id}`}
                                                    </TableCell>
                                                    <TableCell>
                                                        {check.student ? (
                                                            <div>
                                                                <div className="font-medium">{check.student.name}</div>
                                                                <div className="text-xs text-muted-foreground">{check.student.nim}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">Group-level</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">{Number(check.pdc1_score).toFixed(1)}</TableCell>
                                                    <TableCell className="text-right font-medium">{Number(check.pdc2_score).toFixed(1)}</TableCell>
                                                    <TableCell className={`text-right font-bold ${getDeviationColor(check.deviation)}`}>
                                                        {Number(check.deviation).toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusBadge.variant} className="flex items-center gap-1 w-fit">
                                                            <StatusIcon className="h-3 w-3" />
                                                            {check.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {check.checker?.name || 'System'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
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

            {/* Legend */}
            <Card className="bg-muted/30">
                <CardContent className="py-4">
                    <div className="text-sm space-y-2">
                        <p><strong>Deviation Thresholds:</strong></p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li><span className="text-emerald-600 font-medium">≤ 10%</span> - Acceptable deviation (Consistent)</li>
                            <li><span className="text-amber-600 font-medium">11-20%</span> - Moderate deviation (Review recommended)</li>
                            <li><span className="text-red-600 font-medium">&gt; 20%</span> - High deviation (Requires review)</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
