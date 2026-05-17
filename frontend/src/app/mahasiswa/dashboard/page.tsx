'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    ArrowRight, Calendar, Clock, Upload, Check,
    Lock, GraduationCap, AlertCircle, FileText,
    ChevronUp, ChevronDown, AlertTriangle, Circle,
    Users, FileCheck, Mic
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { isFinalReadyEvaluationSection } from '@/types/guards';
import type {
    MahasiswaStats,
    WorkflowPhase,
    SupervisorInEvaluation,
    EvaluationWithSupervisors,
} from '@/types';

interface ScheduleItem {
    id: string | number;
    type: 'BIMBINGAN' | 'SEMPRO' | 'EXPO' | 'TA_DEFENSE';
    date: string;
    room: string;
    mode: 'ONLINE' | 'OFFLINE' | null;
    notes: string | null;
    time_until: string;
}

const PHASE_LABELS: Record<string, string> = {
    PDC1: 'PDC 1',
    SEMPRO: 'Seminar Proposal',
    PDC2: 'PDC 2',
    TA_DRAFT: 'TA Draft (Grup)',
    EXPO: 'Expo',
    TA: 'TA',
    SIDANG: 'Sidang',
    TA_INDIVIDUAL_READY: 'Siap TA Individu',
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
    completed: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-white', ring: 'ring-emerald-500/20' },
    submitted: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-white', ring: 'ring-blue-500/20' },
    draft: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-white', ring: 'ring-amber-500/20' },
    revision: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-white', ring: 'ring-red-500/20' },
    unlocked: { bg: 'bg-background', border: 'border-primary', text: 'text-primary', ring: 'ring-primary/20' },
    locked: { bg: 'bg-muted', border: 'border-muted-foreground/20', text: 'text-muted-foreground', ring: '' },
};

const SCHEDULE_COLORS: Record<string, string> = {
    BIMBINGAN: 'bg-blue-50 text-blue-700 border-blue-200',
    SEMPRO: 'bg-purple-50 text-purple-700 border-purple-200',
    EXPO: 'bg-orange-50 text-orange-700 border-orange-200',
    TA_DEFENSE: 'bg-red-50 text-red-700 border-red-200',
};

const SCHEDULE_LABELS: Record<string, string> = {
    BIMBINGAN: 'Bimbingan',
    SEMPRO: 'Sempro',
    EXPO: 'Expo',
    TA_DEFENSE: 'Sidang TA',
};

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'completed':
            return <Check className="h-5 w-5" />;
        case 'submitted':
            return <Clock className="h-5 w-5" />;
        case 'draft':
            return <FileText className="h-5 w-5" />;
        case 'revision':
            return <AlertTriangle className="h-5 w-5" />;
        case 'locked':
            return <Lock className="h-4 w-4" />;
        default:
            return <Circle className="h-5 w-5" />;
    }
};

const STATUS_LABELS: Record<string, string> = {
    completed: 'Selesai',
    submitted: 'Terkirim',
    draft: 'Draft',
    revision: 'Revisi',
    unlocked: 'Terbuka',
    locked: 'Terkunci',
};

