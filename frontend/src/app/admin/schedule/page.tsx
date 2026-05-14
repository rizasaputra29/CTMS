'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import ScheduleCalendar, { ScheduleEvent } from '@/components/schedule/ScheduleCalendar';

interface Period { id: number; name: string; is_active: boolean; is_finalized?: boolean; }
interface Dosen { id: number; name: string; email: string; }

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
    group: {
        id: number;
        code?: string;
        title?: { title: string };
        period?: { id: number; name: string };
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

interface GroupItem {
    id: number;
    code?: string;
    status: string;
    title?: { title: string };
    members: { student: { id: number; name: string } }[];
    period?: { id: number; name: string };
    period_id?: number;
}

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface SchedulePayload {
    group_id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status?: string;
    mode?: 'ONLINE' | 'OFFLINE';
    notes?: string;
    examiners?: number[];
    examiner_1_id?: number;
    examiner_2_id?: number;
}

export default function AdminSchedulePage() {
    const [semproSchedules, setSemproSchedules] = useState<ApiSchedule[]>([]);
    const [expoSchedules, setExpoSchedules] = useState<ApiSchedule[]>([]);
    const [taDefenseSchedules, setTaDefenseSchedules] = useState<ApiTaDefenseSchedule[]>([]);
    const [bimbinganSchedules, setBimbinganSchedules] = useState<ApiSchedule[]>([]);
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);

    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduleType, setScheduleType] = useState<'SEMPRO' | 'EXPO' | 'TA_DEFENSE'>('SEMPRO');
    const [formGroupId, setFormGroupId] = useState('');
    const [formStudentId, setFormStudentId] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('');
    const [formEndTime, setFormEndTime] = useState('');
    const [formRoom, setFormRoom] = useState('');
    const [formExaminer1, setFormExaminer1] = useState('');
    const [formExaminer2, setFormExaminer2] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [rejectId, setRejectId] = useState<number | null>(null);
    const [rejectType, setRejectType] = useState<'SEMPRO' | 'EXPO' | 'TA_DEFENSE'>('SEMPRO');
    const [rejectReason, setRejectReason] = useState('');

    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [approveId, setApproveId] = useState<number | null>(null);
    const [approveType, setApproveType] = useState<'SEMPRO' | 'EXPO' | 'TA_DEFENSE'>('SEMPRO');
    const [approveData, setApproveData] = useState<{
        date: string;
        start_time: string;
        end_time: string;
        room: string;
        examiner_1_id: string;
        examiner_2_id: string;
    }>({
        date: '',
        start_time: '',
        end_time: '',
        room: '',
        examiner_1_id: '',
        examiner_2_id: '',
    });

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const perRes = await api.get('/admin/periods');
            const perData: Period[] = perRes.data?.data || [];
            setPeriods(perData);

            const [semproRes, expoRes, taRes, groupsRes, bimbinganRes] = await Promise.all([
                api.get('/admin/sempro/schedules'),
                api.get('/admin/expo/schedules'),
                api.get('/admin/ta-defense-schedules'),
                api.get('/admin/groups'),
                api.get('/admin/schedules'),
            ]);

            setSemproSchedules(semproRes.data.data || []);
            setExpoSchedules(expoRes.data.data || []);
            setTaDefenseSchedules(taRes.data.data || []);
            setGroups(groupsRes.data.data || []);
            setBimbinganSchedules(bimbinganRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Derive calendar events from raw schedules
    const allSchedules = useMemo((): ScheduleEvent[] => {
        const mapped: ScheduleEvent[] = [];

        for (const s of [...semproSchedules, ...expoSchedules]) {
            mapped.push({
                id: s.id,
                group_id: s.group_id,
                type: s.type as 'SEMPRO' | 'EXPO',
                date: `${s.date}T${s.start_time}`,
                room: s.room || '',
                status: s.status,
                period_name: s.group?.period?.name || '',
                examiner1: s.examiner1 ? { name: s.examiner1.name } : null,
                examiner2: s.examiner2 ? { name: s.examiner2.name } : null,
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                    members: [],
                },
            });
        }

        for (const s of taDefenseSchedules) {
            mapped.push({
                id: `ta_${s.id}`,
                group_id: s.group.id,
                student_id: s.student?.id,
                type: 'TA_DEFENSE',
                date: `${s.date}T${s.start_time}`,
                room: s.room || '',
                status: s.status,
                period_name: s.period?.name || '',
                student_name: s.student?.name,
                examiners: s.examiners?.map(e => ({
                    name: e.examiner?.name,
                    role: e.role,
                })) || [],
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                    members: [],
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
                period_name: s.group?.period?.name || '',
                group: {
                    title: s.group?.title ? { title: s.group.title.title } : null,
                    members: [],
                },
            });
        }

        return mapped;
    }, [semproSchedules, expoSchedules, taDefenseSchedules, bimbinganSchedules]);

    const fetchDosens = useCallback(async () => {
        try {
            const res = await api.get('/admin/users');
            const all: User[] = res.data.data || [];
            setDosens(all.filter((u: User) => u.role === 'dosen'));
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { fetchDosens(); }, [fetchDosens]);

    const resetForm = () => {
        setFormGroupId(''); setFormStudentId(''); setFormDate('');
        setFormStartTime(''); setFormEndTime(''); setFormRoom('');
        setFormExaminer1(''); setFormExaminer2('');
    };

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (scheduleType === 'TA_DEFENSE') {
                const selectedStudent = taEligibleStudents.find(
                    (student) => student.id.toString() === formStudentId
                );
                if (!selectedStudent?.group_id || !selectedStudent?.period_id) {
                    toast.error('Pilih mahasiswa yang valid untuk TA Defense.');
                    return;
                }
                await api.post('/admin/ta-defense-schedules', {
                    student_id: Number(formStudentId),
                    group_id: Number(selectedStudent.group_id),
                    period_id: Number(selectedStudent.period_id),
                    date: formDate, start_time: formStartTime, end_time: formEndTime,
                    room: formRoom || null,
                    examiner_1_id: Number(formExaminer1), examiner_2_id: Number(formExaminer2),
                });
            } else {
                const endpoint = scheduleType === 'SEMPRO' ? '/admin/sempro/schedule' : '/admin/expo/schedule';
                const payload: SchedulePayload = {
                    group_id: Number(formGroupId),
                    date: formDate, start_time: formStartTime, end_time: formEndTime,
                    room: formRoom || null,
                };
                if (scheduleType === 'SEMPRO') {
                    payload.examiner_1_id = Number(formExaminer1);
                    payload.examiner_2_id = Number(formExaminer2);
                }
                await api.post(endpoint, payload);
            }
            toast.success(`${scheduleType} scheduled!`);
            setScheduleOpen(false); resetForm(); fetchAll();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const msg = error.response?.data?.message || 'Scheduling failed.';
                const conflicts = error.response?.data?.conflicts;
                toast.error(conflicts ? `${msg}\n${conflicts.join('\n')}` : msg);
            } else { toast.error('Scheduling failed.'); }
        } finally { setSubmitting(false); }
    };

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

        const schedule = rawSchedule as ApiSchedule;
        const taSchedule = rawSchedule as ApiTaDefenseSchedule;

        setApproveId(rawId);
        setApproveType(scheduleType);

        if (scheduleType === 'TA_DEFENSE') {
            setApproveData({
                date: taSchedule.date,
                start_time: taSchedule.start_time,
                end_time: taSchedule.end_time,
                room: taSchedule.room || '',
                examiner_1_id: taSchedule.examiners?.[0]?.examiner?.id?.toString() || '',
                examiner_2_id: taSchedule.examiners?.[1]?.examiner?.id?.toString() || '',
            });
        } else {
            setApproveData({
                date: schedule.date,
                start_time: schedule.start_time || '',
                end_time: schedule.end_time || '',
                room: schedule.room || '',
                examiner_1_id: schedule.examiner1?.id?.toString() || '',
                examiner_2_id: schedule.examiner2?.id?.toString() || '',
            });
        }
        setApproveDialogOpen(true);
    };

    const submitApprove = async () => {
        if (!approveId) return;
        try {
            const endpoint = approveType === 'TA_DEFENSE'
                ? `/admin/ta-defense-schedules/${approveId}`
                : approveType === 'SEMPRO'
                    ? `/admin/sempro/schedules/${approveId}/approve`
                    : `/admin/expo/schedules/${approveId}/approve`;

            const payload: SchedulePayload = {
                group_id: 0,
                date: approveData.date,
                start_time: approveData.start_time,
                end_time: approveData.end_time,
                room: approveData.room,
            };

            if (approveType !== 'EXPO') {
                payload.examiner_1_id = Number(approveData.examiner_1_id);
                payload.examiner_2_id = Number(approveData.examiner_2_id);
            }

            if (approveType === 'TA_DEFENSE') {
                payload.status = 'SCHEDULED';
            }

            await api.put(endpoint, payload);
            toast.success(`${approveType} schedule approved!`);
            setApproveDialogOpen(false);
            setApproveId(null);
            fetchAll();
        } catch (error) {
            if (api.isAxiosError(error)) {
                const msg = error.response?.data?.message || 'Approval failed.';
                const conflicts = error.response?.data?.conflicts;
                toast.error(conflicts ? `${msg}\n${conflicts.join('\n')}` : msg);
            } else { toast.error('Approval failed.'); }
        }
    };

    const handleRejectClick = (sid: number | string, type: string) => {
        const id = typeof sid === 'string' && sid.startsWith('ta_')
            ? Number(sid.substring(3))
            : Number(sid);
        setRejectId(id);
        setRejectType(type as 'SEMPRO' | 'EXPO' | 'TA_DEFENSE');
        setRejectReason('');
    };

    const handleReject = async () => {
        if (!rejectId || !rejectReason.trim()) return;
        try {
            const endpoint = rejectType === 'TA_DEFENSE'
                ? `/admin/ta-defense-schedules/${rejectId}/cancel`
                : rejectType === 'SEMPRO'
                    ? `/admin/sempro/schedules/${rejectId}/reject`
                    : `/admin/expo/schedules/${rejectId}/reject`;
            if (rejectType === 'TA_DEFENSE') {
                await api.put(endpoint);
            } else {
                await api.put(endpoint, { rejection_reason: rejectReason });
            }
            toast.success('Schedule request rejected.');
            setRejectId(null); setRejectReason('');
            fetchAll();
        } catch {
            toast.error('Rejection failed.');
        }
    };

    const semproEligible = groups.filter(g => g.status === 'READY_FOR_SEMPRO');
    const expoEligible = groups.filter(g => g.status === 'PDC2_READY_FOR_EXPO');
    const taEligibleStudents = groups
        .filter(g => ['EXPO_DONE', 'TA_IN_PROGRESS'].includes(g.status))
        .flatMap(g => g.members?.map(m => ({
            ...m.student,
            group_id: g.id,
            period_id: g.period_id || g.period?.id,
        })) || []);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule Management</h1>
                    <p className="text-muted-foreground">View all schedules across all periods.</p>
                </div>
                <div>
                    <Button onClick={() => setScheduleOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New Schedule
                    </Button>
                </div>
            </div>

            <ScheduleCalendar
                schedules={allSchedules}
                canEdit={false}
                onApprove={handleApprove}
                onReject={handleRejectClick}
            />

            {/* Create Schedule Dialog */}
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleSchedule}>
                        <DialogHeader>
                            <DialogTitle>Create Schedule</DialogTitle>
                            <DialogDescription>Schedule a SEMPRO, EXPO, or TA Defense session.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Schedule Type</Label>
                                <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as 'SEMPRO' | 'EXPO' | 'TA_DEFENSE')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SEMPRO">SEMPRO</SelectItem>
                                        <SelectItem value="EXPO">EXPO</SelectItem>
                                        <SelectItem value="TA_DEFENSE">TA Defense</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {scheduleType !== 'TA_DEFENSE' ? (
                                <div className="grid gap-2">
                                    <Label>Group (all periods)</Label>
                                    <Select value={formGroupId} onValueChange={setFormGroupId}>
                                        <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                                        <SelectContent>
                                            {(scheduleType === 'SEMPRO' ? semproEligible : expoEligible).map(g => (
                                                <SelectItem key={g.id} value={g.id.toString()}>
                                                    {g.title?.title || g.code || `Group ${g.id}`}
                                                    {g.period?.name ? ` — ${g.period.name}` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label>Student (all periods)</Label>
                                    <Select value={formStudentId} onValueChange={setFormStudentId}>
                                        <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                                        <SelectContent>
                                            {taEligibleStudents.map(s => {
                                                const periodName = periods.find(p => p.id === s.period_id)?.name || '';
                                                return (
                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                        {s.name}{periodName ? ` — ${periodName}` : ''}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <div><Label>Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required /></div>
                                <div><Label>Start</Label><Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} required /></div>
                                <div><Label>End</Label><Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} required /></div>
                            </div>
                            <div className="grid gap-2"><Label>Room</Label><Input value={formRoom} onChange={e => setFormRoom(e.target.value)} placeholder="e.g. Lab 301" /></div>
                            {scheduleType !== 'EXPO' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label>Examiner 1</Label>
                                        <Select value={formExaminer1} onValueChange={setFormExaminer1}>
                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>{dosens.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Examiner 2</Label>
                                        <Select value={formExaminer2} onValueChange={setFormExaminer2}>
                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>{dosens.filter(d => d.id.toString() !== formExaminer1).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                            {scheduleType === 'EXPO' && (
                                <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                    Note: EXPO schedules do not require examiners. Only supervisor evaluations are needed.
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setScheduleOpen(false); resetForm(); }}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Scheduling...' : 'Create Schedule'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={(open) => {
                if (!open) { setApproveDialogOpen(false); setApproveId(null); }
            }}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Approve {approveType} Schedule</DialogTitle>
                        <DialogDescription>Set schedule details and assign examiners.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <Label>Date</Label>
                                <Input type="date" value={approveData.date}
                                    onChange={e => setApproveData({ ...approveData, date: e.target.value })} required />
                            </div>
                            <div>
                                <Label>Start Time</Label>
                                <Input type="time" value={approveData.start_time}
                                    onChange={e => setApproveData({ ...approveData, start_time: e.target.value })} required />
                            </div>
                            <div>
                                <Label>End Time</Label>
                                <Input type="time" value={approveData.end_time}
                                    onChange={e => setApproveData({ ...approveData, end_time: e.target.value })} required />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Room</Label>
                            <Input value={approveData.room}
                                onChange={e => setApproveData({ ...approveData, room: e.target.value })} placeholder="e.g. Lab 301" />
                        </div>
                        {approveType !== 'EXPO' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label>Examiner 1</Label>
                                    <Select value={approveData.examiner_1_id}
                                        onValueChange={(val) => setApproveData({ ...approveData, examiner_1_id: val })}>
                                        <SelectTrigger><SelectValue placeholder="Select examiner 1..." /></SelectTrigger>
                                        <SelectContent>
                                            {dosens.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Examiner 2</Label>
                                    <Select value={approveData.examiner_2_id}
                                        onValueChange={(val) => setApproveData({ ...approveData, examiner_2_id: val })}>
                                        <SelectTrigger><SelectValue placeholder="Select examiner 2..." /></SelectTrigger>
                                        <SelectContent>
                                            {dosens.filter(d => d.id.toString() !== approveData.examiner_1_id).map(d => (
                                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        {approveType === 'EXPO' && (
                            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                Note: EXPO schedules do not require examiners. Only supervisor evaluations are needed.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setApproveId(null); }}>Cancel</Button>
                        <Button onClick={submitApprove}
                            disabled={!approveData.date || !approveData.start_time || !approveData.end_time || (approveType !== 'EXPO' && (!approveData.examiner_1_id || !approveData.examiner_2_id))}>
                            Approve Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectId !== null} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason(''); } }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Reject Schedule Request</DialogTitle>
                        <DialogDescription>Provide a reason for rejection.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Reason</Label>
                        <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Time conflict, wrong examiner..." />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
