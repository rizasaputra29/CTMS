'use client';

import axios from 'axios';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import {
    Search, Info, Lock,
    BookOpen, Lightbulb, Send, User, Check
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/loading';
import {
    LecturerTitle,
    StudentIdea,
    Group,
    BursaFlow,
    RegisteredPeriod,
} from '../types';

const SPECIALIZATIONS = ['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'];

export function TitlesMarketplaceFeature() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [lecturerTitles, setLecturerTitles] = useState<LecturerTitle[]>([]);
    const [studentIdeas, setStudentIdeas] = useState<StudentIdea[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [registeredPeriod, setRegisteredPeriod] = useState<RegisteredPeriod | null>(null);

    // UI State
    const [, setActiveTab] = useState('lecturer');
    const [search, setSearch] = useState('');
    const [filterSpecs, setFilterSpecs] = useState<string[]>([]);

    // Bidding/Join State
    const [, setBiddingId] = useState<number | null>(null);
    const [canRequestJoin, setCanRequestJoin] = useState(false);
    const [myPendingRequests, setMyPendingRequests] = useState<number[]>([]);
    const [bursaFlow, setBursaFlow] = useState<BursaFlow | null>(null);
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [joinMessage, setJoinMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isPeriodFinalized = !!registeredPeriod?.is_finalized;

    const fetchRegisteredPeriod = useCallback(async () => {
        try {
            const response = await api.get('/mahasiswa/my-period');
            const responseData = response.data?.data ?? response.data;
            const periodData = responseData?.period;

            if (!periodData) {
                toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                router.replace('/mahasiswa/registration');
                return null;
            }

            setRegisteredPeriod(periodData);
            return periodData;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                toast.error('Sesi Anda sudah habis. Silakan masuk kembali.');
                router.replace('/login');
                return null;
            }

            if (axios.isAxiosError(error) && error.response?.status === 404) {
                toast.error('Anda belum terdaftar pada periode mana pun. Silakan daftar terlebih dahulu.');
                router.replace('/mahasiswa/registration');
                return null;
            }

            console.error('Failed to fetch registered period', error);
            toast.error('Gagal memuat data periode. Silakan coba lagi.');
            return null;
        }
    }, [router]);

    const fetchData = useCallback(async (periodId: number) => {
        setLoading(true);
        try {
            const [titlesRes, groupRes] = await Promise.all([
                api.get(`/mahasiswa/titles?period_id=${periodId}`),
                api.get('/mahasiswa/group'),
            ]);
            const bursaRes = await api.get(`/mahasiswa/bursa-ide?period_id=${periodId}`);

            // Single endpoint returns both lecturer and student titles
            // TitleController.index returns raw Eloquent collection (unwrapped) or wrapped response
            const allTitlesRaw = titlesRes.data?.data ?? titlesRes.data ?? [];
            const allTitles = Array.isArray(allTitlesRaw) ? allTitlesRaw : [];

            // Filter lecturer titles (title_source = 'LECTURER' or null)
            const lecturerOnly = allTitles.filter((t: LecturerTitle) =>
                t.title_source === 'LECTURER' || t.title_source === null || !t.title_source
            );
            setLecturerTitles(lecturerOnly);

            // Filter student ideas (title_source = 'STUDENT')
            const studentOnly = allTitles.filter((t: StudentIdea) => t.title_source === 'STUDENT');
            setStudentIdeas(studentOnly);

            // Can request join if user has no group or is a solo seeker leader
            const groupData = groupRes.data?.data ?? groupRes.data;
            const userGroup = groupData?.group ?? groupData ?? null;
            setGroup(userGroup);

            // Determine if user can request to join
            const soloStatuses = ['FORMING_SOLO', 'FORMING', 'WAITING_SUPERVISOR_APPROVAL'];
            const isLeader = userGroup?.members?.some((m: { is_leader: boolean; student_id: number }) => m.is_leader && m.student_id === user?.id);
            const canJoin = bursaRes.data?.flow?.can_request_join ?? (!userGroup || (soloStatuses.includes(userGroup?.status) && isLeader));
            setCanRequestJoin(canJoin);

            // Get pending requests from group data if available
            const bursaData = bursaRes.data?.data ?? bursaRes.data;
            setMyPendingRequests(bursaData?.my_pending_requests || userGroup?.pending_join_requests || []);
            setBursaFlow(bursaData?.flow || null);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                toast.error('Sesi Anda sudah habis. Silakan masuk kembali.');
                router.replace('/login');
                return;
            }

            console.error('Failed to fetch marketplace data', error);
            toast.error('Gagal memuat data judul. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    }, [router, user?.id]);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        // Fetch registered period first, then fetch titles
        const init = async () => {
            const period = await fetchRegisteredPeriod();
            if (period) {
                await fetchData(period.id);
            }
        };

        init();
    }, [authLoading, fetchData, fetchRegisteredPeriod, router, user]);

    // --- Actions ---
    const handleBid = async (titleId: number) => {
        const canBid = !!group && !group.title_id && group.status === 'READY_FOR_BIDDING' && group.members.length >= 3;
        if (!canBid) return;

        setBiddingId(titleId);
        try {
            // Need to get props from state or something for supervisors?
            // The original logic used a priority form usually, but the simplified mockup just sent title_id.
            // Let's check how the current BidController expects it.
            // Actually the current BidController expects supervisors. I'll just redirect to a detail page or show a simplified modal?
            // For now, let's just stick to the simple bid if possible, or redirect.
            window.location.href = `/mahasiswa/titles/${titleId}`;
        } finally {
            setBiddingId(null);
        }
    };

    const handleRequestJoin = async () => {
        if (!selectedGroupId) return;
        setSubmitting(true);
        try {
            await api.post(`/mahasiswa/bursa-ide/${selectedGroupId}/request-join`, {
                message: joinMessage || null,
            });
            toast.success('Join request sent!');
            setRequestDialogOpen(false);
            setJoinMessage('');
            setSelectedGroupId(null);
            if (registeredPeriod?.id) {
                fetchData(registeredPeriod.id);
            }
        } catch (error) {
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to send join request'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // --- Helpers ---
    const toggleSpecFilter = (spec: string) => {
        setFilterSpecs(prev =>
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };

    const filteredLecturerTitles = useMemo(() => {
        let result = lecturerTitles ?? [];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.lecturer?.name || '').toLowerCase().includes(q)
            );
        }
        if (filterSpecs.length > 0) {
            result = result.filter(t =>
                t.specializations && filterSpecs.some(s => t.specializations!.includes(s))
            );
        }

        // Filter based on availability
        result = result.filter(title => {
            // Hide if lecturer withdrew approval (status = PENDING)
            if (title.status === 'PENDING') {
                return false;
            }

            // Hide if current group reached max members with this title
            if (group && group.title_id === title.id) {
                const maxSize = group.period?.max_group_size || 4;
                if ((group.members ?? []).length >= maxSize) {
                    return false;
                }
            }

            // Hide if current group at READY_FOR_FINALIZATION
            if (group?.status === 'READY_FOR_FINALIZATION') {
                return false;
            }

            return true;
        });

        return result;
    }, [lecturerTitles, search, filterSpecs, group]);

    const filteredStudentIdeas = useMemo(() => {
        let result = studentIdeas ?? [];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.proposed_supervisor?.name || '').toLowerCase().includes(q)
            );
        }
        if (filterSpecs.length > 0) {
            result = result.filter(t =>
                t.specializations && filterSpecs.some(s => t.specializations!.includes(s))
            );
        }
        return result;
    }, [studentIdeas, search, filterSpecs]);

    const memberCount = group?.members?.length || 0;
    const hasMultipleMembers = memberCount > 1;
    const canBidOnLecturer = !!group && !group.title_id && memberCount >= 3;

    const bursaReasonMap: Record<string, string> = {
        NO_GROUP: 'Anda belum memiliki kelompok.',
        PERIOD_FINALIZED: 'Periode sudah ditutup, fitur join tidak tersedia.',
        GROUP_LOCKED: 'Kelompok sudah terkunci (siap finalisasi).',
        LEADER_SOLO_ONLY: 'Hanya ghost student atau ketua kelompok seeker yang dapat request join.',
    };

    if (loading) return <Loading variant="section" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Titles Marketplace</h1>
                    <p className="text-muted-foreground">Temukan topik skripsi atau bergabung dengan ide mahasiswa lain.</p>
                </div>
                <div className="flex items-center gap-3">
                    {registeredPeriod && (
                        <Badge variant="outline" className="text-sm px-3 py-1">
                            Period: {registeredPeriod.name}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Finalized Period Alert */}
            {isPeriodFinalized && (
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>View-Only Mode</AlertTitle>
                    <AlertDescription>
                        Pendaftaran untuk periode **{registeredPeriod?.name}** sudah ditutup. Anda masih bisa melihat judul sebagai arsip, tetapi tidak dapat melakukan bidding atau meminta bergabung.
                    </AlertDescription>
                </Alert>
            )}

            {/* Constraints Alert */}
            {!group && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Group Yet</AlertTitle>
                    <AlertDescription>
                        Anda harus <Link href="/mahasiswa/group" className="font-medium underline">membuat kelompok</Link> terlebih dahulu sebelum bisa melakukan bidding.
                    </AlertDescription>
                </Alert>
            )}

            {group && !group?.is_solo && memberCount < 3 && (
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Bidding Locked</AlertTitle>
                    <AlertDescription>
                        Kelompok Anda memiliki {memberCount} anggota. **Minimal 3 anggota** diperlukan untuk melakukan bidding pada judul dari Dosen.
                        Silakan tambahkan anggota di menu <Link href="/mahasiswa/group" className="underline font-bold">Grup Saya</Link>.
                    </AlertDescription>
                </Alert>
            )}

            {group?.is_solo && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Solo Seeker Mode</AlertTitle>
                    <AlertDescription>
                        Sebagai solo seeker, Anda hanya dapat <Link href="/mahasiswa/propose-title" className="font-medium underline">mengajukan judul sendiri</Link>.
                        Jika ingin bidding pada judul dosen, silakan <Link href="/mahasiswa/group" className="font-medium underline">bubarkan grup</Link> dan buat grup normal.
                    </AlertDescription>
                </Alert>
            )}

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search titles, lecturers, or student ideas..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium mr-1">Filter Tags:</span>
                    {SPECIALIZATIONS.map(spec => (
                        <Badge
                            key={spec}
                            variant={filterSpecs.includes(spec) ? "default" : "outline"}
                            className="cursor-pointer select-none"
                            onClick={() => toggleSpecFilter(spec)}
                        >
                            {spec}
                        </Badge>
                    ))}
                </div>
            </div>

            <Tabs defaultValue="lecturer" onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="lecturer" className="flex gap-2">
                        <BookOpen className="h-4 w-4" /> Lecturer Offered
                    </TabsTrigger>
                    <TabsTrigger value="student" className="flex gap-2">
                        <Lightbulb className="h-4 w-4" /> Student Ideas
                    </TabsTrigger>
                </TabsList>

                {/* Lecturer Titles Tab */}
                <TabsContent value="lecturer" className="space-y-4">
                    {filteredLecturerTitles.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            No titles found matching your criteria.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Project Title</TableHead>
                                        <TableHead>Lecturer</TableHead>
                                        <TableHead>Specs</TableHead>
                                        <TableHead>Availability</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(filteredLecturerTitles ?? []).map(title => (
                                        <TableRow key={title.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => window.location.href = `/mahasiswa/titles/${title.id}`}>
                                            <TableCell className="font-medium max-w-[350px]">
                                                <div className="line-clamp-2">{title.title}</div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{title.lecturer?.name || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(title.specializations || []).map(s => (
                                                        <Badge key={s} variant="outline" className="text-[10px] h-5">{s}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {title.quota - title.active_groups_count} of {title.quota} open
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleBid(title.id)}
                                                    disabled={isPeriodFinalized || !canBidOnLecturer || (title.quota - title.active_groups_count <= 0)}
                                                    variant={canBidOnLecturer && !isPeriodFinalized ? "default" : "outline"}
                                                >
                                                    {isPeriodFinalized ? <Lock className="mr-2 h-3 w-3" /> : !canBidOnLecturer ? <Lock className="mr-2 h-3 w-3" /> : null}
                                                    {isPeriodFinalized ? "Closed" : "View & Bid"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* Student Ideas Tab (Bursa Ide) */}
                <TabsContent value="student" className="space-y-4">
                    {!canRequestJoin && bursaFlow?.reason && (
                        <Alert>
                            <Lock className="h-4 w-4" />
                            <AlertTitle>Bursa Ide View Only</AlertTitle>
                            <AlertDescription>
                                {bursaReasonMap[bursaFlow.reason] || 'Fitur join tidak tersedia untuk kondisi saat ini.'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!canRequestJoin && !loading && (
                        <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Viewing Only</AlertTitle>
                            <AlertDescription>
                                {group?.title_id
                                    ? "Anda sudah memiliki judul tetap. Fitur bergabung tidak lagi tersedia."
                                    : "Anda sudah terdaftar di kelompok permanen (Ready for Bidding) atau bukan ketua kelompok. Fitur bergabung hanya untuk mahasiswa tanpa kelompok atau Ketua Kelompok Seeker."
                                }
                            </AlertDescription>
                        </Alert>
                    )}

                    {filteredStudentIdeas.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            <Lightbulb className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No student-proposed ideas found yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {(filteredStudentIdeas ?? []).map((title) => {
                                const groupInfo = title.proposed_by_group;
                                const maxMembers = 4; // Hardcoded default or from system
                                const currentCount = groupInfo?.members?.length || 0;
                                const spots = maxMembers - currentCount;
                                const isPending = groupInfo ? myPendingRequests.includes(groupInfo.id) : false;

                                return (
                                    <Card key={title.id} className="flex flex-col">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-base line-clamp-1">{title.title}</CardTitle>
                                                    <CardDescription className="text-xs">By {(groupInfo?.members ?? []).find(m => m.is_leader)?.student.name}</CardDescription>
                                                </div>
                                                <Badge variant={spots > 0 ? "secondary" : "destructive"}>
                                                    {spots > 0 ? `${spots} slots` : 'FULL'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1 space-y-4">
                                            <p className="text-sm text-muted-foreground line-clamp-3">{title.description}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {title.specializations?.map(s => (
                                                    <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                                                <User className="h-3 w-3" />
                                                <span>Proposed Supervisor: {title.proposed_supervisor?.name || 'N/A'}</span>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-muted/10 p-3 pt-0">
                                            {isPeriodFinalized ? (
                                                <Button variant="ghost" disabled className="w-full text-xs font-semibold">
                                                    <Lock className="mr-2 h-3 w-3" /> Period Closed
                                                </Button>
                                            ) : groupInfo?.id === group?.id ? (
                                                <Button variant="ghost" disabled className="w-full text-xs font-semibold text-primary">
                                                    <Check className="mr-2 h-3 w-3" /> Your Idea
                                                </Button>
                                            ) : groupInfo?.status === 'READY_FOR_FINALIZATION' ? (
                                                <Button variant="ghost" disabled className="w-full text-xs" title="Grup ini sudah siap finalisasi dan tidak menerima anggota baru">
                                                    <Lock className="mr-2 h-3 w-3" /> Siap Finalisasi
                                                </Button>
                                            ) : canRequestJoin && spots > 0 ? (
                                                isPending ? (
                                                    <Button variant="ghost" disabled className="w-full text-xs">
                                                        <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Pending Approval
                                                    </Button>
                                                ) : (
                                                    <Button variant="default" size="sm" className="w-full" onClick={() => { setSelectedGroupId(groupInfo?.id || null); setRequestDialogOpen(true); }}>
                                                        <Send className="mr-2 h-3 w-3" /> {hasMultipleMembers ? 'Merge Group' : 'Request to Join'}
                                                    </Button>
                                                )
                                            ) : (
                                                <Button variant="ghost" disabled className="w-full text-xs">
                                                    Unavailable
                                                </Button>
                                            )}
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Request to Join Dialog */}
            <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{hasMultipleMembers ? 'Merge Groups' : 'Request to Join Group'}</DialogTitle>
                        <DialogDescription>
                            {hasMultipleMembers
                                ? `Sebagai Ketua Kelompok, permintaan ini akan memindahkan SELURUH anggota kelompok Anda (${memberCount} orang) ke dalam ide ini. Kelompok lama Anda akan dibubarkan.`
                                : 'Kirim pesan ke ketua kelompok untuk menjelaskan ketertarikan Anda bergabung dengan ide ini.'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Halo, saya tertarik dengan ide ini karena..."
                            value={joinMessage}
                            onChange={(e) => setJoinMessage(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleRequestJoin} disabled={submitting}>
                            {submitting ? 'Sending...' : 'Send Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
