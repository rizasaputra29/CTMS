'use client';

import axios from 'axios';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    BookOpen, Lightbulb, Send, User, Check, Lock, Info, ArrowRight
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from "sonner";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/loading';
import { useSearchFilterSort } from '@/hooks/useSearchFilterSort';
import { SearchBar } from '@/components/shared/SearchBar';
import { FilterBadgeGroup } from '@/components/shared/FilterBadgeGroup';
import { SortDropdown } from '@/components/shared/SortDropdown';

const SPECIALIZATIONS = ['Software', 'Embedded', 'Network', 'Multimedia', 'AI', 'Blockchain'];

interface LecturerTitle {
    id: number;
    title: string;
    description: string;
    specializations: string[] | null;
    quota: number;
    status: string;
    active_groups_count: number;
    lecturer?: { id: number; name: string; email: string };
    title_source?: 'LECTURER' | 'STUDENT' | null;
}

interface StudentIdea {
    id: number;
    title: string;
    description: string;
    specializations: string[] | null;
    proposed_supervisor: { id: number; name: string } | null;
    proposed_by_group: {
        id: number;
        status: string;
        members: { id: number; is_leader: boolean; student: { id: number; name: string; email: string } }[];
        period: { max_group_size: number } | null;
    } | null;
    title_source?: 'LECTURER' | 'STUDENT' | null;
}

interface Group {
    id: number;
    title_id: number | null;
    status: string;
    is_solo?: boolean;
    title?: { id: number; title: string };
    members: { id: number; student_id: number; is_leader: boolean }[];
    period?: { max_group_size: number };
}

interface BursaFlow {
    can_request_join: boolean;
    can_accept_join_requests: boolean;
    can_reject_join_requests: boolean;
    reason: string | null;
}

interface RegisteredPeriod {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized: boolean;
}

const SORT_OPTIONS = [
    { key: 'title', label: 'Title' },
    { key: 'lecturer.name', label: 'Lecturer' },
    { key: 'availability', label: 'Availability' },
];

