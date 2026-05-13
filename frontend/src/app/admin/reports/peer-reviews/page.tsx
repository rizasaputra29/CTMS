'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
    Star,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface PeerReview {
    id: number;
    raw_score: number;
    score: number;
    comment: string | null;
    created_at: string;
    reviewer: {
        id: number;
        name: string;
    };
    reviewee: {
        id: number;
        name: string;
    };
    group: {
        id: number;
        title: {
            title: string;
        };
    };
    periodIndicator: {
        template: {
            code: string;
            name: string;
            weight: number;
        };
    };
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

const getRawScoreColor = (score: number): string => {
    if (score >= 3) return 'text-emerald-600';
    if (score >= 2) return 'text-amber-600';
    return 'text-red-600';
};

export default function PeerReviewsReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [reviews, setReviews] = useState<PeerReview[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [groupId, setGroupId] = useState('all');
    const [studentSearch, setStudentSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [groups, setGroups] = useState<{id: number, title: {title: string}}[]>([]);

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
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/peer-reviews', { params });
            setReviews(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch peer reviews', error);
            toast.error('Failed to load peer review data');
        } finally {
            setLoading(false);
        }
    }, [periodId, groupId, studentSearch, page, perPage]);

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
            
            if (studentSearch) {
                params.student_search = studentSearch;
            }
            
            const res = await api.get('/admin/reports/peer-reviews', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `peer_reviews_report_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Peer review report downloaded');
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
                        <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Peer Reviews</h1>
                        <p className="text-muted-foreground">Detailed view of peer review submissions.</p>
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
                                            {group.title?.title || `Group ${group.id}`}
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
                                    placeholder="Reviewer or reviewee name..."
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
                            <p className="text-muted-foreground">Loading peer review data...</p>
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="p-8 text-center">
                            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                            <p className="text-muted-foreground">No peer reviews match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Group</TableHead>
                                            <TableHead>Reviewer</TableHead>
                                            <TableHead>Reviewee</TableHead>
                                            <TableHead>Indicator</TableHead>
                                            <TableHead className="text-right">Raw (1-4)</TableHead>
                                            <TableHead className="text-right">Score (0-100)</TableHead>
                                            <TableHead>Comment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reviews.map((review) => (
                                            <TableRow key={review.id}>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(review.created_at).toLocaleDateString('id-ID')}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {review.group?.title?.title || `Group ${review.group?.id}`}
                                                </TableCell>
                                                <TableCell>{review.reviewer?.name || 'N/A'}</TableCell>
                                                <TableCell>{review.reviewee?.name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{review.periodIndicator?.template?.name || 'N/A'}</div>
                                                    <div className="text-xs text-muted-foreground">{review.periodIndicator?.template?.code}</div>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${getRawScoreColor(review.raw_score)}`}>
                                                    {review.raw_score}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${getScoreColor(review.score)}`}>
                                                    {review.score}
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate" title={review.comment || ''}>
                                                    {review.comment || '-'}
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

            {/* Score Legend */}
            <Card className="bg-muted/30">
                <CardContent className="py-4">
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Raw Score (1-4):</span>
                            <span className="text-emerald-600">4 = Excellent</span>
                            <span className="text-blue-600">3 = Good</span>
                            <span className="text-amber-600">2 = Fair</span>
                            <span className="text-red-600">1 = Poor</span>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Converted (0-100):</span>
                            <span className="text-emerald-600">80-100</span>
                            <span className="text-blue-600">70-79</span>
                            <span className="text-amber-600">60-69</span>
                            <span className="text-red-600">&lt;60</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
