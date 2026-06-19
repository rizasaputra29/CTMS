'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useStringParam } from '@/hooks/use-params';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    ChevronLeft, Users, BookOpen, GraduationCap, 
    Calendar, Loader2, Mail, User, Flag, ShieldCheck,
    ArrowUpDown, MoreHorizontal, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { getGroupStatusBadgeVariant, getSupervisorApprovalBadgeVariant } from '@/lib/badge-variants';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

function avatarColorClass(name: string): string {
    if (!name || typeof name !== 'string') return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function generateInitials(name: string): string {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        'APPROVED': 'Approved',
        'READY_FOR_BIDDING': 'Ready for Bidding',
        'FORMING': 'Forming',
        'FORMING_SOLO': 'Solo Forming',
        'READY_FOR_FINALIZATION': 'Ready for Finalization',
        'KELOMPOK_FINAL': 'Kelompok Final',
        'REJECTED': 'Rejected',
    };
    return labels[status] || status;
}

interface GroupDetail {
    id: number;
    code?: string;
    status: string;
    group_mode: string;
    period_id: number;
    period: { name: string };
    title: { 
        id: number;
        title: string;
        lecturer: { id: number; name: string; email: string };
        supervisor_approval_status: string;
    } | null;
    members: { 
        id: number; 
        student: { id: number; name: string; nim: string; email: string }; 
        is_leader: boolean;
        status?: string;
    }[];
    supervisions: { 
        id: number;
        supervisor: { id: number; name: string; email: string };
        role: string;
    }[];
    created_at: string;
}

