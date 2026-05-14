'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Users, Search, Filter, 
    Loader2, MoreHorizontal, Eye, Settings, Calendar, ShieldCheck, Crown,
    ChevronDown, ChevronUp, Mail, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
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

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch periods
            const periodsRes = await api.get('/periods-list');
            setPeriods(periodsRes.data?.data || []);

            // Fetch groups
            const url = selectedPeriod !== 'all' ? `/admin/groups?period_id=${selectedPeriod}` : '/admin/groups';
            const groupsRes = await api.get(url);
            setGroups(groupsRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch groups data', error);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredGroups = groups.filter(group => {
        const matchesSearch = 
            group.members.some(m => m.student.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (group.title?.title.toLowerCase().includes(searchQuery.toLowerCase()) || false);
        return matchesSearch;
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
        // Can delete if period is inactive or group is in early formation stages
        const period = periods.find(p => p.id === group.period_id);
        if (!period) return true; // No period - allow deletion
        if (!period.is_active) return true; // Inactive period - allow deletion
        if (['FORMING', 'FORMING_SOLO'].includes(group.status)) return true; // Early stage in active period
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
            // Remove from local state
            setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
            setDeleteDialogOpen(false);
            setGroupToDelete(null);
        } catch (error: any) {
            console.error('Failed to delete group', error);
            alert(error.response?.data?.message || 'Failed to delete group');
        } finally {
            setDeleteLoading(false);
        }
    };

    const getStatusBadge = (status: string, statusLabel?: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500">Approved</Badge>;
            case 'READY_FOR_BIDDING': return <Badge variant="secondary">Bidding</Badge>;
            case 'FORMING': return <Badge variant="outline">Forming</Badge>;
            case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{statusLabel || status}</Badge>;
        }
    };

    const reasonMap: Record<string, string> = {
        PERIOD_FINALIZED: 'Periode sudah difinalisasi. Aksi finalization untuk grup ini dinonaktifkan.',
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Group Management</h1>
                    <p className="text-muted-foreground text-sm">Monitor all student groups across registration periods.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/finalization">
                        <Button variant="default">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Finalization
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by student name or project title..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Registration Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3 text-sm font-medium border-b bg-muted/30">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>Total Groups: {filteredGroups.length}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            No groups found for the selected criteria.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Group Members</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Project Title</TableHead>
                                    <TableHead>Supervisor(s)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGroups.map((group) => {
                                    const isExpanded = expandedGroups.has(group.id);
                                    const leader = group.members.find(m => m.is_leader);
                                    
                                    return (
                                        <Fragment key={group.id}>
                                            {/* Main Row */}
                                            <TableRow 
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => toggleExpanded(group.id)}
                                            >
                                                <TableCell className="w-10">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 w-8 p-0"
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
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {leader && (
                                                            <div className="text-sm">
                                                                <span className="font-medium">{leader.student.name}</span>
                                                                <span className="text-xs text-muted-foreground ml-2">({leader.student.nim})</span>
                                                                <Badge variant="outline" className="ml-2 text-[10px] h-4">
                                                                    <Crown className="h-3 w-3 mr-1" />
                                                                    Leader
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        <Badge variant="secondary" className="w-fit text-[10px]">
                                                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-medium">{group.period.name}</div>
                                                </TableCell>
                                                <TableCell className="max-w-[250px]">
                                                    <div className="text-sm font-medium line-clamp-2" title={group.title?.title || 'No title assigned'}>
                                                        {group.title?.title || <span className="text-muted-foreground italic">No title assigned</span>}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase mt-1">{group.group_mode}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        {group.supervisions.length > 0 ? group.supervisions.map((s, idx) => (
                                                            <div key={idx} className="text-xs font-medium">S{idx+1}: {s.supervisor.name}</div>
                                                        )) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(group.status, group.status_label)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
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
                                                    <TableCell colSpan={7} className="p-4">
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
                                                                        <Avatar className="h-10 w-10">
                                                                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                                                                {getInitials(member.student.name)}
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
                    )}
                </CardContent>
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
