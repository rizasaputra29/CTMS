'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, Loader2, UserPlus, X, PlusCircle, BookOpen, PenLine, Info, Trash2, LogOut, Lightbulb, Check, CalendarDays } from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner";
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
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [myGroup, setMyGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [creating, setCreating] = useState(false);
    const [creatingSolo, setCreatingSolo] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [joinRequests, setJoinRequests] = useState<{id: number; status: string; message: string | null; requester: {id: number; name: string; email: string}}[]>([]);
    const [processingJoinRequest, setProcessingJoinRequest] = useState<number | null>(null);
    const [registrationPeriod, setRegistrationPeriod] = useState<{id: number; name: string} | null>(null);
    const [availablePeriods, setAvailablePeriods] = useState<{id: number; name: string; is_active: boolean; is_finalized?: boolean}[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
    const [periodLoading, setPeriodLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [markingReady, setMarkingReady] = useState(false);
    const [cancellingReady, setCancellingReady] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    const selectedPeriodData = availablePeriods.find(p => p.id.toString() === selectedPeriodId);
    const isPeriodFinalized = !!selectedPeriodData && (selectedPeriodData as { is_finalized?: boolean }).is_finalized;

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
        if (authLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        fetchGroup();
        // Fetch all periods to allow selection with status labels
        api.get('/periods-list').then(res => {
            const periods = res.data || [];
            setAvailablePeriods(periods);
            if (periods.length > 0) {
                // Find first active, non-finalized one, or just the first one
                const active = periods.find((p: { is_active: boolean; is_finalized?: boolean }) => p.is_active && !p.is_finalized) || periods[0];
                setSelectedPeriodId(active.id.toString());
                setRegistrationPeriod(active.is_active && !active.is_finalized ? active : null);
            }
        }).catch(() => {}).finally(() => setPeriodLoading(false));
    }, [authLoading, fetchGroup, router, user]);

    useEffect(() => {
        if (selectedPeriodId && !myGroup) {
            api.get(`/mahasiswa/periods/${selectedPeriodId}/check-registration`)
                .then(res => setIsRegistered(res.data.is_registered))
                .catch(() => setIsRegistered(false));
        }
    }, [selectedPeriodId, myGroup]);

    // Fetch join requests if Solo Leader
    const fetchJoinRequests = useCallback(async () => {
        try {
            const response = await api.get('/mahasiswa/join-requests');
            setJoinRequests(response.data.data || []);
        } catch { /* silent — not a solo leader */ }
    }, []);

    useEffect(() => {
        const soloStatuses = ['FORMING_SOLO', 'FORMING'];
        if (myGroup?.status && soloStatuses.includes(myGroup.status)) {
            fetchJoinRequests();
        }
    }, [myGroup?.status, fetchJoinRequests]);

    // Listen for withdrawal notifications
    useEffect(() => {
        const checkWithdrawalNotification = async () => {
            try {
                const response = await api.get('/notifications/unread');
                const withdrawalNotif = response.data?.find(
                    (n: any) => n.type === 'title_approval_withdrawn'
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
            } catch (error) {
                // Silently fail on notification check
            }
        };

        // Check immediately
        checkWithdrawalNotification();
        
        // Then check periodically (every 10 seconds)
        const interval = setInterval(checkWithdrawalNotification, 10000);
        return () => clearInterval(interval);
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
                toast.error(error.response?.data?.message || 'Failed to accept request');
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
                toast.error(error.response?.data?.message || 'Failed to reject request');
            } else {
                toast.error('Failed to reject request');
            }
        } finally {
            setProcessingJoinRequest(null);
        }
    };

    const isLeader = myGroup?.members.some(m => m.is_leader && m.student.id === user?.id);

    const handleCreateGroup = async () => {
        if (!selectedPeriodId) {
            toast.error('Please select a registration period first.');
            return;
        }
        setCreating(true);
        try {
            await api.post('/mahasiswa/group', { period_id: selectedPeriodId });
            toast.success('Group created! You are the group leader.');
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to create group');
            } else {
                toast.error('Failed to create group');
            }
        } finally {
            setCreating(false);
        }
    };

    const handleRegister = async () => {
        if (!selectedPeriodId) return;
        setRegistering(true);
        try {
            await api.post('/mahasiswa/periods/register', { period_id: selectedPeriodId });
            toast.success('Successfully registered for this period!');
            setIsRegistered(true);
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Registration failed');
            } else {
                toast.error('Registration failed');
            }
        } finally {
            setRegistering(false);
        }
    };

    const handleCreateSoloGroup = async () => {
        if (!selectedPeriodId) {
            toast.error('Please select a registration period first.');
            return;
        }
        setCreatingSolo(true);
        try {
            await api.post('/mahasiswa/group/store-solo', { period_id: selectedPeriodId });
            toast.success('Solo Group created! You can now propose an idea to find members.');
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to register as solo seeker');
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
            if (api.isAxiosError(error)) {
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
            if (api.isAxiosError(error)) {
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
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Failed to remove member');
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
                toast.error(error.response?.data?.message || 'Gagal menandai siap finalisasi');
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
            toast.success('Finalisasi berhasil dibatalkan. Kelompok kembali ke status siap bidding.');
            setCancelDialogOpen(false);
            fetchGroup();
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Gagal membatalkan finalisasi');
            } else {
                toast.error('Gagal membatalkan finalisasi');
            }
        } finally {
            setCancellingReady(false);
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
        const noPeriodOpen = !periodLoading && !registrationPeriod;
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Group</h1>
                    <p className="text-muted-foreground">Create a group to start your capstone journey.</p>
                </div>
                {registrationPeriod && (
                    <Alert>
                        <CalendarDays className="h-4 w-4" />
                        <AlertTitle>Periode Pendaftaran Aktif</AlertTitle>
                        <AlertDescription>
                            Anda akan mendaftar ke periode: <strong>{registrationPeriod.name}</strong>
                        </AlertDescription>
                    </Alert>
                )}
                {noPeriodOpen && (
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Pendaftaran Ditutup</AlertTitle>
                        <AlertDescription>
                            Tidak ada periode pendaftaran yang terbuka saat ini. Silakan hubungi admin.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No Group Yet</h2>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                        Pilih periode pendaftaran untuk memulai perjalanan capstone Anda.
                    </p>
                    <div className="max-w-xs mx-auto mb-6">
                        <Label className="mb-2 block text-left">Pilih Periode Registration</Label>
                        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Daftar Periode</SelectLabel>
                                    {availablePeriods.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name} {p.is_active && !p.is_finalized ? "(Open)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {!isRegistered && !isPeriodFinalized && !noPeriodOpen && (
                        <div className="max-w-md mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800 mb-4">
                                Anda belum terdaftar untuk periode ini. Silakan mendaftar terlebih dahulu untuk memulai pengerjaan Tugas Akhir.
                            </p>
                            <Button onClick={handleRegister} disabled={registering} className="w-full bg-amber-600 hover:bg-amber-700">
                                {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Register for Period
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-center gap-4">
                        <Button onClick={handleCreateGroup} disabled={creating || creatingSolo || isPeriodFinalized || noPeriodOpen || !isRegistered} size="lg">
                            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Create Group
                        </Button>
                        <Button onClick={handleCreateSoloGroup} disabled={creating || creatingSolo || isPeriodFinalized || noPeriodOpen || !isRegistered} size="lg" variant="secondary">
                            {creatingSolo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                            Solo Seeker (Idea Magnet)
                        </Button>
                    </div>
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
    const hasEnoughMembers = myGroup.members.length >= minMembers;
    const isSoloSeeker = ['FORMING_SOLO', 'FORMING'].includes(myGroup.status);

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'default' as const;
            case 'REJECTED': return 'destructive' as const;
            case 'PENDING': return 'secondary' as const;
            case 'FORMING': return 'secondary' as const;
            case 'FORMING_SOLO': return 'secondary' as const;
            case 'READY_FOR_BIDDING': return 'outline' as const;
            default: return 'outline' as const;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'READY_FOR_BIDDING': return hasTitle ? 'Ready for Finalization' : 'Ready for Bidding';
            case 'FORMING': return 'Incomplete Group';
            case 'FORMING_SOLO': return 'Solo Seeker';
            default: return status;
        }
    };

    const getMemberCountColor = (): string => {
        const current = myGroup?.members.length || 0;
        if (current >= maxMembers) return 'text-orange-600';  // At max
        if (current < minMembers) return 'text-red-600';      // Below minimum
        return 'text-green-600';                               // Healthy
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
                    {isLeader && ['READY_FOR_BIDDING', 'FORMING', 'FORMING_SOLO'].includes(myGroup.status) && (
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
                        <div className={`text-sm font-semibold ${getMemberCountColor()}`}>
                            {myGroup.members.length}/{maxMembers} members (min {minMembers})
                        </div>
                        {myGroup.members.length >= maxMembers && (
                            <p className="text-xs text-orange-600">
                                ⚠️ Group at maximum capacity. Title hidden from marketplace.
                            </p>
                        )}
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
                 
                 {/* Finalization Buttons - for FORMING_SOLO/READY_FOR_BIDDING with min members met or READY_FOR_FINALIZATION */}
                 {isLeader && myGroup.members.length >= minMembers && (
                     <CardFooter className="bg-muted/20 border-t p-6 flex gap-3">
                         {(myGroup.status === 'READY_FOR_BIDDING' || 
                           (myGroup.status === 'FORMING_SOLO' && myGroup.title?.id)) && (
                            <>
                                <Button 
                                    onClick={() => setConfirmDialogOpen(true)}
                                    disabled={markingReady}
                                    className="flex-1"
                                >
                                    {markingReady ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Siap Finalisasi
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                        {myGroup.status === 'READY_FOR_FINALIZATION' && (
                            <>
                                <Button 
                                    variant="outline"
                                    onClick={() => setCancelDialogOpen(true)}
                                    disabled={cancellingReady}
                                    className="flex-1"
                                >
                                    {cancellingReady ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <X className="mr-2 h-4 w-4" />
                                            Batalkan Finalisasi
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </CardFooter>
                )}
            </Card>

            {/* Next Steps — shown only when group has no title */}
            {!hasTitle && ['READY_FOR_BIDDING', 'FORMING_SOLO', 'FORMING'].includes(myGroup.status) && (
                <>
                {!hasEnoughMembers && !isSoloSeeker && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Add More Members</AlertTitle>
                        <AlertDescription>
                            Your group needs at least {minMembers} members before you can bid or propose. Currently {myGroup.members.length}/{minMembers}.
                        </AlertDescription>
                    </Alert>
                )}
                <div className={`grid gap-4 ${isSoloSeeker ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
                    {/* Bidding Card — HIDDEN for Solo Seekers (FORMING_SOLO) */}
                    {myGroup.status !== 'FORMING_SOLO' && (
                        <Card className={`border-dashed border-2 ${!hasEnoughMembers ? 'opacity-60' : ''}`}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" /> Bid for a Title
                                </CardTitle>
                                <CardDescription>Browse available titles from lecturers and bid for one.</CardDescription>
                            </CardHeader>
                            <CardFooter>
                                <Button variant="outline" className="w-full" asChild disabled={!hasEnoughMembers}>
                                    <Link href="/mahasiswa/titles">Browse Marketplace</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    )}
                    <Card className="border-dashed border-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PenLine className="h-5 w-5" /> Propose Your Own Title
                            </CardTitle>
                            <CardDescription>
                                {myGroup.status === 'FORMING_SOLO' 
                                    ? "Ajukan judul tugas akhir Anda sendiri. Setelah disetujui, mahasiswa lain dapat bergabung ke kelompok Anda."
                                    : hasEnoughMembers 
                                        ? "Submit your own title idea and choose a supervisor."
                                        : "Ajukan judul Anda sendiri. Butuh minimal " + minMembers + " anggota."}
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="outline" className="w-full" asChild disabled={!hasEnoughMembers && myGroup.status !== 'FORMING_SOLO'}>
                                <Link href="/mahasiswa/propose-title">Propose Title</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                    {/* Propose Title Card */}
                    <Card className="border-dashed border-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PenLine className="h-5 w-5" /> Propose Your Own Title
                            </CardTitle>
                            <CardDescription>
                                {myGroup.status === 'FORMING_SOLO' 
                                    ? "Ajukan judul tugas akhir Anda sendiri. Setelah disetujui, mahasiswa lain dapat bergabung ke kelompok Anda."
                                    : hasEnoughMembers 
                                        ? "Submit your own title idea and choose a supervisor."
                                        : "Ajukan judul Anda sendiri. Butuh minimal " + minMembers + " anggota."}
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="outline" className="w-full" asChild disabled={!hasEnoughMembers && myGroup.status !== 'FORMING_SOLO'}>
                                <Link href="/mahasiswa/propose-title">Propose Title</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                </>)}

            {/* Incoming Join Requests — Solo Leader only */}
            {isLeader && isSoloSeeker && joinRequests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <UserPlus className="h-5 w-5" /> Incoming Join Requests
                        </CardTitle>
                        <CardDescription>Students who want to join your group. Accept or reject their requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            {joinRequests.map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">{req.requester.name}</div>
                                            <div className="text-xs text-muted-foreground">{req.requester.email}</div>
                                            {req.message && (
                                                <div className="text-xs text-muted-foreground mt-1 italic">&ldquo;{req.message}&rdquo;</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleAcceptJoinRequest(req.id)}
                                            disabled={processingJoinRequest === req.id}
                                        >
                                            {processingJoinRequest === req.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                                            Accept
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleRejectJoinRequest(req.id)}
                                            disabled={processingJoinRequest === req.id}
                                        >
                                            <X className="mr-1 h-3 w-3" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}


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

            {/* Confirm Finalization Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Siap Finalisasi Kelompok?</DialogTitle>
                        <DialogDescription>
                            Setelah ini, kelompok Anda akan masuk ke tahap finalisasi admin. Anda tidak bisa menambah atau mengurangi anggota lagi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-muted p-3 rounded-lg text-sm">
                            <strong>Anggota Kelompok ({myGroup?.members.length}):</strong>
                            <ul className="mt-2 space-y-1">
                                {myGroup?.members.map(m => (
                                    <li key={m.id}>• {m.student.name} {m.is_leader && '(Leader)'}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleMarkReadyForFinalization} disabled={markingReady}>
                            {markingReady ? 'Processing...' : 'Lanjutkan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Finalization Dialog */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Batalkan Finalisasi?</DialogTitle>
                        <DialogDescription>
                            Kelompok akan kembali ke status siap bidding. Anda bisa membatalkan jika ada perubahan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)}>Tidak, Lanjutkan</Button>
                        <Button variant="destructive" onClick={handleCancelFinalization} disabled={cancellingReady}>
                            {cancellingReady ? 'Processing...' : 'Ya, Batalkan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
