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
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { 
    ArrowLeft, 
    Download, 
    Loader2, 
    Search,
    Users,
    ChevronLeft,
    ChevronRight,
    Filter,
    User,
    GraduationCap,
    UserCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface GroupMember {
    id: number;
    is_leader: boolean;
    student: {
        id: number;
        name: string;
        nim: string;
        email: string;
    };
}

interface Group {
    id: number;
    code?: string;
    status: string;
    group_mode: string;
    created_at: string;
    title: {
        id: number;
        title: string;
        description: string | null;
    };
    supervisor1: {
        id: number;
        name: string;
        email: string;
    } | null;
    supervisor2: {
        id: number;
        name: string;
        email: string;
    } | null;
    members: GroupMember[];
    members_count: number;
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export default function GroupsReportPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [groups, setGroups] = useState<Group[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    
    // Filters
    const [status, setStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

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
            
            if (searchQuery) {
                params.search = searchQuery;
            }
            
            const res = await api.get('/admin/reports/groups', { params });
            setGroups(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch groups', error);
            toast.error('Failed to load group data');
        } finally {
            setLoading(false);
        }
    }, [periodId, status, searchQuery, page, perPage]);

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
            
            if (searchQuery) {
                params.search = searchQuery;
            }
            
            const res = await api.get('/admin/reports/groups', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `groups_report_period_${periodId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Groups report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

    // Calculate summary stats
    const totalStudents = groups.reduce((acc, g) => acc + g.members_count, 0);
    const activeGroups = groups.filter(g => g.status === 'ACTIVE').length;

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
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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
                        <h1 className="text-3xl font-bold tracking-tight">Group Details</h1>
                        <p className="text-muted-foreground">Complete group information with members and supervisors.</p>
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
            {!loading && groups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{groups.length}</div>
                            <div className="text-sm text-muted-foreground">Total Groups</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-emerald-600">{activeGroups}</div>
                            <div className="text-sm text-muted-foreground">Active Groups</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-blue-600">{totalStudents}</div>
                            <div className="text-sm text-muted-foreground">Total Students</div>
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
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Group, title, or student..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
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
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Groups List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-muted-foreground">Loading group data...</p>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="p-8 text-center">
                            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
                            <p className="text-muted-foreground">No groups match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <Accordion type="multiple" className="w-full">
                                {groups.map((group) => (
                                    <AccordionItem key={group.id} value={`group-${group.id}`} className="border-b">
                                        <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/50">
                                            <div className="flex items-center gap-4 text-left w-full pr-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{group.code || `Group ${group.id}`}</span>
                                                        <Badge variant={group.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                            {group.status}
                                                        </Badge>
                                                        <Badge variant="outline">{group.group_mode}</Badge>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        {group.title?.title || 'No title'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-4 w-4" />
                                                        {group.members_count} members
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            <div className="space-y-4">
                                                {/* Title Description */}
                                                {group.title?.description && (
                                                    <div className="bg-muted/50 p-3 rounded-lg">
                                                        <p className="text-sm text-muted-foreground">{group.title.description}</p>
                                                    </div>
                                                )}
                                                
                                                {/* Supervisors */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                                            <GraduationCap className="h-4 w-4" />
                                                            Supervisor 1
                                                        </h4>
                                                        {group.supervisor1 ? (
                                                            <div className="bg-muted/50 p-3 rounded-lg">
                                                                <div className="font-medium">{group.supervisor1.name}</div>
                                                                <div className="text-sm text-muted-foreground">{group.supervisor1.email}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground italic">Not assigned</div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                                            <GraduationCap className="h-4 w-4" />
                                                            Supervisor 2
                                                        </h4>
                                                        {group.supervisor2 ? (
                                                            <div className="bg-muted/50 p-3 rounded-lg">
                                                                <div className="font-medium">{group.supervisor2.name}</div>
                                                                <div className="text-sm text-muted-foreground">{group.supervisor2.email}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground italic">Not assigned</div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Members Table */}
                                                <div>
                                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        Members ({group.members.length})
                                                    </h4>
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>NIM</TableHead>
                                                                    <TableHead>Name</TableHead>
                                                                    <TableHead>Email</TableHead>
                                                                    <TableHead>Role</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.members.map((member) => (
                                                                    <TableRow key={member.id}>
                                                                        <TableCell className="font-mono text-sm">{member.student.nim}</TableCell>
                                                                        <TableCell className="font-medium">
                                                                            <div className="flex items-center gap-2">
                                                                                <UserCircle className="h-4 w-4 text-muted-foreground" />
                                                                                {member.student.name}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-sm text-muted-foreground">{member.student.email}</TableCell>
                                                                        <TableCell>
                                                                            {member.is_leader && (
                                                                                <Badge variant="default">Leader</Badge>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>

                            {/* Pagination */}
                            {meta && (
                                <div className="flex items-center justify-between px-4 py-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {((meta.current_page - 1) * meta.per_page) + 1} - {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} groups
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
