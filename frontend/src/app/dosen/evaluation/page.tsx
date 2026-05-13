'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
    Loader2, 
    GraduationCap, 
    CalendarDays, 
    CheckCircle2, 
    Clock, 
    MapPin, 
    Users, 
    Search,
    FileCheck,
    AlertCircle,
    Calendar,
    Eye,
    Play
} from 'lucide-react';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Evaluation {
    id: number;
    type: 'SEMINAR' | 'TA_DEFENSE';
    schedule_type: string;
    schedule_id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    status: 'PENDING' | 'COMPLETED' | 'SUBMITTED';
    points: number;
    notes: string;
    deadline: string | null;
    updated_at?: string;
    // Group info
    group: {
        id: number;
        title?: { title?: string; name?: string };
        members?: { student: { id: number; name: string; nim?: string } }[];
    };
    // For TA Defense - single student
    student?: { id: number; name: string; nim?: string } | null;
}

interface SeminarData {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    evaluation_deadline?: string;
    evaluations?: {
        id: number;
        status: string;
        score: number;
        feedback?: string;
        updated_at?: string;
    }[];
    group: {
        id: number;
        title?: { title: string; name: string };
        members?: { student: { id: number; name: string; nim?: string } }[];
    };
    // TA Defense fields
    student?: { id: number; name: string; nim?: string };
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'COMPLETED':
        case 'SUBMITTED':
            return (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <FileCheck className="w-3 h-3 mr-1" />
                    Sudah Dinilai
                </Badge>
            );
        case 'PENDING':
            return (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Belum Dinilai
                </Badge>
            );
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
};

const isCompletedStatus = (status: string) =>
    status === 'COMPLETED' || status === 'SUBMITTED';

const normalizeEvaluationStatus = (status?: string): Evaluation['status'] => {
    const normalized = (status ?? 'PENDING').toUpperCase();
    if (normalized === 'COMPLETED' || normalized === 'SUBMITTED') {
        return normalized;
    }
    return 'PENDING';
};

const getButtonText = (status: string) => {
    if (isCompletedStatus(status)) return 'Lihat Nilai';
    return 'Nilai Sekarang';
};

const getButtonIcon = (status: string) => {
    if (isCompletedStatus(status)) return <Eye className="w-4 h-4 mr-2" />;
    return <Play className="w-4 h-4 mr-2" />;
};

const getEvaluationTypeLabel = (type: string, scheduleType?: string) => {
    if (type === 'TA_DEFENSE') return 'SIDANG_TA';
    return scheduleType || type;
};

