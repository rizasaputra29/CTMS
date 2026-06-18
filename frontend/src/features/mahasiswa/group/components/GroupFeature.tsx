'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, UserPlus, X, PlusCircle, BookOpen, PenLine, Info, Trash2, LogOut } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner";
import { useAuth } from '@/context/AuthContext';
import { addMemberSchema, type AddMemberFormData } from '@/lib/validations/group';
import { getGroupStatusBadgeVariant } from '@/lib/badge-variants';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import type { Group, JoinRequest, NotificationItem } from '../types';

export function GroupFeature() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [myGroup, setMyGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const addMemberForm = useForm<AddMemberFormData>({
        resolver: zodResolver(addMemberSchema),
        mode: 'onBlur',
    });
    const [creating, setCreating] = useState(false);
    const [creatingSolo, setCreatingSolo] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [processingJoinRequest, setProcessingJoinRequest] = useState<number | null>(null);
    const [markingReady, setMarkingReady] = useState(false);
    const [cancellingReady, setCancellingReady] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [notRegistered, setNotRegistered] = useState(false);

    const fetchGroup = useCallback(async () => {
        try {
            const response = await api.get('/mahasiswa/group');
            const data = response.data?.data ?? response.data;
            setMyGroup(data?.group || null);
            setNotRegistered(false);
        } catch (error: unknown) {
            if (api.isAxiosError(error)) {
                const errorMessage = api.getApiErrorMessage(error, '');
                // Check if error is about not being registered
                if (error.response?.status === 404 || 
                    errorMessage.toLowerCase().includes('not registered') ||
                    errorMessage.toLowerCase().includes('belum terdaftar')) {
                    setNotRegistered(true);
                } else {
                    console.error('Failed to fetch group', error);
                    toast.error('Gagal memuat data kelompok. Silakan coba lagi.');
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        fetchGroup();
    }, [authLoading, router, user, fetchGroup]);

    // Fetch join requests if Solo Leader
    const fetchJoinRequests = useCallback(async () => {
        try {
            const response = await api.get('/mahasiswa/join-requests');
            setJoinRequests(response.data?.data || []);
        } catch { /* silent — not a solo leader */ }
    }, []);

    useEffect(() => {
        const soloStatuses = ['FORMING_SOLO', 'FORMING', 'TITLE_APPROVED'];
        if (myGroup?.status && soloStatuses.includes(myGroup.status)) {
            fetchJoinRequests();
        }
    }, [myGroup?.status, fetchJoinRequests]);

    // Listen for withdrawal notifications
    useEffect(() => {
        const checkWithdrawalNotification = async () => {
            try {
                const response = await api.get('/notifications');
                const notifications = response.data?.data ?? response.data ?? [];
                const withdrawalNotif = notifications.find(
                    (n: NotificationItem) => n.type === 'title_approval_withdrawn' && !n.is_read
                );

                if (withdrawalNotif) {
                    toast.warning(withdrawalNotif.message, {
                        action: {
                            label: 'Browse Titles',
                            onClick: () => {
                                window.location.href = '/mahasiswa/titles';
                            },
                        },
                    });
                    
                    // Refresh group to update status
                    fetchGroup();
                }
            } catch {
                // Silently fail on notification check
            }
        };

        // Check once on load
        checkWithdrawalNotification();
    }, [fetchGroup]);

    const handleAcceptJoinRequest = async (requestId: number) => {
        setProcessingJoinRequest(requestId);
        try {
            await api.post(`/mahasiswa/join-requests/${requestId}/accept`);
            toast.success('Request accepted! Student has been added to your group.');
            fetchGroup();
            fetchJoinRequests();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to accept request'));
            } else {
                toast.error('Failed to accept request');
            }
        } finally {
            setProcessingJoinRequest(null);
        }
    };

    const handleRejectJoinRequest = async (requestId: number) => {
        setProcessingJoinRequest(requestId);
        try {
            await api.post(`/mahasiswa/join-requests/${requestId}/reject`);
            toast.success('Request rejected.');
            fetchJoinRequests();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to reject request'));
            } else {
                toast.error('Failed to reject request');
            }
        } finally {
            setProcessingJoinRequest(null);
        }
    };

    const isLeader = myGroup?.members.some(m => m.is_leader && m.student.id === user?.id);

    const handleCreateGroup = async () => {
        setCreating(true);
        try {
            // First, fetch the registered period to ensure we use the correct period_id
            const periodRes = await api.get('/mahasiswa/my-period');
            const periodData = periodRes.data?.data ?? periodRes.data;
            const periodId = periodData?.period?.id;

            if (!periodId) {
                toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                setNotRegistered(true);
                return;
            }

            const response = await api.post('/mahasiswa/group', { period_id: periodId });
            toast.success('Group created! You are the group leader.');

            // Directly use the group data from response to avoid race condition
            const groupResponseData = response.data?.data ?? response.data;
            setMyGroup(groupResponseData?.group || null);
            setNotRegistered(false);

            // Dispatch event to notify other components
            window.dispatchEvent(new Event('group-created'));
        } catch (error) {
            if (api.isAxiosError(error)) {
                const errorMessage = api.getApiErrorMessage(error, '');
                if (errorMessage.toLowerCase().includes('not registered') ||
                    errorMessage.toLowerCase().includes('belum terdaftar')) {
                    toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                    setNotRegistered(true);
                } else {
                    toast.error(api.getApiErrorMessage(error, 'Failed to create group'));
                }
            } else {
                toast.error('Failed to create group');
            }
        } finally {
            setCreating(false);
        }
    };

    const handleCreateSoloGroup = async () => {
        setCreatingSolo(true);
        try {
            // First, fetch the registered period to ensure we use the correct period_id
            const periodRes = await api.get('/mahasiswa/my-period');
            const periodData = periodRes.data?.data ?? periodRes.data;
            const periodId = periodData?.period?.id;

            if (!periodId) {
                toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                setNotRegistered(true);
                return;
            }

            const response = await api.post('/mahasiswa/group/store-solo', { period_id: periodId });
            toast.success('Solo Group created! You can now propose an idea to find members.');

            // Directly use the group data from response to avoid race condition
            const groupResponseData = response.data?.data ?? response.data;
            setMyGroup(groupResponseData?.group || null);
            setNotRegistered(false);

            // Dispatch event to notify other components
            window.dispatchEvent(new Event('group-created'));
        } catch (error) {
            if (api.isAxiosError(error)) {
                const errorMessage = api.getApiErrorMessage(error, '');
                if (errorMessage.toLowerCase().includes('not registered') ||
                    errorMessage.toLowerCase().includes('belum terdaftar')) {
                    toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                    setNotRegistered(true);
                } else {
                    toast.error(api.getApiErrorMessage(error, 'Failed to register as solo seeker'));
                }
            } else {
                toast.error('Failed to register as solo seeker');
            }
        } finally {
            setCreatingSolo(false);
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
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to delete group'));
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
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to leave group'));
            } else {
                toast.error('Failed to leave group');
            }
        } finally {
            setLeaving(false);
        }
    };

    const handleAddMember = async (data: AddMemberFormData) => {
        setSubmitting(true);
        setFormError(null);
        try {
            await api.post('/mahasiswa/group/add-member', { email: data.email });
            toast.success('Member added successfully!');
            setAddOpen(false);
            addMemberForm.reset();
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const message = api.getApiErrorMessage(error, 'Failed to add member');
                setFormError(message);
            } else {
                setFormError('Failed to add member');
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
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to remove member'));
            } else {
                toast.error('Failed to remove member');
            }
        }
    };

    const handleMarkReadyForFinalization = async () => {
        if (!myGroup) return;
        setMarkingReady(true);
        try {
            await api.post(`/mahasiswa/group/mark-ready-for-finalization`, { group_id: myGroup.id });
            toast.success('Kelompok berhasil ditandai siap untuk finalisasi!');
            setConfirmDialogOpen(false);
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Gagal menandai siap finalisasi'));
            } else {
                toast.error('Gagal menandai siap finalisasi');
            }
        } finally {
            setMarkingReady(false);
        }
    };

    const handleCancelFinalization = async () => {
        if (!myGroup) return;
        setCancellingReady(true);
        try {
            await api.post(`/mahasiswa/group/cancel-ready-for-finalization`, { group_id: myGroup.id });
            toast.success('Status siap finalisasi dibatalkan.');
            setCancelDialogOpen(false);
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Gagal membatalkan status'));
            } else {
                toast.error('Gagal membatalkan status');
            }
        } finally {
            setCancellingReady(false);
        }
    };

    if (authLoading || loading) return <Loading variant="section" />;

    // No Group — show create group options
    if (!myGroup) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Group</h1>
                    <p className="text-muted-foreground">Create a group to start your capstone journey.</p>
                </div>

                {notRegistered && (
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Belum Terdaftar</AlertTitle>
                        <AlertDescription>
                            Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu untuk membuat kelompok.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Group Yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        {notRegistered 
                            ? "Anda perlu mendaftar pada suatu periode terlebih dahulu untuk membuat kelompok."
                            : "Pilih cara Anda ingin memulai perjalanan capstone."
                        }
                    </p>
                    
                    {notRegistered ? (
                        <div className="max-w-md mx-auto">
                            <Button asChild size="lg">
                                <Link href="/mahasiswa/registration">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Daftar ke Periode
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
                            <Button 
                                onClick={handleCreateGroup} 
                                disabled={creating || creatingSolo} 
                                size="lg"
                                className="flex-1"
                            >
                                {creating ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Create Group
                            </Button>
                            <Button 
                                onClick={handleCreateSoloGroup} 
                                disabled={creating || creatingSolo} 
                                size="lg" 
                                variant="secondary"
                                className="flex-1"
                            >
                                {creatingSolo ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <BookOpen className="mr-2 h-4 w-4" />}
                                Solo Seeker
                            </Button>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-4">
                        Or <Link href="/mahasiswa/titles" className="underline font-medium text-primary hover:text-primary/80">browse the Titles Marketplace</Link> to find a Solo Seeker&apos;s idea to join.
                    </p>
                </div>
            </div>
        );
    }

    // Fetch from database via myGroup.period
    const minMembers = myGroup.period?.min_group_size ?? 3;
    const maxMembers = myGroup.period?.max_group_size ?? 4;
    const spotsRemaining = maxMembers - myGroup.members.length;
    const hasTitle = !!myGroup.title_id;
    const isSoloSeeker = myGroup.is_solo && ['FORMING_SOLO', 'FORMING', 'TITLE_APPROVED'].includes(myGroup.status);

    const getStatusBadgeVariant = (status: string) => getGroupStatusBadgeVariant(status);

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'APPROVED';
            case 'REJECTED': return 'REJECTED';
            case 'PENDING': return 'PENDING';
            case 'FORMING': return 'FORMING';
            case 'FORMING_SOLO': return 'SOLO SEEKER';
            case 'READY_FOR_BIDDING': return 'READY FOR BIDDING';
            case 'READY_FOR_FINALIZATION': return 'READY FOR FINALIZATION';
            case 'CLOSED': return 'CLOSED';
            default: return status;
        }
    };

    const allowedActions = myGroup.allowed_actions ?? {
        can_add_member: isLeader && spotsRemaining > 0 && myGroup.status !== 'READY_FOR_FINALIZATION',
        can_remove_member: isLeader && myGroup.status !== 'READY_FOR_FINALIZATION',
        can_leave_group: !isLeader && !['APPROVED', 'CLOSED'].includes(myGroup.status),
        can_delete_group: isLeader && ['READY_FOR_BIDDING', 'FORMING', 'FORMING_SOLO', 'TITLE_APPROVED'].includes(myGroup.status),
        can_mark_ready_for_finalization:
            isLeader
            && myGroup.members.length >= minMembers
            && (myGroup.status === 'READY_FOR_BIDDING'
                || myGroup.status === 'TITLE_APPROVED'
                || (myGroup.status === 'FORMING_SOLO' && !!myGroup.title?.id)),
        can_cancel_ready_for_finalization: isLeader && myGroup.status === 'READY_FOR_FINALIZATION',
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Group</h1>
                    <p className="text-muted-foreground">Kelola kelompok dan anggota capstone Anda.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">Group Details</CardTitle>
                            <CardDescription>
                                Status: <Badge variant={getStatusBadgeVariant(myGroup.status)}>{myGroup.status_label || getStatusLabel(myGroup.status)}</Badge>
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {allowedActions.can_delete_group && (
                                <Button variant="destructive" size="sm" onClick={handleDeleteGroup} disabled={deleting}>
                                    {deleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                    Delete Group
                                </Button>
                            )}
                            {allowedActions.can_leave_group && (
                                <Button variant="outline" size="sm" onClick={handleLeaveGroup} disabled={leaving}>
                                    {leaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <LogOut className="h-4 w-4 mr-1" />}
                                    Leave Group
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Title Info */}
                    {myGroup.title ? (
                        <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-start gap-3">
                                <BookOpen className="h-5 w-5 mt-0.5 text-primary" />
                                <div>
                                    <h3 className="font-medium">{myGroup.title.title}</h3>
                                    <p className="text-sm text-muted-foreground">Lecturer: {myGroup.title.lecturer.name}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <PenLine className="h-5 w-5" />
                                <span>No title assigned yet. Browse the <Link href="/mahasiswa/titles" className="underline text-primary">Titles Marketplace</Link> to bid on a title.</span>
                            </div>
                        </div>
                    )}

                    {/* Members List */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium">Members ({myGroup.members.length}/{maxMembers})</h3>
                            {allowedActions.can_add_member && (
                                <Button size="sm" onClick={() => setAddOpen(true)}>
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Add Member
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {myGroup.members.map((member) => (
                                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{member.student.name}</p>
                                            <p className="text-sm text-muted-foreground">{member.student.email}</p>
                                        </div>
                                        {member.is_leader && (
                                            <Badge variant="secondary" className="ml-2">Leader</Badge>
                                        )}
                                    </div>
                                    {allowedActions.can_remove_member && !member.is_leader && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleRemoveMember(member.id, member.student.name)}
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Solo Seeker: Join Requests */}
                    {isSoloSeeker && isLeader && joinRequests.length > 0 && (
                        <div className="border-t pt-6">
                            <h3 className="font-medium mb-4">Join Requests ({joinRequests.length})</h3>
                            <div className="space-y-3">
                                {joinRequests.map((request) => (
                                    <div key={request.id} className="p-4 border rounded-lg bg-muted/30">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-medium">{request.requester.name}</p>
                                                <p className="text-sm text-muted-foreground">{request.requester.email}</p>
                                                {request.message && (
                                                    <p className="text-sm mt-2 italic">&ldquo;{request.message}&rdquo;</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => handleRejectJoinRequest(request.id)}
                                                    disabled={processingJoinRequest === request.id}
                                                >
                                                    {processingJoinRequest === request.id ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : 'Reject'}
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleAcceptJoinRequest(request.id)}
                                                    disabled={processingJoinRequest === request.id}
                                                >
                                                    {processingJoinRequest === request.id ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : 'Accept'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-4 border-t pt-6">
                    {/* Status Messages */}
                    {myGroup.members.length < minMembers && !hasTitle && (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Need More Members</AlertTitle>
                            <AlertDescription>
                                You need at least {minMembers} members to bid on a title. Current: {myGroup.members.length}/{minMembers}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Ready for Finalization Button */}
                    {isLeader && (
                        <div className="w-full">
                            {allowedActions.can_mark_ready_for_finalization && (
                                <Button 
                                    onClick={() => setConfirmDialogOpen(true)} 
                                    className="w-full"
                                    size="lg"
                                >
                                    Mark Ready for Finalization
                                </Button>
                            )}
                            {allowedActions.can_cancel_ready_for_finalization && (
                                <Button 
                                    onClick={() => setCancelDialogOpen(true)} 
                                    variant="outline"
                                    className="w-full"
                                    size="lg"
                                >
                                    Cancel Ready for Finalization
                                </Button>
                            )}
                        </div>
                    )}
                </CardFooter>
            </Card>

            {/* Add Member Dialog */}
            <Dialog open={addOpen} onOpenChange={(open) => {
                setAddOpen(open);
                if (!open) {
                    addMemberForm.reset();
                    setFormError(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                        <DialogDescription>
                            Enter the email address of the student you want to invite.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addMemberForm.handleSubmit(handleAddMember)}>
                        <div className="py-4 space-y-4">
                            {formError && (
                                <Alert variant="destructive">
                                    <AlertDescription>{formError}</AlertDescription>
                                </Alert>
                            )}
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Controller
                                    name="email"
                                    control={addMemberForm.control}
                                    render={({ field, fieldState }) => (
                                        <Input 
                                            id="email" 
                                            type="email" 
                                            placeholder="student@example.com" 
                                            {...field}
                                            data-invalid={fieldState.error ? '' : undefined}
                                            aria-invalid={fieldState.error ? 'true' : 'false'}
                                        />
                                    )}
                                />
                                <FieldError>
                                    {addMemberForm.formState.errors.email?.message}
                                </FieldError>
                            </Field>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" /> : null}
                                Add Member
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Ready Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark Ready for Finalization</DialogTitle>
                        <DialogDescription>
                            This action will mark your group as ready for finalization. You will not be able to add or remove members after this.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleMarkReadyForFinalization} disabled={markingReady}>
                            {markingReady ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" /> : null}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Ready Dialog */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Ready for Finalization</DialogTitle>
                        <DialogDescription>
                            This will cancel your group&apos;s ready for finalization status. You will be able to add or remove members again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCancelFinalization} disabled={cancellingReady} variant="destructive">
                            {cancellingReady ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" /> : null}
                            Confirm Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
