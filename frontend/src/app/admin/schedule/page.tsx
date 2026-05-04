'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, Users, Plus, Search as SearchIcon, FileText } from 'lucide-react';
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
import Link from 'next/link';

interface Period { id: number; name: string; is_active: boolean; is_finalized?: boolean; }
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

interface Period {
    id: number;
    name: string;
    is_active: boolean;
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
    room: string;
    mode?: 'ONLINE' | 'OFFLINE';
    notes?: string;
    examiners?: number[];
    examiner_1_id?: number;
    examiner_2_id?: number;
}

export default function AdminSchedulePage() {
    const [semproSchedules, setSemproSchedules] = useState<Schedule[]>([]);
    const [expoSchedules, setExpoSchedules] = useState<Schedule[]>([]);
    const [taDefenseSchedules, setTaDefenseSchedules] = useState<TaDefenseSchedule[]>([]);
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
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

    // Approve dialog state
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

    const fetchAll = useCallback(async (periodId?: string) => {
        try {
            const currentPeriod = periodId || selectedPeriod;
            if (!currentPeriod && !periodId) {
                const perRes = await api.get('/admin/periods');
                const perData = perRes.data?.data || [];
                setPeriods(perData);
                const active = perData.find((p: Period) => p.is_active);
                if (active) setSelectedPeriod(active.id.toString());
                return;
            }

            const query = currentPeriod ? `?period_id=${currentPeriod}` : '';
            const [semproRes, expoRes, taRes, groupsRes] = await Promise.all([
                api.get(`/admin/sempro/schedules${query}`),
                api.get(`/admin/expo/schedules${query}`),
                api.get(`/admin/ta-defense-schedules${query}`),
                api.get(`/admin/groups${query}`),
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
    }, [selectedPeriod]);

    const fetchDosens = useCallback(async () => {
        try {
            const res = await api.get('/admin/users');
            const all = res.data.data || [];
            setDosens(all.filter((u: User) => u.role === 'dosen'));
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        if (!selectedPeriod) {
            fetchAll();
        } else {
            fetchAll(selectedPeriod);
        }
    }, [selectedPeriod, fetchAll]);

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

                if (!selectedStudent?.group_id || !selectedPeriod) {
                    toast.error('Pilih periode dan mahasiswa yang valid untuk TA Defense.');
                    return;
                }

                await api.post('/admin/ta-defense-schedules', {
                    student_id: Number(formStudentId),
                    group_id: Number(selectedStudent.group_id),
                    period_id: Number(selectedPeriod),
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
                // Only send examiners for SEMPRO, not EXPO
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

    const statusColor = (s: string) => {
        if (s === 'COMPLETED') return 'default' as const;
        if (s === 'CANCELLED') return 'destructive' as const;
        if (s === 'PENDING_APPROVAL') return 'secondary' as const;
        return 'secondary' as const;
    };

    const handleApprove = async (id: number, type: 'SEMPRO' | 'EXPO' | 'TA_DEFENSE', schedule?: Schedule | TaDefenseSchedule) => {
        // Open approve dialog with schedule data
        setApproveId(id);
        setApproveType(type);
        setApproveData({
            date: schedule?.date || '',
            start_time: schedule?.start_time || '',
            end_time: schedule?.end_time || '',
            room: schedule?.room || '',
            examiner_1_id: (schedule as Schedule)?.examiner1?.id?.toString() || '',
            examiner_2_id: (schedule as Schedule)?.examiner2?.id?.toString() || '',
        });
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
                group_id: 0, // Will be set by the API endpoint
                date: approveData.date,
                start_time: approveData.start_time,
                end_time: approveData.end_time,
                room: approveData.room,
            };
            
            // Only send examiners for SEMPRO and TA_DEFENSE, not EXPO
            if (approveType !== 'EXPO') {
                payload.examiner_1_id = Number(approveData.examiner_1_id);
                payload.examiner_2_id = Number(approveData.examiner_2_id);
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

    const ScheduleCard = ({ s }: { s: Schedule }) => (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium">{s.group?.title?.title || `Group ${s.group_id}`}</CardTitle>
                    <Badge variant={statusColor(s.status)}>{s.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                </div>
                {s.type !== 'EXPO' && (
                    <>
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
                    </>
                )}
                {s.type === 'EXPO' && (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        EXPO: Only supervisor evaluations required
                    </div>
                )}
                <div className="flex gap-2 mt-2">
                    <Link href={`/admin/evaluation-summary/${s.id}`}>
                        <Button size="sm" variant="outline">
                            <FileText className="mr-1 h-3 w-3" />
                            Evaluation Summary
                        </Button>
                    </Link>
                </div>
            </CardContent>
            {s.status === 'PENDING_APPROVAL' && (
                <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(s.id, s.type as 'SEMPRO' | 'EXPO', s)}>Approve</Button>
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
                        <p className="text-xs text-muted-foreground">{s.group?.title?.title || `Group ${s.group?.id}`}</p>
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
                <div className="flex gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                        TA Defense evaluation is handled via Supervisor/Examiner pages
                    </span>
                </div>
            </CardContent>
            {s.status === 'PENDING_APPROVAL' && (
                <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(s.id, 'TA_DEFENSE', s)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectId(s.id); setRejectType('TA_DEFENSE'); }}>Reject</Button>
                </div>
            )}
        </Card>
    );

    if (loading && !selectedPeriod) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const filterSchedules = (list: (Schedule | TaDefenseSchedule)[]) => {
        if (!searchQuery) return list;
        const lowerQuery = searchQuery.toLowerCase();
        return list.filter(item => {
            const group = (item as Schedule).group || (item as TaDefenseSchedule).group;
            const title = group?.title?.title?.toLowerCase() || '';
            const groupId = ((item as Schedule).group_id || group?.id)?.toString() || '';
            const studentName = (item as TaDefenseSchedule).student?.name?.toLowerCase() || '';
            const room = item.room?.toLowerCase() || '';
            const ex1 = (item as Schedule).examiner1?.name?.toLowerCase() || '';
            const ex2 = (item as Schedule).examiner2?.name?.toLowerCase() || '';
            const examinersList = (item as TaDefenseSchedule).examiners?.map((ex) => ex.examiner?.name?.toLowerCase()).join(' ') || '';
            
            return title.includes(lowerQuery) || 
                   groupId.includes(lowerQuery) || 
                   studentName.includes(lowerQuery) || 
                   room.includes(lowerQuery) || 
                   ex1.includes(lowerQuery) || 
                   ex2.includes(lowerQuery) || 
                   examinersList.includes(lowerQuery);
        });
    };

    const displaySempro = filterSchedules(semproSchedules) as Schedule[];
    const displayExpo = filterSchedules(expoSchedules) as Schedule[];
    const displayTa = filterSchedules(taDefenseSchedules) as TaDefenseSchedule[];

    const semproEligible = groups.filter(g => g.status === 'READY_FOR_SEMPRO');
    const expoEligible = groups.filter(g => g.status === 'PDC2_READY_FOR_EXPO');
    const taEligibleStudents = groups
        .filter(g => ['EXPO_DONE', 'TA_IN_PROGRESS'].includes(g.status))
        .flatMap(g => g.members?.map(m => ({ ...m.student, group_id: g.id })) || []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule Management</h1>
                    <p className="text-muted-foreground">Manage SEMPRO, EXPO, and TA Defense schedules.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setScheduleOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Schedule</Button>
                </div>
            </div>

            <div className="relative max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search schedules..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <Tabs defaultValue="sempro">
                <TabsList>
                    <TabsTrigger value="sempro">SEMPRO ({displaySempro.length})</TabsTrigger>
                    <TabsTrigger value="expo">EXPO ({displayExpo.length})</TabsTrigger>
                    <TabsTrigger value="ta">TA Defense ({displayTa.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="sempro" className="space-y-3">
                    {displaySempro.length === 0 ? <p className="text-muted-foreground text-center py-8">No SEMPRO schedules found.</p> : displaySempro.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>
                <TabsContent value="expo" className="space-y-3">
                    {displayExpo.length === 0 ? <p className="text-muted-foreground text-center py-8">No EXPO schedules found.</p> : displayExpo.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>
                <TabsContent value="ta" className="space-y-3">
                    {displayTa.length === 0 ? <p className="text-muted-foreground text-center py-8">No TA Defense schedules found.</p> : displayTa.map(s => <TaDefenseCard key={s.id} s={s} />)}
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
                                                <SelectItem key={g.id} value={g.id.toString()}>{g.title?.title || `Group ${g.id}`}</SelectItem>
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

            {/* Approve Dialog with Examiner Selection */}
            <Dialog open={approveDialogOpen} onOpenChange={(open) => { 
                if (!open) { 
                    setApproveDialogOpen(false); 
                    setApproveId(null);
                }
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
                                <Input 
                                    type="date" 
                                    value={approveData.date} 
                                    onChange={e => setApproveData({...approveData, date: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <Label>Start Time</Label>
                                <Input 
                                    type="time" 
                                    value={approveData.start_time} 
                                    onChange={e => setApproveData({...approveData, start_time: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <Label>End Time</Label>
                                <Input 
                                    type="time" 
                                    value={approveData.end_time} 
                                    onChange={e => setApproveData({...approveData, end_time: e.target.value})} 
                                    required 
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Room</Label>
                            <Input 
                                value={approveData.room} 
                                onChange={e => setApproveData({...approveData, room: e.target.value})} 
                                placeholder="e.g. Lab 301" 
                            />
                        </div>
                        {approveType !== 'EXPO' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label>Examiner 1</Label>
                                    <Select 
                                        value={approveData.examiner_1_id} 
                                        onValueChange={(val) => setApproveData({...approveData, examiner_1_id: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select examiner 1..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dosens.map(d => (
                                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Examiner 2</Label>
                                    <Select 
                                        value={approveData.examiner_2_id} 
                                        onValueChange={(val) => setApproveData({...approveData, examiner_2_id: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select examiner 2..." />
                                        </SelectTrigger>
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
                        <Button 
                            onClick={submitApprove} 
                            disabled={!approveData.date || !approveData.start_time || !approveData.end_time || (approveType !== 'EXPO' && (!approveData.examiner_1_id || !approveData.examiner_2_id))}
                        >
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