export default function GroupDetailClient() {
    const groupId = useStringParam('id');
    
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Flag dialog state
    const [flagDialogOpen, setFlagDialogOpen] = useState(false);
    const [memberToFlag, setMemberToFlag] = useState<GroupDetail['members'][0] | null>(null);
    const [flagReason, setFlagReason] = useState('');
    const [flagLoading, setFlagLoading] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!groupId) {
            toast.error('Invalid group ID');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await api.get(`/admin/groups/${groupId}`);
            setGroup(response.data?.data ?? response.data);
        } catch (error) {
            console.error('Failed to fetch group', error);
            toast.error('Failed to load group details');
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        fetchGroup();
    }, [fetchGroup]);

    // Flag handlers
    const handleFlagClick = (member: GroupDetail['members'][0]) => {
        setMemberToFlag(member);
        setFlagReason('');
        setFlagDialogOpen(true);
    };

    const handleFlagConfirm = async () => {
        if (!memberToFlag || !groupId) return;

        setFlagLoading(true);
        try {
            await api.post(`/dosen/groups/${groupId}/flag-student`, {
                student_id: memberToFlag.student.id,
                reason: flagReason.trim() || undefined
            });

            toast.success(`Successfully flagged ${memberToFlag.student.name}`);
            setFlagDialogOpen(false);
            setMemberToFlag(null);
            setFlagReason('');

            await fetchGroup();
        } catch (error) {
            console.error('Failed to flag student', error);
            toast.error('Failed to flag student. Please try again.');
        } finally {
            setFlagLoading(false);
        }
    };

    const handleFlagCancel = () => {
        setFlagDialogOpen(false);
        setMemberToFlag(null);
        setFlagReason('');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Group not found</p>
                <Button variant="outline" className="mt-4" asChild>
                    <Link href="/admin/groups">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Groups
                    </Link>
                </Button>
            </div>
        );
    }

    const leader = group.members.find(m => m.is_leader);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="border-grey-100 text-grey-600 hover:bg-grey-25"
                        asChild
                    >
                        <Link href="/admin/groups">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Kembali
                        </Link>
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getGroupStatusBadgeVariant(group.status)} className="text-xs font-medium px-2.5 py-0.5">
                        {getStatusLabel(group.status)}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/finalization?group_id=${group.id}`}>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Finalization
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/schedule?period_id=${group.period_id}`}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    View Schedule
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Group Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-[32px] font-semibold text-grey-600 flex items-center gap-3">
                            <span>Group Details</span>
                        </CardTitle>
                        <CardDescription>
                            {group.code || `Group ${group.id}`} • {group.period.name}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Title Section */}
                        <div>
                            <h3 className="text-sm font-medium text-grey-400 mb-2 flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Project Title
                            </h3>
                            {group.title ? (
                                <div className="space-y-3">
                                    <p className="text-lg font-semibold text-grey-600">{group.title.title}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>Proposed by:</span>
                                        <span className="font-medium">{group.title.lecturer.name}</span>
                                    </div>
                                    <Badge variant={getSupervisorApprovalBadgeVariant(group.title.supervisor_approval_status)} className="text-xs border">
                                        {group.title.supervisor_approval_status}
                                    </Badge>
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic">No title assigned yet</p>
                            )}
                        </div>

                        <Separator />

                        {/* Members Section */}
                        <div>
                            <h3 className="text-sm font-medium text-grey-400 mb-3 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Group Members ({group.members.length})
                            </h3>
                            <div className="space-y-3">
                                {group.members.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-grey-25 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Avatar className={`h-10 w-10 ${avatarColorClass(member.student.name)}`}>
                                                <AvatarFallback className={`${avatarColorClass(member.student.name)} font-semibold text-xs`}>
                                                    {generateInitials(member.student.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{member.student.name}</span>
                                                    {member.is_leader && (
                                                        <Badge variant="outline" className="text-[10px] h-5">
                                                            Leader
                                                        </Badge>
                                                    )}
                                                    {member.status === 'flagged' && (
                                                        <Badge variant="destructive" className="text-[10px] h-5">
                                                            Flagged
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{member.student.nim}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a 
                                                href={`mailto:${member.student.email}`}
                                                className="text-muted-foreground hover:text-primary"
                                            >
                                                <Mail className="h-4 w-4" />
                                            </a>
                                            {member.status !== 'flagged' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleFlagClick(member)}
                                                    title="Flag Student"
                                                >
                                                    <Flag className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {/* Supervisors */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <GraduationCap className="h-5 w-5" />
                                Supervisors
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {group.supervisions.length > 0 ? (
                                <div className="space-y-4">
                                    {group.supervisions.map((supervision) => (
                                        <div key={supervision.id} className="flex items-center gap-3">
                                            <Avatar className={`h-10 w-10 ${avatarColorClass(supervision.supervisor.name)}`}>
                                                <AvatarFallback className={`${avatarColorClass(supervision.supervisor.name)} font-semibold text-xs`}>
                                                    {generateInitials(supervision.supervisor.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{supervision.supervisor.name}</p>
                                                <Badge variant="outline" className="mt-1 text-[10px]">
                                                    {supervision.role}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No supervisors assigned</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Group Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Group Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Group ID</span>
                                    <span className="font-mono">{group.code || `#${group.id}`}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Period</span>
                                    <span>{group.period.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Mode</span>
                                    <Badge variant="outline" className="text-xs">{group.group_mode}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created</span>
                                    <span>{formatDate(group.created_at)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full" asChild>
                                <Link href={`/admin/finalization?group_id=${group.id}`}>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Manage Finalization
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={`/admin/schedule?period_id=${group.period_id}`}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    View Schedule
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Flag Student Dialog */}
            <AlertDialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Flag Student</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to flag <strong>{memberToFlag?.student.name}</strong> from this group?
                            <br /><br />
                            This will disable evaluation access for this student.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <label htmlFor="flag-reason" className="text-sm font-medium mb-2 block">
                            Reason (optional)
                        </label>
                        <Textarea
                            id="flag-reason"
                            placeholder="Enter reason for flagging this student..."
                            value={flagReason}
                            onChange={(e) => setFlagReason(e.target.value)}
                            maxLength={500}
                            className="resize-none"
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {flagReason.length}/500 characters
                        </p>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleFlagCancel} disabled={flagLoading}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleFlagConfirm}
                            disabled={flagLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {flagLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Flagging...
                                </>
                            ) : (
                                'Flag Student'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
