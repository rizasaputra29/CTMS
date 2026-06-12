'use client';

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Users, Search, Filter, 
    MoreHorizontal, Eye, Settings, Calendar, ShieldCheck, Crown,
    ChevronDown, ChevronUp, Mail, Trash2,
    ArrowUpDown, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { toast } from 'sonner';
import { getGroupStatusBadgeVariant } from '@/lib/badge-variants';

interface GroupMember {
    id: number;
    student: { 
        name: string; 
        nim: string;
        email?: string;
    };
    is_leader: boolean;
    joined_at?: string;
}

interface Group {
    id: number;
    status: string;
    group_mode: string;
    period_id: number;
    period: { name: string };
    title: { title: string } | null;
    members: GroupMember[];
    supervisions: { supervisor: { name: string } }[];
    status_label?: string;
    allowed_actions?: {
        can_manage_finalization: boolean;
        reason: string | null;
    };
}

interface PaginationData {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

function avatarColorClass(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function generateInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getStatusLabel(status: string, statusLabel?: string): string {
    const labels: Record<string, string> = {
        'APPROVED': 'Approved',
        'READY_FOR_BIDDING': 'Ready for Bidding',
        'FORMING': 'Forming',
        'FORMING_SOLO': 'Solo Forming',
        'READY_FOR_FINALIZATION': 'Ready for Finalization',
        'KELOMPOK_FINAL': 'Kelompok Final',
        'REJECTED': 'Rejected',
    };
    return labels[status] || statusLabel || status;
}

type SortKey = 'leader' | 'period' | 'title' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('leader');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    
    // Pagination state
    const [pagination, setPagination] = useState<PaginationData>({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });

    const fetchData = useCallback(async (page: number = 1, perPage?: number) => {
        setLoading(true);
        try {
            // Fetch periods
            const periodsRes = await api.get('/periods-list');
            setPeriods(periodsRes.data?.data || []);

            // Fetch groups with pagination
            const params: Record<string, string> = {
                page: page.toString(),
                per_page: (perPage ?? pagination.per_page).toString(),
            };
            
            if (selectedPeriod !== 'all') {
                params.period_id = selectedPeriod;
            }
            
            const groupsRes = await api.get('/admin/groups', { params });
            setGroups(groupsRes.data.data || []);
            setPagination({
                current_page: groupsRes.data.current_page || 1,
                last_page: groupsRes.data.last_page || 1,
                per_page: groupsRes.data.per_page || 10,
                total: groupsRes.data.total || 0,
            });
        } catch (error) {
            console.error('Failed to fetch groups data', error);
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, pagination.per_page]);

    useEffect(() => {
        fetchData(1);
    }, [fetchData]);

    const filteredGroups = groups.filter(group => {
        const matchesSearch = 
            group.members.some(m => m.student.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (group.title?.title.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
            group.period.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const sortedGroups = [...filteredGroups].sort((a, b) => {
        let comparison = 0;
        switch (sortKey) {
            case 'leader':
                const leaderA = a.members.find(m => m.is_leader)?.student.name || '';
                const leaderB = b.members.find(m => m.is_leader)?.student.name || '';
                comparison = leaderA.localeCompare(leaderB);
                break;
            case 'period':
                comparison = a.period.name.localeCompare(b.period.name);
                break;
            case 'title':
                const titleA = a.title?.title || '';
                const titleB = b.title?.title || '';
                comparison = titleA.localeCompare(titleB);
                break;
            case 'status':
                comparison = a.status.localeCompare(b.status);
                break;
        }
        return sortDir === 'asc' ? comparison : -comparison;
    });

    const toggleExpanded = (groupId: number) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    };

    const canDeleteGroup = (group: Group): boolean => {
        const period = periods.find(p => p.id === group.period_id);
        if (!period) return true;
        if (!period.is_active) return true;
        if (['FORMING', 'FORMING_SOLO'].includes(group.status)) return true;
        return false;
    };

    const handleDeleteClick = (group: Group) => {
        setGroupToDelete(group);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!groupToDelete) return;

        setDeleteLoading(true);
        try {
            await api.delete(`/admin/groups/${groupToDelete.id}/force-delete`);
            setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
            setDeleteDialogOpen(false);
            setGroupToDelete(null);
            toast.success('Group deleted successfully');
        } catch (error: unknown) {
            console.error('Failed to delete group', error);
            toast.error('Failed to delete group');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortLabel = () => {
        const labels: Record<SortKey, string> = { 
            leader: 'Group Leader', 
            period: 'Period', 
            title: 'Project Title', 
            status: 'Status' 
        };
        return `${labels[sortKey]} ${sortDir === 'asc' ? '↑' : '↓'}`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const reasonMap: Record<string, string> = {
        PERIOD_FINALIZED: 'Periode sudah difinalisasi.',
    };

    // Pagination handlers
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= pagination.last_page) {
            fetchData(page);
        }
    };

    const handlePerPageChange = (val: string) => {
        const pp = parseInt(val, 10);
        if (!isNaN(pp)) {
            setPagination(prev => ({ ...prev, per_page: pp, current_page: 1 }));
            fetchData(1, pp);
        }
    };

    // Pagination numbers
    const pageNumbers = useMemo(() => {
        const { current_page, last_page } = pagination;
        const pages: (number | string)[] = [];
        if (last_page <= 7) {
            for (let i = 1; i <= last_page; i++) pages.push(i);
        } else {
            if (current_page <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(last_page);
            } else if (current_page >= last_page - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = last_page - 4; i <= last_page; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                pages.push(current_page - 1);
                pages.push(current_page);
                pages.push(current_page + 1);
                pages.push('...');
                pages.push(last_page);
            }
        }
        return pages;
    }, [pagination]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-[32px] font-semibold text-grey-600 leading-tight">
                        Group Management
                    </h1>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Link href="/admin/finalization">
                        <Button size="sm">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Finalization
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Card */}
            <Card className="py-0 gap-0">
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 border-b">
                    <h3 className="text-[20px] leading-[1.4] font-semibold text-[#353849]">
                        Group Table
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search..." 
                                className="pl-9 w-64"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Filter Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="mr-2 h-4 w-4" /> Filter
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Period</div>
                                <DropdownMenuItem onClick={() => setSelectedPeriod('all')} className={selectedPeriod === 'all' ? 'bg-accent' : ''}>
                                    All Periods
                                </DropdownMenuItem>
                                {periods.map(p => (
                                    <DropdownMenuItem 
                                        key={p.id} 
                                        onClick={() => setSelectedPeriod(p.id.toString())}
                                        className={selectedPeriod === p.id.toString() ? 'bg-accent' : ''}
                                    >
                                        {p.name} {p.is_active && "(Active)"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Sort Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> {sortLabel()}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleSort('leader')}>
                                    Group Leader {sortKey === 'leader' && (sortDir === 'asc' ? '↑' : '↓')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSort('period')}>
                                    Period {sortKey === 'period' && (sortDir === 'asc' ? '↑' : '↓')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSort('title')}>
                                    Project Title {sortKey === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSort('status')}>
                                    Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : sortedGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Users className="h-10 w-10 mb-3 opacity-40" />
                            <p className="text-sm font-medium">No groups found</p>
                            <p className="text-xs mt-1">Try adjusting your search or filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent bg-grey-25">
                                        <TableHead className="w-10 text-[#666D80]"></TableHead>
                                        <TableHead className="whitespace-nowrap w-12 text-[#666D80]">No</TableHead>
                                        <TableHead className="whitespace-nowrap text-[#666D80]">Group Leader</TableHead>
                                        <TableHead className="whitespace-nowrap text-[#666D80]">Period</TableHead>
                                        <TableHead className="whitespace-nowrap text-[#666D80]">Project Title</TableHead>
                                        <TableHead className="whitespace-nowrap text-[#666D80]">Supervisors</TableHead>
                                        <TableHead className="whitespace-nowrap text-[#666D80]">Status</TableHead>
                                        <TableHead className="text-right whitespace-nowrap text-[#666D80]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedGroups.map((group, idx) => {
                                        const isExpanded = expandedGroups.has(group.id);
                                        const leader = group.members.find(m => m.is_leader);
                                        const rowNumber = ((pagination.current_page - 1) * pagination.per_page) + idx + 1;
                                        
                                        return (
                                            <Fragment key={group.id}>
                                                {/* Main Row */}
                                                <TableRow 
                                                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => toggleExpanded(group.id)}
                                                >
                                                    <TableCell className="w-10 py-3" onClick={(e) => e.stopPropagation()}>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(group.id);
                                                            }}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm py-3">{rowNumber}</TableCell>
                                                    <TableCell className="py-3">
                                                        {leader ? (
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className={`h-8 w-8 border ${avatarColorClass(leader.student.name)}`}>
                                                                    <AvatarFallback className={`${avatarColorClass(leader.student.name)} font-semibold text-xs`}>
                                                                        {generateInitials(leader.student.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <span className="font-medium text-sm text-foreground">{leader.student.name}</span>
                                                                    <p className="text-xs text-muted-foreground">{leader.student.nim}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">No leader</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground py-3">{group.period.name}</TableCell>
                                                    <TableCell className="max-w-[200px] py-3">
                                                        <div className="text-sm font-medium line-clamp-2" title={group.title?.title || 'No title assigned'}>
                                                            {group.title?.title || <span className="text-muted-foreground italic">No title assigned</span>}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{group.group_mode}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground py-3">
                                                        {group.supervisions.length > 0 
                                                            ? group.supervisions.map((s, idx) => (
                                                                <div key={idx} className="text-xs">{s.supervisor.name}</div>
                                                            )) 
                                                            : <span className="text-xs text-muted-foreground">Not assigned</span>
                                                        }
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge variant={getGroupStatusBadgeVariant(group.status)} className="text-xs font-medium px-2.5 py-0.5">
                                                            {getStatusLabel(group.status, group.status_label)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40">
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/admin/groups/${group.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View Details
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                {(group.allowed_actions?.can_manage_finalization ?? true) ? (
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/admin/finalization?group_id=${group.id}`}>
                                                                            <Settings className="mr-2 h-4 w-4" />
                                                                            Manage Finalization
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem disabled>
                                                                        <Settings className="mr-2 h-4 w-4" />
                                                                        {reasonMap[group.allowed_actions?.reason || ''] || 'Finalization locked'}
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/admin/schedule?period_id=${group.period_id}`}>
                                                                        <Calendar className="mr-2 h-4 w-4" />
                                                                        View Schedule
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {canDeleteGroup(group) ? (
                                                                    <DropdownMenuItem 
                                                                        onClick={() => handleDeleteClick(group)}
                                                                        className="text-destructive focus:text-destructive"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete Group
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem disabled>
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete Group (locked)
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                                
                                                {/* Expanded Row - All Members */}
                                                {isExpanded && (
                                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                        <TableCell colSpan={8} className="p-4">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                                    <Users className="h-4 w-4" />
                                                                    All Members ({group.members.length})
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                    {group.members.map((member) => (
                                                                        <div 
                                                                            key={member.id} 
                                                                            className="flex items-start gap-3 p-3 bg-background rounded-lg border shadow-sm"
                                                                        >
                                                                            <Avatar className={`h-10 w-10 ${avatarColorClass(member.student.name)}`}>
                                                                                <AvatarFallback className={`${avatarColorClass(member.student.name)} font-semibold text-xs`}>
                                                                                    {generateInitials(member.student.name)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <p className="font-medium text-sm truncate">{member.student.name}</p>
                                                                                    {member.is_leader && (
                                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                                                                            <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                                                                                            Leader
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs text-muted-foreground">{member.student.nim}</p>
                                                                                {member.student.email && (
                                                                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                                                                        <Mail className="h-3 w-3" />
                                                                                        {member.student.email}
                                                                                    </p>
                                                                                )}
                                                                                {member.joined_at && (
                                                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                                                        Joined: {formatDate(member.joined_at)}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>

                {/* Pagination */}
                {!loading && sortedGroups.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                                <Select value={String(pagination.per_page)} onValueChange={handlePerPageChange}>
                                    <SelectTrigger className="h-8 w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100].map((n) => (
                                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                                Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} results
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePageChange(pagination.current_page - 1)}
                                disabled={pagination.current_page === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {pageNumbers.map((page, i) => (
                                page === '...' ? (
                                    <span key={`dots-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
                                ) : (
                                    <Button
                                        key={page}
                                        variant={pagination.current_page === page ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-8 w-8 px-0"
                                        onClick={() => handlePageChange(page as number)}
                                    >
                                        {page}
                                    </Button>
                                )
                            ))}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePageChange(pagination.current_page + 1)}
                                disabled={pagination.current_page === pagination.last_page}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete Group #{groupToDelete?.id}? This action cannot be undone.
                            <br /><br />
                            This will:
                            <ul className="list-disc ml-5 mt-2 text-sm text-muted-foreground">
                                <li>Remove all {groupToDelete?.members?.length || 0} member(s) from the group</li>
                                <li>Delete all bids, proposals, and documents</li>
                                <li>Remove supervisor assignments</li>
                                <li>Allow students to register for new periods</li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setGroupToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteConfirm}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete Group'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