const getEvaluationTypeColor = (type: string, scheduleType?: string) => {
    const evalType = type === 'TA_DEFENSE' ? 'SIDANG_TA' : scheduleType;
    switch (evalType) {
        case 'SEMPRO':
            return 'bg-blue-100 text-blue-800';
        case 'SIDANG_TA':
            return 'bg-indigo-100 text-indigo-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

function EvaluationCard({ 
    evalItem, 
    onEvaluate, 
    isUrgent, 
    isOverdue,
    showScore = false
}: { 
    evalItem: Evaluation; 
    onEvaluate: () => void; 
    isUrgent: boolean;
    isOverdue: boolean;
    showScore?: boolean;
}) {
    const displayTitle = evalItem.group.title?.title || evalItem.group.title?.name || `Group ${evalItem.group.id}`;
    const students = evalItem.type === 'TA_DEFENSE' && evalItem.student
        ? [evalItem.student]
        : evalItem.group.members?.map(m => m.student) || [];

    return (
        <Card className={`transition-all hover:shadow-md ${
            isOverdue ? 'border-red-500 bg-red-50' : ''
        } ${isCompletedStatus(evalItem.status) ? 'opacity-75' : ''}`}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Badge className={getEvaluationTypeColor(evalItem.type, evalItem.schedule_type)}>
                        {getEvaluationTypeLabel(evalItem.type, evalItem.schedule_type)}
                    </Badge>
                    {getStatusBadge(evalItem.status)}
                </div>
                <CardTitle className="text-lg mt-2 leading-tight">
                    {displayTitle}
                </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
                {evalItem.date && (
                    <div className="flex items-center text-sm text-muted-foreground">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {format(parseISO(evalItem.date), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
                    </div>
                )}

                <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    {evalItem.start_time?.substring(0, 5) || '--:--'} - {evalItem.end_time?.substring(0, 5) || '--:--'}
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {evalItem.room}
                </div>

                {evalItem.deadline && (
                    <div className={`flex items-center text-sm ${
                        isOverdue ? 'text-red-600 font-medium' : 
                        isUrgent ? 'text-yellow-600 font-medium' : 'text-muted-foreground'
                    }`}>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Deadline: {format(parseISO(evalItem.deadline), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
                        {isOverdue && ' (Terlewat)'}
                    </div>
                )}

                <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Mahasiswa:</p>
                    <div className="flex flex-wrap gap-1">
                        {students.map((student) => (
                            <Badge key={student.id} variant="secondary" className="text-xs">
                                {student.name}
                            </Badge>
                        ))}
                    </div>
                </div>

                {showScore && isCompletedStatus(evalItem.status) && (
                    <div className="pt-2 border-t bg-green-50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-800">Nilai:</span>
                            <span className="font-bold text-2xl text-green-600">{evalItem.points}</span>
                        </div>
                        <div className="text-xs text-green-600 text-right">/ 100</div>
                        {evalItem.updated_at && (
                            <div className="text-xs text-muted-foreground mt-2">
                                Dinilai: {format(parseISO(evalItem.updated_at), 'dd MMMM yyyy', { locale: idLocale })}
                            </div>
                        )}
                        {evalItem.notes && (
                            <p className="text-xs text-muted-foreground mt-2 italic border-t border-green-200 pt-2">
                                &ldquo;{evalItem.notes}&rdquo;
                            </p>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter>
                <Button 
                    className="w-full"
                    variant={isCompletedStatus(evalItem.status) ? 'outline' : 'default'}
                    onClick={onEvaluate}
                >
                    {getButtonIcon(evalItem.status)}
                    {getButtonText(evalItem.status)}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function DosenExaminerPage() {
    const router = useRouter();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'schedule' | 'group'>('schedule');

    useEffect(() => {
        const fetchPeriods = async () => {
            try {
                const res = await api.get('/periods-list');
                setPeriods(res.data?.data || []);
            } catch (err) {
                console.error('Failed to fetch periods', err);
            }
        };
        fetchPeriods();
    }, []);

    useEffect(() => {
        const fetchEvaluations = async () => {
            setLoading(true);
            try {
                const periodParam = selectedPeriod !== 'all' ? `?period_id=${selectedPeriod}` : '';
                const res = await api.get(`/dosen/seminar-schedules/examiner${periodParam}`);
                const seminars: SeminarData[] = res.data.data?.seminars || [];
                const taDefenses: SeminarData[] = res.data.data?.ta_defenses || [];

                const mapped: Evaluation[] = [];

                // Map SEMPRO (group-based)
                seminars.forEach((s) => {
                    const myEval = s.evaluations?.[0];
                    if (myEval) {
                        mapped.push({
                            id: myEval.id,
                            type: 'SEMINAR',
                            schedule_type: s.type,
                            schedule_id: s.id,
                            date: s.date,
                            start_time: s.start_time,
                            end_time: s.end_time,
                            room: s.room,
                            status: normalizeEvaluationStatus(myEval.status),
                            points: myEval.score,
                            notes: myEval.feedback || '',
                            deadline: s.evaluation_deadline || null,
                            updated_at: myEval.updated_at,
                            group: s.group,
                            student: null
                        });
                    }
                });

                // Map TA Defense (per-student)
                // Show even if evaluation doesn't exist - backend will auto-create it
                taDefenses.forEach((t) => {
                    const myEval = t.evaluations?.[0];
                    mapped.push({
                        id: myEval?.id ?? t.id,
                        type: 'TA_DEFENSE',
                        schedule_type: 'SIDANG_TA',
                        schedule_id: t.id,
                        date: t.date,
                        start_time: t.start_time,
                        end_time: t.end_time,
                        room: t.room,
                        status: normalizeEvaluationStatus(myEval?.status),
                        points: myEval?.score || 0,
                        notes: myEval?.feedback || '',
                        deadline: t.evaluation_deadline || null,
                        updated_at: myEval?.updated_at,
                        group: t.group,
                        student: t.student || null
                    });
                });

                setEvaluations(mapped);
            } catch (err) {
                console.error('Failed to fetch evaluations', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEvaluations();
    }, [selectedPeriod]);

    const filteredEvaluations = useMemo(() => {
        let filtered = evaluations;
        
        // Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e => 
                e.group.title?.title?.toLowerCase().includes(q) ||
                e.group.title?.name?.toLowerCase().includes(q) ||
                e.group.members?.some(m => m.student.name.toLowerCase().includes(q)) ||
                e.student?.name.toLowerCase().includes(q)
            );
        }
        
        // Filter by status
        if (filter !== 'all') {
            if (filter === 'pending') {
                filtered = filtered.filter(e => !isCompletedStatus(e.status));
            } else if (filter === 'completed') {
                filtered = filtered.filter(e => isCompletedStatus(e.status));
            }
        }
        
        return filtered;
    }, [evaluations, searchQuery, filter]);

    // Time-based sections (for "Semua" and "Belum Dinilai" tabs)
    const todayEvaluations = filteredEvaluations.filter((e) => !isCompletedStatus(e.status) && e.date && isToday(parseISO(e.date)));
    const upcomingEvaluations = filteredEvaluations.filter((e) => !isCompletedStatus(e.status) && e.date && isFuture(parseISO(e.date)) && !isToday(parseISO(e.date)));
    const pastEvaluations = filteredEvaluations.filter((e) => !isCompletedStatus(e.status) && e.date && isPast(parseISO(e.date)) && !isToday(parseISO(e.date)));
    
    // Completed evaluations sorted by completion date (most recent first)
    const completedEvaluations = filteredEvaluations
        .filter((e) => isCompletedStatus(e.status))
        .sort((a, b) => {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA; // Most recent first
        });

    const handleEvaluate = (evalItem: Evaluation) => {
        const query = new URLSearchParams({ type: evalItem.type });
        if (evalItem.type === 'TA_DEFENSE') {
            query.set('schedule_id', String(evalItem.schedule_id));
        }
        router.push(`/dosen/evaluation/${evalItem.id}?${query.toString()}`);
    };

    const isDeadlineUrgent = (deadline: string | null) => {
        if (!deadline) return false;
        const deadlineDate = parseISO(deadline);
        const now = new Date();
        const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return diffHours <= 24 && diffHours > 0;
    };

    const isDeadlineOverdue = (deadline: string | null) => {
        if (!deadline) return false;
        return isPast(parseISO(deadline));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <GraduationCap className="w-8 h-8" />
                    Penilaian Sebagai Penguji
                </h1>
                <p className="text-muted-foreground mt-2">
                    Kelola penilaian seminar dan sidang tugas akhir Anda
                </p>
            </div>

            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'schedule' | 'group')} className="mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="schedule">
                        <Calendar className="w-4 h-4 mr-2" />
                        Berdasarkan Jadwal
                    </TabsTrigger>
                    <TabsTrigger value="group">
                        <Users className="w-4 h-4 mr-2" />
                        Berdasarkan Grup
                    </TabsTrigger>
                </TabsList>

                {/* Schedule View */}
                <TabsContent value="schedule" className="mt-6">
                    {/* Filters */}
                    <Card className="mb-6">
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap gap-4">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-sm font-medium mb-2 block">Filter Status</label>
                                    <Tabs value={filter} onValueChange={setFilter}>
                                        <TabsList>
                                            <TabsTrigger value="all">Semua</TabsTrigger>
                                            <TabsTrigger value="pending">
                                                Belum Dinilai
                                            </TabsTrigger>
                                            <TabsTrigger value="completed">
                                                Sudah Dinilai
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                                <div className="w-[200px]">
                                    <label className="text-sm font-medium mb-2 block">Periode</label>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Semua Periode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Periode</SelectItem>
                                            {periods.map((p) => (
                                                <SelectItem key={p.id} value={p.id.toString()}>
                                                    {p.name} {p.is_active && "(Aktif)"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-[300px]">
                                    <label className="text-sm font-medium mb-2 block">Cari</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Cari mahasiswa atau judul..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Schedule Sections */}
                    {filteredEvaluations.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center">
                                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    Tidak ada jadwal yang sesuai dengan filter
                                </p>
                            </CardContent>
                        </Card>
                    ) : filter === 'completed' ? (
                        /* Completed Evaluations - Simple grid sorted by completion date */
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600">
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                Sudah Dinilai ({completedEvaluations.length})
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {completedEvaluations.map((evalItem) => (
                                    <EvaluationCard
                                        key={`${evalItem.schedule_id}-${evalItem.type}`}
                                        evalItem={evalItem}
                                        onEvaluate={() => handleEvaluate(evalItem)}
                                        isUrgent={false}
                                        isOverdue={false}
                                        showScore={true}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Pending Evaluations - Organized by date (for "all" and "pending" tabs) */
                        <div className="space-y-8">
                            {/* Today Section */}
                            {todayEvaluations.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
                                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                                        Hari Ini ({todayEvaluations.length})
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {todayEvaluations.map((evalItem) => (
                                            <EvaluationCard
                                                key={`${evalItem.schedule_id}-${evalItem.type}`}
                                                evalItem={evalItem}
                                                onEvaluate={() => handleEvaluate(evalItem)}
                                                isUrgent={isDeadlineUrgent(evalItem.deadline)}
                                                isOverdue={isDeadlineOverdue(evalItem.deadline)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Section */}
                            {upcomingEvaluations.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 text-yellow-600">
                                        Mendatang ({upcomingEvaluations.length})
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {upcomingEvaluations.map((evalItem) => (
                                            <EvaluationCard
                                                key={`${evalItem.schedule_id}-${evalItem.type}`}
                                                evalItem={evalItem}
                                                onEvaluate={() => handleEvaluate(evalItem)}
                                                isUrgent={isDeadlineUrgent(evalItem.deadline)}
                                                isOverdue={false}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Past Section */}
                            {pastEvaluations.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 text-gray-500">
                                        Sudah Lewat ({pastEvaluations.length})
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {pastEvaluations.map((evalItem) => (
                                            <EvaluationCard
                                                key={`${evalItem.schedule_id}-${evalItem.type}`}
                                                evalItem={evalItem}
                                                onEvaluate={() => handleEvaluate(evalItem)}
                                                isUrgent={false}
                                                isOverdue={isDeadlineOverdue(evalItem.deadline)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Completed Section - Only show in "all" tab */}
                            {filter === 'all' && completedEvaluations.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600">
                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                        Sudah Dinilai ({completedEvaluations.length})
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {completedEvaluations.map((evalItem) => (
                                            <EvaluationCard
                                                key={`${evalItem.schedule_id}-${evalItem.type}`}
                                                evalItem={evalItem}
                                                onEvaluate={() => handleEvaluate(evalItem)}
                                                isUrgent={false}
                                                isOverdue={false}
                                                showScore={true}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Group View */}
                <TabsContent value="group" className="mt-6">
                    <Tabs value={filter} onValueChange={setFilter} className="mb-6">
                        <TabsList>
                            <TabsTrigger value="all">
                                Semua ({filteredEvaluations.length})
                            </TabsTrigger>
                            <TabsTrigger value="pending">
                                Belum Dinilai
                            </TabsTrigger>
                            <TabsTrigger value="completed">
                                Sudah Dinilai
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {filteredEvaluations.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center">
                                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    Tidak ada data yang sesuai dengan filter
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredEvaluations.map((evalItem) => (
                                <EvaluationCard
                                    key={`${evalItem.schedule_id}-${evalItem.type}`}
                                    evalItem={evalItem}
                                    onEvaluate={() => handleEvaluate(evalItem)}
                                    isUrgent={isDeadlineUrgent(evalItem.deadline)}
                                    isOverdue={isDeadlineOverdue(evalItem.deadline) && !isCompletedStatus(evalItem.status)}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