export default function MahasiswaDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<MahasiswaStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [showRequirements, setShowRequirements] = useState(false);

    useEffect(() => {
        const checkRegistration = async () => {
            try {
                const response = await api.get('/mahasiswa/my-period');
                const hasRegistration = !!response.data?.period;

                if (!hasRegistration) {
                    window.location.href = '/mahasiswa/registration';
                    return;
                }

                if (response.data?.auto_registered) {
                    toast.success(response.data?.message || 'Anda telah terdaftar otomatis berdasarkan grup yang sudah ada.');
                }

                const statsResponse = await api.get('/mahasiswa/dashboard');
                setStats(statsResponse.data);
            } catch (error) {
                console.error('Failed to check registration', error);
                if (api.isAxiosError(error) && error.response?.status === 404) {
                    window.location.href = '/mahasiswa/registration';
                } else if (api.isAxiosError(error) && error.response?.status === 200) {
                    window.location.href = '/mahasiswa/registration';
                } else {
                    setLoading(false);
                    toast.error('Gagal memuat data. Silakan coba lagi.');
                }
            } finally {
                setLoading(false);
            }
        };
        checkRegistration();
    }, []);

    useEffect(() => {
        const groupApproved =
            stats?.group_status &&
            !['FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'REJECTED'].includes(stats.group_status);

        if (stats?.has_group && groupApproved) {
            loadWorkflowData();
        }
    }, [stats?.has_group, stats?.group_status]);

    const loadWorkflowData = async () => {
        setWorkflowLoading(true);
        try {
            const response = await api.get('/mahasiswa/dashboard/workflow');
            setStats((prev) => (prev ? { ...prev, ...response.data } : null));
        } catch (error) {
            console.error('Failed to load workflow data', error);
        } finally {
            setWorkflowLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">Gagal memuat data dashboard.</p>
            </div>
        );
    }

    const isGroupApproved =
        stats.group_status &&
        !['FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'REJECTED'].includes(stats.group_status);

    const isSoloSeeker = stats.group_status && ['FORMING_SOLO', 'FORMING'].includes(stats.group_status);

    const workflowPhases: WorkflowPhase[] = stats.workflow?.phases || [];
    const currentPhase = stats.workflow?.current_phase;
    const phaseKeys = Object.keys(stats.steps);
    const donePhases = phaseKeys.filter((k) => stats.steps[k]).length;
    const totalPhases = phaseKeys.length;
    const progressPercent = totalPhases > 0 ? Math.round((donePhases / totalPhases) * 100) : 0;

    const schedules: ScheduleItem[] = (stats as never as { upcoming_schedules?: ScheduleItem[] }).upcoming_schedules || [];

    return (
        <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-baseline justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Halo, {user?.name || 'Mahasiswa'}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {stats.group_period?.name || (stats.active_periods?.length > 0 ? stats.active_periods[0].name : 'N/A')}
                    </p>
                </div>
                <Badge
                    variant={stats.is_graduated ? 'default' : 'secondary'}
                    className={cn('text-xs h-6', stats.is_graduated && 'bg-emerald-500 hover:bg-emerald-500')}
                >
                    {stats.is_graduated ? 'Lulus' : stats.group_status || 'Belum Terdaftar'}
                </Badge>
            </div>

            {/* Workflow Stepper */}
            {workflowPhases.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Alur Kerja
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {stats.workflow?.is_graduated && (
                            <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-sm text-emerald-700 font-medium">
                                Semua fase telah diselesaikan.
                            </div>
                        )}

                        <div className="relative">
                            {workflowPhases.length > 1 && (
                                <div
                                    className="hidden md:block absolute h-0.5 bg-muted z-0 top-6"
                                    style={{
                                        left: `calc(100% / ${2 * workflowPhases.length})`,
                                        right: `calc(100% / ${2 * workflowPhases.length})`,
                                    }}
                                />
                            )}
                            <div
                                className={cn(
                                    'grid grid-cols-1 gap-4 relative z-10',
                                    `md:grid-cols-${workflowPhases.length}`,
                                )}
                            >
                                {workflowPhases.map((phase) => {
                                    const colors = STATUS_COLORS[phase.status];
                                    const active = phase.phase === currentPhase;
                                    return (
                                        <div
                                            key={phase.phase}
                                            className="flex flex-col items-center text-center"
                                        >
                                            <div
                                                className={cn(
                                                    'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2',
                                                    colors.bg,
                                                    colors.border,
                                                    colors.text,
                                                    active && colors.ring && 'ring-4',
                                                    colors.ring,
                                                )}
                                            >
                                                <StatusIcon status={phase.status} />
                                            </div>
                                            <p
                                                className={cn(
                                                    'font-medium text-sm',
                                                    phase.status === 'locked' && 'text-muted-foreground',
                                                )}
                                            >
                                                {PHASE_LABELS[phase.phase] || phase.phase}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {STATUS_LABELS[phase.status] || phase.status}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {workflowLoading && !stats?.workflow?.phases && (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Progress Overview */}
                <Card className="lg:col-span-2 flex flex-col justify-center">
                    <CardContent className="flex items-center justify-between p-6 gap-6">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground">Progres Capaian</p>
                            <p className="text-xl font-semibold mt-0.5">
                                {donePhases}/{totalPhases} fase
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {phaseKeys.map((key) => (
                                    <Badge
                                        key={key}
                                        variant={stats.steps[key] ? 'default' : 'secondary'}
                                        className={cn(
                                            'text-[11px] h-5',
                                            stats.steps[key] && 'bg-emerald-500 hover:bg-emerald-500',
                                        )}
                                    >
                                        {PHASE_LABELS[key] || key}
                                    </Badge>
                                ))}
                            </div>

                            <div className="mt-4 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="h-24 w-24 shrink-0 relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-lg font-bold tabular-nums">{progressPercent}%</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'done', value: donePhases },
                                            { name: 'remaining', value: totalPhases - donePhases },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={40}
                                        startAngle={90}
                                        endAngle={-270}
                                        dataKey="value"
                                        cornerRadius={6}
                                        strokeWidth={0}
                                    >
                                        <Cell fill="var(--primary)" />
                                        <Cell fill="var(--muted)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Aksi Cepat</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 pt-0">
                        {!stats.has_group ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-between h-9"
                                    asChild
                                >
                                    <Link href="/mahasiswa/group">
                                        {isSoloSeeker ? 'Cari Kelompok' : 'Buat / Cari Kelompok'}
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-between h-9"
                                    asChild
                                >
                                    <Link href="/mahasiswa/titles">
                                        Jelajahi Judul
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </>
                        ) : isGroupApproved ? (
                            <Button
                                size="sm"
                                className="w-full justify-between h-9"
                                asChild
                            >
                                <Link href="/mahasiswa/documents">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Dokumen
                                    <ArrowRight className="h-4 w-4 ml-auto" />
                                </Link>
                            </Button>
                        ) : (
                            <Button size="sm" className="w-full h-9" variant="secondary" disabled>
                                <Clock className="h-4 w-4 mr-2" />
                                Menunggu Persetujuan
                            </Button>
                        )}
                        <Separator className="my-1" />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start h-9"
                            asChild
                        >
                            <Link href="/mahasiswa/schedule">
                                <Calendar className="h-4 w-4 mr-2" />
                                Jadwal Saya
                            </Link>
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start h-9"
                            asChild
                        >
                            <Link href="/mahasiswa/grades">
                                <GraduationCap className="h-4 w-4 mr-2" />
                                Nilai Saya
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Project Details */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Proyek</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Judul
                            </p>
                            <p
                                className="font-medium text-sm line-clamp-2 leading-snug"
                                title={stats.title || 'Belum ada judul'}
                            >
                                {stats.title || 'Belum ada judul'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Status Grup
                            </p>
                            <Badge
                                variant="outline"
                                className={cn(
                                    'text-xs',
                                    isGroupApproved
                                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                        : String(stats.group_status) === 'REJECTED'
                                          ? 'border-red-300 text-red-700 bg-red-50'
                                          : '',
                                )}
                            >
                                {stats.group_status || 'Tidak Tergabung'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Fase Aktif
                            </p>
                            <p className="text-sm font-medium">
                                {currentPhase
                                    ? PHASE_LABELS[currentPhase] || currentPhase
                                    : stats.is_graduated
                                      ? 'Selesai'
                                      : '—'}
                            </p>
                        </div>
                        <Separator className="!-mx-0" />
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Periode
                            </p>
                            <p className="text-sm font-medium text-primary">
                                {stats.group_period?.name || 'Belum Terdaftar'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Schedules */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Jadwal Mendatang</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {schedules.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {schedules.map((s, i) => (
                                    <div
                                        key={s.id}
                                        className={cn(
                                            'p-3 rounded-lg border',
                                            i === 0
                                                ? 'bg-primary/5 border-primary/20'
                                                : 'bg-muted/30 border-transparent',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'text-[10px] uppercase tracking-wider font-semibold h-5',
                                                    SCHEDULE_COLORS[s.type] || '',
                                                )}
                                            >
                                                {SCHEDULE_LABELS[s.type] || s.type}
                                            </Badge>
                                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                                {s.time_until}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium leading-snug">
                                            {new Date(s.date).toLocaleDateString('id-ID', {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                            <span className="truncate">{s.room}</span>
                                            {s.mode && (
                                                <span className="shrink-0">| {s.mode}</span>
                                            )}
                                        </div>
                                        {s.notes && (
                                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                                {s.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-between"
                                    asChild
                                >
                                    <Link href="/mahasiswa/schedule">
                                        Lihat Semua Jadwal
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">Belum ada jadwal</p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-4 justify-between"
                                    asChild
                                >
                                    <Link href="/mahasiswa/schedule">
                                        Lihat Jadwal
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Next Phase Requirements */}
            {stats?.next_phase_requirements && (
                <Card>
                    <CardHeader
                        className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
                        onClick={() => setShowRequirements(!showRequirements)}
                    >
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Menuju Fase:{' '}
                                {PHASE_LABELS[stats.next_phase_requirements.next_phase] ||
                                    stats.next_phase_requirements.next_phase}
                            </CardTitle>
                            {showRequirements ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                        </div>
                    </CardHeader>
                    {showRequirements && (
                        <CardContent>
                            {workflowLoading ? (
                                <div className="flex justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Documents */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium flex items-center gap-1.5">
                                                <FileCheck className="h-4 w-4 text-muted-foreground" />
                                                Dokumen
                                            </p>
                                            <Badge
                                                variant={
                                                    stats.next_phase_requirements.documents.completed
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                                className={cn(
                                                    'text-xs',
                                                    stats.next_phase_requirements.documents
                                                        .completed && 'bg-emerald-500 hover:bg-emerald-500',
                                                )}
                                            >
                                                {stats.next_phase_requirements.documents.approved_count}/
                                                {stats.next_phase_requirements.documents.total_required}
                                            </Badge>
                                        </div>
                                        {!stats.next_phase_requirements.documents.completed &&
                                            stats.next_phase_requirements.documents.pending_types.length >
                                                0 && (
                                                <p className="text-xs text-muted-foreground pl-6">
                                                    Menunggu:{' '}
                                                    {stats.next_phase_requirements.documents.pending_types.join(
                                                        ', ',
                                                    )}
                                                </p>
                                            )}
                                    </div>

                                    {/* SEMPRO specific */}
                                    {stats.next_phase_requirements.seminar_schedule && (
                                        <div className="space-y-2 border-t pt-4">
                                            {!stats.next_phase_requirements.seminar_schedule.exists ? (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                                    <p className="font-medium">SEMPRO Belum Terjadwal</p>
                                                    <p className="text-amber-700 mt-0.5">
                                                        Hubungi admin untuk menjadwalkan SEMPRO
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span>
                                                            {new Date(
                                                                stats.next_phase_requirements
                                                                    .seminar_schedule.date!,
                                                            ).toLocaleDateString('id-ID', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric',
                                                            })}
                                                        </span>
                                                    </div>

                                                    {stats.next_phase_requirements.seminar_schedule
                                                        .examiner_evaluations && (
                                                        <div className="space-y-1 pl-6">
                                                            <p className="text-xs font-medium">
                                                                Evaluasi Penguji
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {stats.next_phase_requirements.seminar_schedule
                                                                    .examiner_evaluations.submitted}
                                                                /
                                                                {stats.next_phase_requirements.seminar_schedule
                                                                    .examiner_evaluations.total}{' '}
                                                                terkumpul
                                                            </p>
                                                        </div>
                                                    )}

                                                    {stats.next_phase_requirements.seminar_schedule
                                                        .supervisor_bimbingan && (
                                                        <div className="space-y-1 pl-6">
                                                            <p className="text-xs font-medium">
                                                                Bimbingan Pembimbing
                                                            </p>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {stats.next_phase_requirements.seminar_schedule.supervisor_bimbingan.supervisors.map(
                                                                    (sup: SupervisorInEvaluation) => (
                                                                        <Badge
                                                                            key={sup.id}
                                                                            variant={
                                                                                sup.status ===
                                                                                'completed'
                                                                                    ? 'default'
                                                                                    : 'outline'
                                                                            }
                                                                            className={cn(
                                                                                'text-[11px]',
                                                                                sup.status ===
                                                                                    'completed' &&
                                                                                    'bg-emerald-500 hover:bg-emerald-500',
                                                                            )}
                                                                        >
                                                                            {sup.name}:{' '}
                                                                            {sup.submitted_components}/
                                                                            {sup.total_components}
                                                                        </Badge>
                                                                    ),
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Supervisor Evaluations */}
                                    {stats.next_phase_requirements.supervisor_evaluations &&
                                        stats.next_phase_requirements.supervisor_evaluations.length >
                                            0 && (
                                            <div className="space-y-2 border-t pt-4">
                                                <p className="text-sm font-medium flex items-center gap-1.5">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    Evaluasi Pembimbing
                                                </p>
                                                {stats.next_phase_requirements.supervisor_evaluations.map(
                                                    (evalStatus: EvaluationWithSupervisors) => (
                                                        <div
                                                            key={evalStatus.evaluation_type}
                                                            className="space-y-1 pl-6"
                                                        >
                                                            <p className="text-xs font-medium">
                                                                {evalStatus.evaluation_type}
                                                            </p>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {evalStatus.supervisors.map(
                                                                    (sup: SupervisorInEvaluation) => (
                                                                        <Badge
                                                                            key={sup.id}
                                                                            variant={
                                                                                sup.status ===
                                                                                'completed'
                                                                                    ? 'default'
                                                                                    : 'outline'
                                                                            }
                                                                            className={cn(
                                                                                'text-[11px]',
                                                                                sup.status ===
                                                                                    'completed' &&
                                                                                    'bg-emerald-500 hover:bg-emerald-500',
                                                                            )}
                                                                        >
                                                                            {sup.name}:{' '}
                                                                            {sup.submitted_components}/
                                                                            {sup.total_components}
                                                                        </Badge>
                                                                    ),
                                                                )}
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Final TA Readiness Gate */}
            {stats?.final_ready_for_ta_individual && (
                <Card
                    className={cn(
                        stats.final_ready_for_ta_individual.ready &&
                            'border-emerald-300 bg-emerald-50/60',
                    )}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {stats.final_ready_for_ta_individual.ready ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                            Kesiapan TA Individu
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2.5">
                            {/* Expo Documents */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5">
                                    <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                    Dokumen Expo
                                </span>
                                {stats.final_ready_for_ta_individual.expo_documents.completed ? (
                                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500 text-[10px] h-5">
                                        Selesai
                                    </Badge>
                                ) : (
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {stats.final_ready_for_ta_individual.expo_documents.approved_count}/
                                        {stats.final_ready_for_ta_individual.expo_documents.total_required}
                                    </span>
                                )}
                            </div>

                            {/* Evaluations */}
                            {(
                                ['nilai_dosen', 'milestone', 'expo_evaluation'] as Array<
                                    'nilai_dosen' | 'milestone' | 'expo_evaluation'
                                >
                            ).map((key) => {
                                const status = stats.final_ready_for_ta_individual![key];
                                if (!isFinalReadyEvaluationSection(status)) return null;
                                if (!status?.configured) return null;
                                const labels: Record<string, string> = {
                                    nilai_dosen: 'Nilai Dosen',
                                    milestone: 'Milestone',
                                    expo_evaluation: 'Evaluasi Expo',
                                };
                                return (
                                    <div key={key} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-1.5">
                                            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                                            {labels[key]}
                                        </span>
                                        {status.completed ? (
                                            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500 text-[10px] h-5">
                                                Selesai
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {status.supervisors?.filter(
                                                    (s) => s.status === 'completed',
                                                ).length || 0}
                                                /{status.supervisors?.length || 0}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Peer Review */}
                            {stats.final_ready_for_ta_individual.peer_review.configured && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                        Peer Review
                                    </span>
                                    {stats.final_ready_for_ta_individual.peer_review.completed ? (
                                        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500 text-[10px] h-5">
                                            Selesai
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {stats.final_ready_for_ta_individual.peer_review.completed_members}/
                                            {stats.final_ready_for_ta_individual.peer_review.total_members} anggota
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
