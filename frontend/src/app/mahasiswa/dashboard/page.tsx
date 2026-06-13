'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { MahasiswaStats, WorkflowData } from '@/types/dashboard';
import type { Group } from '@/types/group';
import { Loading } from '@/components/ui/loading';
import { StatusGroup } from '@/components/dashboard/StatusGroup';
import { GroupProjectCard } from '@/components/dashboard/GroupProjectCard';
import { MiniScheduleCalendar } from '@/components/dashboard/MiniScheduleCalendar';
import { DocumentUploadTable } from '@/components/dashboard/DocumentUploadTable';
import { QuickAccessCard } from '@/components/dashboard/QuickAccessCard';
import { Bell } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface MiniCalendarEvent {
    id: number | string;
    date: string;
    title: string;
    type: string;
}

export default function MahasiswaDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<MahasiswaStats | null>(null);
    const [group, setGroup] = useState<Group | null>(null);
    const [schedules, setSchedules] = useState<MiniCalendarEvent[]>([]);
    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            // Check registration first
            const periodRes = await api.get('/mahasiswa/my-period');
            const hasRegistration = !!periodRes.data?.period;
            if (!hasRegistration) {
                window.location.href = '/mahasiswa/registration';
                return;
            }
            if (periodRes.data?.auto_registered) {
                toast.success(periodRes.data?.message || 'Anda telah terdaftar otomatis berdasarkan grup yang sudah ada.');
            }

            // Fetch dashboard stats + group + schedules in parallel
            const [statsRes, groupRes, scheduleRes] = await Promise.allSettled([
                api.get('/mahasiswa/dashboard'),
                api.get('/mahasiswa/group').catch(() => null),
                api.get('/mahasiswa/all-schedules').catch(() => null),
            ]);

            let statsData: MahasiswaStats | null = null;

            if (statsRes.status === 'fulfilled') {
                statsData = statsRes.value.data;
                setStats(statsData);

                // Use workflow from /mahasiswa/dashboard response if available
                if (statsData?.workflow?.phases && statsData.workflow.phases.length > 0) {
                    setWorkflow(statsData.workflow);
                }
            }

            if (groupRes.status === 'fulfilled' && groupRes.value) {
                // Backend returns {group: {...}} wrapper — unwrap it
                const raw = groupRes.value.data;
                const groupData = raw?.group || raw;
                setGroup(groupData);
            }

            if (scheduleRes.status === 'fulfilled' && scheduleRes.value) {
                const raw = scheduleRes.value.data?.data || scheduleRes.value.data || [];
                const events: MiniCalendarEvent[] = raw.map((s: {
                    id: number | string;
                    date: string;
                    type: string;
                    student_name?: string;
                    group?: { title?: { title?: string } | null };
                }) => ({
                    id: s.id,
                    date: s.date,
                    title: s.student_name || s.group?.title?.title || s.type,
                    type: s.type,
                }));
                setSchedules(events);
            }

            // Only fetch workflow separately if not provided by /mahasiswa/dashboard
            if (!statsData?.workflow?.phases) {
                try {
                    const workflowRes = await api.get('/mahasiswa/workflow');
                    const wfData = workflowRes.data?.workflow || workflowRes.data;
                    setWorkflow(wfData);
                } catch {
                    // workflow not available yet
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard', error);
            if (api.isAxiosError(error) && error.response?.status === 404) {
                window.location.href = '/mahasiswa/registration';
                return;
            }
            toast.error('Gagal memuat data dashboard. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (loading) return <Loading variant="section" />;

    if (!stats) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">Gagal memuat data dashboard.</p>
            </div>
        );
    }

    // has_group from stats can be unreliable; use actual group data presence
    const hasGroupApproved = !!group?.id && !!group?.status;

    const periodName = stats.group_period?.name || (stats.active_periods?.length > 0 ? stats.active_periods[0].name : 'N/A');

    return (
        <div className="flex flex-col space-y-6">
            

            {/* Greeting */}
            <div>
                <h1 className="text-xl font-semibold text-gray-800">
                    Halo, {user?.name || 'Mahasiswa'}!
                </h1>
            </div>

            {/* Status Group */}
            <StatusGroup
                phases={workflow?.phases}
                currentPhase={workflow?.current_phase}
                periodName={periodName}
            />

            {/* Row 1: Group Project + Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {hasGroupApproved && group ? (
                    <GroupProjectCard
                        group={group}
                        workflow={workflow}
                        title={stats.title}
                    />
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
                        <p className="text-sm text-gray-500">Anda belum memiliki grup yang disetujui.</p>
                        <Link href="/mahasiswa/group">
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary-50">
                                Buat / Cari Kelompok
                            </Badge>
                        </Link>
                    </div>
                )}
                <MiniScheduleCalendar events={schedules} />
            </div>

            {/* Row 2: Upload Document + Akses Cepat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DocumentUploadTable phases={workflow?.phases} />
                </div>
                <div className="lg:col-span-1">
                    <QuickAccessCard />
                </div>
            </div>
        </div>
    );
}
