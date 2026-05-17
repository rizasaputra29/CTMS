'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
    Download, 
    Loader2, 
    Search,
    Users,
    ChevronLeft,
    ChevronRight,
    Filter,
    TrendingUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    Lock,
    Target,
    GraduationCap,
    FileCheck,
    Calendar,
    ChevronDown,
    ChevronUp,
    BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
}

interface GroupMember {
    id: number;
    student: {
        id: number;
        name: string;
        nim: string;
    };
}

interface ProgressPhase {
    phase: string;
    status: 'locked' | 'unlocked' | 'draft' | 'submitted' | 'revision' | 'completed';
    documents: Array<{
        type: string;
        status: string;
    }>;
}

interface GroupProgress {
    id: number;
    code?: string;
    name: string | null;
    status: string;
    period_id: number;
    period: Period;
    title: {
        id: number;
        title: string;
    } | null;
    supervisor1: {
        id: number;
        name: string;
    } | null;
    supervisor2: {
        id: number;
        name: string;
    } | null;
    members: GroupMember[];
    members_count: number;
    progress: {
        phases: ProgressPhase[];
        current_phase: string | null;
        is_graduated: boolean;
    } | null;
    progress_percentage: number;
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const PHASE_ORDER = ['PDC1', 'SEMPRO', 'PDC2', 'TA_DRAFT', 'EXPO'];

const PHASE_LABELS: Record<string, string> = {
    'PDC1': 'PDC 1',
    'SEMPRO': 'Sempro',
    'PDC2': 'PDC 2',
    'TA_DRAFT': 'TA Draft',
    'EXPO': 'Expo'
};

const STATUS_ORDER = [
    'FORMING',
    'FORMING_SOLO',
    'READY_FOR_BIDDING',
    'TITLE_PROPOSED',
    'TITLE_APPROVED',
    'READY_FOR_FINALIZATION',
    'KELOMPOK_FINAL',
    'PDC1_ACTIVE',
    'READY_FOR_SEMPRO',
    'SEMPRO_DONE',
    'PDC2_ACTIVE',
    'PDC2_READY_FOR_EXPO',
    'EXPO_REGISTERED',
    'EXPO_DONE',
    'READY_FOR_TA_INDIVIDUAL',
    'TA_IN_PROGRESS',
    'CLOSED',
    'DISSOLVED'
];

function getStatusBadge(status: string) {
    const statusConfig: Record<string, { color: string; label: string }> = {
        'FORMING': { color: 'bg-slate-100 text-slate-700', label: 'Forming' },
        'FORMING_SOLO': { color: 'bg-slate-100 text-slate-700', label: 'Solo' },
        'READY_FOR_BIDDING': { color: 'bg-blue-100 text-blue-700', label: 'Ready to Bid' },
        'TITLE_PROPOSED': { color: 'bg-amber-100 text-amber-700', label: 'Title Proposed' },
        'TITLE_APPROVED': { color: 'bg-emerald-100 text-emerald-700', label: 'Title Approved' },
        'READY_FOR_FINALIZATION': { color: 'bg-blue-100 text-blue-700', label: 'Ready Final' },
        'KELOMPOK_FINAL': { color: 'bg-emerald-100 text-emerald-700', label: 'Kelompok Final' },
        'PDC1_ACTIVE': { color: 'bg-cyan-100 text-cyan-700', label: 'PDC1 Active' },
        'READY_FOR_SEMPRO': { color: 'bg-violet-100 text-violet-700', label: 'Ready Sempro' },
        'SEMPRO_DONE': { color: 'bg-violet-100 text-violet-700', label: 'Sempro Done' },
        'PDC2_ACTIVE': { color: 'bg-cyan-100 text-cyan-700', label: 'PDC2 Active' },
        'PDC2_READY_FOR_EXPO': { color: 'bg-pink-100 text-pink-700', label: 'Ready Expo' },
        'EXPO_REGISTERED': { color: 'bg-pink-100 text-pink-700', label: 'Expo Reg' },
        'EXPO_DONE': { color: 'bg-pink-100 text-pink-700', label: 'Expo Done' },
        'READY_FOR_TA_INDIVIDUAL': { color: 'bg-indigo-100 text-indigo-700', label: 'Ready TA' },
        'TA_IN_PROGRESS': { color: 'bg-indigo-100 text-indigo-700', label: 'TA Progress' },
        'CLOSED': { color: 'bg-emerald-100 text-emerald-800', label: 'Closed' },
        'DISSOLVED': { color: 'bg-red-100 text-red-700', label: 'Dissolved' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: status };
    return <Badge className={`${config.color} font-medium text-xs whitespace-nowrap`}>{config.label}</Badge>;
}

function getPhaseIcon(status: string) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
        case 'submitted':
            return <FileCheck className="h-3.5 w-3.5 text-blue-500" />;
        case 'revision':
            return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
        case 'draft':
            return <Clock className="h-3.5 w-3.5 text-slate-400" />;
        case 'unlocked':
            return <Target className="h-3.5 w-3.5 text-cyan-500" />;
        case 'locked':
        default:
            return <Lock className="h-3.5 w-3.5 text-slate-300" />;
    }
}

