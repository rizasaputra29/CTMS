'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Loader2, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ScheduleCalendar, { type ScheduleEvent } from '@/components/schedule/ScheduleCalendar';
import { ViewToggle } from '@/components/schedule/ViewToggle';
import { PeriodFilter } from '@/components/schedule/PeriodFilter';
import { ScheduleExport } from '@/components/schedule/ScheduleExport';
import { ScheduleTable } from '@/components/schedule/ScheduleTable';
import { ScheduleDetailModal } from '@/components/schedule/ScheduleDetailModal';
import Link from 'next/link';

interface Period {
    id: number;
    name: string;
    is_active: boolean;
    is_finalized?: boolean;
}

interface Dosen {
    id: number;
    name: string;
    email: string;
}

interface ApiSchedule {
    id: number;
    group_id: number;
    type: string;
    date: string;
    start_time?: string;
    end_time?: string;
    room: string | null;
    status: string;
    mode?: string;
    notes?: string;
    examiner1?: Dosen;
    examiner2?: Dosen;
    requested_by?: number;
    rejection_reason?: string;
    online_link?: string;
    group: {
        id: number;
        title?: { title: string };
        period?: { id: number; name: string };
        supervisor?: Dosen;
    };
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

interface ApiTaDefenseSchedule {
    id: number;
    student: { id: number; name: string };
    group: { id: number; title?: { title: string } };
    period?: { id: number; name: string };
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    examiners: { examiner: Dosen; role: string }[];
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

export default function AdminSchedulePage() {
    const [semproSchedules, setSemproSchedules] = useState<ApiSchedule[]>([]);
    const [expoSchedules, setExpoSchedules] = useState<ApiSchedule[]>([]);
    const [taDefenseSchedules, setTaDefenseSchedules] = useState<ApiTaDefenseSchedule[]>([]);
    const [bimbinganSchedules, setBimbinganSchedules] = useState<ApiSchedule[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // View and filter states
    const [view, setView] = useState<'calendar' | 'table'>('calendar');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    // Detail modal state
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [perRes, semproRes, expoRes, taRes, bimbinganRes] = await Promise.all([
                api.get('/admin/periods'),
                api.get('/admin/sempro/schedules'),
                api.get('/admin/expo/schedules'),
                api.get('/admin/ta-defense-schedules'),
                api.get('/admin/schedules'),
            ]);

            setPeriods(perRes.data?.data || []);
            setSemproSchedules(semproRes.data.data || []);
            setExpoSchedules(expoRes.data.data || []);
            setTaDefenseSchedules(taRes.data.data || []);
            setBimbinganSchedules(bimbinganRes.data.data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load schedules');
        } finally {
            setLoading(false);
        }
    }, []);

    // Derive calendar events from raw schedules
    const allSchedules = useMemo((): ScheduleEvent[] => {
        const mapped: ScheduleEvent[] = [];

        for (const s of [...semproSchedules, ...expoSchedules]) {
            // Validate date and time before constructing
            if (!s.date) continue; // Skip schedules without dates
            
            const dateStr = s.start_time 
                ? `${s.date}T${s.start_time}` 
                : `${s.date}T00:00:00`;
                
            mapped.push({
                id: s.id,
                group_id: s.group_id,
                type: s.type as 'SEMPRO' | 'EXPO',
                date: dateStr,
                room: s.room || '',
                status: s.status,
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.group?.period?.name || '',
                examiner1: s.examiner1 ? { name: s.examiner1.name } : null,
                examiner2: s.examiner2 ? { name: s.examiner2.name } : null,
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                    members: [],
                },
                online_link: s.online_link ?? null,
                notes: s.notes ?? null,
            });
        }

        for (const s of taDefenseSchedules) {
            // Validate date and time before constructing
            if (!s.date) continue; // Skip schedules without dates
            
            const dateStr = s.start_time 
                ? `${s.date}T${s.start_time}` 
                : `${s.date}T00:00:00`;
                
            mapped.push({
                id: `ta_${s.id}`,
                group_id: s.group.id,
                student_id: s.student?.id,
                type: 'TA_DEFENSE',
                date: dateStr,
                room: s.room || '',
                status: s.status,
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.period?.name || '',
                student_name: s.student?.name,
                examiner1: s.examiners?.[0]?.examiner ? { name: s.examiners[0].examiner.name } : null,
                examiner2: s.examiners?.[1]?.examiner ? { name: s.examiners[1].examiner.name } : null,
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                },
            });
        }

        for (const s of bimbinganSchedules) {
            mapped.push({
                id: `bim_${s.id}`,
                group_id: s.group_id,
                type: 'BIMBINGAN',
                date: s.date,
                room: s.room || '',
                mode: s.mode || '',
                notes: s.notes || '',
                status: s.status || 'SCHEDULED',
                start_time: s.start_time || '',
                end_time: s.end_time || '',
                period_name: s.group?.period?.name || '',
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                },
            });
        }

