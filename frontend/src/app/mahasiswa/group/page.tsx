'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, Loader2, UserPlus, X, PlusCircle, BookOpen, PenLine, Info, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner";
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

interface Group {
    id: number;
    status: string;
    assignment_type: string | null;
    title_id: number | null;
    title: {
        title: string;
        quota: number;
        lecturer: {
             name: string;
        }
    } | null;
    members: {
        id: number;
        student: {
            id: number;
            name: string;
            email: string;
        };
        is_leader: boolean;
    }[];
}

export default function MahasiswaGroupPage() {
    const { user } = useAuth();
    const [myGroup, setMyGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leaving, setLeaving] = useState(false);

    const fetchGroup = useCallback(async () => {
        try {
            const response = await api.get('/mahasiswa/group');
            setMyGroup(response.data.group);
        } catch (error) {
            console.error('Failed to fetch group', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGroup();
    }, [fetchGroup]);

    const isLeader = myGroup?.members.some(m => m.is_leader && m.student.id === user?.id);

    const handleCreateGroup = async () => {
        setCreating(true);
        try {
            await api.post('/mahasiswa/group');
            toast.success('Group created! You are the group leader.');
            fetchGroup();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to create group');
            } else {
                toast.error('Failed to create group');
            }
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group? All members will be removed and you can join another group.')) return;
        setDeleting(true);
        try {
            await api.delete('/mahasiswa/group');
            toast.success('Group deleted successfully.');
            setMyGroup(null);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to delete group');
            } else {
                toast.error('Failed to delete group');
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!confirm('Are you sure you want to leave this group?')) return;
        setLeaving(true);
        try {
            await api.post('/mahasiswa/group/leave');
            toast.success('Successfully left the group.');
            fetchGroup();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to leave group');
            } else {
                toast.error('Failed to leave group');
            }
        } finally {
            setLeaving(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/mahasiswa/group/add-member', { email });
            toast.success('Member added successfully!');
            setAddOpen(false);
            setEmail('');
            fetchGroup();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to add member');
            } else {
                toast.error('Failed to add member');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMember = async (memberId: number, memberName: string) => {
        if (!confirm(`Remove ${memberName} from the group?`)) return;
        try {
            await api.delete(`/mahasiswa/group/members/${memberId}`);
            toast.success('Member removed');
            fetchGroup();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to remove member');
            } else {
                toast.error('Failed to remove member');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // No Group — show create group button
    if (!myGroup) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Group</h1>
                    <p className="text-muted-foreground">Create a group to start your capstone journey.</p>
                </div>
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Group Yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Create a group first, then you can add members, bid for a title, or propose your own.
                    </p>
                    <Button onClick={handleCreateGroup} disabled={creating} size="lg">
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Create Group
                    </Button>
                </div>
            </div>
        );
    }

    const minMembers = 3;
    const maxMembers = 4;
    const spotsRemaining = maxMembers - myGroup.members.length;
    const hasTitle = !!myGroup.title_id;
    const hasEnoughMembers = myGroup.members.length >= minMembers;

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'default' as const;
            case 'REJECTED': return 'destructive' as const;
            case 'PENDING': return 'secondary' as const;
            case 'READY_FOR_BIDDING': return 'outline' as const;
            case 'WAITING_SUPERVISOR_APPROVAL': return 'secondary' as const;
            default: return 'outline' as const;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'READY_FOR_BIDDING': return 'Ready for Bidding';
            case 'WAITING_SUPERVISOR_APPROVAL': return 'Waiting Supervisor Approval';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Group</h1>
                    <p className="text-muted-foreground">Manage your thesis group and members.</p>
                </div>
                <div className="flex items-center gap-2">
                    {isLeader && spotsRemaining > 0 && (
                        <Button onClick={() => setAddOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Member
                        </Button>
                    )}
                    {isLeader && myGroup.status === 'READY_FOR_BIDDING' && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteGroup} disabled={deleting}>
                            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Group
                        </Button>
                    )}
                    {!isLeader && !['APPROVED', 'CLOSED'].includes(myGroup.status) && (
                        <Button variant="destructive" size="sm" onClick={handleLeaveGroup} disabled={leaving}>
                            {leaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                            Leave Group
                        </Button>
                    )}
                </div>
            </div>

            {/* Group Info Card */}
            <Card>
                <CardHeader>
                    {hasTitle ? (
                        <>
                            <CardTitle>{myGroup.title!.title}</CardTitle>
                            <CardDescription>Lecturer: {myGroup.title!.lecturer.name}</CardDescription>
                        </>
                    ) : (
                        <>
                            <CardTitle className="text-muted-foreground">No title selected</CardTitle>
                            <CardDescription>Bid for a title or propose your own to get started.</CardDescription>
                        </>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">Status:</span>
                            <Badge variant={getStatusBadgeVariant(myGroup.status)}>
                                {getStatusLabel(myGroup.status)}
                            </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {myGroup.members.length}/{maxMembers} members (min {minMembers})
                        </div>
                    </div>
                    
                    <h3 className="font-semibold mb-3">Members:</h3>
                    <div className="grid gap-3">
                        {myGroup.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{member.student.name}</div>
                                        <div className="text-xs text-muted-foreground">{member.student.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {member.is_leader && <Badge variant="outline">Leader</Badge>}
                                    {isLeader && !member.is_leader && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleRemoveMember(member.id, member.student.name)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                {spotsRemaining > 0 && (
                    <CardFooter className="bg-muted/20 border-t p-6">
                        <p className="text-sm text-muted-foreground">
                            {spotsRemaining} spot{spotsRemaining > 1 ? 's' : ''} remaining. {isLeader ? 'Click "Add Member" to invite students by email.' : 'Ask your group leader to add members.'}
                        </p>
                    </CardFooter>
                )}
            </Card>

            {/* Next Steps — shown only when group has no title */}
            {!hasTitle && myGroup.status === 'READY_FOR_BIDDING' && (
                <>
                {!hasEnoughMembers && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Add More Members</AlertTitle>
                        <AlertDescription>
                            Your group needs at least {minMembers} members before you can bid or propose. Currently {myGroup.members.length}/{minMembers}.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className={`border-dashed border-2 ${!hasEnoughMembers ? 'opacity-60' : ''}`}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BookOpen className="h-5 w-5" /> Bid for a Title
                            </CardTitle>
                            <CardDescription>Browse available titles from lecturers and bid for one.</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="outline" className="w-full" asChild disabled={!hasEnoughMembers}>
                                <Link href="/mahasiswa/titles">Browse Titles</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                    <Card className={`border-dashed border-2 ${!hasEnoughMembers ? 'opacity-60' : ''}`}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PenLine className="h-5 w-5" /> Propose Your Own
                            </CardTitle>
                            <CardDescription>Submit your own title idea and choose a supervisor.</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="outline" className="w-full" asChild disabled={!hasEnoughMembers}>
                                <Link href="/mahasiswa/propose-title">Propose Title</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                </>)}


            {/* Add Member Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleAddMember}>
                        <DialogHeader>
                            <DialogTitle>Add Group Member</DialogTitle>
                            <DialogDescription>
                                Enter the student&apos;s email address to add them to your group.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Student Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="student@university.ac.id"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Adding...' : 'Add Member'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