function getPhaseColor(status: string): string {
    switch (status) {
        case 'completed':
            return 'bg-emerald-500';
        case 'submitted':
            return 'bg-blue-500';
        case 'revision':
            return 'bg-amber-500';
        case 'draft':
            return 'bg-slate-400';
        case 'unlocked':
            return 'bg-cyan-500';
        case 'locked':
        default:
            return 'bg-slate-200';
    }
}

function ProgressBar({ phases, currentPhase: _currentPhase }: { phases: ProgressPhase[]; currentPhase?: string | null }) {
    const completedCount = phases.filter(p => p.status === 'completed').length;
    const totalPhases = phases.length;
    const progress = totalPhases > 0 ? (completedCount / totalPhases) * 100 : 0;
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="w-full">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                {completedCount}/{totalPhases} phases
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-3">
                    <div className="space-y-2">
                        {phases.map((phase) => (
                            <div key={phase.phase} className="flex items-center gap-2">
                                {getPhaseIcon(phase.status)}
                                <span className="text-xs">{PHASE_LABELS[phase.phase] || phase.phase}</span>
                                <span className="text-xs text-muted-foreground capitalize">({phase.status})</span>
                            </div>
                        ))}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function PhaseIndicator({ phases }: { phases: ProgressPhase[] }) {
    return (
        <div className="flex items-center gap-1">
            {PHASE_ORDER.map((phaseName) => {
                const phase = phases.find(p => p.phase === phaseName);
                const status = phase?.status || 'locked';
                
                return (
                    <TooltipProvider key={phaseName}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div 
                                    className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${getPhaseColor(status)}`}
                                >
                                    {phaseName.charAt(0)}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium">{PHASE_LABELS[phaseName]}</p>
                                <p className="text-xs text-muted-foreground capitalize">{status}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
}

export default function ProgressPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    
    const [groups, setGroups] = useState<GroupProgress[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    
    // Filters
    const [selectedPeriod, setSelectedPeriod] = useState<string>(periodId || 'all');
    const [status, setStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    // Fetch periods for filter
    useEffect(() => {
        const fetchPeriods = async () => {
            try {
                const res = await api.get('/admin/periods?per_page=100');
                setPeriods(res.data.data || []);
            } catch (error) {
                console.error('Failed to fetch periods', error);
            }
        };
        fetchPeriods();
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                page,
                per_page: perPage,
            };
            
            if (selectedPeriod !== 'all') {
                params.period_id = selectedPeriod;
            }
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (searchQuery) {
                params.search = searchQuery;
            }
            
            const res = await api.get('/admin/analytics/group-progress', { params });
            setGroups(res.data.data);
            setMeta(res.data.meta);
        } catch (error) {
            console.error('Failed to fetch group progress', error);
            toast.error('Failed to load group progress data');
            // Fallback to regular groups endpoint
            try {
                const fallbackParams: Record<string, string | number> = {
                    page,
                    per_page: perPage,
                };
                if (selectedPeriod !== 'all') {
                    fallbackParams.period_id = selectedPeriod;
                }
                if (status !== 'all') {
                    fallbackParams.status = status;
                }
                if (searchQuery) {
                    fallbackParams.search = searchQuery;
                }
                const res = await api.get('/admin/groups', { params: fallbackParams });
                // Transform data to match expected format
                const transformedData = (res.data.data || []).map((group: GroupProgress) => ({
                    ...group,
                    progress: null,
                    progress_percentage: calculateProgressPercentage(group.status)
                }));
                setGroups(transformedData);
                setMeta(res.data.meta);
            } catch (fallbackError) {
                console.error('Fallback also failed', fallbackError);
            }
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, status, searchQuery, page, perPage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate progress percentage based on status
    function calculateProgressPercentage(status: string): number {
        const statusIndex = STATUS_ORDER.indexOf(status);
        if (statusIndex === -1) return 0;
        return Math.min(Math.round((statusIndex / STATUS_ORDER.length) * 100), 100);
    }

    const toggleRow = (groupId: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedRows(newExpanded);
    };

    const handleExport = async () => {
        setDownloading(true);
        try {
            const params: Record<string, string | number> = {
                format: 'csv',
            };
            
            if (selectedPeriod !== 'all') {
                params.period_id = selectedPeriod;
            }
            
            if (status !== 'all') {
                params.status = status;
            }
            
            if (searchQuery) {
                params.search = searchQuery;
            }
            
            const res = await api.get('/admin/analytics/group-progress', {
                params,
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `group_progress_report.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Progress report downloaded');
        } catch {
            toast.error('Failed to export report');
        } finally {
            setDownloading(false);
        }
    };

    // Calculate summary stats
    const completedGroups = groups.filter(g => g.status === 'CLOSED').length;
    const activeGroups = groups.filter(g => 
        ['PDC1_ACTIVE', 'PDC2_ACTIVE', 'READY_FOR_SEMPRO', 'SEMPRO_DONE', 'READY_FOR_TA_INDIVIDUAL', 'TA_IN_PROGRESS'].includes(g.status)
    ).length;
    const avgProgress = groups.length > 0 
        ? Math.round(groups.reduce((acc, g) => acc + (g.progress_percentage || 0), 0) / groups.length) 
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Group Progress</h1>
                        <p className="text-muted-foreground">Track group progress and status across all periods.</p>
                    </div>
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleExport}
                    disabled={downloading || groups.length === 0}
                >
                    {downloading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                    ) : (
                        <><Download className="mr-2 h-4 w-4" /> Export CSV</>
                    )}
                </Button>
            </div>

            {/* Summary Cards */}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold">{groups.length}</div>
                                    <div className="text-sm text-muted-foreground">Total Groups</div>
                                </div>
                                <Users className="h-8 w-8 text-muted-foreground opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-cyan-600">{activeGroups}</div>
                                    <div className="text-sm text-muted-foreground">Active Groups</div>
                                </div>
                                <TrendingUp className="h-8 w-8 text-cyan-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-emerald-600">{completedGroups}</div>
                                    <div className="text-sm text-muted-foreground">Completed</div>
                                </div>
                                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-blue-600">{avgProgress}%</div>
                                    <div className="text-sm text-muted-foreground">Avg Progress</div>
                                </div>
                                <BarChart3 className="h-8 w-8 text-blue-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Period</Label>
                            <Select value={selectedPeriod} onValueChange={(val) => {
                                setSelectedPeriod(val);
                                setPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All periods" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Periods</SelectItem>
                                    {periods.map((p) => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name} {p.is_active && '(Active)'}
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
                                    <SelectItem value="FORMING">Forming</SelectItem>
                                    <SelectItem value="PDC1_ACTIVE">PDC1 Active</SelectItem>
                                    <SelectItem value="PDC2_ACTIVE">PDC2 Active</SelectItem>
                                    <SelectItem value="READY_FOR_SEMPRO">Ready for Sempro</SelectItem>
                                    <SelectItem value="SEMPRO_DONE">Sempro Done</SelectItem>
                                    <SelectItem value="EXPO_DONE">Expo Done</SelectItem>
                                    <SelectItem value="CLOSED">Closed</SelectItem>
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
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Progress Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-muted-foreground">Loading group progress...</p>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="p-8 text-center">
                            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
                            <p className="text-muted-foreground">No groups match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-10"></TableHead>
                                            <TableHead>Group</TableHead>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead>Phases</TableHead>
                                            <TableHead>Supervisors</TableHead>
                                            <TableHead className="text-right">Members</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groups.map((group) => (
                                            <>
                                                <TableRow 
                                                    key={group.id} 
                                                    className="cursor-pointer hover:bg-muted/30"
                                                    onClick={() => toggleRow(group.id)}
                                                >
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            {expandedRows.has(group.id) ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">
                                                            {group.code || `Group ${group.id}`}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                            {group.title?.title || 'No title assigned'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="text-sm">{group.period?.name || '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(group.status)}</TableCell>
                                                    <TableCell className="w-[180px]">
                                                        {group.progress ? (
                                                            <ProgressBar 
                                                                phases={group.progress.phases} 
                                                                currentPhase={group.progress.current_phase} 
                                                            />
                                                        ) : (
                                                            <div className="w-full">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-medium text-muted-foreground">
                                                                        {group.progress_percentage || 0}%
                                                                    </span>
                                                                </div>
                                                                <Progress value={group.progress_percentage || 0} className="h-2" />
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {group.progress ? (
                                                            <PhaseIndicator phases={group.progress.phases} />
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {group.supervisor1 && (
                                                                <div className="flex items-center gap-1 text-xs">
                                                                    <GraduationCap className="h-3 w-3 text-muted-foreground" />
                                                                    <span className="truncate max-w-[120px]">{group.supervisor1.name}</span>
                                                                </div>
                                                            )}
                                                            {group.supervisor2 && (
                                                                <div className="flex items-center gap-1 text-xs">
                                                                    <GraduationCap className="h-3 w-3 text-muted-foreground" />
                                                                    <span className="truncate max-w-[120px]">{group.supervisor2.name}</span>
                                                                </div>
                                                            )}
                                                            {!group.supervisor1 && !group.supervisor2 && (
                                                                <span className="text-xs text-muted-foreground italic">Not assigned</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className="font-mono">
                                                            {group.members_count}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                                {expandedRows.has(group.id) && (
                                                    <TableRow className="bg-muted/20">
                                                        <TableCell colSpan={8} className="p-4">
                                                            <div className="space-y-4">
                                                                {/* Title Info */}
                                                                {group.title && (
                                                                    <div className="bg-background p-3 rounded-lg border">
                                                                        <h4 className="text-sm font-medium mb-1">Project Title</h4>
                                                                        <p className="text-sm text-muted-foreground">{group.title.title}</p>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Phase Details */}
                                                                {group.progress && (
                                                                    <div className="grid grid-cols-5 gap-2">
                                                                        {group.progress.phases.map((phase) => (
                                                                            <div 
                                                                                key={phase.phase}
                                                                                className={`p-3 rounded-lg border ${
                                                                                    phase.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                                                                                    phase.status === 'submitted' ? 'bg-blue-50 border-blue-200' :
                                                                                    phase.status === 'revision' ? 'bg-amber-50 border-amber-200' :
                                                                                    phase.status === 'unlocked' ? 'bg-cyan-50 border-cyan-200' :
                                                                                    'bg-slate-50 border-slate-200'
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                    {getPhaseIcon(phase.status)}
                                                                                    <span className="text-xs font-medium">{PHASE_LABELS[phase.phase]}</span>
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground capitalize">
                                                                                    {phase.status}
                                                                                </div>
                                                                                {phase.documents.length > 0 && (
                                                                                    <div className="mt-2 space-y-1">
                                                                                        {phase.documents.slice(0, 2).map((doc, idx) => (
                                                                                            <div key={idx} className="text-xs text-muted-foreground">
                                                                                                • {doc.type}
                                                                                            </div>
                                                                                        ))}
                                                                                        {phase.documents.length > 2 && (
                                                                                            <div className="text-xs text-muted-foreground">
                                                                                                +{phase.documents.length - 2} more
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Members */}
                                                                <div>
                                                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                                        <Users className="h-4 w-4" />
                                                                        Members ({group.members.length})
                                                                    </h4>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {group.members.map((member) => (
                                                                            <Badge key={member.id} variant="secondary" className="text-xs">
                                                                                {member.student.name}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

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