        return mapped;
    }, [semproSchedules, expoSchedules, taDefenseSchedules, bimbinganSchedules]);

    // Filter schedules by period
    const filteredSchedules = useMemo(() => {
        if (selectedPeriod === 'all') {
            return allSchedules;
        }
        return allSchedules.filter(s => s.period_name === periods.find(p => p.id.toString() === selectedPeriod)?.name);
    }, [allSchedules, selectedPeriod, periods]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleApprove = async (sid: number | string, type: string) => {
        const scheduleType = type as 'SEMPRO' | 'EXPO' | 'TA_DEFENSE';

        let rawId: number;
        let rawSchedule: ApiSchedule | ApiTaDefenseSchedule | undefined;

        if (typeof sid === 'string' && sid.startsWith('ta_')) {
            rawId = Number(sid.substring(3));
            rawSchedule = taDefenseSchedules.find(s => s.id === rawId);
        } else {
            rawId = Number(sid);
            rawSchedule = [...semproSchedules, ...expoSchedules].find(s => s.id === rawId);
        }

        if (!rawSchedule) return;

        setIsProcessing(true);
        try {
            const endpoint = scheduleType === 'TA_DEFENSE'
                ? `/admin/ta-defense-schedules/${rawId}`
                : scheduleType === 'SEMPRO'
                    ? `/admin/sempro/schedules/${rawId}/approve`
                    : `/admin/expo/schedules/${rawId}/approve`;

            if (scheduleType === 'TA_DEFENSE') {
                await api.put(endpoint, {
                    status: 'SCHEDULED',
                    date: (rawSchedule as ApiTaDefenseSchedule).date,
                    start_time: (rawSchedule as ApiTaDefenseSchedule).start_time,
                    end_time: (rawSchedule as ApiTaDefenseSchedule).end_time,
                    room: (rawSchedule as ApiTaDefenseSchedule).room,
                    examiner_1_id: (rawSchedule as ApiTaDefenseSchedule).examiners?.[0]?.examiner?.id,
                    examiner_2_id: (rawSchedule as ApiTaDefenseSchedule).examiners?.[1]?.examiner?.id,
                });
            } else {
                await api.put(endpoint, {
                    date: (rawSchedule as ApiSchedule).date,
                    start_time: (rawSchedule as ApiSchedule).start_time,
                    end_time: (rawSchedule as ApiSchedule).end_time,
                    room: (rawSchedule as ApiSchedule).room,
                    examiner_1_id: (rawSchedule as ApiSchedule).examiner1?.id,
                    examiner_2_id: (rawSchedule as ApiSchedule).examiner2?.id,
                });
            }

            toast.success(`${scheduleType} schedule approved!`);
            fetchAll();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const msg = error.response?.data?.message || 'Approval failed.';
                const conflicts = error.response?.data?.conflicts;
                toast.error(conflicts ? `${msg}\n${conflicts.join('\n')}` : msg);
            } else {
                toast.error('Approval failed.');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (sid: number | string, type: string, reason: string) => {
        const id = typeof sid === 'string' && sid.startsWith('ta_')
            ? Number(sid.substring(3))
            : Number(sid);

        setIsProcessing(true);
        try {
            const endpoint = type === 'TA_DEFENSE'
                ? `/admin/ta-defense-schedules/${id}/cancel`
                : type === 'SEMPRO'
                    ? `/admin/sempro/schedules/${id}/reject`
                    : `/admin/expo/schedules/${id}/reject`;

            if (type === 'TA_DEFENSE') {
                await api.put(endpoint, { rejection_reason: reason });
            } else {
                await api.put(endpoint, { rejection_reason: reason });
            }

            toast.success('Schedule request rejected.');
            fetchAll();
        } catch {
            toast.error('Rejection failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRowClick = (schedule: ScheduleEvent) => {
        setSelectedSchedule(schedule);
        setDetailOpen(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Schedule Dashboard</h1>
                        <p className="text-muted-foreground">
                            View all schedules across all periods. Select a period to filter.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/sempro">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New SEMPRO
                            </Button>
                        </Link>
                        <Link href="/admin/expo">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New EXPO
                            </Button>
                        </Link>
                        <Link href="/admin/ta-defense">
                            <Button variant="outline" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                New TA Defense
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-wrap items-center gap-4">
                        <ViewToggle value={view} onChange={setView} />
                        <PeriodFilter
                            periods={periods}
                            value={selectedPeriod}
                            onChange={setSelectedPeriod}
                        />
                    </div>
                    <ScheduleExport
                        schedules={allSchedules}
                        filteredSchedules={filteredSchedules}
                    />
                </div>
            </div>

            {view === 'calendar' ? (
                <ScheduleCalendar
                    schedules={filteredSchedules}
                    canEdit={false}
                    onApprove={handleApprove}
                    onReject={(_id, _type) => {
                        // This is handled in calendar differently - we'll just toast
                        toast.info('Use table view for quick actions');
                    }}
                />
            ) : (
                <ScheduleTable
                    schedules={filteredSchedules}
                    onRowClick={handleRowClick}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isProcessing={isProcessing}
                />
            )}

            <ScheduleDetailModal
                schedule={selectedSchedule}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </div>
    );
}