export default function TitlesMarketplacePage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [lecturerTitles, setLecturerTitles] = useState<LecturerTitle[]>([]);
    const [studentIdeas, setStudentIdeas] = useState<StudentIdea[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [registeredPeriod, setRegisteredPeriod] = useState<RegisteredPeriod | null>(null);
    const [, setActiveTab] = useState('lecturer');
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
            const periodData = response.data?.period;

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
            
            const allTitles = titlesRes.data || [];
            const lecturerOnly = allTitles.filter((t: LecturerTitle) => 
                t.title_source === 'LECTURER' || t.title_source === null || !t.title_source
            );
            setLecturerTitles(lecturerOnly);
            
            const studentOnly = allTitles.filter((t: StudentIdea) => t.title_source === 'STUDENT');
            setStudentIdeas(studentOnly);
            
            const userGroup = groupRes.data?.group ?? null;
            setGroup(userGroup);
            
            const soloStatuses = ['FORMING_SOLO', 'FORMING', 'WAITING_SUPERVISOR_APPROVAL'];
            const isLeader = userGroup?.members?.some((m: { is_leader: boolean; student_id: number }) => m.is_leader && m.student_id === user?.id);
            const canJoin = bursaRes.data?.flow?.can_request_join ?? (!userGroup || (soloStatuses.includes(userGroup?.status) && isLeader));
            setCanRequestJoin(canJoin);
            
            setMyPendingRequests(bursaRes.data?.my_pending_requests || userGroup?.pending_join_requests || []);
            setBursaFlow(bursaRes.data?.flow || null);
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
                toast.error(error.response?.data?.message || 'Failed to send join request');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // --- Search, Filter, Sort for Lecturer Titles ---
    const {
        filteredData: filteredLecturerTitles,
        search: lecturerSearch,
        setSearch: setLecturerSearch,
        filters: lecturerFilters,
        setFilter: setLecturerFilter,
        sort: lecturerSort,
        setSort: setLecturerSort,
        clearAll: clearAllLecturer,
    } = useSearchFilterSort<LecturerTitle>({
        data: lecturerTitles,
        searchFields: ['title', 'lecturer.name', 'description'],
        filterFn: (item, filters) => {
            // Specialization filter
            const specFilter = filters.specializations as string[] | undefined;
            if (specFilter && specFilter.length > 0) {
                if (!item.specializations || !specFilter.some(s => item.specializations!.includes(s))) {
                    return false;
                }
            }
            return true;
        },
        initialSort: { field: 'title', direction: 'asc' },
    });

    // Filter by availability (group-related)
    const finalLecturerTitles = useMemo(() => {
        return filteredLecturerTitles.filter(title => {
            if (title.status === 'PENDING') return false;
            if (group && group.title_id === title.id) {
                const maxSize = group.period?.max_group_size || 4;
                if (group.members.length >= maxSize) return false;
            }
            if (group?.status === 'READY_FOR_FINALIZATION') return false;
            return true;
        });
    }, [filteredLecturerTitles, group]);

    // --- Search, Filter, Sort for Student Ideas ---
    const {
        filteredData: filteredStudentIdeas,
        search: studentSearch,
        setSearch: setStudentSearch,
        filters: studentFilters,
        setFilter: setStudentFilter,
        sort: studentSort,
        setSort: setStudentSort,
        clearAll: clearAllStudent,
    } = useSearchFilterSort<StudentIdea>({
        data: studentIdeas,
        searchFields: ['title', 'proposed_supervisor.name', 'description'],
        filterFn: (item, filters) => {
            const specFilter = filters.specializations as string[] | undefined;
            if (specFilter && specFilter.length > 0) {
                if (!item.specializations || !specFilter.some(s => item.specializations!.includes(s))) {
                    return false;
                }
            }
            return true;
        },
        initialSort: { field: 'title', direction: 'asc' },
    });

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
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Titles Marketplace</h1>
                    <p className="text-muted-foreground">Temukan topik skripsi atau bergabung dengan ide mahasiswa lain.</p>
                </div>
                {registeredPeriod && (
                    <Badge variant="outline" className="text-sm px-3 py-1 w-fit">
                        Period: {registeredPeriod.name}
                    </Badge>
                )}
            </div>

            {/* Alerts */}
            {isPeriodFinalized && (
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>View-Only Mode</AlertTitle>
                    <AlertDescription>
                        Pendaftaran untuk periode <strong>{registeredPeriod?.name}</strong> sudah ditutup. Anda masih bisa melihat judul sebagai arsip, tetapi tidak dapat melakukan bidding atau meminta bergabung.
                    </AlertDescription>
                </Alert>
            )}

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
                        Kelompok Anda memiliki {memberCount} anggota. <strong>Minimal 3 anggota</strong> diperlukan untuk melakukan bidding pada judul dari Dosen.
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

            {/* Tabs */}
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
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <SearchBar
                            value={lecturerSearch}
                            onChange={setLecturerSearch}
                            placeholder="Search titles, lecturers, or descriptions..."
                            className="max-w-md"
                        />
                        <div className="flex items-center gap-2">
                            <SortDropdown
                                options={SORT_OPTIONS}
                                value={lecturerSort?.field ?? null}
                                direction={lecturerSort?.direction ?? 'asc'}
                                onChange={(key, dir) => setLecturerSort({ field: key, direction: dir })}
                            />
                        </div>
                    </div>
                    <FilterBadgeGroup
                        options={SPECIALIZATIONS}
                        selected={(lecturerFilters.specializations as string[]) || []}
                        onChange={(selected) => setLecturerFilter('specializations', selected)}
                        label="Filter by Specialization"
                    />

                    {/* Cards Grid */}
                    {finalLecturerTitles.length === 0 ? (
                        <Card className="border-dashed border-grey-100">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <BookOpen className="h-12 w-12 text-grey-200 mb-4" />
                                <h3 className="text-lg font-semibold text-grey-600 mb-1">No titles found</h3>
                                <p className="text-sm text-grey-400 max-w-md">
                                    {lecturerSearch || (lecturerFilters.specializations as string[])?.length > 0
                                        ? 'Try adjusting your search or filter criteria.'
                                        : 'No lecturer titles available for this period yet.'}
                                </p>
                                {(lecturerSearch || (lecturerFilters.specializations as string[])?.length > 0) && (
                                    <Button variant="outline" size="sm" className="mt-4" onClick={clearAllLecturer}>
                                        Clear all filters
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {finalLecturerTitles.map(title => {
                                const openSlots = title.quota - title.active_groups_count;
                                const isFull = openSlots <= 0;
                                const isPending = title.status === 'PENDING';
                                
                                return (
                                    <Card 
                                        key={title.id} 
                                        className="group cursor-pointer hover:bg-grey-0 transition-colors border border-grey-100"
                                        onClick={() => window.location.href = `/mahasiswa/titles/${title.id}`}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                                                    {title.title}
                                                </CardTitle>
                                                <Badge 
                                                    variant={isFull ? 'destructive' : isPending ? 'secondary' : 'default'}
                                                    className="shrink-0"
                                                >
                                                    {isFull ? 'Full' : isPending ? 'Pending' : `${openSlots} of ${title.quota} open`}
                                                </Badge>
                                            </div>
                                            <CardDescription className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {title.lecturer?.name || 'Unknown Lecturer'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {title.description}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {(title.specializations || []).map(s => (
                                                    <Badge key={s} variant="outline" className="text-[10px] h-5">{s}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                        <CardFooter className="pt-0">
                                            <div className="w-full flex justify-between items-center">
                                                <Button
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBid(title.id);
                                                    }}
                                                    disabled={isPeriodFinalized || !canBidOnLecturer || isFull}
                                                    variant={canBidOnLecturer && !isPeriodFinalized && !isFull ? 'default' : 'outline'}
                                                >
                                                    {isPeriodFinalized ? (
                                                        <><Lock className="mr-2 h-3 w-3" /> Closed</>
                                                    ) : isFull ? (
                                                        <><Lock className="mr-2 h-3 w-3" /> Full</>
                                                    ) : !canBidOnLecturer ? (
                                                        <><Lock className="mr-2 h-3 w-3" /> Locked</>
                                                    ) : (
                                                        <><ArrowRight className="mr-2 h-3 w-3" /> View & Bid</>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Student Ideas Tab (Bursa Ide) */}
                <TabsContent value="student" className="space-y-4">
                    {!canRequestJoin && !loading && (
                        bursaFlow?.reason ? (
                            <Alert>
                                <Lock className="h-4 w-4" />
                                <AlertTitle>Bursa Ide View Only</AlertTitle>
                                <AlertDescription>
                                    {bursaReasonMap[bursaFlow.reason] || 'Fitur join tidak tersedia untuk kondisi saat ini.'}
                                </AlertDescription>
                            </Alert>
                        ) : (
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
                        )
                    )}

                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <SearchBar
                            value={studentSearch}
                            onChange={setStudentSearch}
                            placeholder="Search student ideas, supervisors..."
                            className="max-w-md"
                        />
                        <div className="flex items-center gap-2">
                            <SortDropdown
                                options={[
                                    { key: 'title', label: 'Title' },
                                    { key: 'proposed_supervisor.name', label: 'Supervisor' },
                                ]}
                                value={studentSort?.field ?? null}
                                direction={studentSort?.direction ?? 'asc'}
                                onChange={(key, dir) => setStudentSort({ field: key, direction: dir })}
                            />
                        </div>
                    </div>
                    <FilterBadgeGroup
                        options={SPECIALIZATIONS}
                        selected={(studentFilters.specializations as string[]) || []}
                        onChange={(selected) => setStudentFilter('specializations', selected)}
                        label="Filter by Specialization"
                    />

                    {filteredStudentIdeas.length === 0 ? (
                        <Card className="border-dashed border-grey-100">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Lightbulb className="h-12 w-12 text-grey-200 mb-4" />
                                <h3 className="text-lg font-semibold text-grey-600 mb-1">No student ideas found</h3>
                                <p className="text-sm text-grey-400 max-w-md">
                                    {studentSearch || (studentFilters.specializations as string[])?.length > 0
                                        ? 'Try adjusting your search or filter criteria.'
                                        : 'No student-proposed ideas available for this period yet.'}
                                </p>
                                {(studentSearch || (studentFilters.specializations as string[])?.length > 0) && (
                                    <Button variant="outline" size="sm" className="mt-4" onClick={clearAllStudent}>
                                        Clear all filters
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredStudentIdeas.map((title) => {
                                const groupInfo = title.proposed_by_group;
                                const maxMembers = groupInfo?.period?.max_group_size || 4;
                                const currentCount = groupInfo?.members?.length || 0;
                                const spots = maxMembers - currentCount;
                                const isPending = groupInfo ? myPendingRequests.includes(groupInfo.id) : false;
                                
                                return (
                                    <Card key={title.id} className="flex flex-col border border-grey-100">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <CardTitle className="text-base line-clamp-1">{title.title}</CardTitle>
                                                <Badge variant={spots > 0 ? 'secondary' : 'destructive'} className="shrink-0">
                                                    {spots > 0 ? `${spots} slots` : 'FULL'}
                                                </Badge>
                                            </div>
                                            <CardDescription className="text-xs">
                                                By {groupInfo?.members?.find(m => m.is_leader)?.student.name || 'Unknown'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 space-y-3">
                                            <p className="text-sm text-muted-foreground line-clamp-3">{title.description}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {title.specializations?.map(s => (
                                                    <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-grey-50">
                                                <User className="h-3 w-3" />
                                                <span>Proposed Supervisor: {title.proposed_supervisor?.name || 'N/A'}</span>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-grey-0 p-3 pt-2">
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

            {/* Footer Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-grey-50 pt-3">
                <span>
                    {finalLecturerTitles.length} lecturer titles · {filteredStudentIdeas.length} student ideas
                </span>
                {registeredPeriod && (
                    <span>Period: {registeredPeriod.name}</span>
                )}
            </div>

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
