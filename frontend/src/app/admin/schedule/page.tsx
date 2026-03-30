'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

interface Dosen { id: number; name: string; email: string; }
interface Schedule {
    id: number;
    group_id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    examiner1: Dosen;
    examiner2: Dosen;
    group: { id: number; title?: { title: string } };
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

interface TaDefenseSchedule {
    id: number;
    student: { id: number; name: string };
    group: { id: number; title?: { title: string } };
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    examiners: { examiner: Dosen; role: string }[];
    evaluations: { id: number; examiner: Dosen; status: string; score: number | null }[];
}

interface GroupItem { id: number; status: string; title?: { title: string }; members: { student: { id: number; name: string } }[] }

export default function AdminSchedulePage() {
    const [semproSchedules, setSemproSchedules] = useState<Schedule[]>([]);
    const [expoSchedules, setExpoSchedules] = useState<Schedule[]>([]);
    const [taDefenseSchedules, setTaDefenseSchedules] = useState<TaDefenseSchedule[]>([]);
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
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

    const fetchAll = useCallback(async () => {
        try {
            const [semproRes, expoRes, taRes, groupsRes] = await Promise.all([
                api.get('/admin/sempro/schedules'),
                api.get('/admin/expo/schedules'),
                api.get('/admin/ta-defense/schedules'),
                api.get('/admin/groups'),
            ]);
            setSemproSchedules(semproRes.data.data || []);
            setExpoSchedules(expoRes.data.data || []);
            setTaDefenseSchedules(taRes.data.data || []);
            setGroups(groupsRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDosens = useCallback(async () => {
        try {
            const res = await api.get('/admin/users');
            const all = res.data.data || [];
            setDosens(all.filter((u: { role: string }) => u.role === 'dosen'));
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => { fetchAll(); fetchDosens(); }, [fetchAll, fetchDosens]);

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
                await api.post('/admin/ta-defense/schedule', {
                    student_id: Number(formStudentId),
                    date: formDate, start_time: formStartTime, end_time: formEndTime,
                    room: formRoom || null,
                    examiner_1_id: Number(formExaminer1), examiner_2_id: Number(formExaminer2),
                });
            } else {
                const endpoint = scheduleType === 'SEMPRO' ? '/admin/sempro/schedule' : '/admin/expo/schedule';
                await api.post(endpoint, {
                    group_id: Number(formGroupId),
                    date: formDate, start_time: formStartTime, end_time: formEndTime,
                    room: formRoom || null,
                    examiner_1_id: Number(formExaminer1), examiner_2_id: Number(formExaminer2),
                });
            }
            toast.success(`${scheduleType} scheduled!`);
            setScheduleOpen(false); resetForm(); fetchAll();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const msg = error.response?.data?.message || 'Scheduling failed.';
                const conflicts = error.response?.data?.conflicts;
                toast.error(conflicts ? `${msg}\n${conflicts.join('\n')}` : msg);
            } else { toast.error('Scheduling failed.'); }
        } finally { setSubmitting(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'COMPLETED') return 'default' as const;
        if (s === 'CANCELLED') return 'destructive' as const;
        if (s === 'PENDING_APPROVAL') return 'secondary' as const;
        return 'secondary' as const;
    };

    const handleApprove = async (id: number, type: 'SEMPRO' | 'EXPO' | 'TA_DEFENSE') => {
        try {
            const endpoint = type === 'TA_DEFENSE'
                ? `/admin/ta-defense/schedules/${id}/approve`
                : type === 'SEMPRO'
                    ? `/admin/sempro/schedules/${id}/approve`
                    : `/admin/expo/schedules/${id}/approve`;
            await api.put(endpoint);
            toast.success(`${type} schedule approved!`);
            fetchAll();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const msg = error.response?.data?.message || 'Approval failed.';
                const conflicts = error.response?.data?.conflicts;
                toast.error(conflicts ? `${msg}\n${conflicts.join('\n')}` : msg);
            } else { toast.error('Approval failed.'); }
        }
    };

    const handleReject = async () => {
        if (!rejectId || !rejectReason.trim()) return;
        try {
            const endpoint = rejectType === 'TA_DEFENSE'
                ? `/admin/ta-defense/schedules/${rejectId}/reject`
                : rejectType === 'SEMPRO'
                    ? `/admin/sempro/schedules/${rejectId}/reject`
                    : `/admin/expo/schedules/${rejectId}/reject`;
            await api.put(endpoint, { rejection_reason: rejectReason });
            toast.success('Schedule request rejected.');
            setRejectId(null); setRejectReason('');
            fetchAll();
        } catch (error) {
            toast.error('Rejection failed.');
        }
    };

    const ScheduleCard = ({ s }: { s: Schedule }) => (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium">{s.group?.title?.title || `Group #${s.group_id}`}</CardTitle>
                    <Badge variant={statusColor(s.status)}>{s.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Examiners: {s.examiner1?.name}, {s.examiner2?.name}</span>
                </div>
                <div className="flex gap-2 mt-1">
                    {s.evaluations?.map(ev => (
                        <Badge key={ev.id} variant={ev.status === 'SUBMITTED' ? 'default' : 'outline'}>
                            {ev.examiner?.name}: {ev.status === 'SUBMITTED' ? `${ev.score}` : 'PENDING'}
                        </Badge>
                    ))}
                </div>
            </CardContent>
            {s.status === 'PENDING_APPROVAL' && (
                <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(s.id, s.type as 'SEMPRO' | 'EXPO')}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectId(s.id); setRejectType(s.type as 'SEMPRO' | 'EXPO'); }}>Reject</Button>
                </div>
            )}
        </Card>
    );

    const TaDefenseCard = ({ s }: { s: TaDefenseSchedule }) => (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-medium">{s.student?.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{s.group?.title?.title || `Group #${s.group?.id}`}</p>
                    </div>
                    <Badge variant={statusColor(s.status)}>{s.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                    {s.examiners?.map((ex, i) => (
                        <Badge key={i} variant="outline">{ex.role}: {ex.examiner?.name}</Badge>
                    ))}
                </div>
                <div className="flex gap-2 mt-1">
                    {s.evaluations?.map(ev => (
                        <Badge key={ev.id} variant={ev.status === 'SUBMITTED' ? 'default' : 'outline'}>
                            {ev.examiner?.name}: {ev.status === 'SUBMITTED' ? `${ev.score}` : 'PENDING'}
                        </Badge>
                    ))}
                </div>
            </CardContent>
            {s.status === 'PENDING_APPROVAL' && (
                <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(s.id, 'TA_DEFENSE')}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectId(s.id); setRejectType('TA_DEFENSE'); }}>Reject</Button>
                </div>
            )}
        </Card>
    );

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const semproEligible = groups.filter(g => g.status === 'READY_FOR_SEMPRO');
    const expoEligible = groups.filter(g => g.status === 'PDC2_READY_FOR_EXPO');
    const taEligibleStudents = groups
        .filter(g => ['EXPO_DONE', 'TA_IN_PROGRESS'].includes(g.status))
        .flatMap(g => g.members?.map(m => ({ ...m.student, group_id: g.id })) || []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule Management</h1>
                    <p className="text-muted-foreground">Manage SEMPRO, EXPO, and TA Defense schedules.</p>
                </div>
                <Button onClick={() => setScheduleOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Schedule</Button>
            </div>

            <Tabs defaultValue="sempro">
                <TabsList>
                    <TabsTrigger value="sempro">SEMPRO ({semproSchedules.length})</TabsTrigger>
                    <TabsTrigger value="expo">EXPO ({expoSchedules.length})</TabsTrigger>
                    <TabsTrigger value="ta">TA Defense ({taDefenseSchedules.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="sempro" className="space-y-3">
                    {semproSchedules.length === 0 ? <p className="text-muted-foreground text-center py-8">No SEMPRO schedules.</p> : semproSchedules.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>
                <TabsContent value="expo" className="space-y-3">
                    {expoSchedules.length === 0 ? <p className="text-muted-foreground text-center py-8">No EXPO schedules.</p> : expoSchedules.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>
                <TabsContent value="ta" className="space-y-3">
                    {taDefenseSchedules.length === 0 ? <p className="text-muted-foreground text-center py-8">No TA Defense schedules.</p> : taDefenseSchedules.map(s => <TaDefenseCard key={s.id} s={s} />)}
                </TabsContent>
            </Tabs>

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
                                    <Label>Group</Label>
                                    <Select value={formGroupId} onValueChange={setFormGroupId}>
                                        <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                                        <SelectContent>
                                            {(scheduleType === 'SEMPRO' ? semproEligible : expoEligible).map(g => (
                                                <SelectItem key={g.id} value={g.id.toString()}>{g.title?.title || `Group #${g.id}`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label>Student</Label>
                                    <Select value={formStudentId} onValueChange={setFormStudentId}>
                                        <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                                        <SelectContent>
                                            {taEligibleStudents.map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                            ))}
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
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setScheduleOpen(false); resetForm(); }}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Scheduling...' : 'Create Schedule'}</Button>
                        </DialogFooter>
                    </form>
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
