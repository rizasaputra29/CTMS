'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useStringParam } from '@/hooks/use-params';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    ArrowLeft, Users, BookOpen, GraduationCap, 
    Calendar, Loader2, Mail, User 
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface GroupDetail {
    id: number;
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
        is_leader: boolean 
    }[];
    supervisions: { 
        id: number;
        supervisor: { id: number; name: string; email: string };
        role: string;
    }[];
    created_at: string;
}

export default function GroupDetailPage() {
    const groupId = useStringParam('id');
    
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchGroup = useCallback(async () => {
        if (!groupId) {
            toast.error('Invalid group ID');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await api.get(`/admin/groups/${groupId}`);
            setGroup(response.data.data);
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500">Approved</Badge>;
            case 'READY_FOR_BIDDING': return <Badge variant="secondary">Ready for Bidding</Badge>;
            case 'FORMING': return <Badge variant="outline">Forming</Badge>;
            case 'READY_FOR_FINALIZATION': return <Badge variant="secondary">Ready for Finalization</Badge>;
            case 'KELOMPOK_FINAL': return <Badge className="bg-blue-500">Kelompok Final</Badge>;
            case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Group not found</p>
                <Button variant="outline" className="mt-4" asChild>
                    <Link href="/admin/groups">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Groups
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin/groups">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Group Details</h1>
                        <p className="text-muted-foreground text-sm">
                            Group {group.id} • {group.period.name}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(group.status)}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Group Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Title Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                Project Title
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {group.title ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg">{group.title.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Status: <Badge variant={group.title.supervisor_approval_status === 'APPROVED' ? 'default' : 'secondary'}>
                                                {group.title.supervisor_approval_status}
                                            </Badge>
                                        </p>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Proposed By</p>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{group.title.lecturer.name}</p>
                                                <p className="text-xs text-muted-foreground">{group.title.lecturer.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No title assigned yet</p>
                                    <p className="text-sm">This group is still in bidding phase</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Members Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Group Members
                            </CardTitle>
                            <CardDescription>
                                {group.group_mode} mode • {group.members.length} member(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {group.members.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{member.student.name}</p>
                                                <p className="text-xs text-muted-foreground">{member.student.nim}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {member.is_leader && (
                                                <Badge variant="secondary">Leader</Badge>
                                            )}
                                            <a 
                                                href={`mailto:${member.student.email}`}
                                                className="text-muted-foreground hover:text-primary"
                                            >
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Supervisors & Metadata */}
                <div className="space-y-6">
                    {/* Supervisors Card */}
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
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{supervision.supervisor.name}</p>
                                                <p className="text-xs text-muted-foreground">{supervision.supervisor.email}</p>
                                                <Badge variant="outline" className="mt-1 text-[10px]">
                                                    {supervision.role}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground">
                                    <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No supervisors assigned</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Metadata Card */}
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
                                    <span className="font-mono">#{group.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Period</span>
                                    <span>{group.period.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Mode</span>
                                    <Badge variant="outline">{group.group_mode}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created</span>
                                    <span>{new Date(group.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full" asChild>
                                <Link href={`/admin/finalization?group_id=${group.id}`}>
                                    Manage in Finalization
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={`/admin/schedule?period_id=${group.period_id}`}>
                                    View Schedule
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
